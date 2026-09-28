// [흐름] 재시작과 복구 (docs/implementation.md M6, 시나리오 9, D76, D91, D121~D126, I33).
// 앱이 도중에 꺼진 모습은 그때 앱이 썼을 work.json과 git 상태로 만든다: work.json은 core의 전이로 만들고(앱이
// 명령을 받아 쓴 것), git은 끊긴 곳까지 한 일(백업, push, stash, 반쯤 지운 worktree)을 손으로 한다. 다시 켜면
// 무엇이 어디서 끊겼는지 패널에 알리고, [다시 시도]와 [무시]가 각각 끝까지 간다. 앱이 충돌한 뒤 살아남은 claude의
// 자리는 분리해 띄운 프로세스 트리다: 기록과 시작 시각이 같으면 트리째 끝내고 알리며, 다르면 건드리지 않는다.
// 앱 밖에서 바뀐 앱 소유 파일과 work.json은 알린다. 잘린 pty.log는 경고 없이 남은 만큼 보인다.
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBackup, stashAll } from '../../src/adapters/git'
import {
  isAlive,
  killOrphans,
  listProcesses,
  processStartTime,
  processTree,
  type ProcessInfo,
  type ProcessRecord,
} from '../../src/adapters/pty'
import { WorkFiles, fileHash, jsonText } from '../../src/adapters/store'
import { planClean } from '../../src/core/cleanup'
import { stashMessage } from '../../src/core/delivery'
import { transition, type MachineEvent } from '../../src/core/machine'
import { localIso } from '../../src/core/records'
import { CUT_ERROR, OPERATION_BLOCKS } from '../../src/core/recovery'
import { backupMessage } from '../../src/core/rewind'
import { checkTask, type TaskCheck } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { CleanInput, WorkView } from '../../src/shared/views'
import type { LifecycleEvent, RewindOperation, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import {
  git,
  harness,
  makeRepo,
  register,
  settle,
  sleep,
  writeFiles,
  type Harness,
} from './harness'
import { REPO_FILES, REQUEST, handoff, scenario, steps, type Scenario } from './scenarios'

let h: Harness | undefined
/** 시험이 띄운 자식 프로세스와, 그 트리의 ID와 시작 시각. 시험이 실패해도 남기지 않는다 */
const children: ChildProcess[] = []
const recorded: ProcessRecord[] = []

afterEach(async () => {
  // ID만으로 끝내지 않는다: 이미 끝난 프로세스의 ID는 다른 프로세스가 곧 다시 쓸 수 있다(Windows, A77).
  // 자식은 핸들로, 트리는 ID와 시작 시각으로 끝낸다
  for (const child of children.splice(0)) child.kill('SIGKILL')
  await killOrphans(recorded.splice(0))
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 테스트 레포의 origin을 GitHub 주소로 두고 push는 로컬 bare 원격으로 간다 (pushurl). PR을 만드는 시험이 쓴다 */
const GITHUB = 'https://github.com/relay-test/sample.git'
/** 앱이 충돌한 뒤 살아남은 claude의 자리: 자식 하나를 띄우고 살아 있는다 */
const TREE = path.resolve(__dirname, '../fixtures/tree.mjs')
/** 프로세스 목록과 시작 시각을 읽는 OS (I20, I33) */
const listing = process.platform === 'win32' || process.platform === 'linux'

interface WorkPaths {
  key: string
  /** Work 디렉터리 */
  dir: string
  /** worktree */
  tree: string
  workId: string
  branch: string
}

interface Setup extends WorkPaths {
  h: Harness
  projectId: string
  repo: string
  remote: string
}

async function newWork(hh: Harness, projectId: string): Promise<WorkPaths> {
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
  const workId = r.workKey.split('/')[1] ?? ''
  return {
    key: r.workKey,
    dir: path.join(hh.home, 'projects', projectId, 'works', workId),
    tree: path.join(hh.home, 'projects', projectId, 'worktrees', workId),
    workId,
    branch: `relay/${workId}`,
  }
}

async function setup(s: Scenario, o: { github?: boolean } = {}): Promise<Setup> {
  h = await harness({ scenario: s })
  const hh = h
  const { repo, remote } = makeRepo(hh.root, 'sample', REPO_FILES)
  if (o.github) {
    git(repo, 'remote', 'set-url', 'origin', GITHUB)
    git(repo, 'remote', 'set-url', '--push', 'origin', remote)
  }
  const projectId = await register(hh, repo)
  return { h: hh, projectId, repo, remote, ...(await newWork(hh, projectId)) }
}

const workOf = (w: WorkPaths) => JSON.parse(read(path.join(w.dir, 'work.json'))) as WorkState

function eventsOf(w: WorkPaths): LifecycleEvent[] {
  return read(path.join(w.dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

/** 지금 Work 스냅샷 */
function view(hh: Harness, w: WorkPaths): WorkView {
  const v = hh.relay.snapshot().works.find((x) => x.key === w.key)
  if (!v) throw new Error(`${w.key} 없음`)
  return v
}

/** 이 Work의 되감기 백업 브랜치 (D115) */
const backups = (s: Setup) =>
  git(s.repo, 'for-each-ref', '--format=%(refname:short)', `refs/heads/${s.branch}-discarded-*`)
    .split('\n')
    .filter(Boolean)

/** S 경로(intake → fix → review → verify)로 최종 검증이 승인 대기가 될 때까지 간다 */
async function toVerify(s: Setup): Promise<void> {
  const r = await drive(s.h.relay, s.h.ui, s.key, {
    size: 'S',
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused', reason: '04 최종 검증: 승인 대기' })
  await settle(s.h, s.key)
}

/** verify가 fix를 추천해 멈추는 S 경로 (D23). 되감기 시험이 여기서 시작한다 */
function recommendFix(): Scenario {
  const recommending = steps('verify', 'S').map((st) =>
    st.do === 'write' && st.file === 'handoff.md'
      ? { ...st, text: handoff({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } }) }
      : st,
  )
  return { tasks: { ...scenario('S').tasks, 't-04': recommending } }
}

async function toStopped(s: Setup): Promise<void> {
  const r = await drive(s.h.relay, s.h.ui, s.key, { size: 'S' })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'stopped' })
  await settle(s.h, s.key)
}

// ---------- 충돌 흉내 ----------

const at = () => localIso(new Date())

/** core의 전이: 앱이 명령을 받아 git 작업을 하기 전에 쓴 work.json이다 */
function step(work: WorkState, event: MachineEvent): WorkState {
  const t = transition(work, event, DEFAULT_CONFIG)
  if (t.rejected) throw new Error(t.rejected)
  return t.work
}

/** 앱이 꺼지기 직전의 work.json과 events.jsonl. 그 뒤에 앱이 쓴 것은 충돌로 남지 않는다 */
interface Before {
  work: WorkState
  events: string
}

async function before(hh: Harness, w: WorkPaths): Promise<Before> {
  await settle(hh, w.key)
  return { work: workOf(w), events: read(path.join(w.dir, 'events.jsonl')) }
}

/**
 * 앱이 충돌한 것처럼 다시 켠다. 앱을 끄고(세션은 끝난다) Work마다 work.json과 events.jsonl을 충돌 때의 것으로
 * 둔 뒤, meanwhile(꺼진 동안의 일)을 하고 켠다
 */
async function crash(
  hh: Harness,
  works: readonly { w: WorkPaths; work: WorkState; events: string }[],
  meanwhile?: () => void,
): Promise<void> {
  await hh.relay.close()
  for (const { w } of works) await settle(hh, w.key)
  for (const { w, work, events } of works) {
    fs.writeFileSync(path.join(w.dir, 'work.json'), jsonText(work))
    fs.writeFileSync(path.join(w.dir, 'events.jsonl'), events)
  }
  meanwhile?.()
  await hh.reopen()
  for (const { w } of works) await settle(hh, w.key)
}

/** 지금 task의 형식 검사: main이 전달 명령에 넣는 것 */
async function checkOf(w: WorkPaths, work: WorkState, taskId: string): Promise<TaskCheck> {
  const task = work.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`${taskId} 없음`)
  return checkTask({
    node: task.node,
    size: work.intent?.size,
    files: await new WorkFiles(w.dir).taskFiles(task),
    config: DEFAULT_CONFIG,
    formatVersion: task.format_version,
  })
}

/** [단계 선택]의 [확인]으로 fix로 되감는 명령을 받은 work.json (D77의 backup 단계) */
async function rewindStarted(
  s: Setup,
  b: Before,
): Promise<{ rewinding: WorkState; op: RewindOperation & { backup_branch: string } }> {
  const p = await s.h.relay.stepPreview(s.key, 'fix', false)
  if (!p.ok) throw new Error(p.error)
  const rewinding = step(b.work, {
    type: 'selectStep',
    at: at(),
    node: 'fix',
    keepCode: false,
    instruction: '빈 배열 검사를 다시 보세요',
    expect: p.preview.expect,
    backups: [],
  })
  const op = rewinding.operation
  if (op?.kind !== 'rewind' || op.stage !== 'backup' || !op.backup_branch) {
    throw new Error('되감기 기록이 없음')
  }
  return { rewinding, op: { ...op, backup_branch: op.backup_branch } }
}

/** [Work 정리]의 [정리]를 받은 work.json (D77의 worktree 단계) */
async function cleanStarted(s: Setup, b: Before, input: Omit<CleanInput, 'expect'>) {
  const r = await s.h.relay.cleanPreview(s.key)
  if (!r.ok) throw new Error(r.error)
  const plan = planClean(r.preview, { ...input, expect: r.preview.expect })
  if (!plan.ok) throw new Error(plan.error)
  const cleaning = step(b.work, {
    type: 'clean',
    at: at(),
    force: plan.force,
    deleteBranches: plan.deleteBranches,
    head: git(s.tree, 'rev-parse', 'HEAD'),
  })
  const confirmed: CleanInput = { ...input, expect: r.preview.expect }
  return { cleaning, deleteBranches: plan.deleteBranches, input: confirmed }
}

async function poll<T>(pred: () => Promise<T | null>, label: string, ms = 30_000): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() > end) throw new Error(`시간 초과: ${label}`)
    await sleep(200)
  }
}

/** 앱이 충돌한 뒤 살아남은 claude의 자리: 분리해 띄운 트리(자식 하나). 루트의 ID와 시작 시각, 트리 */
async function survivor(): Promise<{ pid: number; startedAt: string; tree: ProcessInfo[] }> {
  const p = spawn(process.execPath, [TREE], { detached: true, stdio: 'ignore', windowsHide: true })
  p.unref()
  const pid = p.pid ?? 0
  children.push(p)
  const tree = await poll(async () => {
    const t = processTree(pid, await listProcesses())
    return t.length >= 2 ? t : null
  }, '프로세스 트리')
  for (const x of tree) recorded.push({ pid: x.ProcessId, startedAt: x.Created })
  const startedAt = await processStartTime(pid)
  if (!startedAt) throw new Error('시작 시각을 읽지 못함')
  return { pid, startedAt, tree }
}

const alive = (tree: readonly ProcessInfo[], list: readonly ProcessInfo[]) =>
  tree.filter((p) => isAlive(p.ProcessId, p.Created, [...list]))

// ---------- 시험 ----------

describe('[흐름] 고아 프로세스와 정리 세션 (M6, 시나리오 9-1, D76, D126)', () => {
  it.runIf(listing)(
    '다시 켜면 기록과 시작 시각이 같은 claude를 트리째 끝내고 그 Work의 패널에 알린다. 시작 시각이 다르면 건드리지 않는다',
    async () => {
      // B: 최종 검증에서 [AI 세션 열기]로 연 정리 세션이 살아 있다 (7-5)
      const s = await setup(scenario('S'))
      await toVerify(s)
      expect(await s.h.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
      await s.h.ui.until(() => view(s.h, s).cleanup?.status === 'live', '정리 세션')
      await settle(s.h, s.key)
      // 살아 있는 동안 정리 세션의 claude 프로세스를 적는다 (D126)
      const recorded = workOf(s).cleanup_process
      expect(recorded).toMatchObject({
        pid: expect.any(Number),
        process_started_at: expect.any(String),
      })
      const b = await before(s.h, s)
      // A: 의도 정리가 도는 중이다
      fs.writeFileSync(
        path.join(s.h.root, 'scenario.json'),
        JSON.stringify({ tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }),
      )
      const a = await newWork(s.h, s.projectId)
      await s.h.ui.until(() => view(s.h, a).tasks[0]?.live, '의도 정리 세션')
      const ab = await before(s.h, a)
      const intake = ab.work.tasks[0]
      if (!intake?.session?.process_started_at) throw new Error('세션의 시작 시각이 없음')

      // 앱이 충돌한 뒤 살아남은 claude: A의 의도 정리와 B의 정리 세션. 하나 더는 ID만 기록과 같다
      const orphan = await survivor()
      const cleanupOrphan = await survivor()
      const other = await survivor()
      const aCrashed: WorkState = {
        ...ab.work,
        tasks: [
          {
            ...intake,
            session: { ...intake.session, pid: orphan.pid, process_started_at: orphan.startedAt },
          },
        ],
      }
      // B의 verify 세션 기록은 ID가 살아 있는 다른 프로세스와 같고 시작 시각이 다르다: ID를 재사용한 다른 프로그램이다
      const bCrashed: WorkState = {
        ...b.work,
        tasks: b.work.tasks.map((t) =>
          t.id === 't-04' && t.session
            ? {
                ...t,
                session: {
                  ...t.session,
                  pid: other.pid,
                  process_started_at: '2000-01-01T00:00:00.000Z',
                },
              }
            : t,
        ),
        cleanup_process: {
          pid: cleanupOrphan.pid,
          process_started_at: cleanupOrphan.startedAt,
          started_at: recorded?.started_at ?? at(),
        },
      }
      await crash(s.h, [
        { w: s, work: bCrashed, events: b.events },
        { w: a, work: aCrashed, events: ab.events },
      ])

      const list = await listProcesses()
      expect(alive(orphan.tree, list)).toEqual([])
      expect(alive(cleanupOrphan.tree, list)).toEqual([])
      expect(alive(other.tree, list)).toHaveLength(other.tree.length)
      // A: 도는 중이던 의도 정리는 중단됨이다. 끝낸 프로세스를 조정 이벤트에 남긴다 (D75, D76)
      expect(workOf(a).tasks[0]).toMatchObject({ status: 'interrupted', session: { alive: false } })
      expect(eventsOf(a).at(-1)).toMatchObject({
        type: 'task.interrupted',
        payload: { reason: 'app_restart', killed_pid: orphan.pid },
      })
      expect(view(s.h, a).notices).toEqual([
        {
          id: 'orphans',
          kind: 'orphans',
          title: '앱을 다시 켜며 남아 있던 프로세스를 끝냈습니다',
          lines: [`01 의도 정리의 claude (PID ${orphan.pid})`],
          hint: expect.stringContaining('[재개]'),
        },
      ])
      // B: 정리 세션은 재시작 뒤에 없다. 적어 둔 프로세스를 지운다. task와 이벤트로는 남기지 않는다 (D126)
      expect(workOf(s).cleanup_process).toBeUndefined()
      expect(eventsOf(s)).toEqual(
        b.events
          .split('\n')
          .filter(Boolean)
          .map((l) => JSON.parse(l) as LifecycleEvent),
      )
      expect(view(s.h, s).notices.map((n) => n.lines)).toEqual([
        [`정리 세션의 claude (PID ${cleanupOrphan.pid})`],
      ])
      // OS 알림은 보내지 않는다 (D121)
      expect(s.h.ui.notices).toEqual([])
      // [확인]으로 닫는다
      expect(await s.h.relay.dismissNotice(a.key, 'orphans')).toEqual({ ok: true })
      expect(view(s.h, a).notices).toEqual([])
      expect(view(s.h, s).notices).toHaveLength(1)
    },
  )

  it('정리 세션의 프로세스는 살아 있는 동안만 work.json에 둔다. task와 이벤트, pty.log는 남기지 않는다 (7-5, D126)', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    const events = eventsOf(s)
    expect(await s.h.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    await s.h.ui.until(() => view(s.h, s).cleanup?.status === 'live', '정리 세션')
    await settle(s.h, s.key)
    const w = workOf(s)
    expect(w.cleanup_process?.pid).toEqual(expect.any(Number))
    if (listing) expect(w.cleanup_process?.process_started_at).toEqual(expect.any(String))
    expect(w.tasks).toHaveLength(4)
    // [정리 끝 → push/PR 진행]: 세션을 끝내고 깨끗하니 원래 고른 전달을 한다
    expect(await s.h.relay.finishCleanup(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const done = workOf(s)
    expect(done.status).toBe('completed')
    expect(done.cleanup_process).toBeUndefined()
    expect(
      eventsOf(s)
        .slice(events.length)
        .map((e) => e.type),
    ).toEqual(['task.approved', 'delivery.succeeded', 'work.completed'])
    expect(fs.readdirSync(path.join(s.dir, 'tasks')).sort()).toEqual([
      '01-intake',
      '02-fix',
      '03-review',
      '04-verify',
    ])
  })
})

describe('[흐름] 끊긴 되감기 (M6, 시나리오 9-4, D116, D121~D123)', () => {
  it('백업 브랜치를 만든 뒤 끊긴 되감기를 알린다. 기록이 있는 동안 다른 명령은 받지 않고, [다시 시도]는 만든 백업을 쓰고 되돌려 끝까지 간다', async () => {
    const s = await setup(recommendFix())
    await toStopped(s)
    // 사람이 worktree를 고친 채 fix로 되감는다. 커밋 안 된 변경도 백업에 들어간다 (D116)
    writeFiles(s.tree, { 'src/avg.js': '// 사람이 고침\n', 'notes.txt': '메모\n' })
    const head = git(s.tree, 'rev-parse', 'HEAD')
    const b = await before(s.h, s)
    const { rewinding, op } = await rewindStarted(s, b)
    // 앱은 백업 브랜치를 만들고 기록하기 전에 꺼졌다
    const backup = await createBackup(s.tree, op.backup_branch, {
      uncommitted: true,
      message: backupMessage(s.workId),
    })
    await crash(s.h, [{ w: s, work: rewinding, events: b.events }])

    const v = view(s.h, s)
    expect(v.badge).toEqual({ kind: 'recovery', label: '끊긴 작업', hot: true })
    expect(v.operation).toMatchObject({
      kind: 'rewind',
      title: '되감기가 끊겼습니다',
      choice: null,
    })
    expect(v.operation?.lines).toEqual([
      '고른 단계: 수정(fix)',
      '끊긴 곳: 백업 브랜치를 만드는 단계',
      `만들려던 백업 브랜치: ${op.backup_branch}`,
      '코드는 아직 되돌리지 않았습니다.',
      `되돌릴 커밋: ${op.reset_to.slice(0, 8)}`,
      '폐기할 task: 02 수정, 03 리뷰, 04 최종 검증',
    ])
    expect(Object.values(v.actions).some(Boolean)).toBe(false)
    expect(s.h.ui.notices).toEqual([])
    // 기록이 있는 동안은 [다시 시도], [무시], Work 설정만 받는다 (D122)
    expect(await s.h.relay.resumeWork(s.key)).toEqual({ ok: false, error: OPERATION_BLOCKS })
    expect(await s.h.relay.abandon(s.key)).toEqual({ ok: false, error: OPERATION_BLOCKS })
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'rca',
        keepCode: false,
        instruction: '',
        expect: { taskId: 't-04', done: true },
      }),
    ).toEqual({ ok: false, error: OPERATION_BLOCKS })
    expect(await s.h.relay.updateWorkSettings(s.key, { question_mode: {} })).toEqual({ ok: true })

    expect(await s.h.relay.retryOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    // 만든 백업이 지금 코드와 같아 다시 만들지 않았다. 코드를 되돌린 뒤 새 task가 시작했다(새 task는 곧 커밋하므로
    // worktree 대신 새 task의 시작 커밋과 지운 파일로 본다)
    expect(backups(s)).toEqual([op.backup_branch])
    expect(git(s.repo, 'show', `${op.backup_branch}:notes.txt`)).toBe('메모')
    expect(fs.existsSync(path.join(s.tree, 'notes.txt'))).toBe(false)
    const w = workOf(s)
    expect(w.tasks[4]?.start_commit).toBe(op.reset_to)
    expect(w.operation).toBeUndefined()
    expect(w.tasks.map((t) => [t.id, t.status])).toEqual([
      ['t-01', 'approved'],
      ['t-02', 'discarded'],
      ['t-03', 'discarded'],
      ['t-04', 'discarded'],
      ['t-05', expect.any(String)],
    ])
    expect(w.tasks[4]).toMatchObject({
      node: 'fix',
      reason: 'rewind',
      selection: {
        instruction: '빈 배열 검사를 다시 보세요',
        reset: {
          from: head,
          to: op.reset_to,
          backup_branch: op.backup_branch,
          backup_commit: backup,
        },
      },
    })
    const rewound = eventsOf(s).find((e) => e.type === 'task.rewound')
    expect(rewound?.payload).toMatchObject({
      reset_to: op.reset_to,
      backup_branch: op.backup_branch,
    })
    expect(rewound?.payload).not.toHaveProperty('extra_backup_branch')
    expect(view(s.h, s).operation).toBeNull()

    const done = await drive(s.h.relay, s.h.ui, s.key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
  })

  it('되돌리다 끊긴 뒤 사람이 코드를 고쳤으면 [다시 시도]는 다음 번호로 한 번 더 백업하고 되돌린다', async () => {
    const s = await setup(recommendFix())
    await toStopped(s)
    writeFiles(s.tree, { 'src/avg.js': '// 사람이 고침\n', 'notes.txt': '메모\n' })
    const head = git(s.tree, 'rev-parse', 'HEAD')
    const b = await before(s.h, s)
    const { rewinding, op } = await rewindStarted(s, b)
    const backup = await createBackup(s.tree, op.backup_branch, {
      uncommitted: true,
      message: backupMessage(s.workId),
    })
    // 백업을 기록한 뒤 되돌리다 꺼졌다: reset --hard는 했고 추적하지 않는 파일은 남았다
    const resetting = step(rewinding, {
      type: 'rewind.backedUp',
      at: at(),
      branch: op.backup_branch,
      commit: backup,
      head,
    })
    git(s.tree, 'reset', '-q', '--hard', op.reset_to)
    await crash(s.h, [{ w: s, work: resetting, events: b.events }])
    expect(view(s.h, s).operation?.lines).toEqual(
      expect.arrayContaining([
        '끊긴 곳: 코드를 되돌리는 단계',
        `백업 브랜치: ${op.backup_branch} (${backup.slice(0, 8)})`,
        '코드는 되돌렸을 수도 있습니다.',
      ]),
    )
    // 다시 켠 뒤 사람이 또 고쳤다
    writeFiles(s.tree, { 'later.txt': '다시 켠 뒤\n' })

    expect(await s.h.relay.retryOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const extra = `${s.branch}-discarded-2`
    expect(backups(s)).toEqual([op.backup_branch, extra])
    expect(git(s.repo, 'show', `${extra}:later.txt`)).toBe('다시 켠 뒤')
    expect(git(s.repo, 'show', `${extra}:notes.txt`)).toBe('메모')
    expect(fs.existsSync(path.join(s.tree, 'notes.txt'))).toBe(false)
    expect(fs.existsSync(path.join(s.tree, 'later.txt'))).toBe(false)
    expect(workOf(s).tasks.at(-1)?.start_commit).toBe(op.reset_to)
    // 폐기한 task의 [변경]이 볼 백업은 처음 백업이다. 덤으로 남긴 백업은 이벤트에 남긴다
    expect(workOf(s).tasks.at(-1)?.selection?.reset).toEqual({
      from: head,
      to: op.reset_to,
      backup_branch: op.backup_branch,
      backup_commit: backup,
    })
    expect(eventsOf(s).find((e) => e.type === 'task.rewound')?.payload).toMatchObject({
      backup_branch: op.backup_branch,
      extra_backup_branch: extra,
    })
    const done = await drive(s.h.relay, s.h.ui, s.key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
  })

  it('끊긴 되감기의 [다시 시도]는 worktree가 Work 브랜치에 있지 않으면 하지 않고 끊긴 채로 둔다 (D138)', async () => {
    const s = await setup(recommendFix())
    await toStopped(s)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    const b = await before(s.h, s)
    const { rewinding } = await rewindStarted(s, b)
    await crash(s.h, [{ w: s, work: rewinding, events: b.events }])
    git(s.tree, 'checkout', '--quiet', '--detach')

    expect(await s.h.relay.retryOperation(s.key)).toEqual({
      ok: false,
      error: `되감기 실패: worktree가 Work 브랜치에 있지 않음(지금: 분리된 HEAD). worktree에서 \`git switch ${s.branch}\`로 돌아온 뒤 다시 누르세요`,
    })
    await settle(s.h, s.key)
    expect(workOf(s).operation?.interrupted_at).toBeDefined()
    expect(view(s.h, s).badge.kind).toBe('recovery')
    expect(backups(s)).toEqual([])
    expect(git(s.tree, 'rev-parse', 'HEAD')).toBe(head)

    git(s.tree, 'switch', '--quiet', s.branch)
    expect(await s.h.relay.retryOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(workOf(s).operation).toBeUndefined()
  })

  it('[무시]는 기록만 지운다. 코드와 task는 그대로이고, 다시 단계를 골라 끝까지 간다', async () => {
    const s = await setup(recommendFix())
    await toStopped(s)
    writeFiles(s.tree, { 'notes.txt': '메모\n' })
    const head = git(s.tree, 'rev-parse', 'HEAD')
    const b = await before(s.h, s)
    const { rewinding } = await rewindStarted(s, b)
    await crash(s.h, [{ w: s, work: rewinding, events: b.events }])

    expect(await s.h.relay.ignoreOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = workOf(s)
    expect(w.operation).toBeUndefined()
    expect(w.status).toBe('stopped')
    expect(w.tasks).toEqual(b.work.tasks)
    expect(backups(s)).toEqual([])
    expect(git(s.tree, 'rev-parse', 'HEAD')).toBe(head)
    expect(git(s.tree, 'status', '--porcelain')).toBe('?? notes.txt')
    expect(view(s.h, s).operation).toBeNull()
    expect(view(s.h, s).actions.selectStep).toBe(true)

    const p = await s.h.relay.stepPreview(s.key, 'fix', false)
    if (!p.ok) throw new Error(p.error)
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'fix',
        keepCode: false,
        instruction: '',
        expect: p.preview.expect,
      }),
    ).toEqual({ ok: true })
    expect(backups(s)).toEqual([`${s.branch}-discarded-1`])
    const done = await drive(s.h.relay, s.h.ui, s.key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
  })
})

describe('[흐름] 끊긴 전달 (M6, 시나리오 9-4, 7-5, D120~D123)', () => {
  it('push한 뒤 끊긴 전달을 알리고, [다시 시도]는 끊긴 시도를 실패로 남긴 뒤 다시 push해 Work를 완료한다', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    const b = await before(s.h, s)
    const delivering = step(b.work, {
      type: 'deliver',
      at: at(),
      choice: 'push',
      uncommitted: null,
      check: await checkOf(s, b.work, 't-04'),
    })
    expect(delivering.operation).toMatchObject({ kind: 'deliver', stage: 'push' })
    // 앱은 push하고 결과를 기록하기 전에 꺼졌다
    git(s.tree, 'push', '-q', 'origin', s.branch)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    await crash(s.h, [{ w: s, work: delivering, events: b.events }])

    const v = view(s.h, s)
    expect(v.badge.kind).toBe('recovery')
    expect(v.operation).toMatchObject({
      kind: 'deliver',
      title: '전달이 끊겼습니다',
      choice: 'push',
    })
    expect(v.operation?.lines).toEqual(['전달: [push]', '끊긴 곳: push', `브랜치: ${s.branch}`])
    // 끊긴 동안은 전달도 승인도 받지 않는다 (D122)
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: false,
      error: OPERATION_BLOCKS,
    })
    expect(await s.h.relay.approve(s.key, 't-04', {})).toEqual({
      ok: false,
      error: OPERATION_BLOCKS,
    })

    expect(await s.h.relay.retryOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = workOf(s)
    expect(w.status).toBe('completed')
    expect(w.operation).toBeUndefined()
    expect(w.delivery).toMatchObject({ choice: 'push', status: 'succeeded', branch: s.branch })
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
    expect(
      eventsOf(s)
        .slice(-4)
        .map((e) => [e.type, e.payload]),
    ).toEqual([
      [
        'delivery.failed',
        { choice: 'push', stage: 'push', error: CUT_ERROR, reason: 'app_restart' },
      ],
      ['task.approved', { by: 'human' }],
      ['delivery.succeeded', { choice: 'push', branch: s.branch, compare_url: null }],
      ['work.completed', { delivery: 'push' }],
    ])
  })

  it('stash를 만들고 기록하기 전에 끊긴 전달의 [무시]는 그 stash를 찾아 실패한 전달로 남긴다. 그 뒤 [전달 없이 완료]로 끝낸다', async () => {
    const s = await setup(scenario('S'), { github: true })
    await toVerify(s)
    writeFiles(s.tree, { 'debug.log': '실험 출력\n' })
    const b = await before(s.h, s)
    const delivering = step(b.work, {
      type: 'deliver',
      at: at(),
      choice: 'pr',
      uncommitted: 'discard',
      check: await checkOf(s, b.work, 't-04'),
    })
    expect(delivering.operation).toMatchObject({ stage: 'prepare', uncommitted: 'discard' })
    const stash = await stashAll(s.tree, stashMessage(s.workId))
    await crash(s.h, [{ w: s, work: delivering, events: b.events }])
    expect(view(s.h, s).operation?.lines).toEqual([
      '전달: [PR 생성]',
      '끊긴 곳: 커밋 안 된 변경 처리',
      `브랜치: ${s.branch}`,
      '커밋 안 된 변경을 처리하다 만든 stash나 커밋은 [다시 시도]나 [무시]할 때 찾아 결과에 남깁니다.',
    ])

    expect(await s.h.relay.ignoreOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = workOf(s)
    expect(w.operation).toBeUndefined()
    expect(w.status).toBe('active')
    expect(w.tasks[3]?.status).toBe('awaiting_approval')
    expect(w.delivery).toEqual({
      choice: 'pr',
      status: 'failed',
      at: expect.any(String),
      stage: 'prepare',
      error: CUT_ERROR,
      branch: s.branch,
      stashes: [stash],
    })
    expect(eventsOf(s).at(-1)).toMatchObject({
      type: 'delivery.failed',
      payload: { reason: 'app_restart', stage: 'prepare', stashes: [stash] },
    })
    // Work 완료 화면은 M5의 실패처럼 [다시 시도]·[전달 없이 완료]다 (D120)
    const review = await s.h.relay.review(s.key, 't-04')
    expect(review?.completion).toMatchObject({ mode: 'deliver', delivery: { status: 'failed' } })
    expect(await s.h.relay.approve(s.key, 't-04', {})).toEqual({ ok: true })
    await settle(s.h, s.key)
    const done = workOf(s)
    expect(done.status).toBe('completed')
    expect(done.delivery?.stashes).toEqual([stash])
    expect(s.h.ghRecords().filter((r) => r['type'] === 'pr create')).toEqual([])
  })

  it('stash 전에 끊긴 전달의 [다시 시도]는 커밋 안 된 변경의 선택지를 다시 보이고, 고르면 PR까지 간다', async () => {
    const s = await setup(scenario('S'), { github: true })
    await toVerify(s)
    writeFiles(s.tree, { 'debug.log': '실험 출력\n' })
    const b = await before(s.h, s)
    const delivering = step(b.work, {
      type: 'deliver',
      at: at(),
      choice: 'pr',
      uncommitted: 'discard',
      check: await checkOf(s, b.work, 't-04'),
    })
    await crash(s.h, [{ w: s, work: delivering, events: b.events }])

    expect(await s.h.relay.retryOperation(s.key)).toEqual({
      ok: false,
      error: '커밋 안 된 변경이 있어 push와 PR을 할 수 없음',
      uncommitted: ['?? debug.log'],
    })
    await settle(s.h, s.key)
    const failed = workOf(s)
    expect(failed.operation).toBeUndefined()
    expect(failed.delivery).toMatchObject({ status: 'failed', stage: 'prepare', error: CUT_ERROR })
    expect(failed.delivery).not.toHaveProperty('stashes')
    expect(
      await s.h.relay.deliver(s.key, {
        choice: 'pr',
        uncommitted: { action: 'discard', expect: ['?? debug.log'] },
      }),
    ).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = workOf(s)
    expect(w.status).toBe('completed')
    expect(w.delivery).toMatchObject({
      choice: 'pr',
      status: 'succeeded',
      pr_url: 'https://github.com/relay-test/sample/pull/1',
    })
    expect(w.delivery?.stashes).toHaveLength(1)
  })
})

describe('[흐름] 끊긴 정리 (M6, 시나리오 9-4, 8-2, D121~D123)', () => {
  it('worktree를 반쯤 지우다 끊긴 정리의 [다시 시도]는 prune하고 남은 폴더를 지운 뒤 브랜치를 지워 보관됨으로 끝낸다', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    const b = await before(s.h, s)
    const { cleaning, deleteBranches } = await cleanStarted(s, b, {
      deleteBranch: true,
      deleteBackups: true,
      confirmed: false,
    })
    expect(deleteBranches).toEqual([s.branch])
    // git worktree remove가 파일을 지우다 꺼졌다: .git과 파일 일부가 없다
    fs.rmSync(path.join(s.tree, '.git'))
    fs.rmSync(path.join(s.tree, 'src'), { recursive: true })
    await crash(s.h, [{ w: s, work: cleaning, events: b.events }])

    const v = view(s.h, s)
    // 완료한 Work도 정리가 끊겼으면 끊긴 작업 배지다 (D121)
    expect(v.badge.kind).toBe('recovery')
    expect(v.operation).toMatchObject({ kind: 'clean', title: 'Work 정리가 끊겼습니다' })
    expect(v.operation?.lines).toEqual([
      '끊긴 곳: worktree를 지우는 단계',
      `지울 브랜치: ${s.branch}`,
    ])
    expect(await s.h.relay.retryOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(fs.existsSync(s.tree)).toBe(false)
    expect(git(s.repo, 'worktree', 'list', '--porcelain')).not.toContain(s.workId)
    expect(git(s.repo, 'branch', '--list', 'relay/*')).toBe('')
    const w = workOf(s)
    expect(w.status).toBe('archived')
    expect(w.operation).toBeUndefined()
    expect(w.cleaned).toMatchObject({ forced: false, deleted_branches: [s.branch] })
    expect(eventsOf(s).at(-1)).toMatchObject({ type: 'work.cleaned' })
    // 산출물은 남는다
    expect(fs.existsSync(path.join(s.dir, 'tasks', '04-verify', 'verification.md'))).toBe(true)
  })

  it('브랜치를 지우다 끊긴 정리의 [다시 시도]는 아직 있는 브랜치만 지운다', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    // 되감기 백업 브랜치가 하나 있다
    git(s.repo, 'branch', `${s.branch}-discarded-1`, 'main')
    const b = await before(s.h, s)
    const { cleaning, deleteBranches } = await cleanStarted(s, b, {
      deleteBranch: true,
      deleteBackups: true,
      confirmed: false,
    })
    expect(deleteBranches).toEqual([s.branch, `${s.branch}-discarded-1`])
    // worktree를 지웠고 브랜치를 지우다 꺼졌다: 작업 브랜치만 지웠다
    const removing = step(cleaning, { type: 'clean.removed', at: at() })
    git(s.repo, 'worktree', 'remove', s.tree)
    git(s.repo, 'branch', '-D', s.branch)
    await crash(s.h, [{ w: s, work: removing, events: b.events }])
    expect(view(s.h, s).operation?.lines).toContain(
      '끊긴 곳: 브랜치를 지우는 단계(worktree는 지웠음)',
    )

    expect(await s.h.relay.retryOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(git(s.repo, 'branch', '--list', 'relay/*')).toBe('')
    const w = workOf(s)
    expect(w.status).toBe('archived')
    expect(w.cleaned?.deleted_branches).toEqual(deleteBranches)
  })

  it('[무시]는 기록만 지운다. 기록이 있는 동안 받지 않던 [Work 정리]를 다시 해 끝낸다', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    expect(await s.h.relay.approve(s.key, 't-04', {})).toEqual({ ok: true })
    const b = await before(s.h, s)
    expect(b.work.status).toBe('completed')
    const { cleaning, input } = await cleanStarted(s, b, {
      deleteBranch: false,
      deleteBackups: true,
      confirmed: false,
    })
    await crash(s.h, [{ w: s, work: cleaning, events: b.events }])
    // 기록이 있는 동안은 [Work 정리]를 받지 않는다 (D122)
    expect(view(s.h, s).actions.clean).toBe(false)
    expect(await s.h.relay.cleanPreview(s.key)).toEqual({ ok: false, error: OPERATION_BLOCKS })
    expect(await s.h.relay.clean(s.key, input)).toEqual({ ok: false, error: OPERATION_BLOCKS })

    expect(await s.h.relay.ignoreOperation(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = workOf(s)
    expect(w.operation).toBeUndefined()
    expect(w.status).toBe('completed')
    expect(fs.existsSync(s.tree)).toBe(true)
    const v = view(s.h, s)
    expect(v.badge.kind).toBe('done')
    expect(v.actions.clean).toBe(true)
    expect(await s.h.relay.clean(s.key, input)).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(workOf(s).status).toBe('archived')
    expect(fs.existsSync(s.tree)).toBe(false)
  })
})

describe('[흐름] 앱 소유 파일과 잘린 pty.log (M6, 6.1, 시나리오 9-5, 9-6, D124)', () => {
  it('앱 밖에서 바뀐 앱 소유 파일은 앱이 읽을 때 알리고 그 내용을 쓴다. work.json은 쓰기 전에 비교해 바뀐 내용을 옆에 남긴다', async () => {
    const s = await setup(scenario('S'))
    const pause = (node: string) =>
      drive(s.h.relay, s.h.ui, s.key, {
        size: 'S',
        pauseAt: (t) => t.node === node && t.status === 'awaiting_approval',
      })
    expect(await pause('intake')).toMatchObject({ status: 'paused' })
    await settle(s.h, s.key)
    // Work를 만들 때 쓴 request.md의 해시를 적었다
    expect(workOf(s).file_hashes).toEqual({ 'request.md': fileHash(REQUEST) })
    // 스크립트가 request.md를 고쳤다. 수정 task의 context.md를 만들며 읽을 때 알리고 그 내용을 쓴다
    const request = `${REQUEST}스크립트가 더한 줄\n`
    fs.writeFileSync(path.join(s.dir, 'request.md'), request)
    expect(await pause('fix')).toMatchObject({ status: 'paused' })
    await settle(s.h, s.key)
    const files = () => view(s.h, s).notices.find((n) => n.id === 'files')
    expect(files()).toMatchObject({ kind: 'files', title: '앱 밖에서 바뀐 파일이 있습니다' })
    expect(files()?.lines).toEqual([
      expect.stringMatching(
        /^request\.md: 내용이 바뀜 \(\d{4}-\d{2}-\d{2} \d{2}:\d{2}에 확인\) — /,
      ),
    ])
    expect(files()?.lines[0]).toContain(path.join(s.dir, 'request.md'))
    // context.md는 요청 원문의 경로를 싣는다. 파일은 되돌리지 않았다
    expect(read(path.join(s.dir, 'tasks', '02-fix', 'context.md'))).toContain(
      path.join(s.dir, 'request.md'),
    )
    expect(read(path.join(s.dir, 'request.md'))).toBe(request)
    // 앱이 쓴 파일은 해시를 적는다. 사람이 [확인]하기 전에는 request.md의 해시는 그대로다
    expect(workOf(s).file_hashes).toEqual({
      'request.md': fileHash(REQUEST),
      'intent.md': fileHash(read(path.join(s.dir, 'intent.md'))),
      'decisions.md': fileHash(read(path.join(s.dir, 'decisions.md'))),
    })
    // 스크립트가 decisions.md에 덧붙였다. 앱이 덧붙이며 읽을 때 알리고, 그 내용 뒤에 덧붙인다
    fs.appendFileSync(path.join(s.dir, 'decisions.md'), '\n스크립트 메모\n')
    expect(await pause('verify')).toMatchObject({ status: 'paused' })
    await settle(s.h, s.key)
    expect(files()?.lines).toEqual([
      expect.stringMatching(/^request\.md: 내용이 바뀜/),
      expect.stringMatching(/^decisions\.md: 내용이 바뀜/),
    ])
    const decisions = read(path.join(s.dir, 'decisions.md'))
    expect(decisions).toContain('스크립트 메모')
    expect(decisions).toContain('## t-02 fix — ')
    expect(workOf(s).file_hashes?.['decisions.md']).toBe(fileHash(decisions))
    // OS 알림은 보내지 않는다 (D121)
    expect(s.h.ui.notices.filter((n) => n.body.includes('파일'))).toEqual([])
    // [확인]하면 지금 내용을 받아들인다
    expect(await s.h.relay.dismissNotice(s.key, 'files')).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(view(s.h, s).notices).toEqual([])
    expect(workOf(s).file_hashes?.['request.md']).toBe(fileHash(request))

    // 스크립트가 work.json의 승인 기록을 바꿨다. 앱은 다음에 쓸 때 바뀐 내용을 옆에 남기고 자기 상태로 쓴다
    const file = path.join(s.dir, 'work.json')
    const script = read(file).replace('"status": "active"', '"status": "stopped"')
    expect(script).not.toBe(read(file))
    fs.writeFileSync(file, script)
    expect(await s.h.relay.approve(s.key, 't-04', {})).toEqual({ ok: true })
    await settle(s.h, s.key)
    const copies = fs.readdirSync(s.dir).filter((f) => f.startsWith('work.json.changed-'))
    expect(copies).toEqual([expect.stringMatching(/^work\.json\.changed-\d{8}T\d{6}$/)])
    const copy = path.join(s.dir, copies[0] ?? '')
    expect(read(copy)).toBe(script)
    expect(workOf(s).status).toBe('completed')
    expect(view(s.h, s).notices).toEqual([
      {
        id: 'work_json',
        kind: 'work_json',
        title: 'work.json이 앱 밖에서 바뀌었습니다',
        lines: [expect.stringContaining(`바뀐 내용 — ${copy}`)],
        hint: expect.any(String),
      },
    ])
    expect(await s.h.relay.dismissNotice(s.key, 'work_json')).toEqual({ ok: true })
    expect(view(s.h, s).notices).toEqual([])
  })

  it('다시 켜면 앱 소유 파일의 해시를 비교해 알리고, 잘린 pty.log는 경고 없이 남은 만큼 보인다. M6 전에 만든 Work는 경고 없이 적는다', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    await s.h.relay.close()
    await settle(s.h, s.key)
    // 꺼진 동안 스크립트가 intent.md를 고치고 decisions.md를 지웠다
    fs.appendFileSync(path.join(s.dir, 'intent.md'), '스크립트\n')
    fs.rmSync(path.join(s.dir, 'decisions.md'))
    // 충돌로 pty.log의 끝이 글자 가운데서 잘렸다: '확'(3바이트)의 첫 바이트만 남았다
    const log = path.join(s.dir, 'tasks', '01-intake', 'pty.log')
    const bytes = fs.readFileSync(log)
    const cut = bytes.indexOf(Buffer.from('한글 출력 확인')) + Buffer.byteLength('한글 출력 ') + 1
    fs.writeFileSync(log, bytes.subarray(0, cut))
    await s.h.reopen()
    await settle(s.h, s.key)

    const v = view(s.h, s)
    expect(v.notices).toEqual([
      {
        id: 'files',
        kind: 'files',
        title: '앱 밖에서 바뀐 파일이 있습니다',
        lines: [
          expect.stringMatching(/^intent\.md: 내용이 바뀜/),
          expect.stringMatching(/^decisions\.md: 없어짐/),
        ],
        hint: expect.any(String),
      },
    ])
    expect(s.h.ui.notices).toEqual([])
    const backlog = await s.h.relay.terminalAttach(`${s.key}/t-01`)
    expect(backlog.live).toBe(false)
    expect(backlog.data.endsWith('한글 출력 ')).toBe(true)
    expect(backlog.data).not.toContain('�')
    expect(v.problems).toEqual([])

    // [확인]하면 지금 내용을 받아들인다. 없어진 파일은 해시를 지운다
    expect(await s.h.relay.dismissNotice(s.key, 'files')).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(workOf(s).file_hashes).toEqual({
      'request.md': fileHash(REQUEST),
      'intent.md': fileHash(read(path.join(s.dir, 'intent.md'))),
    })
    await s.h.relay.close()
    await s.h.reopen()
    await settle(s.h, s.key)
    expect(view(s.h, s).notices).toEqual([])

    // M6 전에 만든 Work: 해시가 없다. 처음 읽을 때 경고 없이 적는다
    await s.h.relay.close()
    const old = workOf(s)
    delete old.file_hashes
    fs.writeFileSync(path.join(s.dir, 'work.json'), jsonText(old))
    fs.appendFileSync(path.join(s.dir, 'request.md'), '나중에 더한 줄\n')
    await s.h.reopen()
    await settle(s.h, s.key)
    expect(view(s.h, s).notices).toEqual([])
    expect(workOf(s).file_hashes).toEqual({
      'request.md': fileHash(read(path.join(s.dir, 'request.md'))),
      'intent.md': fileHash(read(path.join(s.dir, 'intent.md'))),
    })
  })
})
