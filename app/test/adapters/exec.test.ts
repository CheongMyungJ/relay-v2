// 명령 실행의 시간 초과 (adapters/exec). Windows에서 .cmd로 감싼 명령은 시간 초과 때 트리째 끝낸다 (D333).
// 출력을 흘려받는 실행(독립 리뷰의 진행 표시, D502)은 모아 두지 않고 끝만 남긴다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ABORTED, run, STREAM_TAIL } from '../../src/adapters/exec'

const TREE = path.resolve(__dirname, '../support/fixtures/tree.mjs')

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('[어댑터] 명령 실행의 시간 초과', () => {
  it.skipIf(process.platform !== 'win32')(
    '.cmd로 감싼 명령이 시간을 넘기면 cmd.exe 아래의 프로세스까지 끝낸다',
    async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-exec-'))
      const cmd = path.join(dir, 'tree.cmd')
      fs.writeFileSync(cmd, `@"${process.execPath}" "${TREE}"\r\n`)
      try {
        const r = await run(cmd, [], { timeoutMs: 3000 })
        expect(r.error).toContain('시간 초과')
        const m = /TREE READY (\d+) (\d+)/.exec(r.stdout)
        expect(m, r.stdout).not.toBeNull()
        const pids = [Number(m?.[1]), Number(m?.[2])]
        // taskkill이 끝나기를 잠시 기다린다
        for (let i = 0; i < 50 && pids.some(alive); i++)
          await new Promise((x) => setTimeout(x, 100))
        expect(pids.filter(alive)).toEqual([])
      } finally {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    },
  )

  it('시간을 넘기면 시간 초과로 돌려준다', async () => {
    const r = await run(process.execPath, ['-e', 'setInterval(() => {}, 1 << 30)'], {
      timeoutMs: 500,
    })
    expect(r.code).toBeNull()
    expect(r.error).toContain('시간 초과')
  })
})

describe('[어댑터] 출력을 흘려받는 실행 (D502)', () => {
  it('끝나기 전에 조각을 넘기고, 표준 입력을 주며, 결과에는 출력의 끝만 남긴다', async () => {
    const chunks: string[] = []
    let beforeExit = false
    // 첫 줄을 쓰고 잠깐 기다린 뒤 큰 출력(STREAM_TAIL의 세 배)을 쓰고 표준 입력을 되돌려 준다
    const script = [
      "process.stdout.write('first\\n')",
      'setTimeout(() => {',
      `  process.stdout.write('ㄱ'.repeat(${STREAM_TAIL * 3}))`,
      "  let input = ''",
      "  process.stdin.on('data', (c) => (input += c))",
      "  process.stdin.on('end', () => { process.stdout.write('\\nend:' + input); process.exitCode = 3 })",
      '}, 300)',
    ].join('\n')
    const r = await run(process.execPath, ['-e', script], {
      timeoutMs: 20_000,
      input: '입력',
      onStdout: (c) => {
        if (!chunks.length && c.startsWith('first')) beforeExit = true
        chunks.push(c)
      },
    })
    expect(beforeExit).toBe(true)
    expect(r.code).toBe(3)
    const all = chunks.join('')
    expect(all.startsWith('first\n')).toBe(true)
    expect(all.endsWith('\nend:입력')).toBe(true)
    expect(all.length).toBe('first\n'.length + STREAM_TAIL * 3 + '\nend:입력'.length)
    expect(r.stdout.length).toBe(STREAM_TAIL)
    expect(r.stdout.endsWith('\nend:입력')).toBe(true)
  })

  it('시간을 넘기거나 끊으면 끝내고 까닭을 돌려준다', async () => {
    const idle = ['-e', 'setInterval(() => {}, 1 << 30)']
    const late = await run(process.execPath, idle, { timeoutMs: 500, onStdout: () => {} })
    expect(late).toMatchObject({ code: null, error: expect.stringContaining('시간 초과') })
    const controller = new AbortController()
    const stopped = run(process.execPath, idle, {
      timeoutMs: 20_000,
      signal: controller.signal,
      onStdout: () => {},
    })
    setTimeout(() => controller.abort(), 200)
    expect(await stopped).toMatchObject({ code: null, error: ABORTED })
    // 받는 쪽이 던져도 실행은 이어 간다. 없는 실행 파일은 오류로 돌려준다
    const thrown = await run(process.execPath, ['-e', "process.stdout.write('x')"], {
      onStdout: () => {
        throw new Error('표시 실패')
      },
    })
    expect(thrown).toMatchObject({ code: 0, stdout: 'x' })
    const missing = await run(path.join(os.tmpdir(), 'relay-없는-명령'), [], { onStdout: () => {} })
    expect(missing.code).toBeNull()
    expect(missing.error).toBeTruthy()
  })
})
