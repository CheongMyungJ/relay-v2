// 명령 실행의 시간 초과 (adapters/exec). Windows에서 .cmd로 감싼 명령은 시간 초과 때 트리째 끝낸다 (D333)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { run } from '../../src/adapters/exec'

const TREE = path.resolve(__dirname, '../fixtures/tree.mjs')

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
