// [흐름] 되감기와 단계 선택 (docs/implementation.md M4, I25, I26).
// verify에서 fix로 되감아 Work 완료까지(백업 브랜치), intake로 되감아 intent 새 버전(모든 산출물 폐기, D40),
// 진행 중인 fix의 커밋 안 된 변경(D116)과 [현재 코드 위에서 이어서], 건너뛰기(D117), 세션 상한(D18),
// git 실패와 백업 브랜치 번호(D115). 미리 보기(D82)가 실제 결과와 같은지도 본다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { NodeName, Size } from '../../src/shared/contracts'
import type { SelectStepInput, StepPreview, WorkView } from '../../src/shared/views'
import type { LifecycleEvent, TaskRecord, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { TIMING_EVENTS, git, harness, makeRepo, register, settle, type Harness } from './harness'
import {
  FIXED_FILES,
  REPO_FILES,
  REQUEST,
  handoff,
  intentDraft,
  scenario,
  steps,
  type Scenario,
  type Step,
} from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 파일을 지울 수 없게 표시한다 (Linux의 chattr +i, root만). 없거나 안 되면 false */
function immutable(file: string, on: boolean): boolean {
  if (process.platform !== 'linux') return false
  return spawnSync('chattr', [on ? '+i' : '-i', file]).status === 0
}

/** git clean만 실패시킬 수 있는가 (D136). Windows에서 잠긴 파일은 실기 확인에 맡긴다 */
const canLock = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-chattr-'))
  const file = path.join(dir, 'x')
  fs.writeFileSync(file, '')
  const ok = immutable(file, true)
  if (ok) immutable(file, false)
  fs.rmSync(dir, { recursive: true, force: true })
  return ok
})()

interface Setup {
  h: Harness
  repo: string
  create(request?: string): Promise<string>
  /** Work 디렉터리 */
  dir(workKey: string): string
  /** worktree */
  tree(workKey: string): string
}

async function setup(s: Scenario, config: object = {}): Promise<Setup> {
  h = await harness({ scenario: s, config })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const id = (key: string) => key.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    create: async (request = REQUEST) => {
      const r = await hh.relay.createWork(projectId, {
        request,
        baseBranch: 'main',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (key) => path.join(hh.home, 'projects', projectId, 'works', id(key)),
    tree: (key) => path.join(hh.home, 'projects', projectId, 'worktrees', id(key)),
  }
}

function work(dir: string): WorkState {
  return JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
}

/** events.jsonl. 세션의 시각(D217)은 이 파일의 시험이 보지 않아 뺀다 */
function events(dir: string): LifecycleEvent[] {
  return read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
    .filter((e) => !TIMING_EVENTS.includes(e.type))
}

/** Work 스냅샷의 지금 task가 pred를 만족할 때까지 기다린다 */
function untilTask(
  s: Setup,
  key: string,
  pred: (t: WorkView['tasks'][number], w: WorkView) => boolean,
  label: string,
) {
  return s.h.ui.until(
    () => {
      const w = s.h.ui.works.get(key)
      const t = w?.tasks.find((x) => x.id === w.current)
      return w && t && pred(t, w) ? t : null
    },
    label,
    60_000,
  )
}

async function preview(
  s: Setup,
  key: string,
  node: SelectStepInput['node'],
  keepCode = false,
): Promise<StepPreview> {
  const r = await s.h.relay.stepPreview(key, node, keepCode)
  if (!r.ok) throw new Error(`미리 보기 실패: ${r.error}`)
  return r.preview
}

/** 미리 본 대로 [확인]한다 */
function confirm(s: Setup, key: string, p: StepPreview, instruction = '', keepCode = false) {
  return s.h.relay.selectStep(key, { node: p.node, keepCode, instruction, expect: p.expect })
}

const statuses = (w: WorkState) => w.tasks.map((t) => [t.id, t.node, t.status, t.reason])
const taskOf = (w: WorkState, id: string) => w.tasks.find((t) => t.id === id) as TaskRecord
const taskDir = (s: Setup, key: string, name: string) => path.join(s.dir(key), 'tasks', name)

/** handoff가 이전 단계를 추천하는 단계 */
function recommending(node: NodeName, to: NodeName, reason: string, size?: Size): Step[] {
  return steps(node, size).map((st) =>
    st.do === 'write' && st.file === 'handoff.md'
      ? { ...st, text: handoff({ recommended_next: { node: to, reason } }) }
      : st,
  )
}

/** intake가 승인 대기가 되면 [의도 승인]한다. 다음 task(fix)가 시작한다 */
async function approveIntake(s: Setup, key: string): Promise<void> {
  await untilTask(s, key, (t) => t.id === 't-01' && t.status === 'awaiting_approval', '의도 정리')
  expect(await s.h.relay.approve(key, 't-01', { size: 'S' })).toEqual({ ok: true })
}

function alive(pid: number): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/** 수정이 끝나지 않은 fix: 커밋 하나를 하고, 커밋하지 않은 변경과 추적하지 않는 파일을 남긴 채 일한다 */
const UNFINISHED_FIX: Step[] = [
  { do: 'prompt' },
  { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
  {
    do: 'edit',
    files: {
      'src/avg.js': `${FIXED_FILES['src/avg.js']}// 고치는 중\n`,
      'scratch.txt': '실험 메모\n',
    },
  },
  { do: 'wait' },
]

describe('[흐름] 되감기와 단계 선택 (M4)', () => {
  it('verify의 추천대로 fix로 되감아 다시 Work 완료까지 간다. 되돌린 커밋은 백업 브랜치에 남는다 (6.2, D23, D115)', async () => {
    const s = await setup({
      tasks: { ...scenario('L').tasks, 't-06': recommending('verify', 'fix', '완료조건 2 실패') },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const stopped = await drive(s.h.relay, s.h.ui, key, { size: 'L' })
    expect(stopped, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 수정(fix)로 — 완료조건 2 실패',
    })
    await settle(s.h, key)
    const fixHead = git(s.tree(key), 'rev-parse', 'HEAD')
    expect(fixHead).not.toBe(base)
    const view = s.h.ui.works.get(key)
    expect(view?.actions.selectStep).toBe(true)
    // verify에서 멈춘 Work는 [재개] 대신 Work 완료 화면에서 전달을 고른다 (D119)
    expect(view?.actions.resumeWork).toBe(false)
    expect(view?.stopHint).toBe(
      '추천을 따르지 않고 Work 완료 화면에서 전달을 고르면 Work를 완료합니다. 추천대로 되돌아가려면 [단계 선택]을 누르세요.',
    )
    expect(view?.steps.find((c) => c.recommended)?.node).toBe('fix')

    // 미리 보기 (D82)
    const branch = `relay/${work(dir).work_id}-discarded-1`
    const p = await preview(s, key, 'fix')
    expect(p).toEqual({
      node: 'fix',
      title: '수정(fix)',
      kind: 'rewind',
      reason: '되감기',
      expect: { taskId: 't-06', done: true },
      interrupt: null,
      discard: [
        { taskId: 't-04', label: '04 수정', artifacts: ['fix.md'] },
        { taskId: 't-05', label: '05 리뷰', artifacts: ['review.md'] },
        { taskId: 't-06', label: '06 최종 검증', artifacts: ['pr.md', 'verification.md'] },
      ],
      skipped: [],
      code: { kind: 'reset', to: base, commits: 1, uncommitted: [], backupBranch: branch },
      keepCodeOffered: true,
      intent: null,
    })

    expect(await confirm(s, key, p, '완료조건 2의 빈 배열 경우를 다시 봐 줘')).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-07' && t.live, '되감은 fix')
    await settle(s.h, key)
    const w = work(dir)
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'evidence', 'approved', 'default'],
      ['t-03', 'rca', 'approved', 'default'],
      ['t-04', 'fix', 'discarded', 'default'],
      ['t-05', 'review', 'discarded', 'default'],
      ['t-06', 'verify', 'discarded', 'default'],
      ['t-07', 'fix', 'working', 'rewind'],
    ])
    expect(w.status).toBe('active')
    expect(w.stop).toBeUndefined()
    expect(w.operation).toBeUndefined()
    expect(taskOf(w, 't-04')).toMatchObject({ discarded_by: 't-07', approved_by: 'human' })
    expect(taskOf(w, 't-07').selection).toEqual({
      from_task: 't-06',
      instruction: '완료조건 2의 빈 배열 경우를 다시 봐 줘',
      discarded: ['t-04', 't-05', 't-06'],
      skipped: [],
      keep_code: false,
      reset: { from: fixHead, to: base, backup_branch: branch, backup_commit: fixHead },
    })
    // 미리 보기대로: 되돌린 커밋은 백업 브랜치에 있고, 되감은 fix는 기준 커밋에서 시작했다
    expect(git(s.repo, 'rev-parse', branch)).toBe(fixHead)
    expect(taskOf(w, 't-07').start_commit).toBe(base)
    const tabs = s.h.ui.works.get(key)?.tasks
    expect(tabs?.at(-1)?.band).toBe('07 수정 · 새 세션 · 이유: 되감기')
    expect(tabs?.[3]).toMatchObject({ status: 'discarded', statusLabel: '폐기됨', live: false })
    // 폐기된 task의 [변경]은 그 task가 끝났을 때의 코드까지다. 지금 작업 트리는 보지 않는다 (D83)
    const oldFix = await s.h.relay.review(key, 't-04')
    expect(oldFix?.diff).toContain('+  if (xs.length === 0) return 0')
    expect(oldFix?.emphasis.map((e) => e.kind)).not.toContain('uncommitted')
    const oldVerify = await s.h.relay.review(key, 't-06')
    expect(oldVerify?.diff).toBe('')
    expect(oldVerify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')

    // context.md: 되감기 절이 맨 위이고, 폐기된 task는 입력에서 빠진다
    const ctx = read(path.join(taskDir(s, key, '07-fix'), 'context.md'))
    const top = ctx.indexOf('## 되감기로 들어옴 (먼저 읽을 것)')
    expect(top).toBeGreaterThan(0)
    expect(top).toBeLessThan(ctx.indexOf('## task 정보'))
    expect(ctx).toContain('완료조건 2의 빈 배열 경우를 다시 봐 줘')
    expect(ctx).toContain('- t-04 fix (수정)\n  - 요약: 할 일을 마쳤다.')
    expect(ctx).toContain('  - 이전 단계 추천: fix (수정) — 완료조건 2 실패')
    expect(ctx).toContain('고른 단계를 시작할 때의 커밋으로 되돌렸다.')
    expect(ctx).toContain('## 직전 handoff (t-03 rca)')
    expect(ctx).toContain('- t-05 review (리뷰)\n  - 요약: 지적 둘을 썼다.')
    expect(ctx).not.toContain('## t-04 fix — ')
    expect(ctx).not.toContain('## t-05 review — ')
    expect(ctx).not.toContain('## t-06 verify — ')
    expect(ctx).not.toContain(path.join('04-fix', 'fix.md'))
    expect(ctx).not.toContain(path.join('05-review', 'review.md'))
    // decisions.md에서는 지우지 않는다 (5.4)
    const decisions = read(path.join(dir, 'decisions.md'))
    expect(decisions).toContain('## t-04 fix — ')
    expect(decisions).toContain('## t-05 review — ')
    expect(decisions).toContain('## t-06 verify — ')
    // deny 규칙은 폐기된 task 디렉터리도 막는다
    const settings = JSON.parse(
      read(path.join(taskDir(s, key, '07-fix'), 'task.settings.json')),
    ) as { permissions: { deny: string[] } }
    expect(settings.permissions.deny.filter((r) => r.includes('/tasks/'))).toHaveLength(6)

    const done = await drive(s.h.relay, s.h.ui, key, { size: 'L' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    const finished = work(dir)
    expect(finished.status).toBe('completed')
    expect(statuses(finished).slice(6)).toEqual([
      ['t-07', 'fix', 'approved', 'rewind'],
      ['t-08', 'review', 'approved', 'default'],
      ['t-09', 'verify', 'approved', 'default'],
    ])
    const ev = events(dir)
    expect(ev.slice(-12).map((e) => [e.type, e.task_id ?? null])).toEqual([
      ['task.approved', 't-06'],
      ['task.rewound', 't-07'],
      ['task.started', 't-07'],
      ['task.awaiting_approval', 't-07'],
      ['task.approved', 't-07'],
      ['task.started', 't-08'],
      ['task.awaiting_approval', 't-08'],
      ['task.approved', 't-08'],
      ['task.started', 't-09'],
      ['task.awaiting_approval', 't-09'],
      ['task.approved', 't-09'],
      ['work.completed', null],
    ])
    expect(ev.find((e) => e.type === 'task.rewound')?.payload).toEqual({
      node: 'fix',
      from_task: 't-06',
      discarded: ['t-04', 't-05', 't-06'],
      keep_code: false,
      reset_to: base,
      backup_branch: branch,
    })
    expect(
      ev.find((e) => e.type === 'task.started' && e.task_id === 't-07')?.payload,
    ).toMatchObject({ reason: 'rewind' })
    // 되감은 fix 다음의 review에는 되감기 절이 없고 되감은 fix가 직전 handoff다. verify는 새 review를 받는다
    const reviewCtx = read(path.join(taskDir(s, key, '08-review'), 'context.md'))
    expect(reviewCtx).not.toContain('되감기로 들어옴')
    expect(reviewCtx).toContain('## 직전 handoff (t-07 fix)')
    const verifyCtx = read(path.join(taskDir(s, key, '09-verify'), 'context.md'))
    expect(verifyCtx).not.toContain('되감기로 들어옴')
    expect(verifyCtx).toContain('## 직전 handoff (t-08 review)')
    expect(verifyCtx).toContain(path.join('08-review', 'review.md'))
    expect(verifyCtx).not.toContain(path.join('05-review', 'review.md'))
  })

  it('S Work의 fix가 investigate를 추천하면 멈추고, investigate로 되감으면 fix → review → verify로 끝난다. 다시 한 fix와 review는 rca.md를 받는다 (D66, D149, 점검 A33)', async () => {
    const s = await setup({
      tasks: {
        ...scenario('S').tasks,
        't-02': recommending('fix', 'investigate', '재현이 안 됨', 'S'),
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const stopped = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(stopped, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 재현과 원인 분석(investigate)로 — 재현이 안 됨',
    })
    await settle(s.h, key)
    // S Work의 대화상자: 경로 밖의 investigate를 고를 수 있고 evidence와 rca는 없다
    expect(s.h.ui.works.get(key)?.steps.map((c) => [c.node, c.recommended])).toEqual([
      ['intake', false],
      ['investigate', true],
      ['fix', false],
      ['review', false],
      ['verify', false],
    ])
    const p = await preview(s, key, 'investigate')
    expect(p).toMatchObject({ kind: 'rewind', reason: '되감기', skipped: [] })
    expect(p.discard.map((d) => d.taskId)).toEqual(['t-02'])
    expect(await confirm(s, key, p)).toEqual({ ok: true })

    const done = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    const w = work(dir)
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'fix', 'discarded', 'default'],
      ['t-03', 'investigate', 'approved', 'rewind'],
      ['t-04', 'fix', 'approved', 'default'],
      ['t-05', 'review', 'approved', 'default'],
      ['t-06', 'verify', 'approved', 'default'],
    ])
    expect(w.intent?.size).toBe('S')
    // 크기는 S 그대로지만 fix는 investigate의 산출물을 받는다. S 경로 문구는 rca.md가 없을 때만이다 (A33)
    const ctx = read(path.join(taskDir(s, key, '04-fix'), 'context.md'))
    expect(ctx).toContain(
      `- t-03 investigate: ${path.join(taskDir(s, key, '03-investigate'), 'rca.md')}`,
    )
    // 리뷰도 크기와 관계없이 context.md에 있는 rca.md를 읽는다 (5.6.10, A33)
    const reviewCtx = read(path.join(taskDir(s, key, '05-review'), 'context.md'))
    expect(reviewCtx).toContain(
      `- t-03 investigate: ${path.join(taskDir(s, key, '03-investigate'), 'rca.md')}`,
    )
  })

  it('intake로 되감으면 모든 산출물을 폐기하고, 의도 승인 때 intent 버전이 오른다 (6.3, D40)', async () => {
    const s = await setup({
      tasks: {
        ...scenario('S').tasks,
        // verify는 승인 대기를 만든 뒤에도 세션이 살아 있다(6.2의 k 진행 중)
        'final-verify': [...steps('verify', 'S'), { do: 'wait' }],
        't-05': [
          { do: 'prompt' },
          {
            do: 'write',
            file: 'intent.draft.md',
            text: intentDraft('S', { note: '- 음수만 든 배열도 확인한다' }),
          },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({ decisions: [{ what: '크기는 S', why: '한 곳', by: 'ai' }] }),
          },
          { do: 'stop' },
        ],
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const base = git(s.repo, 'rev-parse', 'main')
    const paused = await drive(s.h.relay, s.h.ui, key, {
      size: 'S',
      pauseAt: (t) => t.node === 'verify',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({
      status: 'paused',
      reason: '04 최종 검증: 승인 대기',
    })
    await settle(s.h, key)
    const v1 = read(path.join(dir, 'intent.md'))
    const verifyPid = work(dir).tasks[3]?.session?.pid ?? 0
    expect(alive(verifyPid)).toBe(true)

    // 의도 승인 뒤라 모든 단계를 고를 수 있다
    expect(s.h.ui.works.get(key)?.steps.every((c) => c.allowed)).toBe(true)
    const p = await preview(s, key, 'intake')
    expect(p).toMatchObject({
      kind: 'rewind',
      expect: { taskId: 't-04', done: false },
      interrupt: '진행 중인 04 최종 검증의 세션을 끝냅니다',
      discard: [
        { taskId: 't-01', label: '01 의도 정리', artifacts: ['intent.draft.md'] },
        { taskId: 't-02', label: '02 수정', artifacts: ['fix.md'] },
        { taskId: 't-03', label: '03 리뷰', artifacts: ['review.md'] },
        { taskId: 't-04', label: '04 최종 검증', artifacts: ['pr.md', 'verification.md'] },
      ],
      code: { kind: 'reset', to: base, commits: 1, uncommitted: [] },
      keepCodeOffered: false,
      intent:
        '의도 승인 때 intent 새 버전(v2)을 만듭니다. 지금 버전(v1)을 출발점으로 고칩니다 (D40)',
    })
    const branch = p.code.backupBranch
    expect(branch).toMatch(/-discarded-1$/)

    expect(await confirm(s, key, p, '완료조건에 음수만 든 배열도 넣어 줘')).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-05' && t.status === 'awaiting_approval', 'intake v2')
    await settle(s.h, key)
    expect(alive(verifyPid)).toBe(false)
    let w = work(dir)
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'discarded', 'default'],
      ['t-02', 'fix', 'discarded', 'default'],
      ['t-03', 'review', 'discarded', 'default'],
      ['t-04', 'verify', 'discarded', 'default'],
      ['t-05', 'intake', 'awaiting_approval', 'rewind'],
    ])
    // 새 intake가 승인되기 전에는 지금 승인된 intent가 그대로다
    expect(w.intent).toEqual({ version: 1, size: 'S' })
    expect(read(path.join(dir, 'intent.md'))).toBe(v1)
    expect(taskOf(w, 't-05').start_commit).toBe(base)
    expect(git(s.repo, 'rev-parse', branch ?? '')).not.toBe(base)
    const ctx = read(path.join(taskDir(s, key, '05-intake'), 'context.md'))
    expect(ctx.indexOf('## 되감기로 들어옴 (먼저 읽을 것)')).toBeLessThan(
      ctx.indexOf('## task 정보'),
    )
    expect(ctx).toContain('완료조건에 음수만 든 배열도 넣어 줘')
    expect(ctx).toContain('- 승인된 intent 버전: 1')
    expect(ctx).toContain('## intent (버전 1)')
    expect(ctx).toContain('빈 배열의 평균이 NaN으로 나온다.')
    expect(ctx).toMatch(/## 결정 로그\n\n없음\n/)
    expect(ctx).toMatch(/## 직전 handoff\n\n없음\n/)

    const done = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    w = work(dir)
    expect(w.intent).toEqual({ version: 2, size: 'S' })
    expect(statuses(w).slice(4)).toEqual([
      ['t-05', 'intake', 'approved', 'rewind'],
      ['t-06', 'fix', 'approved', 'default'],
      ['t-07', 'review', 'approved', 'default'],
      ['t-08', 'verify', 'approved', 'default'],
    ])
    const v2 = read(path.join(dir, 'intent.md'))
    expect(v2).toContain('\nversion: 2\n')
    expect(v2).toContain('음수만 든 배열도 확인한다')
    expect(read(path.join(dir, 'intent.history', 'v1.md'))).toBe(v1)
    // 되감은 뒤의 fix는 폐기된 task를 입력으로 받지 않는다
    const fixCtx = read(path.join(taskDir(s, key, '06-fix'), 'context.md'))
    expect(fixCtx).toContain('## intent (버전 2)')
    expect(fixCtx).toContain('## 직전 handoff (t-05 intake)')
    expect(fixCtx).not.toContain('## t-01 intake — ')
    expect(fixCtx).toContain('## t-05 intake — ')
    expect(taskOf(w, 't-06').start_commit).toBe(base)
    const ev = events(dir)
    expect(ev.find((e) => e.type === 'task.interrupted' && e.task_id === 't-04')?.payload).toEqual({
      reason: 'rewind',
    })
    expect(ev.find((e) => e.type === 'task.rewound')).toMatchObject({
      task_id: 't-05',
      payload: {
        node: 'intake',
        from_task: 't-04',
        discarded: ['t-01', 't-02', 't-03', 't-04'],
      },
    })
  })

  it('진행 중인 fix를 되감으면 커밋 안 된 변경도 백업 브랜치에 남기고 시작 커밋으로 되돌린다 (D116, D117)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 't-02': UNFINISHED_FIX },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const tree = s.tree(key)
    const base = git(s.repo, 'rev-parse', 'main')
    await approveIntake(s, key)
    await s.h.ui.until(
      () => fs.existsSync(path.join(tree, 'scratch.txt')),
      '고치는 중인 fix',
      30_000,
    )
    await settle(s.h, key)
    const fixCommit = git(tree, 'rev-parse', 'HEAD')

    const p = await preview(s, key, 'fix')
    expect(p).toMatchObject({
      kind: 'rewind',
      interrupt: '진행 중인 02 수정의 세션을 끝냅니다',
      discard: [{ taskId: 't-02', label: '02 수정', artifacts: [] }],
      code: { kind: 'reset', to: base, commits: 1 },
      keepCodeOffered: true,
    })
    expect([...p.code.uncommitted].sort()).toEqual([' M src/avg.js', '?? scratch.txt'])
    const branch = p.code.backupBranch ?? ''
    expect(await confirm(s, key, p)).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-03' && t.live, '되감은 fix')
    await settle(s.h, key)

    // 백업: fix의 커밋 위에 커밋 안 된 변경을 담은 커밋 하나 (D116)
    const backup = git(s.repo, 'rev-parse', branch)
    expect(git(s.repo, 'rev-parse', `${backup}^`)).toBe(fixCommit)
    expect(git(s.repo, 'log', '-1', '--format=%s', backup)).toBe(
      `relay(${work(dir).work_id}): 되감기 전 커밋 안 된 변경`,
    )
    expect(git(s.repo, 'show', `${backup}:scratch.txt`)).toBe('실험 메모')
    expect(git(s.repo, 'show', `${backup}:src/avg.js`)).toContain('// 고치는 중')
    // 되감은 fix는 기준 커밋에서 시작했다. HEAD는 그 fix가 곧 커밋해 바뀌므로 시작 커밋으로 본다
    const w = work(dir)
    expect(taskOf(w, 't-03')).toMatchObject({ reason: 'rewind', start_commit: base })
    expect(taskOf(w, 't-03').selection?.reset).toEqual({
      from: fixCommit,
      to: base,
      backup_branch: branch,
      backup_commit: backup,
    })
    // 폐기된 fix의 [변경]은 백업 커밋까지다: 커밋한 수정과 커밋 안 된 변경이 모두 보인다
    const discarded = await s.h.relay.review(key, 't-02')
    expect(discarded?.diff).toContain('+  if (xs.length === 0) return 0')
    expect(discarded?.diff).toContain('+// 고치는 중')
    expect(discarded?.diff).toContain('+실험 메모')
    expect(discarded?.emphasis.map((e) => e.kind)).not.toContain('uncommitted')

    const done = await drive(s.h.relay, s.h.ui, key, { size: 'S' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    expect(statuses(work(dir))).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'fix', 'discarded', 'default'],
      ['t-03', 'fix', 'approved', 'rewind'],
      ['t-04', 'review', 'approved', 'default'],
      ['t-05', 'verify', 'approved', 'default'],
    ])
    // 되감은 fix의 커밋은 기준 커밋 바로 위에 있고, 지운 추적하지 않는 파일은 돌아오지 않았다
    expect(git(tree, 'rev-parse', 'HEAD^')).toBe(base)
    expect(fs.existsSync(path.join(tree, 'scratch.txt'))).toBe(false)
  })

  it('되돌릴 커밋이 없어도 커밋 안 된 변경이 있으면 백업한 뒤 지운다. 미리 보기와 같다 (D116, A14)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 't-02': [{ do: 'prompt' }, { do: 'wait' }] },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const tree = s.tree(key)
    const base = git(s.repo, 'rev-parse', 'main')
    await approveIntake(s, key)
    await untilTask(s, key, (t) => t.id === 't-02' && t.live, 'fix')
    await settle(s.h, key)
    // fix는 아직 커밋하지 않았다. 사람이 worktree에 메모를 남겼다
    fs.writeFileSync(path.join(tree, 'notes.txt'), '사람의 메모\n')
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(base)

    const p = await preview(s, key, 'fix')
    expect(p.code).toMatchObject({ kind: 'reset', to: base, commits: 0 })
    expect(p.code.uncommitted).toEqual(['?? notes.txt'])
    const branch = p.code.backupBranch ?? ''
    expect(branch).toMatch(/-discarded-1$/)
    expect(await confirm(s, key, p)).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-03' && t.live, '되감은 fix')
    await settle(s.h, key)

    // 백업은 기준 커밋 위에 커밋 안 된 변경을 담은 커밋 하나다
    const backup = git(s.repo, 'rev-parse', branch)
    expect(git(s.repo, 'rev-parse', `${backup}^`)).toBe(base)
    expect(git(s.repo, 'show', `${backup}:notes.txt`)).toBe('사람의 메모')
    expect(fs.existsSync(path.join(tree, 'notes.txt'))).toBe(false)
    // 되감은 fix는 곧 커밋하므로 HEAD 대신 시작 커밋으로 본다
    expect(taskOf(work(dir), 't-03').start_commit).toBe(base)
    expect(taskOf(work(dir), 't-03').selection?.reset).toEqual({
      from: base,
      to: base,
      backup_branch: branch,
      backup_commit: backup,
    })
  })

  it('[현재 코드 위에서 이어서]는 커밋과 커밋 안 된 변경을 두고 그 위에서 고친다 (6.2)', async () => {
    const s = await setup({
      tasks: {
        ...scenario('S').tasks,
        't-02': UNFINISHED_FIX,
        't-03': [
          { do: 'prompt' },
          {
            do: 'commit',
            files: { 'src/avg.js': `${FIXED_FILES['src/avg.js']}// 이어서 고침\n` },
            message: 'fix: 이어서',
          },
          ...steps('fix', 'S').slice(2),
        ],
      },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const tree = s.tree(key)
    await approveIntake(s, key)
    await s.h.ui.until(
      () => fs.existsSync(path.join(tree, 'scratch.txt')),
      '고치는 중인 fix',
      30_000,
    )
    await settle(s.h, key)
    const fixCommit = git(tree, 'rev-parse', 'HEAD')

    const p = await preview(s, key, 'fix', true)
    expect(p.code).toMatchObject({ kind: 'keep', to: null, commits: 0, backupBranch: null })
    expect([...p.code.uncommitted].sort()).toEqual([' M src/avg.js', '?? scratch.txt'])
    expect(await confirm(s, key, p, '', true)).toEqual({ ok: true })
    await untilTask(
      s,
      key,
      (t) => t.id === 't-03' && t.status === 'awaiting_approval',
      '이어서 고친 fix',
    )
    await settle(s.h, key)
    const w = work(dir)
    expect(taskOf(w, 't-03')).toMatchObject({ reason: 'rewind', start_commit: fixCommit })
    expect(taskOf(w, 't-03').selection).toMatchObject({ keep_code: true, reset: null })
    // 앞 fix의 커밋 위에 이어서 커밋했고, 백업 브랜치는 없다
    expect(git(tree, 'rev-parse', 'HEAD^')).toBe(fixCommit)
    expect(git(s.repo, 'branch', '--list', 'relay/*-discarded-*')).toBe('')
    const ctx = read(path.join(taskDir(s, key, '03-fix'), 'context.md'))
    expect(ctx).toContain(
      '[현재 코드 위에서 이어서]: 폐기된 시도의 커밋이 남아 있다. 그 위에서 이어서 고친다.',
    )
    expect(ctx).toContain('- t-02 fix (수정): handoff 없음')
    expect(events(dir).find((e) => e.type === 'task.rewound')?.payload).toEqual({
      node: 'fix',
      from_task: 't-02',
      discarded: ['t-02'],
      keep_code: true,
    })
  })

  it('건너뛰기: 기본 다음 단계는 추가 지시와 함께 기본 진행으로, 진행 중인 task에서 뒤 단계로 가면 그 task를 폐기한다 (6.2, D117)', async () => {
    const s = await setup({
      tasks: { ...scenario('L').tasks, evidence: [{ do: 'prompt' }, { do: 'wait' }] },
    })
    const key = await s.create()
    const dir = s.dir(key)
    expect(await s.h.relay.stopAfter(key, true)).toEqual({ ok: true })
    const stopped = await drive(s.h.relay, s.h.ui, key, { size: 'L' })
    expect(stopped.status).toBe('stopped')

    // 끝난 intake 다음의 기본 다음 단계: 건너뛴 것도 폐기한 것도 없다
    const next = await preview(s, key, 'evidence')
    expect(next).toMatchObject({
      kind: 'skip',
      reason: '기본 진행',
      expect: { taskId: 't-01', done: true },
      discard: [],
      skipped: [],
      code: { kind: 'none', commits: 0, backupBranch: null },
    })
    expect(await confirm(s, key, next, '로그를 먼저 봐 줘')).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-02' && t.live, 'evidence')
    await settle(s.h, key)
    expect(s.h.ui.works.get(key)?.tasks[1]?.band).toBe('02 재현과 관찰 · 새 세션 · 이유: 기본 진행')
    const evidenceCtx = read(path.join(taskDir(s, key, '02-evidence'), 'context.md'))
    expect(evidenceCtx).toContain('## 사람 추가 지시 (먼저 읽을 것)')
    expect(evidenceCtx).toContain('로그를 먼저 봐 줘')

    // 진행 중인 evidence에서 fix로: evidence를 폐기하고 rca를 건너뛴다
    const skip = await preview(s, key, 'fix')
    expect(skip).toMatchObject({
      kind: 'skip',
      reason: '건너뛰기',
      interrupt: '진행 중인 02 재현과 관찰의 세션을 끝냅니다',
      discard: [{ taskId: 't-02', label: '02 재현과 관찰', artifacts: [] }],
      skipped: ['원인 분석(rca)'],
      code: { kind: 'none' },
      keepCodeOffered: false,
    })
    expect(await confirm(s, key, skip, '재현은 요청에 있다. 바로 고쳐 줘')).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-03' && t.live, '건너뛴 fix')
    await settle(s.h, key)
    expect(s.h.ui.works.get(key)?.tasks[2]?.band).toBe('03 수정 · 새 세션 · 이유: 건너뛰기')
    const fixCtx = read(path.join(taskDir(s, key, '03-fix'), 'context.md'))
    expect(fixCtx).toContain('## 건너뛰어 들어옴 (먼저 읽을 것)')
    expect(fixCtx).toContain('- 건너뛴 단계: rca (원인 분석)')
    expect(fixCtx).toContain('- 폐기한 task: t-02 evidence (재현과 관찰)')
    expect(fixCtx).toContain('## 직전 handoff (t-01 intake)')
    expect(fixCtx).not.toContain('폐기된 시도 요약')

    const done = await drive(s.h.relay, s.h.ui, key, { size: 'L' })
    expect(done, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    await settle(s.h, key)
    expect(statuses(work(dir))).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'evidence', 'discarded', 'default'],
      ['t-03', 'fix', 'approved', 'skip'],
      ['t-04', 'review', 'approved', 'default'],
      ['t-05', 'verify', 'approved', 'default'],
    ])
    const ev = events(dir)
    expect(
      ev.filter((e) => e.type === 'task.skipped_to').map((e) => [e.task_id, e.payload]),
    ).toEqual([['t-03', { node: 'fix', from_task: 't-02', discarded: ['t-02'], skipped: ['rca'] }]])
    expect(ev.find((e) => e.type === 'task.interrupted')?.payload).toEqual({ reason: 'skip' })
    // 건너뛰기는 코드를 되돌리지 않아 백업 브랜치가 없다
    expect(git(s.repo, 'branch', '--list', 'relay/*-discarded-*')).toBe('')
  })

  it('되감기로 시작하는 task도 세션 상한을 따른다. 자리가 나면 먼저 기다리던 task가 시작한다 (D18)', async () => {
    const s = await setup(
      {
        tasks: {
          ...scenario('S').tasks,
          'final-verify': [...steps('verify', 'S'), { do: 'wait' }],
        },
      },
      { session_limit: 1 },
    )
    const a = await s.create('버그 A')
    await drive(s.h.relay, s.h.ui, a, { size: 'S', pauseAt: (t) => t.node === 'verify' })
    const b = await s.create('버그 B')
    await untilTask(s, b, (t) => t.status === 'queued', 'B 대기열')
    const p = await preview(s, a, 'fix')
    expect(await confirm(s, a, p)).toEqual({ ok: true })
    // A의 verify 세션이 끝나 자리가 나면 먼저 기다리던 B가 시작하고, 되감은 A의 fix는 대기열에서 기다린다
    await untilTask(s, b, (t) => t.live, 'B 시작')
    await untilTask(s, a, (t) => t.id === 't-05' && t.status === 'queued', 'A 되감은 fix 대기열')
    expect(await s.h.relay.interrupt(b, 't-01')).toEqual({ ok: true })
    await untilTask(s, a, (t) => t.id === 't-05' && t.live, 'A 되감은 fix 시작')
    // 대기열에서 자동으로 시작하면 알린다 (D81). 알림은 세션을 띄운 뒤에 보낸다
    await s.h.ui.until(
      () =>
        s.h.ui.notices.some((n) => n.workKey === a && n.body === '05 수정: 대기열에서 자동 시작'),
      'A 알림',
      10_000,
    )
  })

  it.runIf(canLock)(
    'reset 뒤 clean이 실패하면 끊긴 되감기로 남긴다. 승인과 전달을 막고, 원인을 치우면 [다시 시도]로 끝까지 되감는다 (D136)',
    async () => {
      const s = await setup({
        tasks: {
          ...scenario('S').tasks,
          'final-verify': [...steps('verify', 'S'), { do: 'wait' }],
        },
      })
      const key = await s.create()
      const dir = s.dir(key)
      const tree = s.tree(key)
      const base = git(s.repo, 'rev-parse', 'main')
      await drive(s.h.relay, s.h.ui, key, { size: 'S', pauseAt: (t) => t.node === 'verify' })
      await settle(s.h, key)
      const fixHead = git(tree, 'rev-parse', 'HEAD')
      // 추적하지 않는 파일을 지울 수 없게 한다. reset은 되고 clean만 실패한다
      const stuck = path.join(tree, 'stuck', 'x.txt')
      fs.mkdirSync(path.dirname(stuck))
      fs.writeFileSync(stuck, '남은 파일\n')
      expect(immutable(stuck, true)).toBe(true)
      try {
        const p = await preview(s, key, 'fix')
        const r = await confirm(s, key, p)
        expect(r.ok).toBe(false)
        expect(!r.ok && r.error).toMatch(/^되감기 실패: /)
        await settle(s.h, key)
        // 코드는 이미 되돌렸다. 기록은 끊긴 되감기로 남고 task는 아직 폐기하지 않았다
        expect(git(tree, 'rev-parse', 'HEAD')).toBe(base)
        const w = work(dir)
        expect(w.operation).toMatchObject({ kind: 'rewind', stage: 'reset', reset_to: base })
        expect(w.operation?.interrupted_at).toBeDefined()
        expect(statuses(w).map(([id, , st]) => [id, st])).toEqual([
          ['t-01', 'approved'],
          ['t-02', 'approved'],
          ['t-03', 'approved'],
          ['t-04', 'awaiting_approval'],
        ])
        const view = s.h.ui.works.get(key)
        expect(view?.badge.kind).toBe('recovery')
        expect(view?.operation?.title).toBe('되감기가 끊겼습니다')
        // 되돌린 코드로 승인하거나 전달하지 않는다 (D122)
        expect(await s.h.relay.approve(key, 't-04', {})).toEqual({
          ok: false,
          error: '끊긴 작업이 있음: 먼저 [다시 시도]나 [무시]를 누르세요',
        })
        expect(
          s.h.ui.notices.some(
            (n) => n.workKey === key && n.body.startsWith('끊긴 작업이 있습니다'),
          ),
        ).toBe(true)
      } finally {
        immutable(stuck, false)
      }

      expect(await s.h.relay.retryOperation(key)).toEqual({ ok: true })
      await untilTask(s, key, (t) => t.id === 't-05' && t.live, '되감은 fix')
      await settle(s.h, key)
      const w = work(dir)
      expect(w.operation).toBeUndefined()
      expect(fs.existsSync(stuck)).toBe(false)
      // 되감은 fix는 곧 커밋하므로 HEAD 대신 시작 커밋으로 본다
      expect(taskOf(w, 't-05').start_commit).toBe(base)
      // 되돌리기 전 코드는 첫 백업에 있다
      const backup = taskOf(w, 't-05').selection?.reset?.backup_branch ?? ''
      expect(git(s.repo, 'rev-parse', `${backup}~1`)).toBe(fixHead)
      expect(statuses(w).map(([id, , st]) => [id, st])).toEqual([
        ['t-01', 'approved'],
        ['t-02', 'discarded'],
        ['t-03', 'discarded'],
        ['t-04', 'discarded'],
        ['t-05', 'working'],
      ])
    },
  )

  it('worktree가 Work 브랜치에 있지 않으면 코드를 되돌리지 않고 기록을 지운다 (D138)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'final-verify': [...steps('verify', 'S'), { do: 'wait' }] },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const tree = s.tree(key)
    await drive(s.h.relay, s.h.ui, key, { size: 'S', pauseAt: (t) => t.node === 'verify' })
    await settle(s.h, key)
    const fixHead = git(tree, 'rev-parse', 'HEAD')
    const branch = git(tree, 'symbolic-ref', '--short', 'HEAD')
    git(tree, 'checkout', '--quiet', '--detach')

    const p = await preview(s, key, 'fix')
    const r = await confirm(s, key, p)
    expect(r).toEqual({
      ok: false,
      error: `되감기 실패: worktree가 Work 브랜치에 있지 않음(지금: 분리된 HEAD). worktree에서 \`git switch ${branch}\`로 돌아온 뒤 다시 누르세요`,
    })
    await settle(s.h, key)
    expect(work(dir).operation).toBeUndefined()
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(fixHead)
    expect(git(s.repo, 'rev-parse', branch)).toBe(fixHead)
    expect(git(s.repo, 'branch', '--list', 'relay/*-discarded-*')).toBe('')

    git(tree, 'switch', '--quiet', branch)
    const again = await preview(s, key, 'fix')
    expect(await confirm(s, key, again)).toEqual({ ok: true })
  })

  it('git이 실패하면 오류를 돌려주고 기록을 지운다. 다시 고르면 다음 번호의 백업 브랜치를 만든다 (D77, D115)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'final-verify': [...steps('verify', 'S'), { do: 'wait' }] },
    })
    const key = await s.create()
    const dir = s.dir(key)
    const tree = s.tree(key)
    const base = git(s.repo, 'rev-parse', 'main')
    await drive(s.h.relay, s.h.ui, key, { size: 'S', pauseAt: (t) => t.node === 'verify' })
    await settle(s.h, key)
    const fixHead = git(tree, 'rev-parse', 'HEAD')
    // 다른 git 명령이 worktree의 index를 잡고 있다
    const lock = path.resolve(tree, git(tree, 'rev-parse', '--git-path', 'index.lock'))
    fs.writeFileSync(lock, '')

    const first = await preview(s, key, 'fix')
    const branch1 = first.code.backupBranch ?? ''
    expect(branch1).toMatch(/-discarded-1$/)
    const r = await confirm(s, key, first)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/^되감기 실패: /)
    await settle(s.h, key)
    let w = work(dir)
    expect(w.operation).toBeUndefined()
    // 세션은 끝났고 승인 대기로 남아 승인할 수 있다. 코드는 그대로이고 백업 브랜치는 남는다
    expect(statuses(w)).toEqual([
      ['t-01', 'intake', 'approved', 'default'],
      ['t-02', 'fix', 'approved', 'default'],
      ['t-03', 'review', 'approved', 'default'],
      ['t-04', 'verify', 'awaiting_approval', 'default'],
    ])
    expect(taskOf(w, 't-04').session?.alive).toBe(false)
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(fixHead)
    expect(git(s.repo, 'rev-parse', branch1)).toBe(fixHead)
    expect(s.h.ui.works.get(key)?.problems.at(-1)).toContain('되감기 실패')

    fs.rmSync(lock)
    const second = await preview(s, key, 'fix')
    expect(second.expect).toEqual({ taskId: 't-04', done: false })
    expect(second.interrupt).toBeNull()
    expect(second.code.backupBranch).toMatch(/-discarded-2$/)
    expect(await confirm(s, key, second)).toEqual({ ok: true })
    await untilTask(s, key, (t) => t.id === 't-05' && t.live, '되감은 fix')
    await settle(s.h, key)
    w = work(dir)
    expect(taskOf(w, 't-05').start_commit).toBe(base)
    expect(taskOf(w, 't-05').selection?.reset?.backup_branch).toMatch(/-discarded-2$/)
    // 미리 본 뒤 바뀌었으면 받지 않는다
    expect(await confirm(s, key, second)).toEqual({
      ok: false,
      error: '미리 본 뒤 Work가 바뀌었음. 단계 선택을 다시 여세요',
    })
  })
})
