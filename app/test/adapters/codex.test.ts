import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'
import {
  bridgeCommands,
  codexAuthStatus,
  codexBridgePath,
  codexJson,
  codexLaunchArgs,
  codexLaunchEnv,
  codexResumeArgs,
  codexSettings,
  deployCodexSkill,
  findCodex,
} from '../../src/adapters/codex'
import { HookServer } from '../../src/adapters/hooks'
import { run } from '../../src/adapters/exec'
import { writeJson } from '../../src/adapters/store'
import { FAKE_CODEX, SKILLS } from '../support/harness'
import { codexToolDenial } from '../../src/core/codex'

let server: HookServer | undefined
let child: ChildProcessWithoutNullStreams | undefined
let root: string | undefined
afterEach(async () => {
  child?.kill()
  child = undefined
  await server?.close()
  server = undefined
  if (root) fs.rmSync(root, { recursive: true, force: true })
  root = undefined
})
const temp = () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-codex-'))
  return root
}

function mcp(executable: string, env: NodeJS.ProcessEnv) {
  child = spawn(executable, [codexBridgePath(), 'mcp'], {
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'pipe',
  })
  const process = child
  let id = 0
  const replies = new Map<number, (value: Record<string, unknown>) => void>()
  readline.createInterface({ input: process.stdout }).on('line', (line) => {
    const message = JSON.parse(line) as { id: number; result: Record<string, unknown> }
    replies.get(message.id)?.(message.result)
    replies.delete(message.id)
  })
  return {
    send: (method: string, params: unknown) =>
      process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`),
    call: (method: string, params: unknown) => {
      const key = ++id
      const result = new Promise<Record<string, unknown>>((r) => replies.set(key, r))
      process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: key, method, params })}\n`)
      return { id: key, result }
    },
  }
}

describe('Codex CLI 점검과 스킬·설정', () => {
  it('로그인·기능을 확인하고 미설치 Windows npm/native 경로를 구분한다', async () => {
    expect(await codexAuthStatus(FAKE_CODEX, process.env)).toMatchObject({ ok: true })
    expect(
      await codexAuthStatus(FAKE_CODEX, { ...process.env, FAKE_CODEX_AUTH: 'fail' }),
    ).toMatchObject({ ok: false })
    expect(findCodex({ env: { CODEX_BIN: '/missing' }, exists: () => false })).toBeNull()
    const expected = 'C:\\Users\\me\\AppData\\Roaming\\npm\\codex.cmd'
    expect(
      findCodex({
        platform: 'win32',
        env: { APPDATA: 'C:\\Users\\me\\AppData\\Roaming', Path: 'C:\\bin' },
        exists: (s) => s === expected,
      }),
    ).toBe(expected)
  })
  it('task 밖의 레포나 사용자 설정을 바꾸지 않고 스킬과 질문 도구를 전달한다', async () => {
    const dir = temp()
    const deployed = await deployCodexSkill({
      source: SKILLS,
      workDir: dir,
      taskDir: path.join(dir, 'task'),
      skill: 'verify',
      type: 'bugfix',
    })
    const text = fs.readFileSync(deployed.file, 'utf8')
    expect(text).toContain('name: relay-verify')
    expect(text).toContain('`mcp__relay__ask_human`')
    expect(text).not.toContain('`AskUserQuestion`')
    const settings = codexSettings({
      workDir: dir,
      taskDir: path.join(dir, 'task'),
      taskId: 't-01',
      port: 12345,
      previousTaskDirs: [],
      skill: 'verify',
    })
    const file = path.join(dir, 'settings.json')
    await writeJson(file, settings)
    const args = await codexLaunchArgs({
      workDir: dir,
      settingsPath: file,
      sessionId: 'fake-id',
      skill: 'verify',
      contextPath: path.join(dir, 'task/context.md'),
    })
    expect(args).toContain('--no-daemon')
    expect(args).not.toContain('--dangerously-bypass-hook-trust')
    expect(args).not.toContain('--session-id')
    expect(args.at(-1)).toContain(JSON.stringify(deployed.file))
    expect(JSON.stringify(settings)).not.toContain('a-secret-token')
    expect(settings.overrides['hooks.PostCompact']).toBeUndefined()
    expect(settings.overrides['hooks.PostToolUseFailure']).toBeUndefined()
    expect(JSON.stringify(settings.overrides['hooks.SessionStart'])).toContain(
      'additionalContextLimit',
    )
    expect(codexLaunchEnv('a-secret-token', 12345, 't-01')).toMatchObject({
      RELAY_HOOK_TOKEN: 'a-secret-token',
    })
    // 모델·추론 수준을 주지 않으면 덮어쓰지 않는다 (F8)
    expect(settings.overrides).not.toHaveProperty('model')
    expect(settings.overrides).not.toHaveProperty('model_reasoning_effort')
    const chosen = codexSettings({
      workDir: dir,
      taskDir: path.join(dir, 'task'),
      taskId: 't-01',
      port: 12345,
      previousTaskDirs: [],
      skill: 'verify',
      model: 'gpt-6.1-sol',
      effort: 'ultra',
    })
    expect(chosen.overrides).toMatchObject({
      model: 'gpt-6.1-sol',
      model_reasoning_effort: 'ultra',
    })
    const chosenFile = path.join(dir, 'chosen.json')
    await writeJson(chosenFile, chosen)
    const resumed = await codexResumeArgs({
      workDir: dir,
      settingsPath: chosenFile,
      sessionId: 'x',
    })
    expect(resumed).toContain('model="gpt-6.1-sol"')
    expect(resumed).toContain('model_reasoning_effort="ultra"')
    // 모든 훅 설정을 합쳐도 npm .cmd의 제한에 여유를 남긴다.
    expect(args.join(' ').length).toBeLessThan(6500)
    const encoded = bridgeCommands().commandWindows.split(' ').at(-1) ?? ''
    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toContain('$env:RELAY_CODEX_HOOK_PS')
    expect(codexLaunchEnv('token', 12345, 't-01')).toMatchObject({
      RELAY_CODEX_EXE: process.execPath,
      RELAY_CODEX_BRIDGE: codexBridgePath(),
      RELAY_CODEX_HOOK_PS: expect.stringContaining('codex-hook.ps1'),
    })
  })
})

describe('실제 브리지와 MCP', () => {
  it('한글 경로 바이트가 청크 경계에서 나뉘어도 원래 입력과 보호 판정을 보존한다', async () => {
    const dir = path.join(temp(), '한글')
    server = new HookServer()
    await server.listen()
    let received: unknown
    server.register('token', 't-01', async (req) => {
      received = req.body
      const reason = codexToolDenial(
        { workDir: dir, worktree: dir, previousTaskDirs: [] },
        'exec_command',
        req.body['tool_input'] as Record<string, unknown>,
      )
      return reason
        ? {
            hookSpecificOutput: {
              hookEventName: 'PreToolUse',
              permissionDecision: 'deny',
              permissionDecisionReason: reason,
            },
          }
        : null
    })
    const body = {
      hook_event_name: 'PreToolUse',
      tool_name: 'exec_command',
      tool_input: { cmd: `printf changed > "${dir}/request.md"` },
    }
    const bytes = Buffer.from(JSON.stringify(body))
    const index = bytes.indexOf(Buffer.from('한'))
    for (const offset of [1, 2]) {
      child = spawn(process.execPath, [codexBridgePath(), 'hook'], {
        env: {
          ...process.env,
          ...codexLaunchEnv('token', server.port, 't-01'),
          ELECTRON_RUN_AS_NODE: '1',
        },
        stdio: 'pipe',
      })
      const output: Buffer[] = []
      child.stdout.on('data', (chunk: Buffer) => output.push(chunk))
      const closed = once(child, 'close')
      child.stdin.write(bytes.subarray(0, index + offset))
      await new Promise((resolve) => setTimeout(resolve, 500))
      child.stdin.end(bytes.subarray(index + offset))
      expect((await closed)[0]).toBe(0)
      expect(received).toEqual(body)
      expect(JSON.parse(Buffer.concat(output).toString('utf8'))).toMatchObject({
        hookSpecificOutput: { permissionDecision: 'deny' },
      })
      child = undefined
    }
  })
  it('훅 응답을 보존하고 잘못된 토큰이나 끊긴 서버는 보호 도구 거절로 돌려준다', async () => {
    server = new HookServer()
    await server.listen()
    const reply = { decision: 'block', reason: '형식 오류를 고치세요.' }
    server.register('token', 't-01', async () => reply)
    const env = { ...process.env, ...codexLaunchEnv('token', server.port, 't-01') }
    const result = await run(process.execPath, [codexBridgePath(), 'hook'], {
      env,
      input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'real-id' }),
    })
    expect(JSON.parse(result.stdout)).toEqual(reply)
    const denied = await run(process.execPath, [codexBridgePath(), 'hook'], {
      env: { ...env, RELAY_HOOK_TOKEN: 'wrong' },
      input: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(JSON.parse(denied.stdout)).toMatchObject({
      hookSpecificOutput: { permissionDecision: 'deny' },
    })
    await server.close()
    const closed = await run(process.execPath, [codexBridgePath(), 'hook'], {
      env,
      input: JSON.stringify({ hook_event_name: 'PreToolUse' }),
    })
    expect(JSON.parse(closed.stdout)).toMatchObject({
      hookSpecificOutput: { permissionDecision: 'deny' },
    })
  })
  it('MCP 취소 알림이 대기 중인 HTTP 질문을 취소하며 답을 만들어 내지 않는다', async () => {
    server = new HookServer()
    await server.listen()
    let received!: () => void
    const arrived = new Promise<void>((r) => {
      received = r
    })
    let aborted = false
    server.register('token', 't-01', async () => null, {
      question: async (_body, signal) => {
        received()
        return await new Promise((resolve) =>
          signal.addEventListener(
            'abort',
            () => {
              aborted = true
              resolve({ cancelled: true })
            },
            { once: true },
          ),
        )
      },
    })
    const client = mcp(process.execPath, {
      ...process.env,
      ...codexLaunchEnv('token', server.port, 't-01'),
    })
    const init = await client.call('initialize', { protocolVersion: '2024-11-05' }).result
    expect(init['protocolVersion']).toBe('2024-11-05')
    const call = client.call('tools/call', { name: 'ask_human', arguments: { questions: [] } })
    await arrived
    client.send('notifications/cancelled', { requestId: call.id })
    expect(await call.result).toMatchObject({ isError: true })
    await server.close()
    expect(aborted).toBe(true)
  })
  const electron = path.resolve(
    __dirname,
    '../../node_modules/electron/dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  )
  it.skipIf(process.platform !== 'win32' && !fs.existsSync(electron))(
    'Electron Node 모드의 MCP와 command 훅이 완료까지 기다리고 한글 응답을 보존한다',
    async () => {
      server = new HookServer()
      await server.listen()
      const reply = { decision: 'block', reason: '한글 훅 응답' }
      server.register('token', 't-01', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        return reply
      })
      const env = {
        ...process.env,
        ...codexLaunchEnv('token', server.port, 't-01'),
        RELAY_CODEX_EXE: electron,
      }
      const commands = bridgeCommands()
      const result = await run(
        process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
        process.platform === 'win32'
          ? ['/d', '/s', '/c', commands.commandWindows]
          : ['-c', commands.command],
        { env, input: JSON.stringify({ hook_event_name: 'Stop', session_id: 'real-id' }) },
      )
      expect(result.code, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(reply)
      const client = mcp(electron, process.env)
      expect(
        await client.call('initialize', { protocolVersion: '2024-11-05' }).result,
      ).toMatchObject({ serverInfo: { name: 'relay' } })
    },
  )
})

describe('[어댑터] codex exec로 부르는 지식 검토 (D334)', () => {
  it('구조화된 출력 파일을 읽고 사용량을 돌려준다. 모델을 비우면 -m을 넘기지 않는다', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-codex-json-'))
    const scenario = path.join(root, 'scenario.json')
    fs.writeFileSync(
      scenario,
      JSON.stringify({
        review: [{ issues: [{ file: 'a.md', kind: 'conflict', quote: 'q', human: '', fix: 'f' }] }],
      }),
    )
    const env = { ...process.env, FAKE_CODEX_SCENARIO: scenario }
    const schema = {
      type: 'object',
      properties: { issues: { type: 'array' } },
      required: ['issues'],
    }
    const r = await codexJson({
      bin: FAKE_CODEX,
      env,
      cwd: root,
      model: '',
      system: '시스템',
      prompt: '프롬프트',
      schema,
      timeoutMs: 20_000,
    })
    expect(r.error).toBeNull()
    expect(r.data).toEqual({
      issues: [{ file: 'a.md', kind: 'conflict', quote: 'q', human: '', fix: 'f' }],
    })
    expect(r.usage).toEqual({ input: 900, output: 40, cacheRead: 100, cacheCreation: 0 })
    expect(r.costUsd).toBeNull()
    expect(fs.readFileSync(`${scenario}.review-1.txt`, 'utf8')).toContain('시스템')
    const args = JSON.parse(fs.readFileSync(`${scenario}.review-args.json`, 'utf8')) as string[]
    expect(args.slice(0, 2)).toEqual(['exec', '--ephemeral'])
    expect(args).toContain('read-only')
    expect(args).not.toContain('-m')
    const withModel = await codexJson({
      bin: FAKE_CODEX,
      env,
      cwd: root,
      model: 'gpt-5-codex',
      system: '',
      prompt: '',
      schema,
      timeoutMs: 20_000,
    })
    expect(withModel.error).toBeNull()
    const again = JSON.parse(fs.readFileSync(`${scenario}.review-args.json`, 'utf8')) as string[]
    expect(again[again.indexOf('-m') + 1]).toBe('gpt-5-codex')
    const failed = await codexJson({
      bin: FAKE_CODEX,
      env: { ...env, FAKE_CODEX_REVIEW_FAIL: '1' },
      cwd: root,
      model: '',
      system: '',
      prompt: '',
      schema,
      timeoutMs: 20_000,
    })
    expect(failed.data).toBeNull()
    expect(failed.error).toContain('가짜 실패')
  })
})
