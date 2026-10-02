// [흐름] 가짜 claude로 Work가 intake부터 Work 완료까지 간다 (docs/implementation.md M2, I25, I26).
// main의 조립 코드(Relay)를 Electron 없이 불러 쓰고, 실제 node-pty, 훅 서버, git, 파일을 지난다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mergeSkill, selectType, skillText } from '../../src/adapters/claude'
import { OPEN_QUESTIONS_HINT } from '../../src/core/review'
import { sha256 } from '../../src/adapters/store'
import { BOUNCE_HEAD, FORMAT_VERSION, parseFrontMatter } from '../../src/core/validate'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, sleep, type Harness } from './harness'
import {
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
} from './scenarios'

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
  it('기본 경로: intake → fix → verify → [완료만] (3.1, D227)', async () => {
    const s = await start(scenario({ fix: fixAsking() }))
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 원인 분석과 수정', 0, false],
      ['03 리뷰와 검증', 0, false],
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
    })
    // 승인된 intent는 버전뿐이다. 크기는 없다 (D227)
    expect(w.intent).toEqual({ version: 1 })
    expect(w.completed_at).toMatch(ISO)
    expect(w.work_id).toMatch(/^w-\d{8}-001$/)
    expect(w.tasks.map((t) => [t.id, t.seq, t.node, t.status])).toEqual([
      ['t-01', 1, 'intake', 'approved'],
      ['t-02', 2, 'fix', 'approved'],
      ['t-03', 3, 'verify', 'approved'],
    ])
    const fixHead = git(
      path.join(s.h.home, 'projects', s.projectId, 'worktrees', s.workId),
      'rev-parse',
      'HEAD',
    )
    for (const t of w.tasks) {
      expect(t).toMatchObject({
        reason: 'default',
        format_version: FORMAT_VERSION,
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
    // 시작 커밋: fix까지는 기준 커밋, verify는 fix가 커밋한 뒤 (시나리오 2-1).
    // 지적이 없는 verify는 코드를 바꾸지 않는다 (5.6.6)
    expect(w.tasks.map((t) => t.start_commit)).toEqual([base, base, fixHead])
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
      ['t-03', 'verify', '사람 승인'],
    ])
    expect(decisions).toContain('- [AI] 빈 배열의 평균은 0 — 빈 배열의 평균은 0인 이유\n')
    expect(decisions).toContain('- [사람] 재현 명령은 node -e — 재현 명령은 node -e인 이유\n')
    expect(decisions).toContain('- [AI] 원인은 0으로 나눔 — 원인은 0으로 나눔인 이유\n')

    // ---------- events.jsonl (5.5) ----------
    // 세션마다 task.started 다음에 첫 PTY 출력과 첫 훅(UserPromptSubmit)의 시각이 온다 (D217)
    const ev = events(s.workDir)
    const session = (id: string) => [
      ['task.started', id],
      ['task.first_output', id],
      ['task.first_hook', id],
      ['task.awaiting_approval', id],
      ['task.approved', id],
    ]
    expect(ev.map((e) => [e.type, e.task_id ?? null])).toEqual([
      ['work.created', null],
      ...['t-01', 't-02', 't-03'].flatMap(session),
      ['work.completed', null],
    ])
    for (const e of ev) {
      expect(e.ts).toMatch(ISO)
      expect(e.work_id).toBe(s.workId)
    }
    expect(ev[0]?.payload).toEqual({ type: 'bugfix', base_branch: 'main', base_commit: base })
    expect(ev.at(-1)?.payload).toEqual({ delivery: 'none' })
    expect(ev[5]?.payload).toEqual({ by: 'human' })
    for (const t of w.tasks) {
      const own = ev.filter((e) => e.task_id === t.id)
      expect(own[1]?.payload).toEqual({ pid: t.session?.pid, ms: expect.any(Number) })
      expect(own[2]?.payload).toEqual({
        pid: t.session?.pid,
        ms: expect.any(Number),
        event: 'UserPromptSubmit',
      })
    }

    // ---------- task 디렉터리 (5.1) ----------
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    for (const dir of ['01-intake', '02-fix', '03-verify']) {
      for (const f of ['context.md', 'task.settings.json', 'pty.log', 'handoff.md']) {
        expect(fs.existsSync(path.join(task(dir), f)), `${dir}/${f}`).toBe(true)
      }
      expect(read(path.join(task(dir), 'pty.log'))).toContain('FAKE-CLAUDE READY')
    }
    // 단계마다의 필수 산출물 (3.1): fix는 fix.md, verify는 verification.md, pr.md. review.md는 없다 (D229)
    for (const [dir, files] of [
      ['01-intake', ['intent.draft.md']],
      ['02-fix', ['fix.md']],
      ['03-verify', ['verification.md', 'pr.md']],
    ] as const) {
      for (const f of files)
        expect(fs.existsSync(path.join(task(dir), f)), `${dir}/${f}`).toBe(true)
    }
    expect(fs.existsSync(path.join(task('03-verify'), 'review.md'))).toBe(false)
    expect(read(path.join(s.workDir, 'request.md'))).toBe(REQUEST)

    // context.md (시나리오 2-4): verify는 intent, 결정 로그, 기각 목록, 직전 handoff, 산출물 경로를 받는다
    const ctx = read(path.join(task('03-verify'), 'context.md'))
    expect(ctx).toContain(`- task 디렉터리: ${task('03-verify')}`)
    expect(ctx).toContain(`- 기준 커밋: ${base}`)
    expect(ctx).toContain('## intent (버전 1)')
    expect(ctx).toContain('## t-01 intake — ')
    expect(ctx).toContain('- t-02 fix: 캐시 가설: 캐시가 없음')
    expect(ctx).toContain('## 직전 handoff (t-02 fix)')
    expect(ctx).toContain(`- t-02 fix: ${path.join(task('02-fix'), 'fix.md')}`)
    expect(ctx).not.toContain('intent.draft.md')
    expect(ctx).toContain(`경로: ${path.join(s.workDir, 'request.md')}`)
    const intakeCtx = read(path.join(task('01-intake'), 'context.md'))
    expect(intakeCtx).toContain('빈 배열의 평균이 NaN으로 나온다.')

    // task 설정 파일 (시나리오 2-3, I13): 훅 URL과 이전 task 디렉터리의 deny 규칙
    const settings = JSON.parse(read(path.join(task('03-verify'), 'task.settings.json'))) as {
      hooks: Record<string, { hooks: { url: string }[] }[]>
      permissions: { deny: string[] }
    }
    expect(settings.hooks['Stop']?.[0]?.hooks[0]?.url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/hook\/t-03\/Stop$/,
    )
    expect(settings.permissions.deny.filter((r) => r.includes('/tasks/'))).toHaveLength(2)

    // 스킬 배포 (5.6.3, D108): 이번 task의 스킬만 남고 공통 규칙이 붙어 있다
    const skills = path.join(s.workDir, '.claude', 'skills')
    expect(fs.readdirSync(skills)).toEqual(['relay-verify'])
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    expect(read(path.join(skills, 'relay-verify', 'SKILL.md'))).toBe(
      mergeSkill(
        selectType(read(path.join(skillsSrc, 'verify', 'SKILL.md')), 'bugfix'),
        read(path.join(skillsSrc, '_common.md')),
      ),
    )

    // 실행 인자 (시나리오 2-5)와 토큰 (I13)
    const starts = s.h.records().filter((r) => r['type'] === 'start')
    expect(starts).toHaveLength(3)
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
      `/relay-work-start 이 task의 컨텍스트: ${path.join(task('01-intake'), 'context.md')}`,
    ])
    // 훅은 모두 받아들였다
    const hooks = s.h.records().filter((r) => r['type'] === 'hook')
    expect(hooks.every((r) => r['status'] === 200)).toBe(true)
    expect(hooks.some((r) => r['event'] === 'PreToolUse')).toBe(true)
  })

  it('단계마다 제 스킬과 선택 가능한 다음 단계를 받는다. 권한 확인 끈 모드가 아니면 머리 띠에 경고한다 (3.2, 5.6.3, D94)', async () => {
    const s = await start(scenario(), { FAKE_CLAUDE_PERMISSION_MODE: 'auto' })
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const w = work(s.workDir)
    expect(w.tasks.map((t) => [t.id, t.node, t.status])).toEqual([
      ['t-01', 'intake', 'approved'],
      ['t-02', 'fix', 'approved'],
      ['t-03', 'verify', 'approved'],
    ])
    expect(fs.readdirSync(path.join(s.workDir, 'tasks'))).toEqual([
      '01-intake',
      '02-fix',
      '03-verify',
    ])
    // intent.md 머리글에 크기가 없다 (D227)
    expect(read(path.join(s.workDir, 'intent.md'))).not.toContain('size:')

    // 배포한 스킬 (D103의 해시로 확인)과 실행 인자
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    const started = s.h.records().filter((r) => r['type'] === 'start') as { args: string[] }[]
    for (const [i, skill, dir] of [
      [0, 'work-start', '01-intake'],
      [1, 'fix', '02-fix'],
      [2, 'verify', '03-verify'],
    ] as const) {
      expect(w.tasks[i]?.skill_hash).toBe(
        `sha256:${sha256(await skillText(skillsSrc, skill, 'bugfix'))}`,
      )
      expect(started[i]?.args).toContain(
        `/relay-${skill} 이 task의 컨텍스트: ${path.join(task(dir), 'context.md')}`,
      )
      expect(read(path.join(task(dir), 'context.md'))).toContain(`- skill: ${skill}`)
    }

    // 선택 가능한 다음 단계 (3.2): intake의 기본 다음 단계는 fix로 정해져 있다
    const ctx = (dir: string) => read(path.join(task(dir), 'context.md'))
    expect(ctx('01-intake')).toContain(
      '- 기본 다음 단계: fix (원인 분석과 수정)\n- 이전 단계: 없음',
    )
    expect(ctx('02-fix')).toContain(
      '- 기본 다음 단계: verify (리뷰와 검증)\n- 이전 단계: intake (의도 정리)',
    )
    expect(ctx('03-verify')).toContain(
      '- 기본 다음 단계: Work 완료\n- 이전 단계: intake (의도 정리), fix (원인 분석과 수정)',
    )

    // 권한 확인 끈 모드가 아니면 머리 띠에 경고한다 (D94). task는 계속한다
    expect(w.tasks.every((t) => t.permission_mode === 'auto')).toBe(true)
    const view = s.h.ui.works.get(s.workKey)
    expect(view?.tasks[0]?.notice).toBe(
      '권한 확인 끈 모드가 아님(auto 모드): 일부 동작이 막힐 수 있음',
    )
    expect(view?.tasks[0]?.band).toBe('01 의도 정리 · 새 세션 · 이유: 기본 진행')
    expect(view?.tasks[1]?.band).toBe('02 원인 분석과 수정 · 새 세션 · 이유: 기본 진행')
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
        // 지적을 썼지만 사람이 반영하지 않기로 골랐다
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

    // 원인 분석과 수정: fix.md의 원인
    expect((await pause('fix')).status).toBe('paused')
    const fixTask = ui.works.get(s.workKey)?.tasks.find((t) => t.node === 'fix')
    expect((await s.h.relay.review(s.workKey, fixTask?.id ?? ''))?.lead).toEqual({
      title: '원인',
      sections: [{ title: '원인', text: FIX_CAUSE }],
    })

    // 리뷰와 검증: verification.md의 리뷰 지적과 반영
    expect((await pause('verify')).status).toBe('paused')
    const verifyTask = ui.works.get(s.workKey)?.tasks.find((t) => t.node === 'verify')
    const verifyView = await s.h.relay.review(s.workKey, verifyTask?.id ?? '')
    expect(verifyView?.lead).toEqual({
      title: '리뷰 지적',
      sections: [
        { title: '리뷰 지적', text: REVIEW_FINDINGS },
        { title: '반영', text: '없음' },
      ],
    })
    // Work 완료 화면: 작업 브랜치, 기준 뒤 커밋 수와 마지막 커밋, worktree
    const worktree = path.join(s.h.home, 'projects', s.projectId, 'worktrees', s.workId)
    const head = git(worktree, 'rev-parse', 'HEAD')
    const branch = {
      name: `relay/${s.workId}`,
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

  it('리뷰와 검증(M8): 지적을 쓰고 반영할 지적을 질문으로 물은 뒤 사람이 고른 것만 같은 세션에서 고쳐 커밋하고 판정한다. handoff는 한 번이고, 커밋은 [변경]과 [전체 변경]에 들어간다 (D229, D83)', async () => {
    const s = await start(scenario({ verify: verifyApplied() }))
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => t.label)).toEqual([
      '01 의도 정리',
      '02 원인 분석과 수정',
      '03 리뷰와 검증',
    ])
    // 반영할 지적을 묻는 질문에 답했다 (터미널에 지시하지 않는다)
    expect(result.tasks[2]?.answers).toBeGreaterThan(0)
    const w = work(s.workDir)
    const worktree = path.join(s.h.home, 'projects', s.projectId, 'worktrees', s.workId)
    const [fixTask, verifyTask] = [w.tasks[1], w.tasks[2]]
    expect(verifyTask).toMatchObject({ node: 'verify', status: 'approved', approved_by: 'human' })
    // verify는 fix의 커밋 위에서 시작해 사람이 고른 지적을 커밋했다
    expect(verifyTask?.start_commit).not.toBe(fixTask?.start_commit)
    expect(git(worktree, 'log', '-1', '--format=%s')).toBe('verify: 빈 배열 주석')
    expect(git(worktree, 'rev-list', '--count', `${verifyTask?.start_commit}..HEAD`)).toBe('1')
    expect(git(worktree, 'rev-list', '--count', `${fixTask?.start_commit}..HEAD`)).toBe('2')

    // verify의 [변경]에는 반영 커밋만 있고, [전체 변경]에는 수정과 반영이 모두 있다
    const verifyView = await s.h.relay.review(s.workKey, 't-03')
    expect(verifyView?.diff).toContain('+  // 빈 배열의 평균은 0으로 정했다')
    expect(verifyView?.diff).not.toContain('+  if (xs.length === 0) return 0')
    expect(verifyView?.completion?.diff).toContain('+  // 빈 배열의 평균은 0으로 정했다')
    expect(verifyView?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
    // 산출물 둘과 [요약]의 지적과 반영. 리뷰 지적은 verification.md에 있다 (D229)
    expect(verifyView?.artifacts.map((a) => a.name).sort()).toEqual(['pr.md', 'verification.md'])
    expect(verifyView?.completion?.verdicts.map((v) => v.verdict)).toEqual(['통과', '통과', '통과'])
    expect(verifyView?.lead).toEqual({
      title: '리뷰 지적',
      sections: [
        { title: '리뷰 지적', text: REVIEW_FINDINGS },
        { title: '반영', text: REVIEW_APPLIED_TEXT },
      ],
    })

    // 사람이 고른 것과 고르지 않은 것은 by: human으로 결정 로그에 남는다 (D229)
    const decisions = read(path.join(s.workDir, 'decisions.md'))
    expect(decisions).toMatch(/## t-03 verify — .* \(사람 승인\)/)
    expect(decisions).toContain('- [사람] 지적 1 반영 — 사람이 질문에서 고름')
    expect(decisions).toContain('- [사람] 지적 2 반영 안 함 — 사람이 고르지 않음')

    // verify의 context.md: 스킬, 마무리 안내 문구, 승인 방식, 이전 단계, fix의 산출물 (5.6.6, 시나리오 2-4)
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    const verifyCtx = read(path.join(task('03-verify'), 'context.md'))
    expect(verifyCtx).toContain('- skill: verify')
    expect(verifyCtx).toContain(
      '산출물과 handoff를 썼습니다. 오른쪽 패널에서 확인하고 [완료만], [push], [PR 생성] 중 하나를 누르세요. [이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고, 전달은 멈춘 뒤 Work 완료 화면에서 고르세요. 고칠 점은 여기에 말해 주세요.',
    )
    expect(verifyCtx).not.toContain('반영할 지적은 번호로')
    expect(verifyCtx).toContain('수동 승인 (의도 승인, Work 완료는 늘 수동)')
    expect(verifyCtx).toContain('- 이전 단계: intake (의도 정리), fix (원인 분석과 수정)')
    // 재현 절차가 적힌 fix.md를 받는다. 리뷰는 재현 절차가 쓰는 코드를 지킨다 (D195)
    expect(verifyCtx).toContain(`- t-02 fix: ${path.join(task('02-fix'), 'fix.md')}`)
    // 배포한 스킬 (D103)
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    expect(verifyTask?.skill_hash).toBe(
      `sha256:${sha256(await skillText(skillsSrc, 'verify', 'bugfix'))}`,
    )
    // 질문에 답한 뒤 한 번만 마무리한다: 승인 대기는 한 번이다 (D229)
    expect(
      events(s.workDir)
        .filter((e) => e.task_id === 't-03')
        .map((e) => e.type),
    ).toEqual([
      'task.started',
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

  it('리뷰와 검증은 verification.md와 pr.md가 모두 있어야 승인 대기가 된다 (3.1, D30, D229)', async () => {
    const s = await start(
      scenario({
        verify: [
          { do: 'prompt' },
          { do: 'write', file: 'pr.md', text: PR },
          { do: 'write', file: 'handoff.md', text: handoff() },
          { do: 'stop', onBlock: [{ do: 'write', file: 'verification.md', text: VERIFICATION }] },
        ],
      }),
    )
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 0, 1])
    const blocked = s.h
      .records()
      .filter((r) => r['type'] === 'hook' && r['event'] === 'Stop')
      .map((r) => r['response'] as { decision?: string; reason?: string } | null)
      .filter((r) => r?.decision === 'block')
    expect(blocked).toHaveLength(1)
    expect(blocked[0]?.reason).toContain(
      '- verification.md: `verification.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
    )
    expect(blocked[0]?.reason).not.toContain('pr.md')
  })

  it('형식 오류를 되돌리면 고쳐 쓴 handoff로 승인 대기가 된다 (D21, D107)', async () => {
    const bad = handoff({ omit: ['요약'] })
    const s = await start(
      scenario({
        fix: [
          { do: 'prompt' },
          { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
          { do: 'write', file: 'fix.md', text: FIX_DOC },
          { do: 'write', file: 'handoff.md', text: bad },
          { do: 'stop', onBlock: [{ do: 'write', file: 'handoff.md', text: handoff() }] },
        ],
      }),
    )
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 1, 0])
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
    expect(result.tasks.map((t) => t.forced)).toEqual([true, false, false])
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

  it('verify가 이전 단계를 추천하면 승인 뒤 멈추고 알린다 (D23)', async () => {
    const back = steps('verify').map((st) =>
      st.do === 'write' && st.file === 'handoff.md'
        ? { ...st, text: handoff({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } }) }
        : st,
    )
    const s = await start(scenario({ verify: back }))
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 원인 분석과 수정(fix)로 — 완료조건 2 실패',
    })
    const w = work(s.workDir)
    expect(w).toMatchObject({
      status: 'stopped',
      stop: { kind: 'recommended_back', task_id: 't-03', node: 'fix', reason: '완료조건 2 실패' },
    })
    expect(w.tasks).toHaveLength(3)
    // 멈추면 알린다 (D23, D81). 앞의 알림은 task마다의 승인 대기다
    expect(s.h.ui.notices.at(-1)).toEqual({
      workKey: s.workKey,
      title: expect.stringContaining('빈 배열의 평균이 NaN') as string,
      body: '이전 단계 추천으로 멈춤: 원인 분석과 수정(fix)로 — 완료조건 2 실패',
    })
    expect(s.h.ui.notices.map((n) => n.body)).toEqual([
      '01 의도 정리: 승인 대기',
      '02 원인 분석과 수정: 승인 대기',
      '03 리뷰와 검증: 승인 대기',
      '이전 단계 추천으로 멈춤: 원인 분석과 수정(fix)로 — 완료조건 2 실패',
    ])
    expect(events(s.workDir).map((e) => e.type)).not.toContain('work.completed')
    expect(read(path.join(s.workDir, 'decisions.md'))).toContain('## t-03 verify — ')
    // 새 task를 시작하지 않았고 세션도 남지 않았다
    expect(s.h.ui.works.get(s.workKey)?.tasks.every((t) => !t.live)).toBe(true)
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

  it('Stop 없이 세션이 끝나도 유효한 handoff가 있으면 승인 대기로 알린다. 이 경로는 자동 승인하지 않는다 (3.3, D146)', async () => {
    const s = await start(
      scenario({
        fix: [
          { do: 'prompt' },
          { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
          { do: 'write', file: 'fix.md', text: FIX_DOC },
          { do: 'write', file: 'handoff.md', text: handoff({ summary: '수정했다.' }) },
          { do: 'exit' },
        ],
      }),
      {},
      {
        auto_approve: { fix: true },
        auto_approve_countdown_sec: 1,
      },
    )
    const ui = s.h.ui
    await drive(s.h.relay, ui, s.workKey, { pauseAt: (t) => t.node === 'fix' })
    const fix = await ui.until(
      () => {
        const t = ui.works.get(s.workKey)?.tasks[1]
        return t && !t.live && t.status !== 'working' ? t : null
      },
      '세션 종료',
      60_000,
    )
    expect(fix).toMatchObject({ id: 't-02', status: 'awaiting_approval', countdown: null })
    expect(ui.notices.map((n) => n.body)).toEqual([
      '01 의도 정리: 승인 대기',
      '02 원인 분석과 수정: 승인 대기',
    ])
    // 카운트다운 초가 지나도 자동 승인하지 않는다
    await sleep(2_000)
    await settle(s.h, s.workKey)
    expect(work(s.workDir).tasks[1]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
    })
    expect(
      events(s.workDir)
        .filter((e) => e.task_id === 't-02')
        .map((e) => [e.type, e.payload]),
    ).toEqual([
      ['task.started', expect.anything()],
      ['task.first_output', expect.anything()],
      ['task.first_hook', expect.anything()],
      ['task.awaiting_approval', { reason: 'session_ended' }],
    ])
    // 사람은 승인하고 다음 단계로 간다
    const result = await drive(s.h.relay, ui, s.workKey)
    expect(result, ui.dump()).toMatchObject({ status: 'completed' })
  })
})

describe('[흐름] 세션을 끝낼 때 (D231)', () => {
  it('앱이 끝내는 세션의 SessionEnd 훅은 줄에 넣지 않고 바로 답한다. 승인 뒤 다음 단계가 곧바로 뜬다', async () => {
    const s = await start(scenario({ fix: fixAsking() }))
    const t0 = Date.now()
    const result = await drive(s.h.relay, s.h.ui, s.workKey)
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    // 세션 셋을 끝냈다. 훅과 처리 줄이 서로 기다리면 끝낼 때마다 KILL_WAIT_MS(10초)를 다 쓴다
    expect(Date.now() - t0).toBeLessThan(10_000)
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
