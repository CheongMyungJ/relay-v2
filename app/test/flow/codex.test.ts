import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from './harness'
import { handoff, intentDraft, REPO_FILES, REQUEST, scenario } from './scenarios'
import type { WorkState } from '../../src/shared/work'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
const finish = [
  { do: 'write', file: 'intent.draft.md', text: intentDraft('S') },
  { do: 'write', file: 'handoff.md', text: handoff() },
  { do: 'stop' },
  { do: 'wait' },
]
async function setup(scenario: object) {
  const hh = await harness({ scenario, config: { agent_engine: 'codex' } })
  h = hh
  const { repo } = makeRepo(hh.root, 'codex-repo', REPO_FILES)
  const projectId = await register(hh, repo)
  const created = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!created.ok) throw new Error(created.error)
  const key = created.workKey
  const view = () => hh.ui.works.get(key)
  const task = () => view()?.tasks[0]
  const read = () =>
    JSON.parse(
      fs.readFileSync(
        path.join(hh.home, 'projects', projectId, 'works', key.split('/')[1] ?? '', 'work.json'),
        'utf8',
      ),
    ) as WorkState
  const question = () => task()?.question
  return { hh, key, view, task, read, question }
}

describe('[흐름] Codex CLI와 실제 훅·MCP 브리지', () => {
  it('네 질문의 실제 답까지 기다리고 다른 기본 엔진의 다음 task로 넘긴다', async () => {
    const qs = Array.from({ length: 4 }, (_, i) => ({
      id: `q${i}`,
      header: `질문 ${i}`,
      question: '선택 또는 직접 입력해주세요.',
    }))
    const s = await setup({
      tasks: {
        'work-start': [{ do: 'prompt' }, { do: 'ask', questions: qs }, ...finish],
        'code-fix': [{ do: 'prompt' }, { do: 'wait' }],
      },
    })
    const question = await s.hh.ui.until(s.question, 'Codex 질문창')
    expect(s.task()?.status).toBe('asking')
    const record = s.read().tasks[0]
    expect(record).toMatchObject({
      engine: 'codex',
      engine_version: 'codex-cli 0.159.0 (가짜 Codex)',
      session: { alive: true },
    })
    expect(record?.session?.id).toMatch(/^[a-f0-9-]{36}$/)
    expect(record?.claude_version).toBeUndefined()
    expect(s.hh.codexRecords().filter((r) => r['type'] === 'answer')).toHaveLength(0)
    expect((await s.hh.relay.answerQuestion(s.key, 't-01', 'old-question', {})).ok).toBe(false)
    expect((await s.hh.relay.answerQuestion(s.key, 't-01', question.id, {})).ok).toBe(false)
    expect(s.question()?.id).toBe(question.id)
    expect(await s.hh.relay.updateConfig({ agent_engine: 'claude' })).toMatchObject({ ok: true })
    const answers = { q0: ['사람 답'], q1: ['알아서 해'], q2: ['모름'], q3: ['추가 의견'] }
    expect(await s.hh.relay.answerQuestion(s.key, 't-01', question.id, answers)).toEqual({
      ok: true,
    })
    await s.hh.ui.until(() => s.task()?.status === 'awaiting_approval', 'Codex handoff 승인 대기')
    expect(s.question()).toBeUndefined()
    const reply = s.hh.codexRecords().find((r) => r['type'] === 'answer')?.['result'] as {
      content: { text: string }[]
      isError: boolean
    }
    expect(JSON.parse(reply.content[0]?.text ?? '')).toEqual({ cancelled: false, answers })
    expect(reply.isError).toBe(false)
    expect(await s.hh.relay.approve(s.key, 't-01', { size: 'S' })).toEqual({ ok: true })
    await s.hh.ui.until(() => s.hh.records().some((r) => r['type'] === 'start'), '다음 Claude task')
    expect(s.read().tasks.map((t) => t.engine)).toEqual(['codex', 'claude'])
  })

  it('질문 취소를 기본 선택/동의로 돌려주지 않고 작업 상태로 돌아간다', async () => {
    const s = await setup({
      tasks: { 'work-start': [{ do: 'prompt' }, { do: 'ask' }, { do: 'wait' }] },
    })
    const q = await s.hh.ui.until(s.question, '취소할 질문')
    expect(await s.hh.relay.answerQuestion(s.key, 't-01', q.id, null)).toEqual({ ok: true })
    const answer = await s.hh.ui.until(
      () => s.hh.codexRecords().find((r) => r['type'] === 'answer'),
      'MCP 취소 응답',
    )
    const result = answer['result'] as { isError: boolean; content: { text: string }[] }
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0]?.text ?? '')).toMatchObject({ cancelled: true })
    expect(s.task()?.status).toBe('working')
    expect(s.question()).toBeUndefined()
    expect((await s.hh.relay.answerQuestion(s.key, 't-01', q.id, { scope: ['전체'] })).ok).toBe(
      false,
    )
  })

  it('답변 대기 중 중단과 재시작·재개가 교착되지 않고 원래 Codex ID를 유지한다', async () => {
    const s = await setup({
      tasks: { 'work-start': [{ do: 'prompt' }, { do: 'ask' }, { do: 'wait' }] },
      resume: { 'work-start': [{ do: 'prompt' }, { do: 'ask' }, { do: 'wait' }] },
    })
    const first = await s.hh.ui.until(s.question, '첫 질문')
    const id = s.read().tasks[0]?.session?.id
    expect(await s.hh.relay.interrupt(s.key, 't-01')).toEqual({ ok: true })
    expect(s.question()).toBeUndefined()
    await s.hh.relay.updateConfig({ agent_engine: 'claude' })
    await s.hh.relay.close()
    await s.hh.relay.settled()
    await s.hh.reopen()
    expect(await s.hh.relay.resume(s.key, 't-01')).toEqual({ ok: true })
    const next = await s.hh.ui.until(
      () => s.hh.ui.works.get(s.key)?.tasks[0]?.question,
      '재개 후 새 질문',
    )
    expect(next.id).not.toBe(first.id)
    expect(s.read().tasks[0]).toMatchObject({ engine: 'codex', session: { id, alive: true } })
    expect((await s.hh.relay.answerQuestion(s.key, 't-01', first.id, { scope: ['전체'] })).ok).toBe(
      false,
    )
    expect(s.hh.records().filter((r) => r['type'] === 'start')).toHaveLength(0)
  })

  it('CLI 내부 대화 전환은 PTY를 끝내지 않고 새 실제 ID로 재개한다', async () => {
    const s = await setup({
      tasks: {
        'work-start': [{ do: 'prompt' }, { do: 'clear' }, { do: 'prompt' }, { do: 'wait' }],
      },
    })
    await s.hh.ui.until(
      () =>
        s.hh.codexRecords().filter((r) => r['type'] === 'hook' && r['event'] === 'SessionStart')
          .length >= 2,
      'Codex 대화 전환',
    )
    const ids = s.hh
      .codexRecords()
      .filter((r) => r['type'] === 'hook' && r['event'] === 'SessionStart')
      .map((r) => (r['body'] as { session_id: string }).session_id)
    expect(ids[0]).not.toBe(ids[1])
    expect(s.read().tasks[0]?.session).toMatchObject({ id: ids[1], alive: true })
    expect(await s.hh.relay.interrupt(s.key, 't-01')).toEqual({ ok: true })
    expect(await s.hh.relay.resume(s.key, 't-01')).toEqual({ ok: true })
    await s.hh.ui.until(
      () => s.hh.codexRecords().filter((r) => r['type'] === 'start').length === 2,
      '새 ID로 재개',
    )
    expect(
      s.hh
        .codexRecords()
        .filter((r) => r['type'] === 'start')
        .at(-1)?.['sessionId'],
    ).toBe(ids[1])
  })

  it('Codex 전체 S 경로와 정리 질문을 실행하며 설정 변경 뒤에도 정리 엔진을 유지한다', async () => {
    const s = await setup({
      ...scenario('S'),
      cleanup: [{ do: 'prompt' }, { do: 'ask' }, { do: 'wait' }],
    })
    await s.hh.relay.updateConfig({
      auto_approve: { ...s.hh.relay.currentConfig().auto_approve, fix: true },
    })
    for (const [index, node] of ['intake', 'fix', 'review', 'verify'].entries()) {
      const id = `t-0${index + 1}`
      await s.hh.ui.until(
        () => s.view()?.tasks.find((t) => t.id === id)?.status === 'awaiting_approval',
        `${node} 승인 대기`,
      )
      const task = s.read().tasks[index]
      expect(task).toMatchObject({ node, engine: 'codex', session: { alive: true } })
      expect(task?.countdown).toBeUndefined()
      if (node === 'fix') expect(task?.auto_hold?.reasons).toContain('completion_unknown')
      if (node !== 'verify')
        expect(await s.hh.relay.approve(s.key, id, node === 'intake' ? { size: 'S' } : {})).toEqual(
          { ok: true },
        )
    }
    const runner = s.hh.relay.work(s.key)
    if (!runner) throw new Error('runner 없음')
    fs.writeFileSync(path.join(runner.worktree, 'debug.log'), '정리할 파일')
    await s.hh.relay.updateConfig({ agent_engine: 'claude' })
    expect(await s.hh.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    const cleanupQuestion = await s.hh.ui.until(
      () => s.view()?.cleanup?.question,
      'Codex 정리 질문',
    )
    expect(s.view()?.cleanup?.engineLabel).toBe('Codex')
    expect(await s.hh.relay.answerQuestion(s.key, 'cleanup', cleanupQuestion.id, null)).toEqual({
      ok: true,
    })
    expect(await s.hh.relay.closeCleanup(s.key)).toEqual({ ok: true })
    expect(s.view()?.cleanup).toBeNull()
    expect(await s.hh.relay.approve(s.key, 't-04', {})).toEqual({ ok: true })
    expect(s.read().status).toBe('completed')
    expect(s.read().tasks).toHaveLength(4)
    expect(s.hh.records().filter((r) => r['type'] === 'start')).toHaveLength(0)
  })

  it('형식 오류 되돌림을 브리지 응답으로 보낸 뒤 정상 handoff로 승인 대기가 된다', async () => {
    const s = await setup({
      tasks: {
        'work-start': [
          { do: 'prompt' },
          { do: 'write', file: 'handoff.md', text: '잘못된 형식' },
          { do: 'stop', onBlock: finish.slice(0, 2) },
          { do: 'wait' },
        ],
      },
    })
    await s.hh.ui.until(() => s.task()?.status === 'awaiting_approval', 'Codex 형식 수정')
    const stops = s.hh.codexRecords().filter((r) => r['type'] === 'hook' && r['event'] === 'Stop')
    await s.hh.ui.until(
      () =>
        s.hh.codexRecords().filter((r) => r['type'] === 'hook' && r['event'] === 'Stop').length >=
        2,
      '되돌림 뒤 Stop 응답',
    )
    expect(stops[0]?.['response']).toMatchObject({ decision: 'block' })
    expect(s.read().tasks[0]?.bounce_count).toBe(0)
  })

  it('실제 command 훅이 push와 앱 소유 파일 패치를 거절하고 현재 산출물은 허용한다', async () => {
    const s = await setup({
      tasks: {
        'work-start': [
          { do: 'prompt' },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: {
              agent_id: 'child',
              tool_name: 'exec_command',
              tool_input: { cmd: 'git push origin main' },
            },
          },
          {
            do: 'hook',
            event: 'Stop',
            body: { agent_id: 'child' },
          },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: {
              tool_name: 'apply_patch',
              tool_input: { command: '*** Update File: {taskDir}/../../work.json' },
            },
          },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: {
              tool_name: 'apply_patch',
              tool_input: { command: '*** Add File: {taskDir}/handoff.md' },
            },
          },
          { do: 'wait' },
        ],
      },
    })
    await s.hh.ui.until(
      () =>
        s.hh.codexRecords().filter((r) => r['type'] === 'hook' && r['event'] === 'PreToolUse')
          .length === 3,
      '도구 보호 응답',
    )
    const responses = s.hh
      .codexRecords()
      .filter((r) => r['type'] === 'hook' && r['event'] === 'PreToolUse')
      .map((r) => r['response'])
    expect(responses[0]).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } })
    expect(responses[1]).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } })
    expect(responses[2]).toBeNull()
    expect(s.hh.codexRecords().find((r) => r['event'] === 'Stop')?.['response']).toBeNull()
    expect(s.task()?.status).toBe('working')
  })
})
