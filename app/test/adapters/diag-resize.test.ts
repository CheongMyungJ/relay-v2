// 임시 진단: Windows에서 PTY 크기 변경이 자식에게 보이지 않는 원인을 가른다 (app-ci #1~#3).
// 판정하지 않고 관찰만 기록한다. 원인을 찾으면 지운다.
import path from 'node:path'
import * as nodePty from 'node-pty'
import { it } from 'vitest'

const FAKE_MJS = path.resolve(__dirname, '../fake-claude/fake-claude.mjs')
const FAKE_CMD = path.resolve(__dirname, '../fake-claude/fake-claude.cmd')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

it.runIf(process.platform === 'win32')(
  '진단: 크기 변경 조합',
  async () => {
    const cases = [
      { name: 'dll + node 직접', dll: true, file: process.execPath, args: [FAKE_MJS] },
      { name: 'dll + cmd 감쌈', dll: true, file: 'cmd.exe', args: ['/d', '/s', '/c', FAKE_CMD] },
      { name: '내장 + node 직접', dll: false, file: process.execPath, args: [FAKE_MJS] },
      { name: '내장 + cmd 감쌈', dll: false, file: 'cmd.exe', args: ['/d', '/s', '/c', FAKE_CMD] },
    ]
    for (const c of cases) {
      let out = ''
      const p = nodePty.spawn(c.file, c.args, {
        name: 'xterm-256color',
        cols: 90,
        rows: 25,
        cwd: __dirname,
        env: process.env as Record<string, string>,
        useConpty: true,
        useConptyDll: c.dll,
      })
      p.onData((d) => (out += d))
      const end = Date.now() + 15000
      while (!out.includes('한글 출력 확인') && Date.now() < end) await sleep(100)
      let threw = ''
      try {
        p.resize(120, 40)
      } catch (e) {
        threw = String(e)
      }
      await sleep(3000)
      const sizes = [...out.matchAll(/SIZE (\d+x\d+)/g)].map((m) => m[1])
      console.log(
        `[진단] ${c.name}: sizes=${JSON.stringify(sizes)} pty.cols=${p.cols} pty.rows=${p.rows} threw=${threw || '-'}`,
      )
      console.log(`[진단] ${c.name} 원출력: ${JSON.stringify(out.slice(0, 400))}`)
      try {
        p.kill()
      } catch {
        // 이미 끝남
      }
      await sleep(1000)
    }
  },
  120000,
)
