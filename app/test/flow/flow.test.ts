// [흐름] 가짜 claude로 Work가 intake부터 Work 완료까지 간다 (docs/implementation.md M2, I25, I26).
// main의 조립 코드(Relay)를 Electron 없이 불러 쓰고, 실제 node-pty, 훅 서버, git, 파일을 지난다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { mergeSkill } from '../../src/adapters/claude'
import { parseFrontMatter } from '../../src/core/validate'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, type Harness } from './harness'
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
  it('M 경로: intake → evidence → rca → fix → verify → [완료만]', async () => {
    const s = await start(scenario('M'))
    const base = git(s.repo, 'rev-parse', 'main')
    const result = await drive(s.h.relay, s.h.ui, s.workKey, { size: 'M' })
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.forced])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 재현과 관찰', 0, false],
      ['03 원인 분석', 0, false],
      ['04 수정', 0, false],
      ['05 최종 검증', 0, false],
    ])
    // evidence의 질문 대기에 답했다
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
      intent: { version: 1, size: 'M' },
      settings: {},
    })
    expect(w.completed_at).toMatch(ISO)
    expect(w.work_id).toMatch(/^w-\d{8}-001$/)
    expect(w.tasks.map((t) => [t.id, t.seq, t.node, t.status])).toEqual([
      ['t-01', 1, 'intake', 'approved'],
      ['t-02', 2, 'evidence', 'approved'],
      ['t-03', 3, 'rca', 'approved'],
      ['t-04', 4, 'fix', 'approved'],
      ['t-05', 5, 'verify', 'approved'],
    ])
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
    // 시작 커밋: fix 앞까지는 기준 커밋, verify는 fix가 커밋한 뒤 (시나리오 2-1)
    expect(w.tasks.map((t) => t.start_commit)).toEqual([base, base, base, base, fixHead])
    expect(fixHead).not.toBe(base)

    // ---------- intent.md (5.3) ----------
    const intent = read(path.join(s.workDir, 'intent.md'))
    const fm = parseFrontMatter(intent)
    expect(fm.ok && fm.data).toEqual({ schema_version: 1, version: 1, type: 'bugfix', size: 'M' })
    expect(fm.body).toBe(parseFrontMatter(intentDraft('M')).body)
    expect(fs.existsSync(path.join(s.workDir, 'intent.history'))).toBe(false)

    // ---------- decisions.md (5.4) ----------
    const decisions = read(path.join(s.workDir, 'decisions.md'))
    const heads = [
      ...decisions.matchAll(/^## (t-\d\d) (\w+) — (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \((.+)\)$/gm),
    ]
    expect(heads.map((m) => [m[1], m[2], m[4]])).toEqual([
      ['t-01', 'intake', '사람 승인'],
      ['t-02', 'evidence', '사람 승인'],
      ['t-03', 'rca', '사람 승인'],
      ['t-04', 'fix', '사람 승인'],
      ['t-05', 'verify', '사람 승인'],
    ])
    expect(decisions).toContain('- [AI] 크기는 M — 크기는 M인 이유\n')
    expect(decisions).toContain('- [사람] 재현 명령은 node -e — 재현 명령은 node -e인 이유\n')

    // ---------- events.jsonl (5.5) ----------
    const ev = events(s.workDir)
    expect(ev.map((e) => [e.type, e.task_id ?? null])).toEqual([
      ['work.created', null],
      ['task.started', 't-01'],
      ['task.awaiting_approval', 't-01'],
      ['task.approved', 't-01'],
      ['task.started', 't-02'],
      ['task.awaiting_approval', 't-02'],
      ['task.approved', 't-02'],
      ['task.started', 't-03'],
      ['task.awaiting_approval', 't-03'],
      ['task.approved', 't-03'],
      ['task.started', 't-04'],
      ['task.awaiting_approval', 't-04'],
      ['task.approved', 't-04'],
      ['task.started', 't-05'],
      ['task.awaiting_approval', 't-05'],
      ['task.approved', 't-05'],
      ['work.completed', null],
    ])
    for (const e of ev) {
      expect(e.ts).toMatch(ISO)
      expect(e.work_id).toBe(s.workId)
    }
    expect(ev[0]?.payload).toEqual({ base_branch: 'main', base_commit: base })
    expect(ev.at(-1)?.payload).toEqual({ delivery: 'none' })
    expect(ev[3]?.payload).toEqual({ by: 'human' })

    // ---------- task 디렉터리 (5.1) ----------
    const task = (dir: string) => path.join(s.workDir, 'tasks', dir)
    for (const dir of ['01-intake', '02-evidence', '03-rca', '04-fix', '05-verify']) {
      for (const f of ['context.md', 'task.settings.json', 'pty.log', 'handoff.md']) {
        expect(fs.existsSync(path.join(task(dir), f)), `${dir}/${f}`).toBe(true)
      }
      expect(read(path.join(task(dir), 'pty.log'))).toContain('FAKE-CLAUDE READY')
    }
    expect(read(path.join(s.workDir, 'request.md'))).toBe(REQUEST)

    // context.md (시나리오 2-4): rca는 intent, 결정 로그, 기각 목록, 직전 handoff, 산출물 경로를 받는다
    const ctx = read(path.join(task('03-rca'), 'context.md'))
    expect(ctx).toContain(`- task 디렉터리: ${task('03-rca')}`)
    expect(ctx).toContain(`- 기준 커밋: ${base}`)
    expect(ctx).toContain('## intent (버전 1)')
    expect(ctx).toContain('## t-01 intake — ')
    expect(ctx).toContain('- t-02 evidence: 캐시 가설: 캐시가 없음')
    expect(ctx).toContain('## 직전 handoff (t-02 evidence)')
    expect(ctx).toContain(`- t-02 evidence: ${path.join(task('02-evidence'), 'evidence.md')}`)
    expect(ctx).not.toContain('intent.draft.md')
    expect(ctx).toContain(`경로: ${path.join(s.workDir, 'request.md')}`)
    const intakeCtx = read(path.join(task('01-intake'), 'context.md'))
    expect(intakeCtx).toContain('빈 배열의 평균이 NaN으로 나온다.')

    // task 설정 파일 (시나리오 2-3, I13): 훅 URL과 이전 task 디렉터리의 deny 규칙
    const settings = JSON.parse(read(path.join(task('03-rca'), 'task.settings.json'))) as {
      hooks: Record<string, { hooks: { url: string }[] }[]>
      permissions: { deny: string[] }
    }
    expect(settings.hooks['Stop']?.[0]?.hooks[0]?.url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/hook\/t-03\/Stop$/,
    )
    expect(settings.permissions.deny.filter((r) => r.includes('/tasks/'))).toHaveLength(2)

    // 스킬 배포 (5.6.3, D108): 이번 task의 스킬만 남고 공통 규칙이 붙어 있다
    const skills = path.join(s.workDir, '.claude', 'skills')
    expect(fs.readdirSync(skills)).toEqual(['relay-final-verify'])
    const skillsSrc = path.resolve(__dirname, '../../../skills')
    expect(read(path.join(skills, 'relay-final-verify', 'SKILL.md'))).toBe(
      mergeSkill(
        read(path.join(skillsSrc, 'final-verify', 'SKILL.md')),
        read(path.join(skillsSrc, '_common.md')),
      ),
    )

    // 실행 인자 (시나리오 2-5)와 토큰 (I13)
    const starts = s.h.records().filter((r) => r['type'] === 'start')
    expect(starts).toHaveLength(5)
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

  it('S 경로: intake → fix → verify → [완료만]. 사람이 고른 size가 초안보다 우선한다 (3.4, 4.1)', async () => {
    // 초안은 M을 제안하지만 사람이 의도 승인 화면에서 S를 고른다
    const s = await start(scenario('S', { 'work-start': steps('intake', 'M') }), {
      FAKE_CLAUDE_PERMISSION_MODE: 'auto',
    })
    const result = await drive(s.h.relay, s.h.ui, s.workKey, { size: 'S' })
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    const w = work(s.workDir)
    expect(w.intent).toEqual({ version: 1, size: 'S' })
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
    expect(read(path.join(s.workDir, 'intent.md'))).toContain('\nsize: S\n')
    // 권한 확인 끈 모드가 아니면 머리 띠에 경고한다 (D94). task는 계속한다
    expect(w.tasks.every((t) => t.permission_mode === 'auto')).toBe(true)
    const view = s.h.ui.works.get(s.workKey)
    expect(view?.tasks[0]?.notice).toBe(
      '권한 확인 끈 모드가 아님(auto 모드): 일부 동작이 막힐 수 있음',
    )
    expect(view?.tasks[0]?.band).toBe('01 의도 정리 · 새 세션 · 이유: 기본 진행')
    expect(events(s.workDir).at(-1)?.type).toBe('work.completed')
  })

  it('형식 오류를 되돌리면 고쳐 쓴 handoff로 승인 대기가 된다 (D21, D107)', async () => {
    const bad = handoff({ omit: ['요약'] })
    const s = await start(
      scenario('M', {
        evidence: [
          { do: 'prompt' },
          {
            do: 'write',
            file: 'evidence.md',
            text:
              steps('evidence')[2]?.do === 'write'
                ? (steps('evidence')[2] as { text: string }).text
                : '',
          },
          { do: 'write', file: 'handoff.md', text: bad },
          { do: 'stop', onBlock: [{ do: 'write', file: 'handoff.md', text: handoff() }] },
        ],
      }),
    )
    const result = await drive(s.h.relay, s.h.ui, s.workKey, { size: 'M' })
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 1, 0, 0, 0])
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
    const i = stops.indexOf(blocked[0] as (typeof stops)[number])
    expect(stops[i + 1]?.body.stop_hook_active).toBe(true)
    expect(stops[i + 1]?.response).toBeNull()
    const w = work(s.workDir)
    expect(w.tasks[1]).toMatchObject({ status: 'approved', bounce_count: 0 })
  })

  it('되돌림은 설정 횟수까지만 한다. 남은 오류는 [오류 무시하고 승인]으로 넘긴다 (D21, D90, D112)', async () => {
    // intent 초안의 본문 절이 계속 빠져 있다(넘길 수 있는 오류). 되돌림마다 초안을 다시 쓴다
    const draft = (n: string) => intentDraft('M', { omit: ['비목표'], note: `시도 ${n}` })
    const s = await start(
      scenario('M', {
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'intent.draft.md', text: draft('0') },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({ decisions: [{ what: '크기는 M', why: '이유', by: 'ai' }] }),
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
    expect(review?.gates.M).toMatchObject({ approve: false, force: true, blocking: [] })
    expect(review?.emphasis.map((e) => e.kind)).toEqual(['format_errors'])
    // 확인 창 없이 [승인]은 받지 않는다
    expect((await s.h.relay.approve(s.workKey, 't-01', { size: 'M' })).ok).toBe(false)

    const result = await drive(s.h.relay, s.h.ui, s.workKey, { size: 'M', force: true })
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed' })
    expect(result.tasks.map((t) => t.forced)).toEqual([true, false, false, false, false])
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
    expect(read(path.join(s.workDir, 'decisions.md'))).toContain('- [AI] 크기는 M — 이유')
  })

  it('되돌림 횟수는 config.json을 따른다 (D70)', async () => {
    const s = await start(
      scenario('M', {
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'intent.draft.md', text: intentDraft('M') },
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
    const s = await start(scenario('S', { 'final-verify': back }))
    const result = await drive(s.h.relay, s.h.ui, s.workKey, { size: 'S' })
    await settle(s.h, s.workKey)
    expect(result, s.h.ui.dump()).toMatchObject({
      status: 'stopped',
      reason: '이전 단계 추천으로 멈춤: 수정(fix)로 — 완료조건 2 실패',
    })
    const w = work(s.workDir)
    expect(w).toMatchObject({
      status: 'stopped',
      stop: { kind: 'recommended_back', task_id: 't-03', node: 'fix', reason: '완료조건 2 실패' },
    })
    expect(w.tasks).toHaveLength(3)
    expect(s.h.ui.notices).toEqual([
      {
        title: expect.stringContaining('빈 배열의 평균이 NaN') as string,
        body: '이전 단계 추천으로 멈춤: 수정(fix)로 — 완료조건 2 실패',
      },
    ])
    expect(events(s.workDir).map((e) => e.type)).not.toContain('work.completed')
    expect(read(path.join(s.workDir, 'decisions.md'))).toContain('## t-03 verify — ')
    // 새 task를 시작하지 않았고 세션도 남지 않았다
    expect(s.h.ui.works.get(s.workKey)?.tasks.every((t) => !t.live)).toBe(true)
  })

  it('handoff 없이 세션이 끝나면 세션 종료로 남는다 (시나리오 3)', async () => {
    const s = await start(
      scenario('M', { 'work-start': [{ do: 'prompt' }, { do: 'stop' }, { do: 'exit' }] }),
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
      ['task.interrupted', { reason: 'session_ended' }],
    ])
  })
})
