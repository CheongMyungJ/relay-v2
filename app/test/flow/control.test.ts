// [흐름] 사람 조작과 여러 Work (docs/implementation.md M3, I25, I26).
// 여러 Work와 대기열(D18), [즉시 중단]과 [재개](--resume), [이 단계 끝나면 멈춤], [Work 포기],
// [이 단계 새 세션으로 다시](D114), 재시작 조정(D75, D78), 설정(D70, D72, D73), 알림(D81).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { harness, makeRepo, register, settle, type Harness } from './harness'
import {
  REPO_FILES,
  REQUEST,
  handoff,
  intentDraft,
  scenario,
  steps,
  type Scenario,
} from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

interface Setup {
  h: Harness
  projectId: string
  /** Work를 만들고 키를 돌려준다 */
  create(request?: string, settings?: object): Promise<string>
  /** Work 디렉터리 */
  dir(workKey: string): string
}

async function setup(s: Scenario, config: object = {}): Promise<Setup> {
  h = await harness({ scenario: s, config })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  return {
    h: hh,
    projectId,
    create: async (request = REQUEST, settings?: object) => {
      const r = await hh.relay.createWork(projectId, {
        request,
        baseBranch: 'main',
        baseLocation: 'local',
        ...(settings ? { settings } : {}),
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (workKey) =>
      path.join(hh.home, 'projects', projectId, 'works', workKey.split('/')[1] ?? ''),
  }
}

function work(dir: string): WorkState {
  return JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
}

function events(dir: string): LifecycleEvent[] {
  return read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

/** Work 스냅샷의 지금 task가 pred를 만족할 때까지 기다린다 */
function untilTask(
  s: Setup,
  workKey: string,
  pred: (t: WorkView['tasks'][number], w: WorkView) => boolean,
  label: string,
) {
  return s.h.ui.until(
    () => {
      const w = s.h.ui.works.get(workKey)
      const t = w?.tasks.find((x) => x.id === w.current)
      return w && t && pred(t, w) ? t : null
    },
    label,
    60_000,
  )
}

type Start = { args: string[]; resume?: boolean; taskId?: string; pid: number; found?: boolean }
const starts = (s: Setup) => s.h.records().filter((r) => r['type'] === 'start') as Start[]

/**
 * 가짜 claude가 UserPromptSubmit을 n번 보낼 때까지 기다린다. 세션을 띄운 직후에 끝내면 가짜 claude가
 * 대화를 남기기 전이라 --resume할 대화가 없다(실제 claude도 같다, S6).
 */
function untilPrompts(s: Setup, n: number) {
  const count = () =>
    s.h.records().filter((r) => r['type'] === 'hook' && r['event'] === 'UserPromptSubmit').length
  return s.h.ui.until(() => count() >= n, `UserPromptSubmit ${n}번`, 30_000)
}

describe('[흐름] 사람 조작과 여러 Work (M3)', () => {
  it('Work 셋을 나란히 돌리면 상한을 넘은 task는 대기열에서 기다리다 자동으로 시작한다 (D18, D81)', async () => {
    const s = await setup(scenario('S'), { session_limit: 2 })
    // 살아 있는 세션 수의 최댓값을 잰다
    let maxLive = 0
    const off = s.h.ui.onChange(() => {
      const live = [...s.h.ui.works.values()].flatMap((w) => w.tasks).filter((t) => t.live)
      maxLive = Math.max(maxLive, live.length)
    })
    const a = await s.create('버그 A')
    const b = await s.create('버그 B')
    const c = await s.create('버그 C')
    // C의 intake는 자리가 없어 대기열에 있다
    const queued = await untilTask(s, c, (t) => t.status === 'queued', 'C 대기열')
    expect(queued.live).toBe(false)
    expect(s.h.ui.works.get(c)?.badge).toEqual({ kind: 'queued', label: '대기열', hot: false })
    expect(s.h.ui.works.get(c)?.actions).toMatchObject({ interrupt: true, resume: false })
    expect(work(s.dir(c)).tasks[0]).toMatchObject({ status: 'queued', session: null })
    expect(work(s.dir(c)).tasks[0]?.queued_at).toBeDefined()

    const results = await Promise.all([a, b, c].map((key) => drive(s.h.relay, s.h.ui, key)))
    off()
    for (const r of results) expect(r, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(maxLive).toBeLessThanOrEqual(2)
    expect(maxLive).toBe(2)
    // 대기열에서 자동으로 시작하면 알린다
    const auto = s.h.ui.notices.filter((n) => n.body.endsWith('대기열에서 자동 시작'))
    expect(auto.map((n) => n.workKey)).toContain(c)
    expect(auto.find((n) => n.workKey === c)?.body).toBe('01 의도 정리: 대기열에서 자동 시작')
    // 사람이 움직여야 하는 상태가 되면 그 Work의 키로 알린다
    expect(
      s.h.ui.notices.filter((n) => n.workKey === a && n.body === '01 의도 정리: 승인 대기'),
    ).toHaveLength(1)
    await Promise.all([a, b, c].map((key) => settle(s.h, key)))
    for (const key of [a, b, c]) {
      const w = work(s.dir(key))
      expect(w.status).toBe('completed')
      expect(w.tasks.every((t) => t.queued_at === undefined)).toBe(true)
    }
    expect(s.h.ui.works.get(c)?.badge).toEqual({ kind: 'done', label: '완료', hot: false })
  })

  it('[즉시 중단] 뒤 [재개]는 같은 세션 id로 --resume을 부르고, 이전 화면 뒤에 이어 보인다 (시나리오 3-4)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'work-start': [{ do: 'prompt' }, { do: 'wait' }] },
      resume: {
        'work-start': [
          { do: 'waitEnter' },
          { do: 'prompt', text: '이어서 해 줘' },
          ...steps('intake', 'S').slice(1),
        ],
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    await untilTask(s, key, (t) => t.status === 'working' && t.live, '작업 중')
    await untilPrompts(s, 1)
    const first = work(dir).tasks[0]?.session
    expect(first?.alive).toBe(true)

    // [즉시 중단]
    expect(await s.h.relay.interrupt(key, 't-01')).toEqual({ ok: true })
    await settle(s.h, key)
    expect(work(dir).tasks[0]).toMatchObject({ status: 'interrupted', session: { alive: false } })
    expect(s.h.ui.works.get(key)?.tasks[0]).toMatchObject({ live: false, statusLabel: '중단됨' })
    expect(s.h.ui.works.get(key)?.actions).toMatchObject({ interrupt: false, resume: true })
    expect(alive(first?.pid ?? 0)).toBe(false)
    // 끊긴 세션은 다시 [즉시 중단]할 수 없다
    expect((await s.h.relay.interrupt(key, 't-01')).ok).toBe(false)

    // [재개]: 같은 옵션 + --resume <같은 id>. --session-id와 첫 프롬프트는 없다
    expect(await s.h.relay.resume(key, 't-01')).toEqual({ ok: true })
    const resumed = await untilTask(s, key, (t) => t.live, '재개')
    expect(resumed).toMatchObject({
      status: 'idle',
      resumed: true,
      band: '01 의도 정리 · 세션 재개 · 이유: 기본 진행',
    })
    await s.h.ui.until(() => starts(s).length === 2, '다시 연 가짜 claude', 30_000)
    const all = starts(s)
    expect(all).toHaveLength(2)
    const workDir = dir
    const settingsPath = path.join(dir, 'tasks', '01-intake', 'task.settings.json')
    expect(all[1]?.args).toEqual([
      '--dangerously-skip-permissions',
      '--resume',
      first?.id,
      '--add-dir',
      workDir,
      '--settings',
      settingsPath,
    ])
    expect(all[1]?.resume).toBe(true)
    await settle(s.h, key)
    const task = work(dir).tasks[0]
    expect(task?.session).toMatchObject({ id: first?.id, alive: true })
    expect(task?.session?.pid).not.toBe(first?.pid)
    expect(task?.session?.resumed_at).toBeDefined()
    expect(events(dir).map((e) => [e.type, e.payload])).toEqual([
      ['work.created', expect.anything()],
      ['task.started', { reason: 'default', session_id: first?.id }],
      ['task.interrupted', { reason: 'human' }],
      ['task.resumed', { session_id: first?.id, claude_version: '0.0.0 (가짜 Claude Code)' }],
    ])
    // 이전 화면을 먼저 보이고 그 뒤에 다시 연 세션의 출력을 잇는다
    const backlog = await s.h.relay.terminalAttach(`${key}/t-01`)
    expect(backlog.live).toBe(true)
    const marks = [...backlog.data.matchAll(/FAKE-CLAUDE READY/g)].map((m) => m.index)
    expect(marks).toHaveLength(2)
    const resumeMark = backlog.data.indexOf('relay: 세션 재개')
    expect(resumeMark).toBeGreaterThan(marks[0] ?? Infinity)
    expect(resumeMark).toBeLessThan(marks[1] ?? -1)
    expect(read(path.join(dir, 'tasks', '01-intake', 'pty.log'))).toContain('relay: 세션 재개')

    // 다시 연 세션에 사람이 요청을 보내면 이어서 일하고, 새 토큰으로 보낸 훅을 받는다
    s.h.relay.terminalWrite(`${key}/t-01`, '\r')
    await untilTask(s, key, (t) => t.status === 'awaiting_approval', '승인 대기')
    const result = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const hooks = s.h.records().filter((r) => r['type'] === 'hook')
    expect(hooks.every((r) => r['status'] === 200)).toBe(true)
  })

  it('승인 대기에서 [즉시 중단]하면 승인 대기로 남아 승인할 수 있고, 자리가 나 대기열의 task가 시작된다 (3.3)', async () => {
    const s = await setup(
      {
        tasks: { ...scenario('S').tasks, 'work-start': [...steps('intake', 'S'), { do: 'wait' }] },
      },
      { session_limit: 1 },
    )
    const a = await s.create('버그 A')
    await untilTask(s, a, (t) => t.status === 'awaiting_approval', 'A 승인 대기')
    const b = await s.create('버그 B')
    await untilTask(s, b, (t) => t.status === 'queued', 'B 대기열')

    expect(await s.h.relay.interrupt(a, 't-01')).toEqual({ ok: true })
    // A는 승인 대기로 남고 세션이 없다. 자리가 나 B가 시작된다
    await untilTask(s, b, (t) => t.live, 'B 시작')
    const ta = s.h.ui.works.get(a)?.tasks[0]
    expect(ta).toMatchObject({ status: 'awaiting_approval', live: false })
    expect(s.h.ui.works.get(a)?.actions).toMatchObject({ interrupt: false, resume: true })
    const review = await s.h.relay.review(a, 't-01')
    expect(review?.gates.S.approve).toBe(true)
    // 세션이 없어도 승인한다. 다음 task는 자리가 없어 대기열에서 기다린다
    expect(await s.h.relay.approve(a, 't-01', { size: 'S' })).toEqual({ ok: true })
    await untilTask(s, a, (t) => t.node === 'fix' && t.status === 'queued', 'A 수정 대기열')
  })

  it('[이 단계 끝나면 멈춤]이면 승인 뒤 멈추고 알린다. [재개]하면 다음 단계를 시작한다 (시나리오 3-4)', async () => {
    const s = await setup(scenario('S'))
    const key = await s.create()
    expect(await s.h.relay.stopAfter(key, true)).toEqual({ ok: true })
    expect(s.h.ui.works.get(key)?.stopAfterStep).toBe(true)
    const stopped = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(stopped).toMatchObject({
      status: 'stopped',
      reason: '이 단계 끝나면 멈춤: 01 의도 정리 승인 뒤 멈춤',
    })
    await settle(s.h, key)
    const w = work(s.dir(key))
    expect(w).toMatchObject({ status: 'stopped', stop: { kind: 'after_step', task_id: 't-01' } })
    expect(w.stop_after_step).toBeUndefined()
    expect(w.tasks).toHaveLength(1)
    expect(s.h.ui.works.get(key)?.badge).toEqual({ kind: 'stopped', label: '멈춤', hot: true })
    expect(s.h.ui.notices.at(-1)).toMatchObject({
      workKey: key,
      body: '이 단계 끝나면 멈춤: 01 의도 정리 승인 뒤 멈춤',
    })

    expect(await s.h.relay.resumeWork(key)).toEqual({ ok: true })
    const done = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(work(s.dir(key)).tasks.map((t) => t.node)).toEqual(['intake', 'fix', 'verify'])
  })

  it('[Work 포기]는 세션을 끝내고 Work를 포기로 둔다 (3.3)', async () => {
    const s = await setup({ tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } })
    const key = await s.create()
    await untilTask(s, key, (t) => t.live, '작업 중')
    const pid = work(s.dir(key)).tasks[0]?.session?.pid ?? 0
    expect(await s.h.relay.abandon(key)).toEqual({ ok: true })
    await settle(s.h, key)
    const w = work(s.dir(key))
    expect(w).toMatchObject({ status: 'abandoned', tasks: [{ status: 'interrupted' }] })
    expect(w.abandoned_at).toBeDefined()
    expect(alive(pid)).toBe(false)
    expect(events(s.dir(key)).map((e) => [e.type, e.payload])).toEqual([
      ['work.created', expect.anything()],
      ['task.started', expect.anything()],
      ['task.interrupted', { reason: 'abandoned' }],
      ['work.abandoned', {}],
    ])
    expect(s.h.ui.works.get(key)?.badge).toEqual({ kind: 'done', label: '포기', hot: false })
    expect((await s.h.relay.resume(key, 't-01')).ok).toBe(false)
  })

  it('handoff 없이 끝난 세션은 [세션 재개]하거나 [이 단계 새 세션으로 다시] 새 task로 시작한다 (시나리오 3-5, D114)', async () => {
    const s = await setup({
      tasks: {
        ...scenario('S').tasks,
        'work-start': [{ do: 'prompt' }, { do: 'stop' }, { do: 'exit' }],
        't-02': steps('intake', 'S'),
      },
      resume: { 'work-start': [{ do: 'exit' }] },
    })
    const key = await s.create()
    await untilTask(s, key, (t) => t.status === 'session_ended', '세션 종료')
    expect(s.h.ui.works.get(key)?.actions).toMatchObject({ resume: true, retry: true })
    expect(s.h.ui.notices.at(-1)?.body).toBe('01 의도 정리: handoff 없이 세션 종료')

    // [세션 재개]: 다시 연 세션이 또 끝나면 세션 종료다
    expect(await s.h.relay.resume(key, 't-01')).toEqual({ ok: true })
    await s.h.ui.until(() => starts(s).length === 2, '재개', 30_000)
    await untilTask(s, key, (t) => t.status === 'session_ended' && t.resumed, '다시 세션 종료')

    // [이 단계 새 세션으로 다시]: 같은 노드의 새 task
    expect(await s.h.relay.retry(key, 't-01')).toEqual({ ok: true })
    const retried = await untilTask(s, key, (t) => t.id === 't-02', '새 task')
    expect(retried.band).toBe('02 의도 정리 · 새 세션 · 이유: 재개')
    const result = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    const w = work(s.dir(key))
    expect(w.tasks.map((t) => [t.id, t.node, t.status, t.reason])).toEqual([
      ['t-01', 'intake', 'session_ended', 'default'],
      ['t-02', 'intake', 'approved', 'resume'],
      ['t-03', 'fix', 'approved', 'default'],
      ['t-04', 'verify', 'approved', 'default'],
    ])
    const third = starts(s)[2]
    expect(third?.args).toContain('--session-id')
    expect(third?.args.at(-1)).toContain(path.join('tasks', '02-intake', 'context.md'))
    // 앞 task의 세션이 아니라 새 세션이다
    expect(third?.args).not.toContain(w.tasks[0]?.session?.id)
    expect(fs.readdirSync(path.join(s.dir(key), 'tasks'))).toEqual([
      '01-intake',
      '02-intake',
      '03-fix',
      '04-verify',
    ])
  })

  it('SessionEnd 뒤 아직 끝나지 않은 프로세스는 [세션 재개] 전에 끝내고 자리를 돌려받는다 (D18)', async () => {
    const s = await setup(
      {
        tasks: {
          'work-start': [{ do: 'prompt' }, { do: 'stop' }, { do: 'exit', linger: 5000 }],
        },
      },
      { session_limit: 1 },
    )
    const a = await s.create('버그 A')
    await untilTask(s, a, (t) => t.status === 'session_ended', '세션 종료')
    const old = starts(s)[0]?.pid ?? 0
    expect(alive(old)).toBe(true)
    // 앞 프로세스가 살아 있는 동안 다시 연다
    expect(await s.h.relay.resume(a, 't-01')).toEqual({ ok: true })
    await untilTask(s, a, (t) => t.live, '재개')
    expect(alive(old)).toBe(false)
    // 자리는 다시 연 세션 하나만 쓴다. 그 세션을 끝내면 기다리던 Work가 시작한다
    const b = await s.create('버그 B')
    await untilTask(s, b, (t) => t.status === 'queued', 'B 대기열')
    expect(await s.h.relay.interrupt(a, 't-01')).toEqual({ ok: true })
    await untilTask(s, b, (t) => t.live, 'B 시작')
    expect(s.h.ui.works.get(a)?.tasks[0]?.statusLabel).toBe('중단됨')
  })

  it('다시 켜면 실행 중이던 task는 중단됨이나 승인 대기로, 대기열의 task는 중단됨으로 바꾼다 (시나리오 9, D75, D78)', async () => {
    const draft = intentDraft('S')
    const s = await setup(
      {
        tasks: { ...scenario('S').tasks, 'work-start': [{ do: 'prompt' }, { do: 'wait' }] },
      },
      { session_limit: 2 },
    )
    // A: handoff를 쓰고 Stop 전에 끊김. C: handoff 없이 작업 중. B: 대기열
    const a = await s.create('버그 A')
    const c = await s.create('버그 C')
    const b = await s.create('버그 B')
    await untilTask(s, a, (t) => t.live, 'A 작업 중')
    await untilTask(s, c, (t) => t.live, 'C 작업 중')
    await untilTask(s, b, (t) => t.status === 'queued', 'B 대기열')
    await untilPrompts(s, 2)
    const aTask = path.join(s.dir(a), 'tasks', '01-intake')
    fs.writeFileSync(path.join(aTask, 'intent.draft.md'), draft)
    fs.writeFileSync(
      path.join(aTask, 'handoff.md'),
      handoff({ decisions: [{ what: '크기는 S', why: '이유', by: 'ai' }] }),
    )
    await Promise.all([a, b, c].map((key) => settle(s.h, key)))
    // 충돌 직전의 work.json을 남긴다(앱이 꺼진 동안 받지 못한 Stop)
    const crashed = Object.fromEntries(
      [a, b, c].map((key) => [key, read(path.join(s.dir(key), 'work.json'))]),
    )
    const cSession = work(s.dir(c)).tasks[0]?.session
    await s.h.relay.close()
    for (const [key, text] of Object.entries(crashed)) {
      fs.writeFileSync(path.join(s.dir(key), 'work.json'), text)
    }
    const before = starts(s).length

    await s.h.reopen()
    for (const key of [a, b, c]) await settle(s.h, key)
    const wa = work(s.dir(a))
    expect(wa.tasks[0]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      check: { handoff_present: true, errors: [] },
    })
    expect(events(s.dir(a)).at(-1)).toMatchObject({
      type: 'task.awaiting_approval',
      payload: { reason: 'app_restart' },
    })
    const wc = work(s.dir(c))
    expect(wc.tasks[0]).toMatchObject({ status: 'interrupted', session: { alive: false } })
    expect(events(s.dir(c)).at(-1)).toMatchObject({
      type: 'task.interrupted',
      payload: { reason: 'app_restart' },
    })
    const wb = work(s.dir(b))
    expect(wb.tasks[0]).toMatchObject({ status: 'interrupted', session: null })
    expect(wb.tasks[0]?.queued_at).toBeUndefined()
    expect(events(s.dir(b)).at(-1)).toMatchObject({
      type: 'task.interrupted',
      payload: { reason: 'app_restart', queued: true },
    })
    // 자동으로 재개하거나 알리지 않는다
    expect(starts(s)).toHaveLength(before)
    expect(s.h.ui.notices).toEqual([])
    expect(s.h.ui.works.get(a)?.badge.kind).toBe('awaiting_approval')
    // 끝난 task의 탭은 pty.log를 읽어 읽기 전용으로 보인다
    const backlog = await s.h.relay.terminalAttach(`${c}/t-01`)
    expect(backlog).toMatchObject({ live: false })
    expect(backlog.data).toContain('FAKE-CLAUDE READY')

    // [재개]: C는 같은 세션 id로 --resume, 한 번도 띄우지 못한 B는 새 세션으로 시작한다
    expect(await s.h.relay.resume(c, 't-01')).toEqual({ ok: true })
    expect(await s.h.relay.resume(b, 't-01')).toEqual({ ok: true })
    await untilTask(s, c, (t) => t.live, 'C 재개')
    await untilTask(s, b, (t) => t.live, 'B 시작')
    await s.h.ui.until(() => starts(s).length === before + 2, '가짜 claude 둘', 30_000)
    const after = starts(s).slice(before)
    const cStart = after.find((x) => x.resume)
    expect(cStart?.args).toContain(cSession?.id)
    const bStart = after.find((x) => !x.resume)
    expect(bStart?.args).toContain('--session-id')
    // A는 세션 없이 승인한다
    expect(await s.h.relay.approve(a, 't-01', { size: 'S' })).toEqual({ ok: true })
  })

  it('설정: 세션 상한을 올리면 대기열이 바로 시작하고, 질문 방식은 다음에 시작하는 task부터 쓴다 (D70, D72, D73)', async () => {
    const s = await setup(scenario('M'), { session_limit: 1 })
    const a = await s.create('버그 A')
    const b = await s.create('버그 B', { question_mode: { 'work-start': 'confirm_each' } })
    await untilTask(s, b, (t) => t.status === 'queued', 'B 대기열')
    expect((await s.h.relay.updateConfig({ session_limit: 0 })).ok).toBe(false)
    expect((await s.h.relay.updateConfig({ auto_approve: { fix: true } })).ok).toBe(false)
    // 세션 상한을 올리면 바로 적용한다 (D73)
    expect(await s.h.relay.updateConfig({ session_limit: 2 })).toMatchObject({ ok: true })
    await untilTask(s, b, (t) => t.live, 'B 시작')
    const config = JSON.parse(read(path.join(s.h.home, 'config.json'))) as { session_limit: number }
    expect(config.session_limit).toBe(2)
    // Work별 질문 방식 (D72)
    const bCtx = read(path.join(s.dir(b), 'tasks', '01-intake', 'context.md'))
    expect(bCtx).toContain('결정마다 확인 (`confirm_each`)')
    expect(work(s.dir(b)).settings).toEqual({ question_mode: { 'work-start': 'confirm_each' } })

    // A: intake가 돌고 있을 때 바꾼 질문 방식은 다음 task부터 쓴다 (D73)
    await untilTask(s, a, (t) => t.live, 'A 작업 중')
    expect(
      await s.h.relay.updateConfig({
        question_mode: { 'work-start': 'confirm_each', evidence: 'confirm_each' },
      }),
    ).toMatchObject({ ok: true })
    expect(
      await s.h.relay.updateWorkSettings(a, { question_mode: { 'root-cause': 'confirm_each' } }),
    ).toEqual({ ok: true })
    expect((await s.h.relay.updateWorkSettings(a, { question_mode: { fix: 'x' } })).ok).toBe(false)
    const result = await drive(s.h.relay, s.h.ui, a, { size: 'M' })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, a)
    const ctx = (dir: string) => read(path.join(s.dir(a), 'tasks', dir, 'context.md'))
    expect(ctx('01-intake')).toContain('초안 우선 (`draft_first`)')
    expect(ctx('02-evidence')).toContain('결정마다 확인 (`confirm_each`)')
    expect(ctx('03-rca')).toContain('결정마다 확인 (`confirm_each`)')
    expect(ctx('04-fix')).toContain('초안 우선 (`draft_first`)')
    expect(work(s.dir(a)).settings).toEqual({ question_mode: { 'root-cause': 'confirm_each' } })
  })

  it('task 설정 파일은 자동 메모리를 끈다 (D113)', async () => {
    const s = await setup({ tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } })
    const key = await s.create()
    await untilTask(s, key, (t) => t.live, '작업 중')
    const settings = JSON.parse(
      read(path.join(s.dir(key), 'tasks', '01-intake', 'task.settings.json')),
    ) as { autoMemoryEnabled?: boolean }
    expect(settings.autoMemoryEnabled).toBe(false)
  })
})

function alive(pid: number): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
