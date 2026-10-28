// [흐름] relay MCP (D516~D526): 호출자가 도구로 Work를 맡기고, 질문은 relay MCP의 ask_human으로 와서 호출자가 답하며,
// 승인은 호출자가 하고, 사람은 [직접 맡기]로 맡는다. 가짜 claude가 --mcp-config의 relay 서버로 묻는다
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from '../support/harness'
import { handoff, intentDraft, REPO_FILES, REQUEST } from '../support/scenarios'
import { CALLER_DRIVES, HUMAN_DRIVES, RECOMMEND_ANSWER } from '../../src/core/driver'
import { IN_APP_REFUSED, type McpWork } from '../../src/core/mcp'
import type { McpResult } from '../../src/main/mcp'
import type { WorkState } from '../../src/shared/work'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})

/** 의도 정리를 마치는 단계: intent 초안과 handoff를 쓰고 턴을 끝낸다 */
const finish = [
  { do: 'write', file: 'intent.draft.md', text: intentDraft() },
  { do: 'write', file: 'handoff.md', text: handoff() },
  { do: 'stop' },
  { do: 'wait' },
]

async function setup(scenario: object) {
  const hh = await harness({ scenario })
  h = hh
  const { repo } = makeRepo(hh.root, 'mcp-repo', REPO_FILES)
  const projectId = await register(hh, repo)
  const call = async (tool: string, args: Record<string, unknown> = {}, inApp = false) =>
    hh.relay.mcp.call(tool, args, { inApp })
  const ok = async <T = McpWork>(tool: string, args: Record<string, unknown> = {}) => {
    const r = await call(tool, args)
    if (!r.ok) throw new Error(`${tool}: ${r.error}`)
    return r.result as T
  }
  const read = (key: string) => {
    const [project, work] = key.split('/')
    return JSON.parse(
      fs.readFileSync(
        path.join(hh.home, 'projects', project ?? '', 'works', work ?? '', 'work.json'),
        'utf8',
      ),
    ) as WorkState
  }
  const starts = () => hh.records().filter((r) => r['type'] === 'start')
  const answers = () => hh.records().filter((r) => r['type'] === 'answer')
  return { hh, projectId, call, ok, read, starts, answers }
}

/** wait를 state가 바뀔 때까지 되풀이한다 */
async function waitFor(
  ok: <T = McpWork>(tool: string, args?: Record<string, unknown>) => Promise<T>,
  work: string,
  state: string,
): Promise<McpWork> {
  let seen: string | undefined
  for (let i = 0; i < 20; i++) {
    const r = await ok<McpWork & { timed_out: boolean }>('wait', {
      work,
      timeout_sec: 30,
      ...(seen ? { seen } : {}),
    })
    if (r.state === state) return r
    seen = r.state_key
  }
  throw new Error(`state ${state}을 기다리다 끝남`)
}

const text = (r: unknown) =>
  JSON.parse((r as { content: { text: string }[] }).content[0]?.text ?? '') as Record<
    string,
    unknown
  >

describe('[흐름] relay MCP 호출자가 Work를 맡긴다 (D516~D526)', () => {
  it('조회 도구로 프로젝트와 유형을 보고, caller Work의 질문·승인을 호출자가 하며 사람은 하지 못한다', async () => {
    const s = await setup({
      tasks: {
        'work-start': [{ do: 'prompt' }, { do: 'mcpAsk' }, ...finish],
        'code-fix': [{ do: 'prompt' }, { do: 'wait' }],
      },
    })
    const projects = await s.ok<{ id: string; default_branch: string }[]>('list_projects')
    expect(projects).toEqual([expect.objectContaining({ id: s.projectId, default_branch: 'main' })])
    const types = await s.ok<{ id: string; source: string }[]>('list_types', {
      project: s.projectId,
    })
    expect(types.map((t) => t.id)).toEqual(
      expect.arrayContaining(['bugfix', 'feature', 'refactor', 'spec', 'general']),
    )

    const started = await s.ok('start_work', {
      project: s.projectId,
      type: 'bugfix',
      request: REQUEST,
    })
    expect(started).toMatchObject({ driver: 'caller', status: 'active', type: 'bugfix' })
    const work = started.work
    expect(s.read(work).driver).toBe('caller')
    expect(await s.ok('list_works')).toEqual([expect.objectContaining({ work, driver: 'caller' })])

    // 질문은 relay MCP로 온다: Claude task가 --mcp-config로 띄워지고 AskUserQuestion은 빠졌다 (D521)
    const asked = await waitFor(s.ok, work, 'question')
    expect(asked.next).toContain('answer')
    const args = s.starts()[0]?.['args'] as string[]
    expect(args).toEqual(expect.arrayContaining(['--disallowedTools', 'AskUserQuestion']))
    const config = args[args.indexOf('--mcp-config') + 1] ?? ''
    expect(JSON.parse(fs.readFileSync(config, 'utf8'))).toMatchObject({
      mcpServers: { relay: { args: [expect.stringMatching(/codex-bridge\.mjs$/), 'mcp'] } },
    })
    const instructions = s.starts()[0]?.['instructions'] as string
    expect(instructions).toContain('`mcp__relay__ask_human`')
    expect(instructions).not.toContain('`AskUserQuestion`')
    expect(instructions).toContain('cannot see this terminal')
    expect(s.read(work).tasks[0]?.ask).toBe('mcp')

    // 사람은 caller Work의 질문에 답하지 못한다 (D523)
    const q = asked.question
    if (!q) throw new Error('질문 없음')
    expect(await s.hh.relay.answerQuestion(work, 't-01', q.id, { scope: ['전체'] })).toEqual({
      ok: false,
      error: CALLER_DRIVES,
    })
    expect(
      await s.call('answer', { work, question_id: q.id, answers: { scope: ['작은 범위 (추천)'] } }),
    ).toEqual({ ok: true, result: { ok: true } })
    const reply = await s.hh.ui.until(() => s.answers()[0], '가짜 claude가 받은 답')
    expect(text(reply['result'])).toEqual({
      cancelled: false,
      answers: { scope: ['작은 범위 (추천)'] },
    })

    // 승인 대기: 요약과 산출물 경로가 오고, 사람의 [승인]은 받지 않는다
    const waiting = await waitFor(s.ok, work, 'awaiting_approval')
    expect(waiting.next).toEqual(expect.arrayContaining(['approve', 'revise', 'abandon']))
    expect(waiting.review?.can_approve).toBe(true)
    expect(waiting.review?.artifacts.some((a) => a.endsWith('intent.draft.md'))).toBe(true)
    expect(fs.existsSync(waiting.review?.artifacts[0] ?? '')).toBe(true)
    expect(await s.hh.relay.approve(work, 't-01', {})).toEqual({ ok: false, error: CALLER_DRIVES })
    expect(await s.call('approve', { work })).toEqual({ ok: true, result: { ok: true } })
    await s.hh.ui.until(() => s.starts().length >= 2, '다음 task')
    const decisions = fs.readFileSync(
      path.join(
        s.hh.home,
        'projects',
        s.projectId,
        'works',
        work.split('/')[1] ?? '',
        'decisions.md',
      ),
      'utf8',
    )
    expect(decisions).toContain('(호출자 승인)')
    expect(s.read(work).tasks[0]?.approved_by).toBe('caller')
    // 다음 task도 relay MCP로 묻는다
    expect(s.starts()[1]?.['args']).toEqual(expect.arrayContaining(['--mcp-config']))
    // caller Work는 OS 알림을 보내지 않는다 (D523)
    expect(s.hh.ui.notices.filter((n) => n.workKey === work)).toEqual([])
  })

  it('questions: recommend면 앱이 "알아서 해"로 바로 답하고 질문 상태가 되지 않는다 (D521)', async () => {
    const s = await setup({
      tasks: { 'work-start': [{ do: 'prompt' }, { do: 'mcpAsk' }, ...finish] },
    })
    const { work } = await s.ok('start_work', {
      project: s.projectId,
      type: 'bugfix',
      request: REQUEST,
      questions: 'recommend',
    })
    const reply = await s.hh.ui.until(() => s.answers()[0], '가짜 claude가 받은 답')
    expect(text(reply['result'])).toEqual({
      cancelled: false,
      answers: { scope: [RECOMMEND_ANSWER] },
    })
    const waiting = await waitFor(s.ok, work, 'awaiting_approval')
    expect(waiting.question).toBeNull()
    expect(s.read(work).caller_questions).toBe('recommend')
  })

  it('[직접 맡기] 뒤에는 사람이 질문에 답하고 승인하며, 호출자는 조회만 한다 (D523)', async () => {
    const s = await setup({
      tasks: { 'work-start': [{ do: 'prompt' }, { do: 'mcpAsk' }, ...finish] },
    })
    const { work } = await s.ok('start_work', {
      project: s.projectId,
      type: 'bugfix',
      request: REQUEST,
    })
    const asked = await waitFor(s.ok, work, 'question')
    expect(await s.hh.relay.takeOver(work)).toEqual({ ok: true })
    expect(s.hh.ui.works.get(work)?.driver).toBe('human')
    expect(s.read(work).driver).toBeUndefined()
    const q = asked.question
    if (!q) throw new Error('질문 없음')
    expect(
      await s.call('answer', { work, question_id: q.id, answers: { scope: ['전체'] } }),
    ).toEqual({ ok: false, error: HUMAN_DRIVES })
    // 살아 있는 세션의 질문은 이제 사람의 것이다: 화면에 보이고 사람이 답한다
    expect(s.hh.ui.works.get(work)?.tasks[0]?.question?.id).toBe(q.id)
    expect(await s.hh.relay.answerQuestion(work, 't-01', q.id, { scope: ['전체'] })).toEqual({
      ok: true,
    })
    const human = await waitFor(s.ok, work, 'awaiting_approval')
    expect(human).toMatchObject({ driver: 'human', next: ['wait'] })
    expect(await s.call('approve', { work })).toEqual({ ok: false, error: HUMAN_DRIVES })
    expect(await s.hh.relay.approve(work, 't-01', {})).toEqual({ ok: true })
    expect(s.read(work).tasks[0]?.approved_by).toBe('human')
    expect(await s.hh.relay.takeOver(work)).toMatchObject({ ok: false })
  })

  it('revise는 턴이 끝난 세션을 끝내고 같은 대화를 그 글로 다시 연다 (D524)', async () => {
    const s = await setup({
      tasks: { 'work-start': [{ do: 'prompt' }, ...finish] },
      resume: { 'work-start': [{ do: 'prompt' }, { do: 'stop' }, { do: 'wait' }] },
    })
    const { work } = await s.ok('start_work', {
      project: s.projectId,
      type: 'bugfix',
      request: REQUEST,
    })
    await waitFor(s.ok, work, 'awaiting_approval')
    expect(await s.call('revise', { work, message: '   ' })).toMatchObject({ ok: false })
    expect(await s.call('revise', { work, message: '비목표에 성능 개선을 넣으세요' })).toEqual({
      ok: true,
      result: { ok: true },
    })
    const resumed = await s.hh.ui.until(
      () => s.starts().find((r) => r['resume'] === true),
      '다시 연 세션',
    )
    const args = resumed['args'] as string[]
    expect(args).toEqual(expect.arrayContaining(['--resume', '--mcp-config']))
    expect(args.at(-1)).toBe('비목표에 성능 개선을 넣으세요')
    await waitFor(s.ok, work, 'awaiting_approval')
    // 일하는 중에는 받지 않는다
    expect(s.read(work).tasks).toHaveLength(1)
  })

  it('driver: human이면 사람이 만든 Work와 같고 호출자의 승인을 받지 않는다 (D519)', async () => {
    const s = await setup({ tasks: { 'work-start': [{ do: 'prompt' }, ...finish] } })
    const started = await s.ok('start_work', {
      project: s.projectId,
      type: 'bugfix',
      request: REQUEST,
      driver: 'human',
      questions: 'recommend',
    })
    expect(started.driver).toBe('human')
    expect(s.read(started.work).driver).toBeUndefined()
    expect(s.read(started.work).caller_questions).toBeUndefined()
    const waiting = await waitFor(s.ok, started.work, 'awaiting_approval')
    expect(waiting.hint).toMatch(/사람이 진행하는 Work/)
    expect(await s.call('approve', { work: started.work })).toEqual({
      ok: false,
      error: HUMAN_DRIVES,
    })
    expect(s.starts()[0]?.['args']).not.toContain('--mcp-config')
  })

  it('앱 안의 세션은 조회만 받고, 모르는 도구와 틀린 인자는 오류로 돌려준다 (D520)', async () => {
    const s = await setup({ tasks: {} })
    const r: McpResult = await s.call(
      'start_work',
      { project: s.projectId, type: 'bugfix', request: REQUEST },
      true,
    )
    expect(r).toEqual({ ok: false, error: IN_APP_REFUSED })
    expect(await s.call('list_projects', {}, true)).toMatchObject({ ok: true })
    expect(await s.call('nope')).toMatchObject({ ok: false })
    expect(await s.call('get_work', { work: 'x/y' })).toMatchObject({ ok: false })
    expect(await s.call('start_work', { project: s.projectId, type: 'bugfix' })).toEqual({
      ok: false,
      error: 'request가 필요합니다',
    })
    expect(s.hh.relay.snapshot().works).toEqual([])
  })

  it('wait는 바뀐 것이 없으면 제한 시간 뒤 timed_out이고, seen과 지금이 다르면 바로 돌려준다 (D525)', async () => {
    const s = await setup({ tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } })
    const { work } = await s.ok('start_work', {
      project: s.projectId,
      type: 'bugfix',
      request: REQUEST,
    })
    const working = await waitFor(s.ok, work, 'working')
    const started = Date.now()
    const idle = await s.ok<McpWork & { timed_out: boolean }>('wait', {
      work,
      seen: working.state_key,
      timeout_sec: 0.3,
    })
    expect(idle.timed_out).toBe(true)
    expect(Date.now() - started).toBeGreaterThanOrEqual(250)
    const now = await s.ok<McpWork & { timed_out: boolean }>('wait', { work, seen: 'old' })
    expect(now.timed_out).toBe(false)
  })
})
