import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isAlive,
  listProcesses,
  spawnSpec,
  startPty,
  type PtySession,
} from '../../src/adapters/pty'

const FAKE = path.resolve(
  __dirname,
  '../fake-claude',
  process.platform === 'win32' ? 'fake-claude.cmd' : 'fake-claude.mjs',
)
const TREE = path.resolve(__dirname, '../fixtures/tree.mjs')
const isWin = process.platform === 'win32'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function collect(s: PtySession) {
  let out = ''
  let exitCode: number | null = null
  s.onData((d) => {
    out += d
    // ConPTY는 시작할 때 터미널에 DA1(ESC [ c)을 묻는다. 앱에서는 xterm.js가 답하므로
    // 시험도 xterm.js와 같은 답을 보낸다. 답이 없으면 1.23 ConPTY가 크기 변경을
    // 처리하지 않는 것으로 보였다 (app-ci #1, #2).
    if (d.includes('\x1b[c')) s.write('\x1b[?1;2c')
  })
  s.onExit((c) => (exitCode = c))
  const until = async (pred: () => boolean, label: string, ms = 20000) => {
    const end = Date.now() + ms
    while (!pred()) {
      if (Date.now() > end) throw new Error(`시간 초과: ${label}\n--- 출력 ---\n${out}`)
      await sleep(100)
    }
  }
  return { out: () => out, exited: () => exitCode !== null, until }
}

describe('spawnSpec', () => {
  it('.cmd는 cmd.exe /d /s /c로 감싼다', () => {
    expect(spawnSpec('C:\\npm\\claude.cmd', ['-p', 'x'])).toEqual({
      file: 'cmd.exe',
      args: ['/d', '/s', '/c', 'C:\\npm\\claude.cmd', '-p', 'x'],
    })
    expect(spawnSpec('C:\\bin\\claude.exe', ['a'])).toEqual({
      file: 'C:\\bin\\claude.exe',
      args: ['a'],
    })
  })
})

describe('PTY 세션', () => {
  it('가짜 claude의 출력이 오고, 크기 변경이 전달되고, 트리 종료로 끝난다', async () => {
    const s = startPty({
      bin: FAKE,
      args: ['--hello', '한글 인자'],
      cwd: __dirname,
      cols: 90,
      rows: 25,
    })
    const c = collect(s)
    await c.until(() => c.out().includes('FAKE-CLAUDE READY'), '시작 표식')
    await c.until(() => c.out().includes('SIZE 90x25'), '처음 크기')
    expect(c.out()).toContain('["--hello","한글 인자"]')
    expect(c.out()).toContain('한글 출력 확인')

    s.resize(120, 40)
    await c.until(() => c.out().includes('SIZE 120x40'), '바뀐 크기')

    await s.killTree()
    await c.until(c.exited, '종료 이벤트')
  })

  it.runIf(isWin)(
    '트리 종료 뒤 자식, 손자, OpenConsole.exe가 남지 않는다 (I32)',
    async () => {
      // 다른 시험이 남긴 OpenConsole.exe와 구분하려고 시작 전 목록을 둔다.
      const existing = new Set((await listProcesses()).map((p) => p.ProcessId))
      const s = startPty({
        bin: process.execPath,
        args: [TREE],
        cwd: __dirname,
        cols: 80,
        rows: 24,
      })
      const c = collect(s)
      await c.until(() => /TREE READY \d+ \d+/.test(c.out()), '시작 표식')

      // 세션 트리: PTY로 띄운 프로세스와 그 자손. OpenConsole.exe는 이 시험 프로세스의 자식으로 뜬다.
      const before = await listProcesses()
      const tree = new Set<number>([s.pid])
      for (let grew = true; grew;) {
        grew = false
        for (const p of before) {
          if (tree.has(p.ParentProcessId) && !tree.has(p.ProcessId)) {
            tree.add(p.ProcessId)
            grew = true
          }
        }
      }
      const conhosts = before.filter(
        (p) =>
          p.ParentProcessId === process.pid &&
          !existing.has(p.ProcessId) &&
          /^(OpenConsole|conhost)\.exe$/i.test(p.Name),
      )
      const watched = [...before.filter((p) => tree.has(p.ProcessId)), ...conhosts]
      console.log('감시할 프로세스', watched.map((p) => `${p.Name}(${p.ProcessId})`).join(', '))
      expect(watched.some((p) => /^OpenConsole\.exe$/i.test(p.Name))).toBe(true)
      expect(tree.size).toBeGreaterThanOrEqual(2)

      await s.killTree()
      await c.until(c.exited, '종료 이벤트')

      let left = watched
      const end = Date.now() + 10000
      while (left.length > 0 && Date.now() < end) {
        await sleep(500)
        const now = await listProcesses()
        left = watched.filter((p) => isAlive(p.ProcessId, p.Created, now))
      }
      expect(left.map((p) => `${p.Name}(${p.ProcessId})`)).toEqual([])
    },
    60000,
  )
})
