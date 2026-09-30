// 맨 CLI 쪽: 평가 레포에서 bash를 PTY로 띄우고 claude를 실행해 둔다. 사람 역할은 터미널 화면(xterm headless로 그린
// 글자)을 보고 입력한다. 터미널을 더 열 수 있다(여러 버그를 나란히 할 때). relay와 같은 모델, effort, 권한 모드다.
import path from 'node:path'
import headless from '@xterm/headless'
import pty from 'node-pty'
import { cleanEnv, findClaude } from './env.mjs'
import { decideDialog } from './dialogs.mjs'
import { gitState } from './repo.mjs'
import { sleep } from './util.mjs'

const { Terminal } = headless
const COLS = 140
const ROWS = 45

const RAW = {
  Enter: '\r',
  Escape: '\x1b',
  ArrowUp: '\x1b[A',
  ArrowDown: '\x1b[B',
  ArrowRight: '\x1b[C',
  ArrowLeft: '\x1b[D',
  Tab: '\t',
  'Shift+Tab': '\x1b[Z',
  Space: ' ',
  Backspace: '\x7f',
  'Control+c': '\x03',
}

export class CliArm {
  /**
   * @param {object} o
   * @param {string} o.dir
   * @param {string} o.repo
   * @param {string} o.base 평가 레포의 첫 커밋
   * @param {object} o.agentEnv
   * @param {string} o.agentConfigDir
   * @param {string[]} o.claudeArgs claude를 띄울 때 줄 인자 (권한 모드)
   */
  constructor(o) {
    this.o = o
    this.terms = []
    this.active = 0
  }

  kind = 'cli'

  env() {
    return cleanEnv({
      ...this.o.agentEnv,
      CLAUDE_CONFIG_DIR: this.o.agentConfigDir,
      PS1: '\\w $ ',
    })
  }

  /** bash를 하나 띄운다. claude가 true면 claude를 실행해 둔다 */
  async open(claude = true) {
    const term = new Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true, scrollback: 5000 })
    const p = pty.spawn('bash', ['--norc', '--noprofile', '-i'], {
      name: 'xterm-256color',
      cols: COLS,
      rows: ROWS,
      cwd: this.o.repo,
      env: this.env(),
    })
    const t = { term, p, exited: false }
    p.onData((d) => term.write(d))
    p.onExit(() => (t.exited = true))
    this.terms.push(t)
    this.active = this.terms.length - 1
    await sleep(500)
    if (claude) {
      const bin = findClaude()
      const dir = path.dirname(bin)
      p.write(`export PATH="${dir}:$PATH"; clear; claude ${this.o.claudeArgs.join(' ')}\r`)
      await sleep(3000)
    }
    return t
  }

  async prepare() {
    await this.open(true)
  }

  cur() {
    return this.terms[this.active]
  }

  screenOf(t) {
    const buf = t.term.buffer.active
    const lines = []
    for (let i = 0; i < t.term.rows; i++)
      lines.push(buf.getLine(buf.viewportY + i)?.translateToString(true) ?? '')
    return lines.join('\n').replace(/\n+$/, '')
  }

  async signature() {
    return this.terms.map((t) => this.screenOf(t)).join('\n\u0000\n')
  }

  async notifications() {
    return []
  }

  async handleSetupDialogs(guard) {
    for (const t of this.terms) {
      const d = guard ? guard.check(this.screenOf(t)) : decideDialog(this.screenOf(t))
      if (!d) continue
      for (const k of d.keys) {
        t.p.write(RAW[k])
        await sleep(300)
      }
      return d.name
    }
    return null
  }

  async observe() {
    return {
      terminals: this.terms.map((t, i) => ({
        index: i + 1,
        active: i === this.active,
        exited: t.exited,
        screen: this.screenOf(t),
      })),
    }
  }

  async act(a) {
    const t = this.cur()
    switch (a.do) {
      case 'type': {
        if (!t || t.exited) return '열린 터미널이 없음'
        const text = String(a.text ?? '').replace(/\s*\n\s*/g, ' ')
        if (text) t.p.write(text)
        if (a.enter !== false) {
          await sleep(300)
          t.p.write('\r')
        }
        return `터미널 ${this.active + 1}에 입력함`
      }
      case 'key': {
        if (!t || t.exited) return '열린 터미널이 없음'
        const k = cliKey(a.key)
        if (k === null) return `모르는 키 ${a.key}`
        t.p.write(k)
        return `${a.key}를 누름`
      }
      case 'new_terminal': {
        if (this.terms.length >= 4) return '터미널은 넷까지'
        await this.open(false)
        return `새 터미널 ${this.terms.length}을 염 (셸)`
      }
      case 'switch': {
        const i = Number(a.terminal) - 1
        if (!this.terms[i]) return `터미널 ${a.terminal}이 없음`
        this.active = i
        return `터미널 ${a.terminal}로 옮김`
      }
      default:
        return `모르는 행동 ${a.do}`
    }
  }

  /** 터미널 창이 갑자기 닫힌다: 셸과 claude를 프로세스 그룹째 끝내고, 같은 폴더에서 새 셸을 연다 */
  async crash() {
    for (const t of this.terms) {
      try {
        process.kill(-t.p.pid, 'SIGKILL')
      } catch {
        try {
          t.p.kill('SIGKILL')
        } catch {
          // 이미 끝났다
        }
      }
    }
    await sleep(2000)
    this.terms = []
    await this.open(false)
    return '터미널 창이 갑자기 닫혔습니다(작업하던 claude도 끝남). 같은 폴더에서 새 터미널을 열었습니다.'
  }

  snapshot() {}

  finalTrees() {
    return [{ path: this.o.repo, label: 'repo', git: gitState(this.o.repo, this.o.base) }]
  }

  works() {
    return []
  }

  async close() {
    for (const t of this.terms) {
      try {
        process.kill(-t.p.pid, 'SIGKILL')
      } catch {
        try {
          t.p.kill('SIGKILL')
        } catch {
          // 이미 끝났다
        }
      }
    }
  }
}

export function cliKey(k) {
  const s = String(k ?? '').trim()
  const map = {
    enter: 'Enter',
    escape: 'Escape',
    esc: 'Escape',
    up: 'ArrowUp',
    arrowup: 'ArrowUp',
    down: 'ArrowDown',
    arrowdown: 'ArrowDown',
    left: 'ArrowLeft',
    arrowleft: 'ArrowLeft',
    right: 'ArrowRight',
    arrowright: 'ArrowRight',
    tab: 'Tab',
    'shift+tab': 'Shift+Tab',
    space: 'Space',
    backspace: 'Backspace',
    'ctrl+c': 'Control+c',
    'control+c': 'Control+c',
  }
  const name = map[s.toLowerCase()]
  if (name) return RAW[name]
  if (/^[0-9a-zA-Z]$/.test(s)) return s
  return null
}
