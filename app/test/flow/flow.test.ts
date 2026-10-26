// [흐름] 가짜 claude로 Work가 intake부터 Work 완료까지 간다 (docs/implementation.md M2, I25, I26).
// main의 조립 코드(Relay)를 Electron 없이 불러 쓰고, 실제 node-pty, 훅 서버, git, 파일을 지난다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { skillText } from '../../src/adapters/claude'
import { OPEN_QUESTIONS_HINT } from '../../src/core/review'
import { sha256 } from '../../src/adapters/store'
import { BOUNCE_HEAD, parseFrontMatter } from '../../src/core/validate'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import {
  git,
  harness,
  makeRepo,
  register,
  settle,
  SKILLS,
  workBranchOf,
  type Harness,
} from '../support/harness'
import {
  atCompletion,
  FIXED_FILES,
  FIX_CAUSE,
  FIX_DOC,
  PR,
  REPO_FILES,
  REQUEST,
  REVIEW,
  REVIEW_APPLIED_TEXT,
  REVIEW_FINDINGS,
  VERDICTS,
  VERIFICATION,
  fixAsking,
  handoff,
  intentDraft,
  scenario,
  steps,
  verifyApplied,
  type Scenario,
} from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/

/** 레포를 만들고 등록한 뒤 Work를 만든다 */
async function start(s: Scenario, env: Record<string, string> = {}, config = {}) {
  h = await harness({ scenario: s, env, config })
  const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
  const projectId = await register(h, repo)
  const created = await h.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation: 'local',
  })
  if (!created.ok || !created.workKey) throw new Error(`Work 생성 실패: ${JSON.stringify(created)}`)
  const workKey = created.workKey
  const workId = workKey.split('/')[1] ?? ''
  const workDir = path.join(h.home, 'projects', projectId, 'works', workId)
  return { h, repo, projectId, workKey, workId, workDir }
}

/** 프로세스가 살아 있는가 */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function work(workDir: string): WorkState {
  return JSON.parse(read(path.join(workDir, 'work.json'))) as WorkState
}

function events(workDir: string): LifecycleEvent[] {
  return read(path.join(workDir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

describe('[흐름] 최소 흐름 (M2)', () => {
  it('기본 경로: intake → fix(판정표 → 리뷰 요청 → 독립 리뷰 → 다시 열기 → 마무리) → [완료만] (3.1, D227, D493~D496)', async () => {
    const s = await start(scenario({ fix: fixAsking() }))
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 원인 분석과 수정', 0, false],
    ])
    // fix의 질문 대기(재현 방법)에 답했다
    expect(result.tasks[1]?.answers).toBeGreaterThan(0)
    // task마다 걸린 시간은 구간이 겹치지 않아 합이 전체 시간을 넘지 않는다 (8.4)
    expect(result.tasks.every((t) => t.ms > 0)).toBe(true)
    expect(result.tasks.reduce((sum, t) => sum + t.ms, 0)).toBeLessThanOrEqual(result.ms)

    // ---------- work.json (5.1) ----------
    const w = work(s.workDir)
    expect(w).toMatchObject({
      schema_version: 1,
      work_id: s.workId,
      status: 'completed',
      base_branch: 'main',
      base_commit: base,
      settings: {},
      // 마지막 작업 단계가 마무리하는 파이프라인 (D501)
      pipeline: 2,
    })
    // 승인된 intent는 버전뿐이다. 크기는 없다 (D227)
    expect(w.intent).toEqual({ version: 1 })
    expect(w.completed_at).toMatch(ISO)
    expect(w.work_id).toMatch(/^w-\d{8}-001$/)
    expect(w.tasks.map((t) => [t.id, t.seq, t.node, t.status])).toEqual([
      ['t-01', 1, 'intake', 'approved'],
      ['t-02', 2, 'fix', 'approved'],
    ])
    // 마무리 단계의 독립 리뷰 기록 (D494~D496): 요청, 끝, 결과로 다시 연 때. 코드 리뷰는 기본으로 켰다 (D497)
    expect(w.tasks[1]?.review).toEqual({
      requested_at: expect.stringMatching(ISO),
      code_review: true,
      finished_at: expect.stringMatching(ISO),
      resumed_at: expect.stringMatching(ISO),
    })
    expect(w.tasks[0]?.review).toBeUndefined()
    const fixHead = git(
      path.join(s.h.home, 'projects', s.projectId, 'worktrees', s.workId),
      'rev-parse',
      'HEAD',
    )
    for (const t of w.tasks) {
      expect(t).toMatchObject({
        reason: 'default',
        format_version: 1,
        approved_by: 'human',
        bounce_count: 0,
        permission_mode: 'bypassPermissions',
        claude_version: '0.0.0 (가짜 Claude Code)',
        check: { handoff_present: true, status: 'awaiting_approval', errors: [] },
      })
      expect(t.skill_hash).toMatch(/^sha256:[0-9a-f]{64}$/)
      expect(t.session?.id).toMatch(UUID)
      expect(t.session?.pid).toBeGreaterThan(0)
      expect(t.session?.alive).toBe(false)
      expect(t.session?.ended_at).toMatch(ISO)
      expect(t.approved_at).toMatch(ISO)
      expect(t.ignored_errors).toBeUndefined()
    }
    // 시작 커밋: 둘 다 기준 커밋이다 (시나리오 2-1). fix가 커밋했다
    expect(w.tasks.map((t) => t.start_commit)).toEqual([base, base])
    expect(fixHead).not.toBe(base)

    // ---------- intent.md (5.3) ----------
    const intent = read(path.join(s.workDir, 'intent.md'))
    const fm = parseFrontMatter(intent)
    expect(fm.ok && fm.data).toEqual({ schema_version: 1, version: 1, type: 'bugfix' })
    expect(fm.body).toBe(parseFrontMatter(intentDraft()).body)
    expect(fs.existsSync(path.join(s.workDir, 'intent.history'))).toBe(false)

    // ---------- decisions.md (5.4) ----------
    const decisions = read(path.join(s.workDir, 'decisions.md'))
    const heads = [
      ...decisions.matchAll(/^## (t-\d\d) (\w+) — (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \((.+)\)$/gm),
    ]
    expect(heads.map((m) => [m[1], m[2], m[4]])).toEqual([
      ['t-01', 'intake', '사람 승인'],
      ['t-02', 'fix', '사람 승인'],
    ])
    expect(decisions).toContain('- [AI] 빈 배열의 평균은 0 — 빈 배열의 평균은 0인 이유\n')
    expect(decisions).toContain('- [사람] 재현 명령은 node -e — 재현 명령은 node -e인 이유\n')
    expect(decisions).toContain('- [AI] 원인은 0으로 나눔 — 원인은 0으로 나눔인 이유\n')

    // ---------- events.jsonl (5.5) ----------
    // 세션마다 task.started 다음에 첫 PTY 출력과 첫 훅(UserPromptSubmit)의 시각이 온다 (D217)
    const ev = events(s.workDir)
    // fix는 리뷰를 요청하고(세션을 닫음), 리뷰가 끝나면 같은 대화를 다시 열어 마무리한다 (D494~D496)
    expect(ev.map((e) => [e.type, e.task_id ?? null])).toEqual([
      ['work.created', null],
      ['task.started', 't-01'],
      ['task.first_output', 't-01'],
      ['task.first_hook', 't-01'],
      ['task.awaiting_approval', 't-01'],
      ['task.approved', 't-01'],
      ['task.started', 't-02'],
      ['task.first_output', 't-02'],
      ['task.first_hook', 't-02'],
      ['review.requested', 't-02'],
      ['review.finished', 't-02'],
      ['task.resumed', 't-02'],
      ['task.first_output', 't-02'],
      ['task.first_hook', 't-02'],
      ['task.awaiting_approval', 't-02'],
      ['task.approved', 't-02'],
      ['work.completed', null],
    ])
    expect(ev.find((e) => e.type === 'review.requested')?.payload).toEqual({ code_review: true })
    expect(ev.find((e) => e.type === 'review.finished')?.payload).toEqual({
      code_review: true,
      ok: true,
      findings: 0,
      objections: 0,
      ms: expect.any(Number),
    })
    expect(ev.find((e) => e.type === 'task.resumed')?.payload).toMatchObject({ input: 'review' })
    for (const e of ev) {
      expect(e.ts).toMatch(ISO)
      expect(e.work_id).toBe(s.workId)
    }
    expect(ev[0]?.payload).toEqual({
      type: 'bugfix',
      base_branch: 'main',
      base_commit: base,
      branch: workBranchOf(s.workId),
    })
    expect(ev.at(-1)?.payload).toEqual({ delivery: 'none' })
    expect(ev[5]?.payload).toEqual({ by: 'human' })
    for (const t of w.tasks) {
      // 첫 세션의 첫 출력과 첫 훅. 다시 연 세션(fix)은 마지막 pid다
      const own = ev.filter((e) => e.task_id === t.id)
      expect(own[1]?.payload).toEqual({ pid: expect.any(Number), ms: expect.any(Number) })
      expect(own[2]?.payload).toEqual({
        pid: own[1]?.payload['pid'],
        ms: expect.any(Number),
        event: 'UserPromptSubmit',
      })
    }

    // ---------- task 디렉터리 (5.1) ----------
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    for (const dir of ['01-intake', '02-fix']) {
      for (const f of ['context.md', 'task.settings.json', 'pty.log', 'handoff.md']) {
        expect(fs.existsSync(path.join(task(dir), f)), `${dir}/${f}`).toBe(true)
      }
      expect(read(path.join(task(dir), 'pty.log'))).toContain('FAKE-CLAUDE READY')
    }
    // 단계마다의 필수 산출물 (3.1): 마무리 단계인 fix는 fix.md와 verification.md, pr.md. 독립 리뷰 결과와 기록, 리뷰에 넘긴
    // 변경 파일도 있다 (D495). review.md는 없다 (D229)
    for (const [dir, files] of [
      ['01-intake', ['intent.draft.md']],
      [
        '02-fix',
        [
          'fix.md',
          'verification.md',
          'pr.md',
          'independent-review.md',
          'independent-review.json',
          'independent-review/diff.patch',
        ],
      ],
    ] as const) {
      for (const f of files)
        expect(fs.existsSync(path.join(task(dir), f)), `${dir}/${f}`).toBe(true)
    }
    expect(fs.existsSync(path.join(task('02-fix'), 'review.md'))).toBe(false)
    expect(fs.existsSync(path.join(s.workDir, 'tasks', '03-verify'))).toBe(false)
    // 리뷰에 넘긴 변경은 기준 커밋부터 지금까지다. 결과 글에는 지적과 이의가 없다
    expect(read(path.join(task('02-fix'), 'independent-review', 'diff.patch'))).toContain(
      '+  if (xs.length === 0) return 0',
    )
    const result1 = read(path.join(task('02-fix'), 'independent-review.md'))
    expect(result1).toContain('## 코드 리뷰\n\n켬')
    expect(result1).toContain('## 지적\n\n없음')
    expect(result1).toContain('## 판정표 이의\n\n없음')
    // 독립 리뷰 호출 (D495): 찾기와 확인 차례로, 읽기 도구만, Work 디렉터리를 --add-dir, 세션을 남기지 않음
    const scenarioFile = path.join(s.h.root, 'scenario.json')
    for (const kind of ['find', 'check']) {
      const args = JSON.parse(read(`${scenarioFile}.independent-${kind}-1.json`)) as string[]
      expect(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2)).toEqual([
        '--tools',
        'Read,Grep,Glob',
      ])
      expect(args).toContain('--no-session-persistence')
      expect(args.slice(args.indexOf('--add-dir'), args.indexOf('--add-dir') + 2)).toEqual([
        '--add-dir',
        s.workDir,
      ])
    }
    const findPrompt = read(`${scenarioFile}.independent-find-1.txt`)
    // 찾기 지침(_review.md의 Finder)과 bugfix의 관점만 받는다
    expect(findPrompt).toContain('## What to review')
    expect(findPrompt).not.toContain('## Candidates')
    expect(findPrompt).toContain(path.join(task('02-fix'), 'independent-review', 'diff.patch'))
    expect(findPrompt).toContain(path.join(task('02-fix'), 'fix.md'))
    expect(read(`${scenarioFile}.independent-check-1.txt`)).toContain('## 완료조건 판정')
    expect(fs.existsSync(`${scenarioFile}.independent-find-2.txt`)).toBe(false)
    // 진행 표시 (D502): 호출마다 출력 이벤트를 받아 지금 호출과 도구를 보이고, 진행 기록을 남긴다
    const reviewing = s.h.ui.activityLog
      .filter((u) => u.taskId === 't-02' && u.activity?.phase)
      .map((u) => [
        u.activity?.phase,
        u.activity?.tool?.label ?? null,
        u.activity?.tool?.endedAt === null,
      ])
    expect(reviewing).toContainEqual(['찾기', 'Read(README.md)', true])
    expect(reviewing).toContainEqual(['찾기', 'Read(README.md)', false])
    expect(reviewing).toContainEqual(['확인', 'Read(README.md)', true])
    // 구조화된 출력 도구는 진행에 보이지 않는다
    expect(reviewing.some(([, label]) => String(label).startsWith('StructuredOutput'))).toBe(false)
    const findLog = read(path.join(task('02-fix'), 'independent-review', 'find.log'))
    expect(findLog).toMatch(/^\d\d:\d\d:\d\d 찾기 시작 \(Claude Code\)\n/)
    expect(findLog).toMatch(/^\d\d:\d\d:\d\d {3}변경 파일을 읽는다\.$/m)
    expect(findLog).toMatch(/^\d\d:\d\d:\d\d Read\(README\.md\)$/m)
    expect(findLog).toMatch(/^\d\d:\d\d:\d\d 찾기 끝 \(\d+초\)\n$/m)
    expect(read(path.join(task('02-fix'), 'independent-review', 'check.log'))).toContain('확인 끝')
    // 독립 리뷰가 끝나면 진행 표시는 없다 (다시 연 세션의 진행 표시로 바뀐다)
    expect(s.h.ui.works.get(s.workKey)?.tasks[1]?.activity?.phase).toBeUndefined()
    expect(read(path.join(s.workDir, 'request.md'))).toBe(REQUEST)

    // context.md (시나리오 2-4): fix는 intent, 결정 로그, 기각 목록, 직전 handoff를 받고, 마무리 단계라 마무리 절이 있다
    const ctx = read(path.join(task('02-fix'), 'context.md'))
    expect(ctx).toContain(`- task 디렉터리: ${task('02-fix')}`)
    expect(ctx).toContain(`- 기준 커밋: ${base}`)
    expect(ctx).toContain('## intent (버전 1)')
    expect(ctx).toContain('## t-01 intake — ')
    expect(ctx).toContain('## 직전 handoff (t-01 intake)')
    expect(ctx).toContain('## 마무리')
    expect(ctx).toContain(`- 판정표: \`${path.join(task('02-fix'), 'verification.md')}\``)
    expect(ctx).toContain('[완료만], [push], [PR 생성] 중 하나를 누르세요')
    expect(ctx).not.toContain('intent.draft.md')
    expect(ctx).toContain(`경로: ${path.join(s.workDir, 'request.md')}`)
    const intakeCtx = read(path.join(task('01-intake'), 'context.md'))
    expect(intakeCtx).toContain('빈 배열의 평균이 NaN으로 나온다.')

    // task 설정 파일 (시나리오 2-3, I13): 훅 URL과 이전 task 디렉터리의 deny 규칙
    const settings = JSON.parse(read(path.join(task('02-fix'), 'task.settings.json'))) as {
      hooks: Record<string, { hooks: { url: string }[] }[]>
      permissions: { deny: string[] }
    }
    expect(settings.hooks['Stop']?.[0]?.hooks[0]?.url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/hook\/t-02\/Stop$/,
    )
    expect(settings.permissions.deny.filter((r) => r.includes('/tasks/'))).toHaveLength(2)

    // 단계 절차 (5.6.3, D440): task마다 그 task 디렉터리의 instructions.md에 쓰고(조립은 [어댑터] store.test.ts가 본다),
    // 스킬로는 배포하지 않는다. 끝에 그 task의 context.md 경로가 있고(D442), 편집을 막는다 (D443)
    expect(fs.existsSync(path.join(s.workDir, '.claude', 'skills'))).toBe(false)
    const instructions = path.join(task('02-fix'), 'instructions.md')
    expect(read(instructions)).toContain(
      `- \`context.md\`: \`${path.join(task('02-fix'), 'context.md')}\``,
    )
    // 마무리 단계라 마무리 절차가 붙었다 (5.6.14). intake에는 없다
    expect(read(instructions)).toContain('## Finishing the Work')
    expect(read(path.join(task('01-intake'), 'instructions.md'))).not.toContain(
      '## Finishing the Work',
    )
    expect(
      settings.permissions.deny.filter((r) => r.endsWith('/tasks/02-fix/instructions.md)')),
    ).toHaveLength(1)

    // 실행 인자 (시나리오 2-5)와 토큰 (I13). fix는 리뷰 결과를 첫 입력으로 같은 대화를 다시 연다 (D496)
    const starts = s.h.records().filter((r) => r['type'] === 'start')
    expect(starts).toHaveLength(3)
    const reopened = starts[2] as { args: string[]; resume: boolean }
    expect(reopened.resume).toBe(true)
    expect(reopened.args.slice(0, 3)).toEqual([
      '--dangerously-skip-permissions',
      '--resume',
      w.tasks[1]?.session?.id,
    ])
    expect(reopened.args.at(-1)).toBe(
      `relay: 독립 리뷰가 끝났습니다. ${path.join(task('02-fix'), 'independent-review.md')}를 읽고 절차의 '독립 리뷰를 받은 뒤' 순서대로 이어 하세요. 리뷰를 다시 요청하지 마세요.`,
    )
    const first = starts[0] as { args: string[]; token: boolean; cwd: string }
    expect(first.token).toBe(true)
    expect(first.args).toEqual([
      '--dangerously-skip-permissions',
      '--session-id',
      w.tasks[0]?.session?.id,
      '--add-dir',
      s.workDir,
      '--settings',
      path.join(task('01-intake'), 'task.settings.json'),
      '--append-system-prompt-file',
      path.join(task('01-intake'), 'instructions.md'),
      `relay work-start 단계를 시작합니다. 이 task의 컨텍스트: ${path.join(task('01-intake'), 'context.md')}`,
    ])
    // 가짜 claude는 task로 보고(곁 세션이 아님) 받은 절차를 남긴다
    expect(starts.map((r) => r['side'])).toEqual([undefined, undefined, undefined])
    expect((starts[0] as { instructions?: string }).instructions).toBe(
      read(path.join(task('01-intake'), 'instructions.md')),
    )
    // 훅은 모두 받아들였다
    const hooks = s.h.records().filter((r) => r['type'] === 'hook')
    expect(hooks.every((r) => r['status'] === 200)).toBe(true)
    expect(hooks.some((r) => r['event'] === 'PreToolUse')).toBe(true)
  })

  it('단계마다 제 스킬과 Work 초안 폴더를 받고 고를 다음 단계 목록은 없다. 권한 확인 끈 모드가 아니면 머리 띠에 경고한다 (3.2, 5.6.3, D94)', async () => {
    const s = await start(scenario(), { FAKE_CLAUDE_PERMISSION_MODE: 'auto' })
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const w = work(s.workDir)
    expect(w.tasks.map((t) => [t.id, t.node, t.status])).toEqual([
      ['t-01', 'intake', 'approved'],
      ['t-02', 'fix', 'approved'],
    ])
    expect(fs.readdirSync(path.join(s.workDir, 'tasks'))).toEqual(['01-intake', '02-fix'])
    // intent.md 머리글에 크기가 없다 (D227)
    expect(read(path.join(s.workDir, 'intent.md'))).not.toContain('size:')

    // 배포한 스킬 (D103의 해시로 확인)과 실행 인자
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    const started = s.h.records().filter((r) => r['type'] === 'start') as { args: string[] }[]
    // 마무리 단계인 fix는 마무리 절차(_final.md)를 붙여 조립한다 (5.6.14, D493)
    for (const [i, skill, dir, finishing] of [
      [0, 'work-start', '01-intake', false],
      [1, 'fix', '02-fix', true],
    ] as const) {
      expect(w.tasks[i]?.skill_hash).toBe(
        `sha256:${sha256(await skillText(skillsSrc, skill, 'bugfix', undefined, finishing))}`,
      )
      expect(started[i]?.args).toContain(
        `relay ${skill} 단계를 시작합니다. 이 task의 컨텍스트: ${path.join(task(dir), 'context.md')}`,
      )
      expect(read(path.join(task(dir), 'context.md'))).toContain(`- skill: ${skill}`)
    }

    // 다음 단계는 늘 파이프라인의 다음이라 고를 목록이 없다 (3.2, D418, D422). 다시 하기로 하면 쓸 Work 초안 폴더와
    // 그 초안의 project를 적는다 (D421)
    const ctx = (dir: string) => read(path.join(task(dir), 'context.md'))
    for (const dir of ['01-intake', '02-fix']) {
      expect(ctx(dir)).not.toContain('선택 가능한 다음 단계')
      expect(ctx(dir)).toContain(`- 프로젝트 id: ${s.workKey.split('/')[0] ?? ''}`)
      expect(ctx(dir)).toContain(
        `- Work 초안 폴더: ${path.join(s.workDir, 'work-drafts')} (근본부터 다시 하기로 사람과 정했을 때 새 Work의 초안을 쓰는 곳, D420)`,
      )
    }
    expect(fs.existsSync(path.join(s.workDir, 'work-drafts'))).toBe(true)

    // 권한 확인 끈 모드가 아니면 머리 띠에 경고한다 (D94). task는 계속한다
    expect(w.tasks.every((t) => t.permission_mode === 'auto')).toBe(true)
    const view = s.h.ui.works.get(s.workKey)
    expect(view?.tasks[0]?.notice).toBe(
      '권한 확인 끈 모드가 아님(auto 모드): 일부 동작이 막힐 수 있음',
    )
    expect(view?.tasks[0]?.band).toBe('01 의도 정리 · 새 세션 · 이유: 기본 진행')
    // 마무리 단계는 독립 리뷰 결과로 같은 대화를 다시 열었다 (D496)
    expect(view?.tasks[1]?.band).toBe('02 원인 분석과 수정 · 세션 재개 · 이유: 기본 진행')
    expect(events(s.workDir).at(-1)?.type).toBe('work.completed')
  })

  it('[요약] 맨 위에 의도 초안, 원인, 리뷰 지적과 반영을 보이고 열린 질문에 답할 곳을 알린다. Work 완료 화면과 완료 뒤에 작업 브랜치의 커밋을 보인다 (D222, D223, D225, D229)', async () => {
    const s = await start(
      scenario({
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'intent.draft.md', text: intentDraft() },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({
              decisions: [{ what: '빈 배열은 0', why: '요청의 기대', by: 'ai' }],
              open_questions: ['운영 시간대는?'],
            }),
          },
          { do: 'stop' },
        ],
        // 리뷰를 받은 뒤 지적을 옮겨 썼지만 사람이 반영하지 않기로 골랐다
        verify: steps('verify').map((st) =>
          st.do === 'write' && st.file === 'verification.md'
            ? { ...st, text: REVIEW + VERDICTS }
            : st,
        ),
      }),
    )
    const ui = s.h.ui
    const pause = (node: string) =>
      drive(s.h.relay, ui, s.workKey, { pauseAt: (t) => t.node === node })

    // 의도 정리: 초안의 목표·비목표·완료조건, 열린 질문과 답할 곳
    expect((await pause('intake')).status).toBe('paused')
    const intake = await s.h.relay.review(s.workKey, 't-01')
    expect(intake?.lead).toEqual({
      title: '의도 초안',
      sections: [
        { title: '목표', text: '빈 배열의 평균이 NaN이 되는 문제를 고친다.' },
        { title: '비목표', text: '- 없음' },
        {
          title: '완료조건',
          text: '- [ ] 재현 절차가 더 이상 실패하지 않는다\n- [ ] `npm test`가 통과한다\n- [ ] 기존 테스트를 약화하거나 삭제하지 않는다',
        },
      ],
    })
    expect(intake?.emphasis.find((e) => e.kind === 'open_questions')).toEqual({
      kind: 'open_questions',
      title: '열린 질문',
      lines: ['운영 시간대는?'],
      hint: OPEN_QUESTIONS_HINT,
    })

    // 원인 분석과 수정(마무리 단계, D493): fix.md의 원인과, 리뷰를 받은 뒤 쓴 verification.md의 리뷰 지적과 반영 (D499)
    expect((await pause('fix')).status).toBe('paused')
    const verifyTask = ui.works.get(s.workKey)?.tasks.find((t) => t.node === 'fix')
    const verifyView = await s.h.relay.review(s.workKey, verifyTask?.id ?? '')
    expect(verifyView?.lead).toEqual({
      title: '원인',
      sections: [
        { title: '원인', text: FIX_CAUSE },
        { title: '리뷰 지적', text: REVIEW_FINDINGS },
        { title: '반영', text: '없음' },
      ],
    })
    // Work 완료 화면: 작업 브랜치, 기준 뒤 커밋 수와 마지막 커밋, worktree
    const worktree = path.join(s.h.home, 'projects', s.projectId, 'worktrees', s.workId)
    const head = git(worktree, 'rev-parse', 'HEAD')
    const branch = {
      name: workBranchOf(s.workId),
      ahead: 1,
      last: { sha: head.slice(0, 8), subject: 'fix: 빈 배열의 평균은 0' },
      worktree,
    }
    expect(verifyView?.completion?.branch).toEqual(branch)
    // [완료만] 뒤에도 같은 것을 보인다 (완료 알림)
    const done = await drive(s.h.relay, ui, s.workKey)
    expect(done, ui.dump()).toMatchObject({ status: 'completed' })
    expect((await s.h.relay.review(s.workKey, verifyTask?.id ?? ''))?.completion?.branch).toEqual(
      branch,
    )
  })

  it('마무리(M8, D499): 독립 리뷰의 지적을 옮겨 쓰고 반영할 지적을 질문으로 물은 뒤 사람이 고른 것만 같은 대화에서 고쳐 커밋하고 판정한다. 승인 대기는 한 번이고, 커밋은 [변경]과 [전체 변경]에 들어간다 (D229, D83)', async () => {
    const s = await start(scenario({ verify: verifyApplied() }))
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => t.label)).toEqual(['01 의도 정리', '02 원인 분석과 수정'])
    // 반영할 지적을 묻는 질문에 답했다 (터미널에 지시하지 않는다)
    expect(result.tasks[1]?.answers).toBeGreaterThan(0)
    const w = work(s.workDir)
    const worktree = path.join(s.h.home, 'projects', s.projectId, 'worktrees', s.workId)
    const fixTask = w.tasks[1]
    expect(fixTask).toMatchObject({ node: 'fix', status: 'approved', approved_by: 'human' })
    // 수정과, 리뷰를 받은 뒤 사람이 고른 지적의 반영을 차례로 커밋했다
    expect(git(worktree, 'log', '-1', '--format=%s')).toBe('verify: 빈 배열 주석')
    expect(git(worktree, 'rev-list', '--count', `${fixTask?.start_commit}..HEAD`)).toBe('2')

    // 마무리 단계의 [변경]과 [전체 변경]에는 수정과 반영이 모두 있다
    const verifyView = await s.h.relay.review(s.workKey, 't-02')
    expect(verifyView?.diff).toContain('+  // 빈 배열의 평균은 0으로 정했다')
    expect(verifyView?.diff).toContain('+  if (xs.length === 0) return 0')
    expect(verifyView?.completion?.diff).toContain('+  // 빈 배열의 평균은 0으로 정했다')
    expect(verifyView?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
    // 산출물과 [요약]의 원인, 지적과 반영. 리뷰 지적은 verification.md에 있다 (D229, D499)
    expect(verifyView?.artifacts.map((a) => a.name).sort()).toEqual([
      'fix.md',
      'independent-review.md',
      'pr.md',
      'verification.md',
    ])
    expect(verifyView?.completion?.verdicts.map((v) => v.verdict)).toEqual(['통과', '통과', '통과'])
    expect(verifyView?.completion?.review).toEqual({ state: 'ok' })
    // 독립 리뷰의 진행 기록은 산출물이 아니고 [산출물] 탭 아래에 따로 보인다 (D502)
    expect(verifyView?.reviewLogs?.map((l) => l.name)).toEqual(['find.log', 'check.log'])
    expect(verifyView?.reviewLogs?.[0]?.text).toContain('Read(README.md)')
    expect(verifyView?.lead).toEqual({
      title: '원인',
      sections: [
        { title: '원인', text: FIX_CAUSE },
        { title: '리뷰 지적', text: REVIEW_FINDINGS },
        { title: '반영', text: REVIEW_APPLIED_TEXT },
      ],
    })

    // 사람이 고른 것과 고르지 않은 것은 by: human으로 결정 로그에 남는다 (D229)
    const decisions = read(path.join(s.workDir, 'decisions.md'))
    expect(decisions).toMatch(/## t-02 fix — .* \(사람 승인\)/)
    expect(decisions).toContain('- [사람] 지적 1 반영 — 사람이 질문에서 고름')
    expect(decisions).toContain('- [사람] 지적 2 반영 안 함 — 사람이 고르지 않음')

    // 마무리 단계의 context.md: 마무리 안내 문구는 전달 버튼, 승인 방식은 수동 (시나리오 2-4, D498)
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    const verifyCtx = read(path.join(task('02-fix'), 'context.md'))
    expect(verifyCtx).toContain('- skill: fix')
    expect(verifyCtx).toContain(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push], [PR 생성] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(verifyCtx).toContain('수동 승인 (의도 승인, Work 완료는 늘 수동)')
    // 질문에 답한 뒤 한 번만 마무리한다: 리뷰 요청 한 번, 승인 대기 한 번이다 (D229, D494)
    expect(
      events(s.workDir)
        .filter((e) => e.task_id === 't-02')
        .map((e) => e.type),
    ).toEqual([
      'task.started',
      'task.first_output',
      'task.first_hook',
      'review.requested',
      'review.finished',
      'task.resumed',
      'task.first_output',
      'task.first_hook',
      'task.awaiting_approval',
      'task.approved',
    ])
    // 질문은 AskUserQuestion으로 물었다
    const asks = s.h
      .records()
      .filter(
        (r) =>
          r['type'] === 'hook' &&
          r['event'] === 'PreToolUse' &&
          (r['body'] as { tool_name?: string }).tool_name === 'AskUserQuestion',
      )
    expect(asks).toHaveLength(1)
  })

  it('마무리 단계는 리뷰를 받은 뒤 pr.md까지 있어야 승인 대기가 된다 (3.1, D30, D500)', async () => {
    const s = await start(
      scenario({
        verify: [
          { do: 'prompt' },
          { do: 'write', file: 'verification.md', text: VERIFICATION },
          { do: 'write', file: 'handoff.md', text: handoff() },
          { do: 'stop', onBlock: [{ do: 'write', file: 'pr.md', text: PR }] },
        ],
      }),
    )
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 1])
    const blocked = s.h
      .records()
      .filter((r) => r['type'] === 'hook' && r['event'] === 'Stop')
      .map((r) => r['response'] as { decision?: string; reason?: string } | null)
      .filter((r) => r?.decision === 'block')
    expect(blocked).toHaveLength(1)
    expect(blocked[0]?.reason).toContain(
      '- pr.md: `pr.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
    )
    expect(blocked[0]?.reason).not.toContain('verification.md')
  })

  it('리뷰 요청 handoff는 리뷰 중과 다시 연 세션이 일하는 동안 화면의 형식 오류가 아니다 (D494, D496, I188)', async () => {
    // 다시 연 세션은 1.5초 쉰 뒤 마무리한다: 그동안 handoff는 리뷰 요청 때의 것이다
    const after = steps('verify')
    const s = await start(
      scenario({ verify: [...after.slice(0, 1), { do: 'sleep', ms: 1500 }, ...after.slice(1)] }),
    )
    const seen: { status: string; errors: string[] }[] = []
    let done = false
    const watch = (async () => {
      while (!done) {
        const t = s.h.ui.works.get(s.workKey)?.tasks.find((x) => x.node === 'fix')
        if (t && (t.status === 'reviewing' || t.status === 'working')) {
          const r = await s.h.relay.review(s.workKey, t.id)
          if (r?.handoffStatus === 'review_requested')
            seen.push({ status: t.status, errors: r.errors.map((e) => e.message) })
        }
        await new Promise((r) => setTimeout(r, 50))
      }
    })()
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    done = true
    await watch
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    // 다시 연 세션이 일하는 동안을 보았고, 그동안 형식 오류가 없었다
    expect(seen.map((x) => x.status)).toContain('working')
    expect(seen.flatMap((x) => x.errors)).toEqual([])
  })

  it('형식 오류를 되돌리면 고쳐 쓴 handoff로 승인 대기가 된다 (D21, D107)', async () => {
    // 마무리 단계의 리뷰 요청 handoff가 형식을 어겼다. 고쳐 쓰면 리뷰를 받고 마무리한다 (D494)
    const bad = handoff({ status: 'review_requested', omit: ['요약'] })
    const s = await start(
      scenario({
        fix: [
          { do: 'prompt' },
          { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
          { do: 'write', file: 'fix.md', text: FIX_DOC },
          { do: 'write', file: 'verification.md', text: VERDICTS },
          { do: 'write', file: 'handoff.md', text: bad },
          {
            do: 'stop',
            onBlock: [
              { do: 'write', file: 'handoff.md', text: handoff({ status: 'review_requested' }) },
            ],
          },
        ],
      }),
    )
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 1])
    expect(result.tasks.every((t) => !t.forced)).toBe(true)
    // Stop 응답으로 필드와 어긴 규칙을 되돌렸고, 되돌림에 이은 Stop은 stop_hook_active: true다 (S2)
    const stops = s.h.records().filter((r) => r['type'] === 'hook' && r['event'] === 'Stop') as {
      body: { stop_hook_active: boolean }
      response: { decision?: string; reason?: string } | null
    }[]
    const blocked = stops.filter((r) => r.response?.decision === 'block')
    expect(blocked).toHaveLength(1)
    expect(blocked[0]?.response?.reason).toContain(
      '- handoff.md: `## 요약` 절 없음: handoff 본문의 필수 절',
    )
    // 되돌림 메시지의 첫 줄은 사람도 읽는다. Claude Code가 "Stop hook error: <첫 줄>"로 그린다 (D220)
    expect(blocked[0]?.response?.reason?.split('\n')[0]).toBe(BOUNCE_HEAD)
    const i = stops.indexOf(blocked[0] as (typeof stops)[number])
    expect(stops[i + 1]?.body.stop_hook_active).toBe(true)
    expect(stops[i + 1]?.response).toBeNull()
    const w = work(s.workDir)
    expect(w.tasks[1]).toMatchObject({ status: 'approved', bounce_count: 0 })
    // 되돌림은 몇 번째인지와 오류로 기록한다. 고치는 동안 패널이 안내한다 (D220)
    expect(events(s.workDir).filter((e) => e.type === 'task.bounced')).toEqual([
      expect.objectContaining({
        task_id: 't-02',
        payload: {
          attempt: 1,
          max: 2,
          errors: [{ file: 'handoff.md', message: '`## 요약` 절 없음: handoff 본문의 필수 절' }],
        },
      }),
    ])
    const notices = s.h.ui.history.flatMap((v) => v.tasks[1]?.bounceNotice ?? [])
    expect([...new Set(notices)]).toEqual([
      '형식 확인으로 되돌림(1/2): 에이전트가 handoff와 산출물의 형식만 고칩니다. 결정과 판정은 바뀌지 않습니다.',
    ])
    expect(s.h.ui.works.get(s.workKey)?.tasks[1]?.bounceNotice).toBeNull()
  })

  it('되돌림은 설정 횟수까지만 한다. 남은 오류는 [오류 무시하고 승인]으로 넘긴다 (D21, D90, D112)', async () => {
    // intent 초안의 본문 절이 계속 빠져 있다(넘길 수 있는 오류). 되돌림마다 초안을 다시 쓴다
    const draft = (n: string) => intentDraft({ omit: ['비목표'], note: `시도 ${n}` })
    const s = await start(
      scenario({
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'intent.draft.md', text: draft('0') },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({ decisions: [{ what: '빈 배열은 0', why: '이유', by: 'ai' }] }),
          },
          {
            do: 'stop',
            onBlock: [{ do: 'write', file: 'intent.draft.md', text: draft('{attempt}') }],
          },
        ],
      }),
    )
    // 되돌림 두 번 뒤 대기에서 멈춘다
    const idle = await s.h.ui.until(
      () => {
        const t = s.h.ui.works.get(s.workKey)?.tasks[0]
        return t?.status === 'idle' ? t : null
      },
      '대기',
      60_000,
    )
    expect(idle.bounces).toBe(2)
    expect(idle.errorCount).toBe(1)
    // 가짜 claude는 응답을 받은 뒤에 기록한다
    const stops = () => s.h.records().filter((r) => r['type'] === 'hook' && r['event'] === 'Stop')
    await s.h.ui.until(() => stops().length === 3, 'Stop 세 번', 10_000)
    expect(
      stops().map((r) => (r['response'] as { decision?: string } | null)?.decision ?? null),
    ).toEqual(['block', 'block', null])
    const review = await s.h.relay.review(s.workKey, 't-01')
    expect(review?.gate).toMatchObject({ approve: false, force: true, blocking: [] })
    expect(review?.emphasis.map((e) => e.kind)).toEqual(['format_errors'])
    // 확인 창 없이 [승인]은 받지 않는다
    expect((await s.h.relay.approve(s.workKey, 't-01', {})).ok).toBe(false)

    const result = await drive(s.h.relay, s.h.ui, s.workKey, { force: true })
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.forced)).toEqual([true, false])
    const w = work(s.workDir)
    expect(w.tasks[0]?.ignored_errors).toEqual([
      {
        file: 'intent.draft.md',
        part: 'body',
        field: '비목표',
        message: '`## 비목표` 절 없음: intent 초안 본문의 필수 절',
      },
    ])
    const approved = events(s.workDir).find(
      (e) => e.type === 'task.approved' && e.task_id === 't-01',
    )
    expect(approved?.payload).toEqual({ by: 'human', ignored_errors: 1 })
    // 확정한 intent는 초안의 마지막 내용이다
    expect(read(path.join(s.workDir, 'intent.md'))).toContain('시도 2')
    expect(read(path.join(s.workDir, 'decisions.md'))).toContain('- [AI] 빈 배열은 0 — 이유')
  })

  it('되돌림 횟수는 config.json을 따른다 (D70)', async () => {
    const s = await start(
      scenario({
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'intent.draft.md', text: intentDraft() },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({ omit: ['요약'], summary: '{attempt}' }),
          },
          {
            do: 'stop',
            onBlock: [
              {
                do: 'write',
                file: 'handoff.md',
                text: handoff({ omit: ['요약'], summary: '{attempt}' }) + '\n{attempt}\n',
              },
            ],
          },
        ],
      }),
      {},
      { format_error_bounce_max: 1 },
    )
    const idle = await s.h.ui.until(
      () => {
        const t = s.h.ui.works.get(s.workKey)?.tasks[0]
        return t?.status === 'idle' ? t : null
      },
      '대기',
      60_000,
    )
    expect(idle.bounces).toBe(1)
  })

  it('D418 전 형식의 recommended_next가 handoff에 있어도 경고 없이 무시하고 다음 단계로 간다 (D422, D424)', async () => {
    const old = handoff().replace(
      'knowledge_candidates: []',
      'recommended_next:\n  node: fix\n  reason: "완료조건 2 실패"\nknowledge_candidates: []',
    )
    const back = steps('verify').map((st) =>
      st.do === 'write' && st.file === 'handoff.md' ? { ...st, text: old } : st,
    )
    const s = await start(scenario({ verify: back }))
    const paused = await drive(s.h.relay, s.h.ui, s.workKey, {
      pauseAt: atCompletion(),
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, s.workKey)
    const review = await s.h.relay.review(s.workKey, 't-02')
    expect(review?.errors).toEqual([])
    expect(review?.warnings).toEqual([])
    expect(review?.emphasis.map((e) => e.kind)).not.toContain('recommended_back')
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const w = work(s.workDir)
    expect(w.stop).toBeUndefined()
    expect(w.tasks).toHaveLength(2)
  })

  it('handoff 없이 세션이 끝나면 세션 종료로 남는다 (시나리오 3)', async () => {
    const s = await start(
      scenario({ 'work-start': [{ do: 'prompt' }, { do: 'stop' }, { do: 'exit' }] }),
    )
    await s.h.ui.until(
      () => s.h.ui.works.get(s.workKey)?.tasks[0]?.status === 'session_ended',
      '세션 종료',
      60_000,
    )
    await settle(s.h, s.workKey)
    const w = work(s.workDir)
    expect(w.tasks[0]).toMatchObject({ status: 'session_ended', session: { alive: false } })
    expect(events(s.workDir).map((e) => [e.type, e.payload])).toEqual([
      ['work.created', expect.anything()],
      ['task.started', expect.anything()],
      ['task.first_output', expect.anything()],
      ['task.first_hook', expect.anything()],
      ['task.interrupted', { reason: 'session_ended' }],
    ])
  })
})

describe('[흐름] 독립 리뷰를 돌리지 못할 때 (D495)', () => {
  it('리뷰를 돌리다 앱 쪽에서 실패해도 독립 리뷰 중에 머물지 않고, 실패한 결과 글로 같은 대화를 다시 열어 마무리한다', async () => {
    // 독립 리뷰 지침(_review.md)이 없는 스킬 폴더: 리뷰 호출 전에 지침을 읽다 실패한다
    const skills = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-skills-'))
    fs.cpSync(SKILLS, skills, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}node_modules`),
    })
    fs.rmSync(path.join(skills, '_review.md'))
    try {
      h = await harness({ scenario: scenario(), skills })
      const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
      const projectId = await register(h, repo)
      const created = await h.relay.createWork(projectId, {
        request: REQUEST,
        baseBranch: 'main',
        type: 'bugfix',
        baseLocation: 'local',
      })
      if (!created.ok) throw new Error(created.error)
      const result = await drive(h.relay, h.ui, created.workKey)
      expect(result, h.ui.dump()).toMatchObject({ status: 'completed' })
      await settle(h, created.workKey)
      const dir = path.join(
        h.home,
        'projects',
        projectId,
        'works',
        created.workKey.split('/')[1] ?? '',
      )
      const w = work(dir)
      expect(w.tasks[1]?.review).toMatchObject({
        error: expect.stringContaining('독립 리뷰를 하지 못함'),
        finished_at: expect.any(String),
        resumed_at: expect.any(String),
      })
      const text = read(path.join(dir, 'tasks', '02-fix', 'independent-review.md'))
      expect(text).toContain('독립 리뷰를 하지 못함')
      // 리뷰 호출은 하지 않았다
      expect(fs.existsSync(path.join(h.root, 'scenario.json.independent-check-1.txt'))).toBe(false)
      // 남은 진행 표시가 없다
      expect(h.ui.activityLog.filter((u) => u.taskId === 't-02').at(-1)?.activity?.phase).not.toBe(
        '확인',
      )
    } finally {
      fs.rmSync(skills, { recursive: true, force: true })
    }
  })
})

describe('[흐름] 독립 리뷰 중에 앱을 끌 때 (D496)', () => {
  it('도는 리뷰 호출을 끝내고, 그 프로세스가 끝난 뒤에 끝난다: worktree를 잡고 있지 않다 (Windows의 EBUSY)', async () => {
    const s = await start(scenario(), { FAKE_CLAUDE_INDEPENDENT_MS: '60000' })
    const pidFile = path.join(s.h.root, 'scenario.json.independent-find-1.pid')
    await s.h.ui.until(
      () => s.h.ui.works.get(s.workKey)?.tasks[0]?.status === 'awaiting_approval' || null,
      'intake 승인 대기',
    )
    expect(await s.h.relay.approve(s.workKey, 't-01', {})).toEqual({ ok: true })
    await s.h.ui.until(() => fs.existsSync(pidFile) || null, '리뷰 호출 시작', 30_000)
    const pid = Number(read(pidFile))
    expect(alive(pid)).toBe(true)
    expect(s.h.ui.works.get(s.workKey)?.tasks[1]?.status).toBe('reviewing')
    const t0 = Date.now()
    await s.h.relay.close()
    // 60초 기다리는 리뷰 호출을 끊었다: 끝을 기다리지 않고 바로 끝낸다
    expect(Date.now() - t0).toBeLessThan(15_000)
    expect(alive(pid)).toBe(false)
  })
})

describe('[흐름] 세션을 끝낼 때 (D231)', () => {
  it('앱이 끝내는 세션의 SessionEnd 훅은 줄에 넣지 않고 바로 답한다. 승인 뒤 다음 단계가 곧바로 뜬다', async () => {
    const s = await start(scenario({ fix: fixAsking() }))
    const t0 = Date.now()
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    // 세션 셋을 끝냈다. 훅과 처리 줄이 서로 기다리면 끝낼 때마다 KILL_WAIT_MS(10초)를 다 써 30초를 넘는다.
    // 기다리지 않아도 Windows 러너에서 12초가 걸린 적이 있어 상한에 여유를 둔다
    expect(Date.now() - t0).toBeLessThan(25_000)
    // Linux와 macOS는 SIGHUP으로 끝내 가짜 claude가 SessionEnd를 보낸다. Windows는 taskkill /F라 오지 않는다
    if (process.platform !== 'win32') {
      const ends = s.h.records().filter((r) => r['type'] === 'hook' && r['event'] === 'SessionEnd')
      expect(ends.map((r) => [(r['body'] as { reason?: string }).reason, r['status']])).toEqual([
        ['other', 200],
        ['other', 200],
        ['other', 200],
      ])
    }
  })
})

describe('[흐름] 할 일이 실패할 때 (D135)', () => {
  it('승인 뒤 앞선 할 일이 실패하면 다음 task를 띄우지 않고 중단됨으로 둔다. 원인을 치우면 [재개]로 이어 간다', async () => {
    const s = await start(scenario())
    const ui = s.h.ui
    await ui.until(
      () => ui.works.get(s.workKey)?.tasks[0]?.status === 'awaiting_approval',
      '의도 승인 대기',
      60_000,
    )
    // 이벤트를 덧붙일 수 없게 한다. 세션을 띄우는 데는 events.jsonl이 필요 없다
    const log = path.join(s.workDir, 'events.jsonl')
    const saved = read(log)
    fs.rmSync(log)
    fs.mkdirSync(log)

    expect(await s.h.relay.approve(s.workKey, 't-01', {})).toEqual({ ok: true })
    await settle(s.h, s.workKey)
    const w = work(s.workDir)
    expect(w.tasks.map((t) => [t.id, t.node, t.status])).toEqual([
      ['t-01', 'intake', 'approved'],
      ['t-02', 'fix', 'interrupted'],
    ])
    const t2 = w.tasks[1]
    expect(t2?.session ?? null).toBeNull()
    expect(t2?.error).toMatch(/^앞선 처리가 실패해 시작하지 않음: log 실패: /)
    // 실패하지 않은 할 일은 한다: 결정을 적고 intent를 확정했다
    expect(read(path.join(s.workDir, 'decisions.md'))).toContain('t-01')
    expect(read(path.join(s.workDir, 'intent.md'))).toContain('version: 1')
    expect(s.h.records().filter((r) => r['type'] === 'start')).toHaveLength(1)
    const view = ui.works.get(s.workKey)
    expect(view?.tasks[1]).toMatchObject({ status: 'interrupted', live: false })
    expect(view?.problems.some((p) => p.includes('log 실패'))).toBe(true)

    fs.rmdirSync(log)
    fs.writeFileSync(log, saved)
    expect(await s.h.relay.resume(s.workKey, 't-02')).toEqual({ ok: true })
    await ui.until(() => ui.works.get(s.workKey)?.tasks[1]?.live === true, 'fix 세션', 30_000)
  })
  it('work.json을 쓰지 못하면 메모리의 상태도 바꾸지 않고 할 일도 하지 않는다', async () => {
    const s = await start(scenario())
    const ui = s.h.ui
    await ui.until(
      () => ui.works.get(s.workKey)?.tasks[0]?.status === 'awaiting_approval',
      '의도 승인 대기',
      60_000,
    )
    const file = path.join(s.workDir, 'work.json')
    const saved = read(file)
    fs.rmSync(file)
    fs.mkdirSync(file)

    await expect(s.h.relay.approve(s.workKey, 't-01', {})).rejects.toThrow()
    const view = ui.works.get(s.workKey)
    expect(view?.tasks.map((t) => t.status)).toEqual(['awaiting_approval'])
    expect(view?.problems.at(-1)).toContain('work.json 쓰기 실패')
    expect(fs.existsSync(path.join(s.workDir, 'intent.md'))).toBe(false)

    fs.rmdirSync(file)
    fs.writeFileSync(file, saved)
    expect(await s.h.relay.approve(s.workKey, 't-01', {})).toEqual({ ok: true })
    await ui.until(() => ui.works.get(s.workKey)?.tasks[1]?.live === true, 'fix 세션', 30_000)
  })
})
