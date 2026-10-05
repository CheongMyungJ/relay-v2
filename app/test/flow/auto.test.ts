// [흐름] 자동 승인 (docs/implementation.md M7, I25, I26).
// 조건을 모두 만족하면 카운트다운 뒤 자동 승인하고 다음 단계로 간다(4.3). [취소]와 새 요청, [즉시 중단], 세션 종료,
// 조건을 어긴 handoff는 카운트다운을 멈추고 사람의 승인을 기다린다(D130). 확인 창으로 앱을 끄거나 [단계 선택]으로
// 세션을 끝내도 멈추고, 까닭은 끝낸 까닭대로 남는다(D145). 멈춘 뒤에는 턴이 끝날 때 다시 판정한다(D131). 조건을
// 어기면 카운트다운하지 않는다(4.3, D129). Work 설정이 앱 설정보다 우선하고(D72), 자동 승인 여부는 턴이 끝날 때의
// 설정을 쓴다(D73, D128). 카운트다운 시작을 알리고(D81), 앱을 다시 켜면 자동 승인하지 않는다(D75).
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../../src/shared/config'
import type { TaskView, WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, sleep, type Harness } from './harness'
import {
  FIXED_FILES,
  FIX_DOC,
  REPO_FILES,
  REQUEST,
  handoff,
  scenario,
  type Scenario,
  type Step,
} from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

interface Setup {
  h: Harness
  /** Work를 만들고 키를 돌려준다 */
  create(request?: string, settings?: object): Promise<string>
  /** Work 디렉터리 */
  dir(workKey: string): string
  /** worktree */
  tree(workKey: string): string
}

async function setup(
  s: Scenario,
  config: Partial<AppConfig>,
  o: { productDefaults?: boolean } = {},
): Promise<Setup> {
  h = await harness({ scenario: s, config, ...o })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  return {
    h: hh,
    create: async (request = REQUEST, settings?: object) => {
      const r = await hh.relay.createWork(projectId, {
        request,
        baseBranch: 'main',
        type: 'bugfix',
        baseLocation: 'local',
        ...(settings ? { settings } : {}),
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (workKey) =>
      path.join(hh.home, 'projects', projectId, 'works', workKey.split('/')[1] ?? ''),
    tree: (workKey) =>
      path.join(hh.home, 'projects', projectId, 'worktrees', workKey.split('/')[1] ?? ''),
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

/** decisions.md의 머리 줄 (5.4) */
function heads(dir: string): string[] {
  return read(path.join(dir, 'decisions.md'))
    .split('\n')
    .filter((l) => l.startsWith('## '))
    .map((l) => l.replace(/ — \d{4}-\d\d-\d\d \d\d:\d\d /, ' — '))
}

/** task.approved의 승인 방식 (5.5) */
function approvedBy(dir: string): [string | undefined, unknown][] {
  return events(dir)
    .filter((e) => e.type === 'task.approved')
    .map((e) => [e.task_id, e.payload['by']])
}

/** Work 스냅샷의 task가 pred를 만족할 때까지 기다린다. taskId가 없으면 지금 task다 */
function untilTask(
  s: Setup,
  workKey: string,
  pred: (t: TaskView, w: WorkView) => boolean,
  label: string,
  taskId?: string,
) {
  return s.h.ui.until(
    () => {
      const w = s.h.ui.works.get(workKey)
      const t = w?.tasks.find((x) => x.id === (taskId ?? w.current))
      return w && t && pred(t, w) ? t : null
    },
    label,
    60_000,
  )
}

/** 가짜 claude가 UserPromptSubmit을 n번 보낼 때까지 기다린다 */
function untilPrompts(s: Setup, n: number) {
  const count = () =>
    s.h.records().filter((r) => r['type'] === 'hook' && r['event'] === 'UserPromptSubmit').length
  return s.h.ui.until(() => count() >= n, `UserPromptSubmit ${n}번`, 30_000)
}

/** 이 Work의 스냅샷 가운데 카운트다운이 있던 task */
function counted(s: Setup, workKey: string): string[] {
  const ids = s.h.ui.history
    .filter((w) => w.key === workKey)
    .flatMap((w) => w.tasks.filter((t) => t.countdown !== null).map((t) => t.id))
  return [...new Set(ids)]
}

const noticesOf = (s: Setup, workKey: string) =>
  s.h.ui.notices.filter((n) => n.workKey === workKey).map((n) => n.body)

/** 자동 승인을 켤 수 있는 파이프라인 단계는 원인 분석과 수정뿐이다 (4.2, D229) */
const ALL_AUTO = {
  fix: true,
  design: true,
  implement: true,
  refactor: true,
  execute: true,
  respond: false,
}

/** 카운트다운이 끝나기 전에 [취소]할 수 있게 넉넉히 둔 카운트다운 */
const LONG = 600

describe('[흐름] 자동 승인 (M7)', () => {
  it('조건을 모두 만족하면 카운트다운 뒤 자동 승인되고 다음 단계로 간다. decisions.md의 머리 줄과 task.approved에 자동 승인이 남고, 카운트다운 시작을 알린다 (4.3, 5.4, 5.5, D81)', async () => {
    const s = await setup(scenario(), { auto_approve: ALL_AUTO, auto_approve_countdown_sec: 1 })
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    // 의도 승인과 리뷰와 검증(Work 완료)은 늘 사람이 한다 (4.2)
    expect(result.tasks.map((t) => [t.label, t.auto])).toEqual([
      ['01 의도 정리', false],
      ['02 원인 분석과 수정', true],
      ['03 리뷰와 검증', false],
    ])
    await settle(s.h, key)
    const dir = s.dir(key)
    const w = work(dir)
    expect(w.tasks.map((t) => [t.id, t.approved_by])).toEqual([
      ['t-01', 'human'],
      ['t-02', 'auto'],
      ['t-03', 'human'],
    ])
    expect(w.tasks.every((t) => t.countdown === undefined && t.auto_hold === undefined)).toBe(true)
    expect(approvedBy(dir)).toEqual([
      ['t-01', 'human'],
      ['t-02', 'auto'],
      ['t-03', 'human'],
    ])
    expect(heads(dir)).toEqual([
      '## t-01 intake — (사람 승인)',
      '## t-02 fix — (자동 승인)',
      '## t-03 verify — (사람 승인)',
    ])
    // 자동 승인도 사람 승인과 같은 길로 decisions.md에 덧붙이고 해시를 적는다. 다시 읽어도 경고가 없다 (D124)
    const hash = createHash('sha256')
      .update(fs.readFileSync(path.join(dir, 'decisions.md')))
      .digest('hex')
    expect(w.file_hashes?.['decisions.md']).toBe(`sha256:${hash}`)
    expect(s.h.ui.works.get(key)?.notices).toEqual([])
    // 카운트다운 시작을 알린다. 보고 있는 Work인지는 창(main/index)이 가린다 (D81)
    const notices = noticesOf(s, key)
    expect(notices).toContain('02 원인 분석과 수정: 1초 뒤 자동 승인 (멈추려면 [취소])')
    expect(notices).not.toContain('02 원인 분석과 수정: 승인 대기')
    // 리뷰와 검증은 카운트다운하지 않고 승인 대기를 알린다
    expect(notices).toContain('03 리뷰와 검증: 승인 대기')
    expect(notices.some((n) => n.startsWith('03 리뷰와 검증: 1초 뒤'))).toBe(false)
    expect(counted(s, key)).toEqual(['t-02'])
    // 마무리 안내 문구는 수동과 자동을 한 문구에 적는다 (D132)
    const ctx = read(path.join(dir, 'tasks', '02-fix', 'context.md'))
    expect(ctx).toContain('자동 승인이 켜져 있으면 조건을 만족할 때 카운트다운 뒤 승인되고')
    expect(ctx).toContain('자동 승인 (task를 시작할 때의 설정.')
    const verifyCtx = read(path.join(dir, 'tasks', '03-verify', 'context.md'))
    expect(verifyCtx).toContain('수동 승인 (의도 승인, Work 완료는 늘 수동)')
    expect(verifyCtx).not.toContain('자동 승인이 켜져 있으면')
  })

  it('앱의 기본값은 원인 분석과 수정만 자동 승인한다. 의도 승인과 리뷰와 검증(Work 완료)은 사람이 한다 (D214, D229)', async () => {
    const s = await setup(scenario(), { auto_approve_countdown_sec: 1 }, { productDefaults: true })
    const key = await s.create()
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => [t.label, t.auto])).toEqual([
      ['01 의도 정리', false],
      ['02 원인 분석과 수정', true],
      ['03 리뷰와 검증', false],
    ])
    await settle(s.h, key)
    const dir = s.dir(key)
    expect(approvedBy(dir)).toEqual([
      ['t-01', 'human'],
      ['t-02', 'auto'],
      ['t-03', 'human'],
    ])
    expect(noticesOf(s, key)).toContain('02 원인 분석과 수정: 1초 뒤 자동 승인 (멈추려면 [취소])')
    expect(counted(s, key)).toEqual(['t-02'])
    const ctx = read(path.join(dir, 'tasks', '02-fix', 'context.md'))
    expect(ctx).toContain('자동 승인 (task를 시작할 때의 설정.')
  })

  it('[취소]를 누르면 멈추고 사람의 승인을 기다린다. 감시가 조건을 어긴 handoff를 보아도 멈춘다. 멈춘 뒤에는 턴이 끝날 때 다시 판정한다 (4.3, D130, D131)', async () => {
    const fix: Step[] = [
      { do: 'prompt' },
      { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
      { do: 'write', file: 'fix.md', text: FIX_DOC },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '첫 수정' }) },
      { do: 'stop' },
      { do: 'waitEnter' },
      { do: 'prompt', text: '요약을 고쳐 줘' },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '고친 수정' }) },
      { do: 'stop' },
      { do: 'wait' },
    ]
    const s = await setup(scenario({ fix }), {
      auto_approve: {
        fix: true,
        design: false,
        implement: true,
        refactor: true,
        execute: true,
        respond: false,
      },
      auto_approve_countdown_sec: 4,
    })
    const key = await s.create()
    const paused = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    expect(paused.status, s.h.ui.dump()).toBe('paused')
    const first = await untilTask(s, key, (t) => t.countdown !== null, '카운트다운')
    expect(first.countdown?.seconds).toBe(4)
    expect(first.countdown?.endsAt).toBeGreaterThan(Date.now())

    // [취소]: 카운트다운을 멈추고 사람의 승인을 기다린다
    expect(await s.h.relay.cancelCountdown(key, first.id)).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.countdown === null, '취소')
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['cancel'] },
    })
    expect(work(s.dir(key)).tasks[1]?.countdown).toBeUndefined()
    const review = await s.h.relay.review(key, first.id)
    expect(review?.autoApprove).toEqual({
      on: true,
      hold: '자동 승인하지 않음: [취소]를 누름. 다음 턴이 끝날 때 다시 판정합니다.',
    })
    expect((await s.h.relay.cancelCountdown(key, first.id)).ok).toBe(false)
    // 카운트다운이 끝났을 때를 지나도 승인하지 않는다
    await sleep(5_000)
    expect(s.h.ui.works.get(key)?.tasks[1]?.status).toBe('awaiting_approval')
    // [취소]는 사람이 한 일이라 알리지 않는다
    expect(noticesOf(s, key).filter((n) => n.includes('자동 승인하지 않음'))).toEqual([])

    // 사람이 요청하고 에이전트가 고쳐 턴이 끝나면 다시 판정해 카운트다운한다 (D131)
    s.h.relay.terminalWrite(`${key}/${first.id}`, '\r')
    const second = await untilTask(
      s,
      key,
      (t) => t.countdown !== null && t.countdown.endsAt !== first.countdown?.endsAt,
      '다시 카운트다운',
    )
    // 감시가 조건을 어긴 handoff를 보면 멈춘다 (D130)
    const handoffFile = path.join(s.dir(key), 'tasks', '02-fix', 'handoff.md')
    fs.writeFileSync(handoffFile, handoff({ summary: '고친 수정', open_questions: ['기대 동작?'] }))
    await untilTask(s, key, (t) => t.countdown === null, '조건을 어겨 멈춤')
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['open_questions'] },
    })
    expect(noticesOf(s, key)).toContain(
      '02 원인 분석과 수정: 승인 대기 — 자동 승인하지 않음(열린 질문이 있음)',
    )
    await sleep(5_000)
    expect(s.h.ui.works.get(key)?.tasks[1]?.status).toBe('awaiting_approval')
    // 조건을 다시 만족해도 카운트다운은 턴이 끝날 때만 시작한다 (D128)
    fs.writeFileSync(handoffFile, handoff({ summary: '고친 수정' }))
    await sleep(1_000)
    expect(s.h.ui.works.get(key)?.tasks[1]?.countdown).toBeNull()

    // 사람이 승인한다
    expect(await s.h.relay.approve(key, second.id, {})).toEqual({ ok: true })
    const done = await drive(s.h.relay, s.h.ui, key)
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    expect(approvedBy(s.dir(key))).toEqual([
      ['t-01', 'human'],
      ['t-02', 'human'],
      ['t-03', 'human'],
    ])
    expect(heads(s.dir(key))[1]).toBe('## t-02 fix — (사람 승인)')
  })

  it('카운트다운 중에 터미널에 새 요청이 오면 멈춘다. 고친 뒤 턴이 끝나면 다시 판정하고, 바꾼 카운트다운 초는 다음 카운트다운부터 쓴다 (4.3, D128, D131)', async () => {
    const fix: Step[] = [
      { do: 'prompt' },
      { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
      { do: 'write', file: 'fix.md', text: FIX_DOC },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '첫 수정' }) },
      { do: 'stop' },
      { do: 'waitEnter' },
      { do: 'prompt', text: '테스트 이름을 바꿔 줘' },
      {
        do: 'write',
        file: 'handoff.md',
        text: handoff({
          summary: '고친 수정',
          decisions: [{ what: '테스트 이름을 바꿈', why: '사람이 요청함', by: 'human' }],
        }),
      },
      { do: 'stop' },
    ]
    const s = await setup(scenario({ fix }), {
      auto_approve: {
        fix: true,
        design: false,
        implement: true,
        refactor: true,
        execute: true,
        respond: false,
      },
      auto_approve_countdown_sec: 60,
    })
    const key = await s.create()
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    const first = await untilTask(s, key, (t) => t.countdown !== null, '카운트다운')
    expect(first.countdown?.seconds).toBe(60)
    // 카운트다운 초를 바꾸면 다음 카운트다운부터 쓴다 (D128)
    expect(await s.h.relay.updateConfig({ auto_approve_countdown_sec: 1 })).toMatchObject({
      ok: true,
    })
    await settle(s.h, key)
    expect(s.h.ui.works.get(key)?.tasks[1]?.countdown?.seconds).toBe(60)

    // 새 요청: 작업 중이 되고 카운트다운이 멈춘다
    s.h.relay.terminalWrite(`${key}/${first.id}`, '\r')
    await untilPrompts(s, 3)
    // 고친 뒤 턴이 끝나면 다시 판정한다. 이번 카운트다운은 1초라 곧 자동 승인된다
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.find((t) => t.label === '02 원인 분석과 수정')?.auto).toBe(true)
    const fixViews = s.h.ui.history
      .filter((w) => w.key === key)
      .map((w) => w.tasks[1])
      .filter((t): t is TaskView => t !== undefined)
    // 새 요청을 받은 때는 작업 중이고 카운트다운이 없다
    expect(fixViews.some((t) => t.status === 'working' && t.countdown === null)).toBe(true)
    expect([
      ...new Set(fixViews.flatMap((t) => (t.countdown ? [t.countdown.seconds] : []))),
    ]).toEqual([60, 1])
    await settle(s.h, key)
    const dir = s.dir(key)
    expect(approvedBy(dir)[1]).toEqual(['t-02', 'auto'])
    expect(read(path.join(dir, 'decisions.md'))).toContain(
      '[사람] 테스트 이름을 바꿈 — 사람이 요청함',
    )
  })

  it('조건을 하나라도 어기면 카운트다운하지 않고 까닭과 함께 알린다: 열린 질문, 백그라운드 작업, 의도와 어긋남 (4.3, D129, D130)', async () => {
    // 원인 분석과 수정이 턴마다 조건 하나를 어긴다. 사람이 새 요청을 보내면 다음 턴으로 간다
    const fix: Step[] = [
      { do: 'prompt' },
      { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
      { do: 'write', file: 'fix.md', text: FIX_DOC },
      { do: 'write', file: 'handoff.md', text: handoff({ open_questions: ['기대 동작?'] }) },
      { do: 'stop' },
      { do: 'waitEnter' },
      { do: 'prompt', text: '기대 동작은 0' },
      { do: 'write', file: 'handoff.md', text: handoff() },
      {
        do: 'stop',
        background: [{ id: 'task-1', type: 'subagent', status: 'running', description: '조사' }],
      },
      { do: 'waitEnter' },
      { do: 'prompt', text: '조사를 마쳐 줘' },
      {
        do: 'write',
        file: 'handoff.md',
        text: handoff({
          intent_deviation: { summary: '범위 밖 파일도 고침', evidence: 'src/x.js' },
        }),
      },
      { do: 'stop' },
    ]
    const s = await setup(scenario({ fix }), {
      auto_approve: ALL_AUTO,
      auto_approve_countdown_sec: 1,
    })
    const key = await s.create()
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    const held = [
      '02 원인 분석과 수정: 승인 대기 — 자동 승인하지 않음(열린 질문이 있음)',
      '02 원인 분석과 수정: 승인 대기 — 자동 승인하지 않음(턴이 끝날 때 백그라운드 작업이나 예약된 깨우기가 남아 있었음)',
      '02 원인 분석과 수정: 승인 대기 — 자동 승인하지 않음(의도와 어긋남(intent_deviation)이 있음)',
    ]
    for (const [i, notice] of held.entries()) {
      await s.h.ui.until(() => noticesOf(s, key).includes(notice), notice, 30_000)
      if (i === held.length - 1) break
      // 사람이 새 요청을 보낸다: 다음 턴이 끝날 때 다시 판정한다 (D131)
      s.h.relay.terminalWrite(`${key}/t-02`, '\r')
      await untilPrompts(s, 3 + i)
    }
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.every((t) => !t.auto)).toBe(true)
    expect(counted(s, key)).toEqual([])
    await settle(s.h, key)
    const dir = s.dir(key)
    expect(approvedBy(dir).every(([, by]) => by === 'human')).toBe(true)
    // 승인하면 까닭은 지운다
    expect(work(dir).tasks.every((t) => t.auto_hold === undefined)).toBe(true)
  })

  it('Work 설정이 앱 설정보다 우선한다 (D72)', async () => {
    const s = await setup(scenario(), {
      auto_approve: {
        fix: false,
        design: false,
        implement: false,
        refactor: false,
        execute: false,
        respond: false,
      },
      auto_approve_countdown_sec: 1,
    })
    // 앱 설정은 꺼짐: Work A는 켜서 자동 승인, Work B는 앱 설정을 따라 사람 승인
    const a = await s.create('버그 A', { auto_approve: { fix: true } })
    const b = await s.create('버그 B')
    const [ra, rb] = await Promise.all(
      [a, b].map((key) => drive(s.h.relay, s.h.ui, key, { awaitAuto: true })),
    )
    expect(ra, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(rb, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    // 앱 설정을 켜고, Work C는 꺼서 사람 승인
    expect(await s.h.relay.updateConfig({ auto_approve: { fix: true } })).toMatchObject({
      ok: true,
    })
    const c = await s.create('버그 C', { auto_approve: { fix: false } })
    const rc = await drive(s.h.relay, s.h.ui, c, { awaitAuto: true })
    expect(rc, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    for (const key of [a, b, c]) await settle(s.h, key)
    expect(work(s.dir(a)).settings).toEqual({ auto_approve: { fix: true } })
    expect(work(s.dir(b)).settings).toEqual({})
    expect(work(s.dir(c)).settings).toEqual({ auto_approve: { fix: false } })
    expect(approvedBy(s.dir(a))[1]).toEqual(['t-02', 'auto'])
    expect(approvedBy(s.dir(b))[1]).toEqual(['t-02', 'human'])
    expect(approvedBy(s.dir(c))[1]).toEqual(['t-02', 'human'])
    expect(counted(s, b)).toEqual([])
    expect(counted(s, c)).toEqual([])
  })

  it('자동 승인 여부는 턴이 끝날 때의 설정을 쓴다. 카운트다운 중에 끄면 바로 멈추고, 이미 승인 대기면 켜도 시작하지 않는다 (D73, D128)', async () => {
    const fix: Step[] = [
      { do: 'prompt' },
      { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
      { do: 'write', file: 'fix.md', text: FIX_DOC },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '첫 수정' }) },
      { do: 'waitEnter' },
      { do: 'stop' },
      { do: 'waitEnter' },
      { do: 'prompt', text: '다시 봐 줘' },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '다시 본 수정' }) },
      { do: 'stop' },
      { do: 'wait' },
    ]
    const s = await setup(scenario({ fix }), {
      auto_approve: {
        fix: false,
        design: false,
        implement: false,
        refactor: false,
        execute: false,
        respond: false,
      },
      auto_approve_countdown_sec: LONG,
    })
    const key = await s.create()
    await untilTask(s, key, (t) => t.status === 'awaiting_approval', '의도 정리 승인 대기')
    expect(await s.h.relay.approve(key, 't-01', {})).toEqual({ ok: true })
    // fix가 도는 중에(턴이 끝나기 전에) 앱 설정을 켠다
    const fixTask = await untilTask(s, key, (t) => t.node === 'fix' && t.live, '수정 작업 중')
    await untilPrompts(s, 2)
    const ctx = read(path.join(s.dir(key), 'tasks', '02-fix', 'context.md'))
    expect(ctx).toContain('수동 승인 (task를 시작할 때의 설정.')
    expect(await s.h.relay.updateConfig({ auto_approve: { fix: true } })).toMatchObject({
      ok: true,
    })
    s.h.relay.terminalWrite(`${key}/${fixTask.id}`, '\r')
    // task를 시작할 때는 꺼져 있었지만 턴이 끝날 때 켜져 있어 카운트다운한다 (D73)
    await untilTask(s, key, (t) => t.countdown !== null, '카운트다운')

    // Work 설정으로 끄면 바로 멈춘다 (D128)
    expect(await s.h.relay.updateWorkSettings(key, { auto_approve: { fix: false } })).toEqual({
      ok: true,
    })
    await untilTask(s, key, (t) => t.countdown === null, 'Work 설정으로 멈춤')
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks[1]?.auto_hold?.reasons).toEqual(['settings'])
    // 앱 설정을 따르게 되돌려(켜짐) 이미 승인 대기인 task는 카운트다운하지 않는다
    expect(await s.h.relay.updateWorkSettings(key, { auto_approve: {} })).toEqual({ ok: true })
    await settle(s.h, key)
    expect(work(s.dir(key)).settings).toEqual({})
    expect(s.h.ui.works.get(key)?.tasks[1]?.countdown).toBeNull()
    expect((await s.h.relay.review(key, fixTask.id))?.autoApprove).toEqual({
      on: true,
      hold: '자동 승인하지 않음: 카운트다운 중에 자동 승인을 끔. 다음 턴이 끝날 때 다시 판정합니다.',
    })

    // 사람이 요청하고 턴이 끝나면 다시 판정한다. 앱 설정으로 끄면 바로 멈춘다 (D128)
    s.h.relay.terminalWrite(`${key}/${fixTask.id}`, '\r')
    await untilPrompts(s, 3)
    await untilTask(s, key, (t) => t.countdown !== null, '다시 카운트다운')
    expect(await s.h.relay.updateConfig({ auto_approve: { fix: false } })).toMatchObject({
      ok: true,
    })
    await untilTask(s, key, (t) => t.countdown === null, '앱 설정으로 멈춤')
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks[1]?.auto_hold?.reasons).toEqual(['settings'])
    // 설정을 끈 것은 사람이 한 일이라 알리지 않는다
    expect(noticesOf(s, key).filter((n) => n.includes('자동 승인하지 않음'))).toEqual([])

    expect(await s.h.relay.approve(key, fixTask.id, {})).toEqual({ ok: true })
    const done = await drive(s.h.relay, s.h.ui, key)
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
  })

  it('앱 설정을 바꾸면 상태가 그대로인 Work도 스냅샷을 다시 보내, 승인 화면이 새 설정으로 안내를 다시 읽는다 (D128)', async () => {
    const s = await setup(scenario(), {
      auto_approve: {
        fix: false,
        design: false,
        implement: false,
        refactor: false,
        execute: false,
        respond: false,
      },
      auto_approve_countdown_sec: LONG,
    })
    const key = await s.create()
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    const fix = await untilTask(
      s,
      key,
      (t) => t.node === 'fix' && t.status === 'awaiting_approval',
      '수정 승인 대기',
    )
    expect((await s.h.relay.review(key, fix.id))?.autoApprove).toEqual({ on: false, hold: null })
    // 화면은 스냅샷의 revision이 바뀔 때 승인 화면을 다시 읽는다(App.tsx의 reviewKey)
    const revision = () => s.h.ui.works.get(key)?.revision ?? 0
    const snapshot = (after: number, label: string) =>
      s.h.ui.until(() => revision() > after, label, 5_000)
    /** 늦게 온 스냅샷(감시의 검사 등)이 1초 동안 없을 때까지 기다린다 */
    const quiet = async () => {
      for (let last = revision(); ; last = revision()) {
        await sleep(1_000)
        if (revision() === last) return last
      }
    }

    // 켠다: 이미 승인 대기라 카운트다운하지 않아 상태는 그대로다 (D128)
    let before = await quiet()
    expect(await s.h.relay.updateConfig({ auto_approve: { fix: true } })).toMatchObject({
      ok: true,
    })
    await snapshot(before, '켠 뒤 스냅샷')
    expect(s.h.ui.works.get(key)?.tasks[1]?.countdown).toBeNull()
    expect((await s.h.relay.review(key, fix.id))?.autoApprove).toEqual({
      on: true,
      hold: '자동 승인은 턴이 끝날 때 판정합니다. 이 결과는 사람이 승인합니다. 다음 턴이 끝날 때 다시 판정합니다.',
    })

    // 끈다
    before = await quiet()
    expect(await s.h.relay.updateConfig({ auto_approve: { fix: false } })).toMatchObject({
      ok: true,
    })
    await snapshot(before, '끈 뒤 스냅샷')
    expect((await s.h.relay.review(key, fix.id))?.autoApprove).toEqual({ on: false, hold: null })
  })

  it('[즉시 중단]과 세션 종료도 카운트다운을 멈춘다. 사람이 누르지 않은 세션 종료는 알린다 (D130, D131)', async () => {
    const s = await setup(
      {
        ...scenario({
          fix: [
            { do: 'prompt' },
            { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
            { do: 'write', file: 'fix.md', text: FIX_DOC },
            { do: 'write', file: 'handoff.md', text: handoff({ summary: '첫 수정' }) },
            { do: 'stop' },
            { do: 'wait' },
          ],
        }),
        resume: {
          fix: [
            { do: 'waitEnter' },
            { do: 'prompt', text: '이어서 해 줘' },
            { do: 'write', file: 'handoff.md', text: handoff({ summary: '이어서 한 수정' }) },
            { do: 'stop' },
            { do: 'sleep', ms: 1_500 },
            { do: 'exit' },
          ],
        },
      },
      {
        auto_approve: {
          fix: true,
          design: false,
          implement: true,
          refactor: true,
          execute: true,
          respond: false,
        },
        auto_approve_countdown_sec: LONG,
      },
    )
    const key = await s.create()
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    const t = await untilTask(s, key, (x) => x.countdown !== null, '카운트다운')

    // [즉시 중단]: 승인 대기로 남고 카운트다운은 멈춘다. 사람이 누른 것이라 알리지 않는다
    expect(await s.h.relay.interrupt(key, t.id)).toEqual({ ok: true })
    await untilTask(s, key, (x) => !x.live && x.countdown === null, '즉시 중단')
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['interrupt'] },
    })
    expect(noticesOf(s, key).filter((n) => n.includes('자동 승인하지 않음'))).toEqual([])

    // [세션 재개] 뒤 사람이 요청해 턴이 끝나면 다시 카운트다운한다 (D131). 카운트다운 중에 세션이 끝나면 멈추고 알린다
    expect(await s.h.relay.resume(key, t.id)).toEqual({ ok: true })
    await untilTask(s, key, (x) => x.live, '재개')
    s.h.relay.terminalWrite(`${key}/${t.id}`, '\r')
    await untilTask(s, key, (x) => x.countdown !== null, '다시 카운트다운')
    await untilTask(s, key, (x) => !x.live && x.countdown === null, '세션 종료')
    await settle(s.h, key)
    expect(work(s.dir(key)).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      auto_hold: { reasons: ['session'] },
    })
    expect(noticesOf(s, key)).toContain(
      '02 원인 분석과 수정: 승인 대기 — 자동 승인하지 않음(카운트다운 중에 세션이 끝남)',
    )
    // 세션이 없어도 사람은 승인한다
    expect(await s.h.relay.approve(key, t.id, {})).toEqual({ ok: true })
    const done = await drive(s.h.relay, s.h.ui, key)
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
  })

  it('카운트다운 중에 앱이 꺼졌다 켜지면 자동 승인하지 않는다. 다시 연 세션의 다음 턴은 다시 판정한다 (D75, D127, D131)', async () => {
    const s = await setup(
      {
        ...scenario({
          fix: [
            { do: 'prompt' },
            { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
            { do: 'write', file: 'fix.md', text: FIX_DOC },
            { do: 'write', file: 'handoff.md', text: handoff({ summary: '첫 수정' }) },
            { do: 'stop' },
            { do: 'wait' },
          ],
        }),
        resume: {
          fix: [
            { do: 'waitEnter' },
            { do: 'prompt', text: '이어서 해 줘' },
            { do: 'write', file: 'handoff.md', text: handoff({ summary: '이어서 한 수정' }) },
            { do: 'stop' },
            { do: 'wait' },
          ],
        },
      },
      {
        auto_approve: {
          fix: true,
          design: false,
          implement: true,
          refactor: true,
          execute: true,
          respond: false,
        },
        auto_approve_countdown_sec: 5,
      },
    )
    const key = await s.create()
    const dir = s.dir(key)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    const t = await untilTask(s, key, (x) => x.countdown !== null, '카운트다운')
    await settle(s.h, key)
    // 앱이 충돌한 때처럼 카운트다운 중의 work.json과 events.jsonl을 남긴다
    const crashed = read(path.join(dir, 'work.json'))
    const crashedEvents = read(path.join(dir, 'events.jsonl'))
    expect((JSON.parse(crashed) as WorkState).tasks[1]?.countdown?.seconds).toBe(5)
    await s.h.relay.close()
    fs.writeFileSync(path.join(dir, 'work.json'), crashed)
    fs.writeFileSync(path.join(dir, 'events.jsonl'), crashedEvents)

    await s.h.reopen()
    await settle(s.h, key)
    const reopened = work(dir).tasks[1]
    expect(reopened).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { reasons: ['restart'] },
    })
    expect(reopened?.countdown).toBeUndefined()
    // 카운트다운이 끝났을 때를 지나도 승인하지 않고, 재시작 조정은 알리지 않는다
    await sleep(6_000)
    expect(work(dir).tasks[1]?.status).toBe('awaiting_approval')
    expect(
      events(dir)
        .filter((e) => e.type === 'task.approved')
        .map((e) => e.task_id),
    ).toEqual(['t-01'])
    expect(s.h.ui.notices).toEqual([])
    expect((await s.h.relay.review(key, t.id))?.autoApprove.hold).toBe(
      '자동 승인하지 않음: 앱을 다시 켜며 승인 대기가 됨 (재시작 경로는 자동 승인하지 않음). 다음 턴이 끝날 때 다시 판정합니다.',
    )

    // [세션 재개]로 다시 열어 사람이 요청하고 턴이 끝나면 다시 판정해 자동 승인한다 (D131)
    expect(await s.h.relay.resume(key, t.id)).toEqual({ ok: true })
    await untilTask(s, key, (x) => x.live, '재개')
    s.h.relay.terminalWrite(`${key}/${t.id}`, '\r')
    // 새 요청을 받기 전의 승인 대기를 사람 역할이 승인하지 않게 요청을 기다린다
    await untilPrompts(s, 3)
    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    expect(approvedBy(dir)).toEqual([
      ['t-01', 'human'],
      ['t-02', 'auto'],
      ['t-03', 'human'],
    ])
  })

  it('확인 창으로 앱을 끄거나 [단계 선택]이 git에서 실패해도, 카운트다운을 멈춘 까닭은 끝낸 까닭대로 남는다 (D130, D145)', async () => {
    const s = await setup(
      {
        ...scenario({
          fix: [
            { do: 'prompt' },
            { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
            { do: 'write', file: 'fix.md', text: FIX_DOC },
            { do: 'write', file: 'handoff.md', text: handoff({ summary: '첫 수정' }) },
            { do: 'stop' },
            { do: 'wait' },
          ],
        }),
        resume: {
          fix: [
            { do: 'waitEnter' },
            { do: 'prompt', text: '이어서 해 줘' },
            { do: 'write', file: 'handoff.md', text: handoff({ summary: '이어서 한 수정' }) },
            { do: 'stop' },
            { do: 'wait' },
          ],
        },
      },
      {
        auto_approve: {
          fix: true,
          design: false,
          implement: true,
          refactor: true,
          execute: true,
          respond: false,
        },
        auto_approve_countdown_sec: LONG,
      },
    )
    const key = await s.create()
    const dir = s.dir(key)
    await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    const t = await untilTask(s, key, (x) => x.countdown !== null, '카운트다운')
    await settle(s.h, key)
    const hold = async () => (await s.h.relay.review(key, t.id))?.autoApprove.hold

    // 확인 창에서 [종료]를 누르면 앱이 세션을 끝내고 꺼진다(Relay.close). 다시 켜도 까닭은 그대로다
    await s.h.relay.close()
    await s.h.reopen()
    await settle(s.h, key)
    expect(work(dir).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { reasons: ['quit'] },
    })
    expect(await hold()).toBe(
      '자동 승인하지 않음: 카운트다운 중에 앱을 끔. 다음 턴이 끝날 때 다시 판정합니다.',
    )
    expect(s.h.ui.notices).toEqual([])

    // [세션 재개] 뒤 턴이 끝나 다시 카운트다운하는 중에 코드를 되돌리는 [단계 선택]을 고르고, git이 실패한다
    expect(await s.h.relay.resume(key, t.id)).toEqual({ ok: true })
    await untilTask(s, key, (x) => x.live, '재개')
    s.h.relay.terminalWrite(`${key}/${t.id}`, '\r')
    await untilTask(s, key, (x) => x.countdown !== null, '다시 카운트다운')
    await settle(s.h, key)
    const tree = s.tree(key)
    const lock = path.resolve(tree, git(tree, 'rev-parse', '--git-path', 'index.lock'))
    fs.writeFileSync(lock, '')
    const p = await s.h.relay.stepPreview(key, 'fix', false)
    if (!p.ok) throw new Error(`미리 보기 실패: ${p.error}`)
    expect(p.preview.code.kind).toBe('reset')
    const r = await s.h.relay.selectStep(key, {
      node: 'fix',
      keepCode: false,
      instruction: '',
      expect: p.preview.expect,
    })
    expect(!r.ok && r.error).toMatch(/^되감기 실패: /)
    await settle(s.h, key)
    fs.rmSync(lock)
    expect(work(dir).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
      auto_hold: { reasons: ['step'] },
    })
    expect(await hold()).toBe(
      '자동 승인하지 않음: [단계 선택]을 누름. 다음 턴이 끝날 때 다시 판정합니다.',
    )
    // 사람이 한 일이라 알리지 않는다
    expect(noticesOf(s, key).filter((n) => n.includes('자동 승인하지 않음'))).toEqual([])
  })
})
