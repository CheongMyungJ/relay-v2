import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from '../support/harness'
import { handoff, intentDraft, REPO_FILES, REQUEST, scenario } from '../support/scenarios'
import { continuePrompt } from '../../src/core/settings'
import type { AppConfig } from '../../src/shared/config'
import type { WorkState } from '../../src/shared/work'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
const finish = [
  { do: 'write', file: 'intent.draft.md', text: intentDraft() },
  { do: 'write', file: 'handoff.md', text: handoff() },
  { do: 'stop' },
  { do: 'wait' },
]
async function setup(scenario: object, config: Partial<AppConfig> = { agent_engine: 'codex' }) {
  const hh = await harness({ scenario, config })
  h = hh
  const { repo } = makeRepo(hh.root, 'codex-repo', REPO_FILES)
  const projectId = await register(hh, repo)
  const created = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
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
  it('단계에서 고른 Codex 모델·추론 수준을 -c로 넘기고 설정을 바꾼 뒤 재개에도 그대로 준다 (F7, F10)', async () => {
    const s = await setup(
      {
        tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] },
        resume: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] },
      },
      {
        agent_engine: 'claude',
        agent_model: 'opus',
        agent_steps: {
          'work-start': { engine: 'codex', model: 'gpt-6.1-sol', effort: 'ultra' },
        },
      },
    )
    const starts = () => s.hh.codexRecords().filter((r) => r['type'] === 'start')
    await s.hh.ui.until(() => starts().length >= 1, 'Codex 시작')
    await s.hh.ui.until(() => s.read().tasks[0]?.session?.id, 'Codex 대화 ID')
    expect(s.read().tasks[0]).toMatchObject({
      engine: 'codex',
      model: 'gpt-6.1-sol',
      effort: 'ultra',
    })
    const first = starts()[0]?.['args'] as string[]
    expect(first).toContain('model="gpt-6.1-sol"')
    expect(first).toContain('model_reasoning_effort="ultra"')
    expect(
      await s.hh.relay.updateConfig({ agent_steps: { 'work-start': { engine: 'claude' } } }),
    ).toMatchObject({ ok: true })
    expect(await s.hh.relay.interrupt(s.key, 't-01')).toEqual({ ok: true })
    expect(await s.hh.relay.resume(s.key, 't-01')).toEqual({ ok: true })
    await s.hh.ui.until(() => starts().length >= 2, 'Codex 재개')
    const resumed = starts().at(-1)?.['args'] as string[]
    expect(resumed).toContain('resume')
    expect(resumed).toContain('model="gpt-6.1-sol"')
    expect(resumed).toContain('model_reasoning_effort="ultra"')
    expect(s.hh.records().filter((r) => r['type'] === 'start')).toHaveLength(0)
  })

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
    expect(await s.hh.relay.approve(s.key, 't-01', {})).toEqual({ ok: true })
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
    const resumed = s.hh
      .codexRecords()
      .filter((r) => r['type'] === 'start')
      .at(-1)
    expect((resumed?.['args'] as string[]).at(-1)).toBe(continuePrompt(false))
    expect(
      s.hh
        .codexRecords()
        .find((r) => r['pid'] === resumed?.['pid'] && r['event'] === 'UserPromptSubmit')?.['body'],
    ).toMatchObject({ prompt: continuePrompt(false) })
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

  it('Codex 전체 경로와 정리 질문을 실행하며 설정 변경 뒤에도 정리 엔진을 유지한다', async () => {
    const s = await setup({
      ...scenario(),
      cleanup: [
        { do: 'prompt' },
        {
          do: 'ask',
          afterEnter: [
            {
              do: 'hook',
              event: 'PreToolUse',
              body: { tool_name: 'exec_command', tool_input: { cmd: 'git status --short' } },
            },
            {
              do: 'hook',
              event: 'PostToolUse',
              body: { tool_name: 'exec_command', tool_response: { exit_code: 0 } },
            },
            {
              do: 'hook',
              event: 'PreToolUse',
              body: { tool_name: 'exec_command', tool_input: { cmd: 'git push' } },
            },
            {
              do: 'hook',
              event: 'PreToolUse',
              body: {
                agent_id: 'child',
                tool_name: 'apply_patch',
                tool_input: { input: '*** Update File: {protectedFile}' },
              },
            },
            {
              do: 'hook',
              event: 'PreToolUse',
              body: {
                tool_name: 'apply_patch',
                tool_input: { input: '*** Update File: README.md' },
              },
            },
          ],
        },
        { do: 'wait' },
      ],
    })
    await s.hh.relay.updateConfig({
      auto_approve: { ...s.hh.relay.currentConfig().auto_approve, fix: true },
    })
    for (const [index, node] of ['intake', 'fix', 'verify'].entries()) {
      const id = `t-0${index + 1}`
      await s.hh.ui.until(
        () => s.view()?.tasks.find((t) => t.id === id)?.status === 'awaiting_approval',
        `${node} 승인 대기`,
      )
      const task = s.read().tasks[index]
      expect(task).toMatchObject({ node, engine: 'codex', session: { alive: true } })
      expect(task?.countdown).toBeUndefined()
      if (node === 'fix') {
        expect(task?.auto_hold).toBeUndefined()
        expect((await s.hh.relay.review(s.key, id))?.autoApprove).toMatchObject({ on: false })
      }
      if (node !== 'verify') expect(await s.hh.relay.approve(s.key, id, {})).toEqual({ ok: true })
    }
    const runner = s.hh.relay.work(s.key)
    if (!runner) throw new Error('runner 없음')
    fs.writeFileSync(path.join(runner.worktree, 'debug.log'), '정리할 파일')
    await s.hh.relay.updateConfig({ agent_engine: 'claude' })
    const scenarioFile = s.hh.env['FAKE_CODEX_SCENARIO']
    if (!scenarioFile) throw new Error('시나리오 없음')
    fs.writeFileSync(
      scenarioFile,
      fs
        .readFileSync(scenarioFile, 'utf8')
        .replace('{protectedFile}', () =>
          JSON.stringify(path.join(runner.files.dir, 'request.md')).slice(1, -1),
        ),
    )
    expect(await s.hh.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    const cleanupQuestion = await s.hh.ui.until(
      () => s.view()?.cleanup?.question,
      'Codex 정리 질문',
    )
    expect(s.view()?.cleanup?.engineLabel).toBe('Codex')
    const terminal = s.view()?.cleanup?.terminal
    if (!terminal) throw new Error('정리 터미널 없음')
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const busy = runner.enqueue(() => gate)
    const countBefore = s.hh.codexRecords().filter((r) => r['event'] === 'PreToolUse').length
    try {
      s.hh.relay.terminalWrite(terminal, '\r')
      await s.hh.ui.until(
        () =>
          s.hh.codexRecords().filter((r) => r['event'] === 'PreToolUse').length === countBefore + 4,
        '처리 큐가 막혀 있어도 정리 도구 훅 네 개에 응답',
        10_000,
      )
      const replies = s.hh
        .codexRecords()
        .filter((r) => r['event'] === 'PreToolUse')
        .slice(-4)
        .map((r) => r['response'])
      expect(replies).toMatchObject([
        null,
        { hookSpecificOutput: { permissionDecision: 'deny' } },
        { hookSpecificOutput: { permissionDecision: 'deny' } },
        null,
      ])
      expect(
        s.hh.codexRecords().findLast((r) => r['event'] === 'PostToolUse')?.['response'],
      ).toBeNull()
    } finally {
      release()
      await busy
    }
    expect(await s.hh.relay.answerQuestion(s.key, 'cleanup', cleanupQuestion.id, null)).toEqual({
      ok: true,
    })
    expect(await s.hh.relay.closeCleanup(s.key)).toEqual({ ok: true })
    expect(s.view()?.cleanup).toBeNull()
    expect(await s.hh.relay.approve(s.key, 't-03', {})).toEqual({ ok: true })
    expect(s.read().status).toBe('completed')
    expect(s.read().tasks).toHaveLength(3)
    expect(s.hh.records().filter((r) => r['type'] === 'start')).toHaveLength(0)
  })

  it('정리 질문은 같은 대화 압축에 유지하고 새 요청·대화 전환에 취소한다', async () => {
    const s = await setup({
      ...scenario(),
      cleanup: [
        { do: 'prompt' },
        {
          do: 'ask',
          afterEnter: [
            {
              do: 'hook',
              event: 'SessionStart',
              body: { session_id: 'child-session', agent_id: 'child', source: 'startup' },
            },
            { do: 'hook', event: 'SessionStart', body: { source: 'compact' } },
          ],
        },
        { do: 'ask', afterEnter: [{ do: 'prompt' }] },
        {
          do: 'ask',
          afterEnter: [
            {
              do: 'hook',
              event: 'SessionStart',
              body: { session_id: 'new-cleanup-session', source: 'startup' },
            },
          ],
        },
        { do: 'ask' },
        { do: 'wait' },
      ],
    })
    for (const index of [0, 1, 2]) {
      const id = `t-0${index + 1}`
      await s.hh.ui.until(
        () => s.view()?.tasks[index]?.status === 'awaiting_approval',
        `${id} 승인 대기`,
      )
      if (index < 2) expect(await s.hh.relay.approve(s.key, id, {})).toEqual({ ok: true })
    }
    const runner = s.hh.relay.work(s.key)
    if (!runner) throw new Error('runner 없음')
    fs.writeFileSync(path.join(runner.worktree, 'debug.log'), '정리할 파일')
    expect(await s.hh.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    const question = () => s.view()?.cleanup?.question
    const first = await s.hh.ui.until(question, '압축 전 정리 질문')
    const terminal = s.view()?.cleanup?.terminal
    const pid = s.hh
      .codexRecords()
      .filter((r) => r['type'] === 'start')
      .at(-1)?.['pid']
    if (!terminal || !pid) throw new Error('정리 세션 없음')
    const answers = () =>
      s.hh.codexRecords().filter((r) => r['type'] === 'answer' && r['pid'] === pid)
    s.hh.relay.terminalWrite(terminal, '\r')
    await s.hh.ui.until(
      () =>
        s.hh
          .codexRecords()
          .some(
            (r) =>
              r['pid'] === pid &&
              r['event'] === 'SessionStart' &&
              (r['body'] as { source?: string }).source === 'compact',
          ),
      '같은 대화 압축 훅',
    )
    expect(question()?.id).toBe(first.id)
    expect(answers()).toHaveLength(0)
    expect(
      await s.hh.relay.answerQuestion(s.key, 'cleanup', first.id, { scope: ['첫 답'] }),
    ).toEqual({
      ok: true,
    })
    const second = await s.hh.ui.until(
      () => (question()?.id !== first.id ? question() : undefined),
      '새 요청 전 정리 질문',
    )
    s.hh.relay.terminalWrite(terminal, '\r')
    const third = await s.hh.ui.until(
      () => (question()?.id !== second.id ? question() : undefined),
      '새 요청 후 정리 질문',
    )
    expect(
      (await s.hh.relay.answerQuestion(s.key, 'cleanup', second.id, { scope: ['오래된 답'] })).ok,
    ).toBe(false)
    expect(question()?.id).toBe(third.id)
    s.hh.relay.terminalWrite(terminal, '\r')
    const fourth = await s.hh.ui.until(
      () => (question()?.id !== third.id ? question() : undefined),
      '대화 전환 후 정리 질문',
    )
    expect((await s.hh.relay.answerQuestion(s.key, 'cleanup', third.id, null)).ok).toBe(false)
    expect(question()?.id).toBe(fourth.id)
    expect(
      await s.hh.relay.answerQuestion(s.key, 'cleanup', fourth.id, { scope: ['새 답'] }),
    ).toEqual({
      ok: true,
    })
    await s.hh.ui.until(() => answers().length === 4, '정리 MCP 응답 네 개')
    const replies = answers().map((r) => {
      const result = r['result'] as { isError: boolean; content: { text: string }[] }
      return { isError: result.isError, ...JSON.parse(result.content[0]?.text ?? '') }
    })
    expect(replies).toMatchObject([
      { cancelled: false, isError: false, answers: { scope: ['첫 답'] } },
      { cancelled: true, isError: true },
      { cancelled: true, isError: true },
      { cancelled: false, isError: false, answers: { scope: ['새 답'] } },
    ])
    expect(await s.hh.relay.closeCleanup(s.key)).toEqual({ ok: true })
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

  it('Codex 실패 도구도 진행을 끝내고 자식 도구 보호는 바깥 진행 표시를 유지한다', async () => {
    const s = await setup({
      tasks: {
        'work-start': [
          { do: 'prompt' },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: {
              tool_name: 'exec_command',
              tool_use_id: 'outer',
              tool_input: { cmd: 'npm test' },
            },
          },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: {
              agent_id: 'child',
              tool_name: 'exec_command',
              tool_use_id: 'child',
              tool_input: { cmd: 'printf changed > request.md', workdir: '{taskDir}/../..' },
            },
          },
          {
            do: 'hook',
            event: 'PostToolUse',
            body: {
              tool_name: 'exec_command',
              tool_use_id: 'outer',
              tool_response: { exit_code: 1, output: 'test failed' },
            },
          },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: {
              tool_name: 'exec_command',
              tool_use_id: 'denied',
              tool_input: { cmd: 'rm request.md', workdir: '{taskDir}/../..' },
            },
          },
          { do: 'wait' },
        ],
      },
    })
    await s.hh.ui.until(
      () =>
        s.hh
          .codexRecords()
          .some(
            (r) => (r['body'] as { tool_use_id?: string } | undefined)?.tool_use_id === 'denied',
          ),
      'Codex 실패 훅',
    )
    const child = s.hh
      .codexRecords()
      .find(
        (r) =>
          r['event'] === 'PreToolUse' && (r['body'] as { agent_id?: string }).agent_id === 'child',
      )
    expect(child?.['response']).toMatchObject({
      hookSpecificOutput: { permissionDecision: 'deny' },
    })
    expect(
      s.hh.ui.activityLog
        .filter((u) => u.workKey === s.key)
        .map((u) => [u.activity?.tool?.label, u.activity?.tool?.endedAt === null]),
    ).toEqual([
      ['exec_command(npm test)', true],
      ['exec_command(npm test)', false],
      ['exec_command(rm request.md)', false],
    ])
    expect(s.hh.ui.activityOf(s.key, 't-01')?.tool?.endedAt).toBeTypeOf('number')
    expect(s.read().tasks[0]?.status).toBe('working')
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

it('압축 뒤 SessionStart(compact)에서 현재 스킬을 재주입한다', async () => {
  const s = await setup({
    tasks: {
      'work-start': [
        { do: 'prompt' },
        { do: 'hook', event: 'SessionStart', body: { source: 'compact' } },
        { do: 'ask' },
        { do: 'wait' },
      ],
    },
  })
  await s.hh.ui.until(s.question, '압축 뒤 질문')
  const compact = s.hh
    .codexRecords()
    .find(
      (r) =>
        r['type'] === 'hook' &&
        r['event'] === 'SessionStart' &&
        (r['body'] as { source?: string }).source === 'compact',
    )
  expect(compact?.['response']).toMatchObject({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: expect.stringContaining('이번 relay task의 스킬'),
    },
  })
  expect(s.read().tasks[0]?.session?.id).toBeTruthy()
  expect(s.task()?.status).toBe('asking')
})
