// 맨 CLI 쪽: 평가 레포에서 bash를 PTY로 띄우고 claude를 실행해 둔다. 사람 역할은 터미널 화면(xterm headless로 그린
// 글자)을 보고 입력한다. 터미널을 더 열 수 있다(여러 버그를 나란히 할 때). relay와 같은 모델, effort, 권한 모드다.
import fs from 'node:fs'
import path from 'node:path'
import headless from '@xterm/headless'
import pty from 'node-pty'
import { cleanEnv, findClaude } from './env.mjs'
import { DialogGuard } from './dialogs.mjs'
import { gitState } from './repo.mjs'
import { git, run, sleep } from './util.mjs'

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
    /** 꺼낸 브랜치: label → 꺼낼 때의 커밋 */
    this.exported = new Map()
  }

  kind = 'cli'

  /**
   * 셸이 찾는 claude가 relay의 CLAUDE_BIN과 같은 실행 파일이 되게 한다. 실행 파일의 이름이 claude가 아니어도
   * 사람 역할이 셸에서 친 claude(예: 비정상 종료 뒤 claude --continue)가 같은 것을 띄우도록 PATH 맨 앞에 링크를 둔다
   */
  shimDir() {
    const dir = path.join(this.o.dir, 'bin')
    const link = path.join(dir, 'claude')
    if (!fs.existsSync(link)) {
      fs.mkdirSync(dir, { recursive: true })
      fs.symlinkSync(findClaude(), link)
    }
    return dir
  }

  env() {
    const env = cleanEnv({
      ...this.o.agentEnv,
      CLAUDE_CONFIG_DIR: this.o.agentConfigDir,
      PS1: '\\w $ ',
    })
    env.PATH = `${this.shimDir()}:${env.PATH ?? ''}`
    return env
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
    // 첫 실행 창의 안정 판정은 터미널마다 따로 한다(다른 터미널의 화면이 판정을 되돌리지 않게)
    const t = { term, p, exited: false, guard: new DialogGuard() }
    p.onData((d) => term.write(d))
    p.onExit(() => (t.exited = true))
    this.terms.push(t)
    this.active = this.terms.length - 1
    await sleep(500)
    if (claude) {
      // relay가 쓰는 실행 파일을 경로로 직접 띄운다
      p.write(`clear; '${findClaude()}' ${this.o.claudeArgs.join(' ')}\r`)
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

  async poll() {
    return { signature: this.terms.map((t) => this.screenOf(t)).join('\n\u0000\n') }
  }

  async notifications() {
    return []
  }

  async handleSetupDialogs() {
    for (const t of this.terms) {
      const d = t.guard.check(this.screenOf(t))
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

  /** 사람 역할의 행동 하나. { ok, message }를 돌려준다. ok가 false면 헛동작이다 */
  async act(a) {
    const t = this.cur()
    const ok = (message) => ({ ok: true, message })
    const fail = (message) => ({ ok: false, message })
    switch (a.do) {
      case 'type': {
        if (!t || t.exited) return fail('열린 터미널이 없음')
        const text = String(a.text ?? '').replace(/\s*\n\s*/g, ' ')
        if (text) t.p.write(text)
        if (a.enter !== false) {
          await sleep(300)
          t.p.write('\r')
        }
        return ok(`터미널 ${this.active + 1}에 입력함`)
      }
      case 'key': {
        if (!t || t.exited) return fail('열린 터미널이 없음')
        const k = cliKey(a.key)
        if (k === null) return fail(`모르는 키 ${a.key}`)
        t.p.write(k)
        return ok(`${a.key}를 누름`)
      }
      case 'new_terminal': {
        if (this.terms.length >= 4) return fail('터미널은 넷까지')
        await this.open(false)
        return ok(`새 터미널 ${this.terms.length}을 염 (셸)`)
      }
      case 'switch': {
        const i = Number(a.terminal) - 1
        if (!this.terms[i]) return fail(`터미널 ${a.terminal}이 없음`)
        this.active = i
        return ok(`터미널 ${a.terminal}로 옮김`)
      }
      default:
        return fail(`모르는 행동 ${a.do}`)
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

  /**
   * 다음 Work로 넘어갈 때(works 시나리오, relay I84): 앞 일의 터미널을 닫고 같은 레포 폴더에서 새 claude 세션을 연다.
   * 사람이 다음 요청을 새 세션으로 주는 것과 같다. 맨 CLI의 자동 메모리는 끄지 않는다
   */
  async nextWork() {
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
    await sleep(1000)
    this.terms = []
    await this.open(true)
    return '앞 일의 터미널을 닫고 같은 레포 폴더에서 claude를 새로 띄웠습니다.'
  }

  snapshot() {}

  /**
   * 에이전트가 고친 코드가 있는 곳들: 평가 레포(체크아웃된 브랜치)와, 체크아웃되지 않은 로컬 브랜치 가운데
   * 기준 뒤에 커밋이 있고 HEAD에 아직 들어 있지 않은 것. 사람이 버그마다 브랜치를 나눠 달라고 하면 고친 것이
   * 여러 브랜치에 흩어지므로, 그런 브랜치는 git archive로 꺼내 따로 판정한다(레포는 건드리지 않는다)
   */
  finalTrees() {
    const repo = this.o.repo
    const trees = [{ path: repo, label: 'repo', git: gitState(repo, this.o.base) }]
    let branches
    try {
      branches = git(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads')
        .split('\n')
        .filter(Boolean)
    } catch {
      return trees
    }
    const head = run('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: repo }).out.trim()
    for (const b of branches) {
      if (b === head) continue
      try {
        const sha = git(repo, 'rev-parse', b)
        const commits = Number(git(repo, 'rev-list', '--count', `${this.o.base}..${sha}`))
        if (commits === 0) continue
        // HEAD에 이미 들어 있으면 평가 레포가 대신한다
        if (run('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], { cwd: repo }).code === 0)
          continue
        const label = `branch-${b.replace(/[^\w.-]+/g, '-')}`
        const dir = path.join(this.o.dir, 'branches', label)
        if (this.exported.get(label) !== sha) {
          fs.rmSync(dir, { recursive: true, force: true })
          fs.mkdirSync(dir, { recursive: true })
          const tar = `${dir}.tar`
          git(repo, 'archive', '--format=tar', '-o', tar, sha)
          run('tar', ['-xf', tar, '-C', dir])
          fs.rmSync(tar, { force: true })
          this.exported.set(label, sha)
        }
        const log = git(repo, 'log', '--format=%s', `${this.o.base}..${sha}`)
          .split('\n')
          .filter(Boolean)
        trees.push({ path: dir, label, git: { branch: b, commits, log, uncommitted: [] } })
      } catch {
        // 브랜치를 읽지 못하면 그 브랜치만 빼고 판정한다
      }
    }
    return trees
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
