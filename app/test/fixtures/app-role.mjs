// 고아 프로세스 시험용 앱 역할 프로세스 (D76, 스파이크 S1의 orphan-parent.mjs와 같은 역할).
// 앱과 같은 옵션(useConpty, useConptyDll, I32)의 PTY로 tree.mjs를 띄우고, 앱보다 오래 사는 프로세스(분리해 띄운
// tree.mjs)도 하나 띄운 뒤 두 프로세스 ID를 파일에 쓰고 살아 있는다. 시험이 이 프로세스만 강제 종료해 앱 충돌을
// 흉내 낸다. 분리한 프로세스는 Windows에서 자기 콘솔을 갖고 Linux에서 새 세션이 되어(Node 문서 child_process
// detached) 앱이 끝나도 남는다: 앱이 충돌한 뒤 살아남은 claude의 자리다.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pty = require('node-pty')
const [out] = process.argv.slice(2)
const tree = path.join(here, 'tree.mjs')

const p = pty.spawn(process.execPath, [tree], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: here,
  env: process.env,
  useConpty: true,
  useConptyDll: true,
})
let ready = false
p.onData((d) => {
  // ConPTY는 시작할 때 DA1을 묻는다. 앱처럼 답한다 (adapters/pty answerQueries)
  if (d.includes('\x1b[c')) p.write('\x1b[?1;2c')
  if (!ready && /TREE READY/.test(d)) {
    ready = true
    const survivor = spawn(process.execPath, [tree], { detached: true, stdio: 'ignore' })
    survivor.unref()
    fs.writeFileSync(out, JSON.stringify({ pty: p.pid, survivor: survivor.pid }))
  }
})
setInterval(() => {}, 1 << 30)
