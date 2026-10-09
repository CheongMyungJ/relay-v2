// 요구사항 추출 extract의 run 루프 (requirements-extraction-flow.md 15.2~15.4, 결정 4·6·7·24~42·92~99, 17.12).
// extract task는 자기 CLI 세션이 없다. 이 루프가 단위 하나씩 claude -p run을 돌리고, 성공한 결과를 불변 revision으로 쓴 뒤
// work.json의 포인터를 machine 이벤트(requirements.updated)로 바꾼다. 루프는 Work의 처리 줄 밖에서 돌고(run 하나가 몇 분이다),
// 상태를 바꿀 때만 처리 줄에 이벤트를 넣는다. [즉시 중단]은 처리 줄 안에서 오므로 루프를 기다리지 않고 중단 신호만 보낸다.
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  IntegrityError,
  RequirementsFiles,
  type OutputReader,
  assembleRun,
  baseReader,
  resultProblems,
  runExtract,
  worktreeFingerprint,
} from '../adapters/requirements'
import { inventoryProblems } from '../../../skills/extract/build-index.mjs'
import { buildConfigIndex } from '../adapters/build-index'
import { fileHash, jsonText, writeFileAtomic } from '../adapters/store'
import type { HookServer } from '../adapters/hooks'
import { currentTask, type MachineEvent } from '../core/machine'
import {
  afterRun,
  anchorsOf,
  answerRevision,
  applyResult,
  buildIndexRevision,
  buildIndexWork,
  buildPacket,
  closeRevision,
  configsOf,
  emptyPointer,
  fold,
  isPartial,
  judgeRun,
  openDecisions,
  partialRevision,
  pickUnit,
  renderExtraction,
  renderHandoff,
  repoPath,
  rewindRevision,
  rewoundPointer,
  runId,
  runLimit,
  runRow,
  scheduleRevision,
  scopeRevision,
  startRevision,
  surveyInventory,
  withoutRun,
  type RunEnd,
} from '../core/requirements'
import type {
  ActiveRun,
  Answer,
  ExtractResult,
  HaltReason,
  PendingAnswer,
  RequirementsBudget,
  RequirementsPointer,
  RequirementsState,
  UnitState,
} from '../shared/requirements'
import type { CheckSummary, WorkState } from '../shared/work'
import type { RequirementsRunView } from '../shared/views'

/** 루프가 Work에 바라는 것 */
export interface ExtractHost {
  /** 지금 work.json 상태 */
  work(): WorkState
  workDir: string
  /** 분석 대상 worktree */
  worktree: string
  env: NodeJS.ProcessEnv
  hooks: HookServer
  /** skills/의 부모(지시 원본, 결정 9) */
  skillsRoot: string
  at(): string
  /** Work의 처리 줄에서 machine 이벤트를 넣는다 */
  feed(event: MachineEvent): Promise<void>
  /** Work의 처리 줄에서 그때의 work.json으로 이벤트를 만들어 넣는다 */
  feedWith(make: (work: WorkState) => MachineEvent): Promise<void>
  /** 승인된 intent 본문(머리글 없이) */
  intent(): Promise<string>
  /** task 디렉터리 */
  taskDir(taskId: string): string
  /** 그 task의 형식 검사 */
  check(taskId: string): Promise<CheckSummary>
  /** run의 모델과 추론 수준 */
  agent(taskId: string): { model: string; effort?: string }
  /** claude 실행 파일. 없으면 null */
  bin(): string | null
  /** 세션 상한의 자리 (D18): run 하나가 자리 하나를 쓴다(15.2) */
  acquire(): boolean
  release(): void
  budget(): RequirementsBudget
  problem(message: string): void
  /** 화면을 다시 그리게 한다 */
  changed(): void
}

/** 화면에 보일 지금 run */
export interface CurrentRun {
  run: string
  unit: string
  startedAt: number
  tool: string | null
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const t = setTimeout(done, ms)
    function done() {
      signal.removeEventListener('abort', done)
      clearTimeout(t)
      resolve()
    }
    signal.addEventListener('abort', done)
  })

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

export class ExtractRunner {
  private abort: AbortController | null = null
  private loop: Promise<void> | null = null
  /** 지금 루프가 돌리는 task */
  private loopTask: string | null = null
  /** 지금 도는 run (화면용) */
  current: CurrentRun | null = null
  /** 마지막으로 접은 기록 (화면용) */
  state: RequirementsState | null = null
  /** 반영 대기 사람 답의 내용 (화면용) */
  pending: Answer[] = []
  /** 끝난 run의 목록 (화면용, AI 결정 115) */
  runs: RequirementsRunView[] = []

  constructor(private readonly host: ExtractHost) {}

  get running(): boolean {
    return this.loop !== null
  }

  /**
   * 루프를 시작한다. 같은 task의 루프가 돌면 그대로 둔다. 멈추라고 알린 루프나 다른 task의 루프가 남아 있으면 그것을 멈추고
   * 끝나기를 기다린 뒤 새로 시작한다 (결정 120): [즉시 중단] 바로 뒤의 [재개], 되감기로 연 새 extract
   */
  start(taskId: string): void {
    if (this.loop && this.loopTask === taskId && !this.abort?.signal.aborted) return
    const previous = this.loop
    this.abort?.abort()
    const abort = new AbortController()
    this.abort = abort
    this.loopTask = taskId
    const loop: Promise<void> = (previous ?? Promise.resolve())
      .then(() => (abort.signal.aborted ? undefined : this.run(taskId, abort.signal)))
      .finally(() => {
        if (this.loop !== loop) return
        this.loop = null
        this.abort = null
        this.loopTask = null
        this.current = null
        this.host.changed()
      })
    this.loop = loop
  }

  /** 도는 run을 끝내라고 알린다. 기다리지 않는다(처리 줄 안에서 부른다) */
  stop(): void {
    this.abort?.abort()
  }

  /** 루프가 끝나기를 기다린다 (앱 종료) */
  async settled(): Promise<void> {
    await this.loop
  }

  /** 기록을 다시 읽어 화면용 상태를 채운다 */
  async refresh(): Promise<void> {
    const p = this.host.work().requirements
    if (!p || p.revision === 0) return
    try {
      const files = new RequirementsFiles(this.host.workDir)
      this.state = fold(await files.load(p))
      this.pending = (
        await Promise.all((p.pending_answers ?? []).map((a) => files.readAnswers(a)))
      ).flat()
      await this.readRuns(files)
    } catch (e) {
      this.host.problem(`요구사항 추출 기록을 읽지 못함: ${message(e)}`)
    }
  }

  /** run 기록 폴더의 run.json들을 run 목록으로 (AI 결정 115) */
  private async readRuns(files: RequirementsFiles): Promise<void> {
    const names = await fsp.readdir(files.runs).catch(() => [] as string[])
    const rows: RequirementsRunView[] = []
    for (const n of names.filter((x) => /^r-\d{4,}$/.test(x)).sort()) {
      const text = await fsp
        .readFile(path.join(files.runDir(n), 'run.json'), 'utf8')
        .catch(() => null)
      if (text === null) continue
      try {
        const row = runRow(JSON.parse(text))
        if (row) rows.push(row)
      } catch {
        // 읽지 못한 run.json은 목록에서 뺀다
      }
    }
    this.runs = rows
  }

  /**
   * [범위 줄이고 계속] (결정 26, AI 결정 114): 고른 열린 단위를 범위에서 빼는 사람 revision을 쓰고, 늘린 run 수를 더한 포인터를
   * 돌려준다. Work의 처리 줄 안에서 루프가 멈춘 동안 부른다
   */
  async narrow(
    p: RequirementsPointer,
    units: string[],
    note: string,
    extend: number,
  ): Promise<{ pointer: RequirementsPointer; units: string[] }> {
    const files = new RequirementsFiles(this.host.workDir)
    const state = fold(await files.load(p))
    const r = scopeRevision(state, p.next, units, note, this.host.at())
    if (!r.units.length) return { pointer: p, units: [] }
    const hash = await files.writeRevision(r.revision)
    return {
      pointer: {
        ...p,
        revision: r.revision.number,
        revision_hash: hash,
        next: r.next,
        runs_extra: p.runs_extra + extend,
      },
      units: r.units,
    }
  }

  /** [부분 분석으로 넘기기] (결정 26, AI 결정 114): 열린 단위를 보류로 닫고 summarize 단위를 여는 revision */
  async partial(p: RequirementsPointer): Promise<RequirementsPointer> {
    const files = new RequirementsFiles(this.host.workDir)
    const state = fold(await files.load(p))
    const r = partialRevision(state, p.next, this.host.at())
    const hash = await files.writeRevision(r.revision)
    return { ...p, revision: r.revision.number, revision_hash: hash, next: r.next }
  }

  /**
   * 사람 결정 필요의 답 (결정 41): 불변 파일로 쓰고 포인터의 반영 대기에 둔다. 루프가 다음 run을 띄우기 전에(멈췄으면
   * [재개] 뒤에) revision으로 만든다
   */
  async answer(taskId: string, answers: Answer[]): Promise<void> {
    const files = new RequirementsFiles(this.host.workDir)
    const pending = await files.writeAnswers(answers, this.host.at())
    // 루프의 포인터 갱신과 엇갈려도 답이 사라지지 않게 처리 줄에서 그때의 포인터에 더한다
    await this.host.feedWith((w) => {
      const p = w.requirements ?? emptyPointer()
      return {
        type: 'requirements.updated',
        taskId,
        at: this.host.at(),
        pointer: { ...p, pending_answers: [...(p.pending_answers ?? []), pending] },
      }
    })
    await this.refresh()
    this.host.changed()
  }

  private async halt(taskId: string, reason: HaltReason, detail: string, clearStopAfter = false) {
    await this.host.feed({
      type: 'extract.halted',
      taskId,
      at: this.host.at(),
      halt: { at: this.host.at(), reason, detail },
      ...(clearStopAfter ? { clearStopAfter } : {}),
    })
  }

  /**
   * 포인터를 바꾼다. 반영 대기 답은 처리 줄에서 그때의 포인터 것을 이어받고, consumed(이번에 revision으로 만든 답)만
   * 뺀다. 루프가 포인터를 읽은 뒤 사람이 답해도 답이 사라지지 않는다 (결정 41)
   */
  private async setPointer(
    taskId: string,
    pointer: RequirementsPointer,
    log?: Record<string, unknown>,
    consumed: readonly PendingAnswer[] = [],
  ) {
    const { pending_answers: _mine, ...own } = pointer
    void _mine
    // 포인터는 그 계보를 돌리는 task를 적는다 (결정 120)
    const rest = { ...own, task: taskId }
    await this.host.feedWith((w) => {
      const pending = (w.requirements?.pending_answers ?? []).filter(
        (a) => !consumed.some((c) => c.file === a.file),
      )
      return {
        type: 'requirements.updated',
        taskId,
        at: this.host.at(),
        pointer: pending.length ? { ...rest, pending_answers: pending } : rest,
        ...(log ? { log } : {}),
      }
    })
  }

  /** 지금 task가 이 extract이고 돌고 있는가 */
  private live(taskId: string): boolean {
    const task = currentTask(this.host.work())
    return !!task && task.id === taskId && task.status === 'working'
  }

  private async run(taskId: string, signal: AbortSignal): Promise<void> {
    const files = new RequirementsFiles(this.host.workDir)
    let ranOnce = false
    try {
      // 처음이면 survey 단위 하나로 시작한다 (결정 95)
      const first = this.host.work().requirements
      if (!first || first.revision === 0) {
        const base = first ?? emptyPointer()
        const { revision, next } = startRevision(base.next, this.host.at())
        const hash = await files.writeRevision(revision)
        await this.setPointer(taskId, {
          ...base,
          revision: revision.number,
          revision_hash: hash,
          next,
        })
      } else if (first.task !== undefined && first.task !== taskId) {
        // 다른 extract task의 계보: 되감기로 연 task면 이어서나 처음부터 (결정 120)
        const task = this.host.work().tasks.find((t) => t.id === taskId)
        const before = fold(await files.load(first))
        const { revision, next } = rewindRevision(before, first.next, {
          keep: task?.selection?.keep_code === true,
          instruction: task?.selection?.instruction ?? null,
          at: this.host.at(),
          parent: first.revision,
        })
        const hash = await files.writeRevision(revision)
        await this.setPointer(
          taskId,
          {
            ...rewoundPointer(first, taskId),
            revision: revision.number,
            revision_hash: hash,
            next,
          },
          undefined,
          first.pending_answers ?? [],
        )
      }
      while (!signal.aborted && this.live(taskId)) {
        const work = this.host.work()
        const p = work.requirements
        if (!p) return
        // 반영 대기 사람 답부터 revision으로 (결정 41). 답으로 다시 볼 끝난 단위를 같은 revision에서 연다 (결정 103)
        if (p.pending_answers?.length) {
          const answers = (
            await Promise.all(p.pending_answers.map((a) => files.readAnswers(a)))
          ).flat()
          const before = fold(await files.load(p))
          const { revision, next } = answerRevision(before, p.next, answers, this.host.at())
          const hash = await files.writeRevision(revision)
          await this.setPointer(
            taskId,
            { ...p, revision: revision.number, revision_hash: hash, next },
            undefined,
            p.pending_answers,
          )
          continue
        }
        const state = fold(await files.load(p))
        this.state = state
        this.host.changed()
        // 열린 사람 결정 수는 포인터에도 둔다: 배지와 알림이 work.json만 본다 (AI 결정 116)
        const openCount = openDecisions(state).length
        if ((p.open_decisions ?? 0) !== openCount) {
          await this.setPointer(taskId, { ...p, open_decisions: openCount })
          continue
        }
        // 5시간 창 사용량 한도: 재설정까지 기다렸다 같은 단위부터 (결정 29)
        if (p.usage_wait) {
          const wait = Date.parse(p.usage_wait.until) - Date.now()
          if (wait > 0) await sleep(wait, signal)
          if (signal.aborted) return
          const { usage_wait: _w, ...rest } = p
          void _w
          await this.setPointer(taskId, rest)
          continue
        }
        // [이 단계 끝나면 멈춤]: 지금 run이 끝나면 멈춘다 (17.12 사람 결정)
        if (ranOnce && work.stop_after_step) {
          await this.halt(taskId, 'human', '이 단계 끝나면 멈춤', true)
          return
        }
        // 구성별 빌드 인덱스 (AI 결정 118): 사람이 답한 뒤 한 번. run을 쓰지 않는다
        const building = buildIndexWork(state)
        if (building) {
          await this.buildIndex(taskId, p, state, building, files, signal)
          if (signal.aborted) return
          continue
        }
        // 앱이 만드는 단위: integrate(주기, 마지막), summarize (AI 결정 111, 113). run을 쓰지 않는다
        const scheduled = scheduleRevision(state, p.next, this.host.at())
        if (scheduled) {
          const hash = await files.writeRevision(scheduled.revision)
          await this.setPointer(taskId, {
            ...p,
            revision: scheduled.revision.number,
            revision_hash: hash,
            next: scheduled.next,
          })
          continue
        }
        const budget = this.host.budget()
        const pick = pickUnit(state)
        // 부분 분석의 summarize 하나는 상한 밖에서 돈다 (결정 26, AI 결정 114)
        const outside = pick.unit?.kind === 'summarize' && isPartial(state)
        if (pick.unit && !outside && p.runs_used >= runLimit(p, budget)) {
          await this.halt(taskId, 'run_limit', `run 상한 ${runLimit(p, budget)}에 닿음`)
          return
        }
        if (!pick.unit) {
          const open = openDecisions(state)
          // 부분 분석은 답하지 않은 결정을 "답 없음"으로 남기고 끝낸다 (AI 결정 114)
          if (open.length && !isPartial(state)) {
            await this.halt(
              taskId,
              'decisions',
              `사람 결정 필요 ${open.length}건에 답해야 이어서 돈다`,
            )
            return
          }
          await this.finish(taskId, state)
          return
        }
        await this.runOne(taskId, work, p, state, pick.unit, files, signal)
        ranOnce = true
      }
    } catch (e) {
      const integrity = e instanceof IntegrityError
      this.host.problem(`요구사항 추출: ${message(e)}`)
      if (this.live(taskId))
        await this.halt(taskId, integrity ? 'integrity' : 'launch', message(e)).catch(() => {})
    }
  }

  /**
   * 구성별 빌드 인덱스 (AI 결정 118): 허용이면 별도 체크아웃에서 만들고 지금 survey의 목록을 검사해, 문제가 있으면 survey를
   * 그 문제와 함께 다시 연다. 거절이면 그 까닭만 남긴다. 멈추라고 하면 쓰지 않고 돌아간다(재개하면 다시 만든다)
   */
  private async buildIndex(
    taskId: string,
    p: RequirementsPointer,
    state: RequirementsState,
    work: NonNullable<ReturnType<typeof buildIndexWork>>,
    files: RequirementsFiles,
    signal: AbortSignal,
  ): Promise<void> {
    const host = this.host
    let entry: Parameters<typeof buildIndexRevision>[3]
    if (work.kind === 'denied') {
      entry = {
        status: 'denied',
        configs: [],
        file: null,
        detail: `사람이 허용하지 않음: ${work.answer}`,
        problems: [],
      }
    } else {
      const survey = [...state.units].reverse().find((u) => u.kind === 'survey')
      this.current = {
        run: '빌드 인덱스',
        unit: survey?.id ?? '',
        startedAt: Date.now(),
        tool: null,
      }
      host.changed()
      const out = await buildConfigIndex({
        worktree: host.worktree,
        base: host.work().base_commit,
        dir: files.buildCheckout,
        targets: work.targets,
        env: host.env,
      }).finally(() => {
        this.current = null
      })
      if (signal.aborted) return
      const file = out.index ? await files.writeBuildIndex(out.index) : null
      entry = {
        status: out.status,
        configs: out.configs,
        file,
        detail: out.detail,
        problems: out.index ? inventoryProblems(surveyInventory(state), out.index) : [],
      }
    }
    const r = buildIndexRevision(state, p.next, host.at(), entry)
    const hash = await files.writeRevision(r.revision)
    await this.setPointer(
      taskId,
      { ...p, revision: r.revision.number, revision_hash: hash, next: r.next },
      { build_index: entry.status, reopened: r.reopened },
    )
  }

  /** run 하나 (15.3): 띄우고, 판정하고, 성공하면 반영한다 */
  private async runOne(
    taskId: string,
    work: WorkState,
    p: RequirementsPointer,
    state: RequirementsState,
    unit: UnitState,
    files: RequirementsFiles,
    signal: AbortSignal,
  ): Promise<void> {
    const host = this.host
    const bin = host.bin()
    if (!bin) {
      await this.halt(taskId, 'launch', 'claude 실행 파일을 찾지 못함')
      return
    }
    // 세션 상한의 자리 (D18, 15.2): 날 때까지 기다린다
    while (!host.acquire()) {
      await sleep(3_000, signal)
      if (signal.aborted || !this.live(taskId)) return
    }
    const id = runId(p.next.run)
    try {
      const budget = host.budget()
      // integrate의 기록 목록은 run 디렉터리의 읽기 전용 파일이다 (AI 결정 109)
      const listingPath = path.join(files.runDir(id), 'record-listing.md')
      const built = buildPacket({
        unit,
        state,
        intent: await host.intent(),
        repo: host.worktree,
        base: work.base_commit,
        scratch: files.scratchDir(id),
        budget,
        listingPath,
      })
      const packet = built.packet
      if (built.listing !== null) {
        await fsp.mkdir(files.runDir(id), { recursive: true })
        await writeFileAtomic(listingPath, built.listing)
      }
      const assembled = assembleRun(host.skillsRoot, unit.kind, unit.lens, built.keys)
      const active: ActiveRun = {
        id,
        unit: unit.id,
        pid: null,
        started_at: host.at(),
        input_revision: p.revision,
        // 패킷 해시는 기록 목록까지 덮는다
        hashes: { packet: fileHash(packet + (built.listing ?? '')), ...assembled.hashes },
      }
      let pointer: RequirementsPointer = {
        ...p,
        next: { ...p.next, run: p.next.run + 1 },
        run: active,
      }
      await this.setPointer(taskId, pointer)
      const before = await worktreeFingerprint(host.worktree)
      const reader = baseReader(host.worktree, work.base_commit)
      const surveyConfigs = configsOf(state).map((c) => String(c.name))
      // 기록의 전역 ID와 주장의 절 (규칙 global_refs, link_shape)
      const ids = [
        ...state.units.map((u) => u.id),
        ...state.claims.map((c) => c.id),
        ...state.decisions.map((d) => d.id),
      ]
      const sections = Object.fromEntries(state.claims.map((c) => [c.id, c.section]))
      const outputsOf = { run: id, worktree: host.worktree }
      // 빌드 인덱스가 있으면 survey의 제출을 config_active로도 검사한다(되돌림 2회까지, 반영 검사에는 넣지 않는다, AI 결정 118)
      const index =
        unit.kind === 'survey' && state.build_index?.status === 'built' && state.build_index.file
          ? await files.readBuildIndex(state.build_index.file)
          : null
      // 실행 출력 파일: 제출마다 새로 읽는다(되돌린 뒤 run이 고칠 수 있다). 반영 검사는 사본과 같은 reader를 쓴다 (결정 101)
      const ctxFor = (output: unknown, outputs: OutputReader = files.outputReader(outputsOf)) => {
        const own = (output as { configs?: { name?: unknown }[] } | null)?.configs
        const configs =
          unit.kind === 'survey'
            ? Array.isArray(own)
              ? own.map((c) => String(c.name))
              : undefined
            : surveyConfigs.length
              ? surveyConfigs
              : undefined
        return {
          repo: host.worktree,
          read: reader.read,
          readOutput: outputs.read,
          kind: unit.kind,
          ...(configs ? { configs } : {}),
          ...(unit.kind === 'integrate' || unit.kind === 'summarize' ? { ids, sections } : {}),
        }
      }
      const { model, effort } = host.agent(taskId)
      this.current = { run: id, unit: unit.id, startedAt: Date.now(), tool: null }
      host.changed()
      const out = await runExtract({
        run: id,
        bin,
        env: host.env,
        files,
        repo: host.worktree,
        packet,
        assembled,
        hooks: host.hooks,
        model,
        effort,
        softMs: budget.soft_minutes * 60_000,
        hardMs: budget.hard_minutes * 60_000,
        submitCheck: (o) => resultProblems(o, { ...ctxFor(o), ...(index ? { build: index } : {}) }),
        onSpawn: async (pid, processStartedAt) => {
          pointer = {
            ...pointer,
            run: {
              ...active,
              pid,
              ...(processStartedAt ? { process_started_at: processStartedAt } : {}),
            },
          }
          await this.setPointer(taskId, pointer)
        },
        onTool: (tool) => {
          if (this.current) this.current.tool = tool
          host.changed()
        },
        signal,
      })
      this.current = null
      const after = await worktreeFingerprint(host.worktree)
      const outputs = files.outputReader(outputsOf)
      const applyProblems =
        out.output && out.schemaValid
          ? await resultProblems(out.output, ctxFor(out.output, outputs))
          : []
      const latest = host.work().requirements ?? pointer
      const verdict = judgeRun({
        stoppedByApp: out.stoppedByApp,
        timedOut: out.timedOut,
        exitCode: out.exitCode,
        result: out.result,
        schemaValid: out.schemaValid,
        lastStop: out.lastStop,
        usageLimit: out.usageLimit,
        worktreeChanged: before !== after,
        inputRevision: active.input_revision,
        currentRevision: latest.revision,
        applyProblems,
      })
      let next: RequirementsPointer = { ...latest }
      let end: RunEnd
      let warnings: string[] = []
      if (verdict.ok && out.output) {
        const blobs: Record<string, string | null> = {}
        for (const { anchor } of anchorsOf(out.output)) {
          if (anchor.kind !== 'code' && anchor.kind !== 'doc_claim') continue
          const rel = repoPath(anchor.path, host.worktree)
          if (!(rel in blobs)) blobs[rel] = await reader.blob(rel)
        }
        // 실행 출력 근거는 scratch 밖의 불변 사본으로 (결정 42)
        const kept = await files.keepOutputs(out.output, outputsOf, outputs)
        if (kept.missing.length)
          warnings.push(`실행 출력 파일을 찾지 못함: ${kept.missing.join(', ')}`)
        const applied = applyResult({
          state,
          next: next.next,
          unit,
          run: id,
          result: kept.result as ExtractResult,
          base: work.base_commit,
          repo: host.worktree,
          blobs,
          at: host.at(),
        })
        const hash = await files.writeRevision(applied.revision)
        next = {
          ...next,
          revision: applied.revision.number,
          revision_hash: hash,
          next: applied.next,
        }
        end = applied.closed ? 'closed' : 'incomplete'
        warnings = [...warnings, ...applied.warnings]
      } else end = verdict.ok ? 'failed' : verdict.end
      const streak = afterRun(next, unit.id, end, budget)
      next = streak.pointer
      // 부분 분석의 summarize는 한 번만 돈다: 실패하면 바로 끝낸다 (AI 결정 113, 114)
      if (unit.kind === 'summarize' && isPartial(state) && end === 'failed' && !streak.close)
        streak.close = 'failed'
      if (streak.close) {
        const reason =
          streak.close === 'failed'
            ? `같은 항목 연속 실패 ${budget.unit_failures}회`
            : `같은 항목 연속 미완료 ${budget.unit_incompletes}회`
        const c = closeRevision(
          next.next,
          unit.id,
          streak.close,
          reason,
          unit.checkpoint,
          host.at(),
        )
        const hash = await files.writeRevision(c.revision)
        next = { ...next, revision: c.revision.number, revision_hash: hash, next: c.next }
      }
      next = withoutRun(next)
      if (!verdict.ok && verdict.waitUntil)
        next = {
          ...next,
          usage_wait: { until: new Date(verdict.waitUntil * 1000).toISOString(), unit: unit.id },
        }
      const failure = verdict.ok ? null : verdict.failure
      await writeFileAtomic(
        path.join(files.runDir(id), 'run.json'),
        jsonText({
          id,
          unit: unit.id,
          kind: unit.kind,
          lens: unit.lens,
          input_revision: active.input_revision,
          hashes: active.hashes,
          started_at: active.started_at,
          ms: out.ms,
          exit_code: out.exitCode,
          failure,
          end,
          schema_errors: out.schemaErrors,
          apply_problems: applyProblems,
          submits: out.submits,
          soft_deadline_hit: out.softDeadlineHit,
          cost_usd: out.result?.total_cost_usd ?? null,
          warnings,
          model,
          effort: effort ?? null,
        }),
      )
      await this.setPointer(taskId, next, {
        run: id,
        unit: unit.id,
        result: failure ?? end,
        denials: out.submits.filter((s) => s.denied).length,
      })
      await this.readRuns(files)
      const halt = (!verdict.ok ? verdict.halt : undefined) ?? streak.halt
      if (halt && this.live(taskId)) {
        const detail =
          halt === 'source_changed'
            ? `run ${id}이 분석 대상 worktree를 바꿈`
            : halt === 'failures'
              ? `연속 실패 ${budget.failures_in_row}회`
              : halt === 'usage_weekly'
                ? '주간 사용량 한도'
                : (failure ?? '')
        await this.halt(taskId, halt, detail)
      }
    } finally {
      this.current = null
      host.release()
    }
  }

  /** 열린 단위와 열린 결정이 없다: extraction.md와 handoff.md를 렌더링하고 승인 대기로 (결정 99) */
  private async finish(taskId: string, state: RequirementsState): Promise<void> {
    const dir = this.host.taskDir(taskId)
    await fsp.mkdir(dir, { recursive: true })
    await writeFileAtomic(
      path.join(dir, 'extraction.md'),
      renderExtraction(state, this.host.work().base_commit),
    )
    await writeFileAtomic(path.join(dir, 'handoff.md'), renderHandoff(state))
    const check = await this.host.check(taskId)
    await this.host.feed({ type: 'extract.finished', taskId, at: this.host.at(), check })
  }
}
