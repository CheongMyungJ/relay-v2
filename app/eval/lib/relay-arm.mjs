// relay 쪽: 빌드한 Electron 앱(out/)을 Playwright로 띄우고, 사람 역할이 화면(스크린샷, 보이는 글자, 누를 수 있는 요소)을
// 보고 고른 행동을 한다. 프로젝트 등록만 평가 전에 도구가 해 둔다(사람은 이미 등록된 앱에서 시작한다).
import fs from 'node:fs'
import path from 'node:path'
import { _electron as electron } from '@playwright/test'
import { cleanEnv, findClaude } from './env.mjs'
import { DialogGuard } from './dialogs.mjs'
import { gitState } from './repo.mjs'
import { copyTree, sleep } from './util.mjs'

const APP_DIR = path.resolve(import.meta.dirname, '../..')

/** 렌더러에서 누를 수 있는 요소를 찾아 번호를 매긴다. 번호는 data-eval-id로 남긴다 */
function collectElements() {
  for (const e of document.querySelectorAll('[data-eval-id]')) e.removeAttribute('data-eval-id')
  const sel =
    'button, [role=tab], [role=button], input, textarea, select, a[href], summary, [role=checkbox], [role=radio], [role=menuitem], [role=option]'
  const clip = (s, n = 80) => {
    const t = (s ?? '').replace(/\s+/g, ' ').trim()
    return t.length > n ? `${t.slice(0, n)}…` : t
  }
  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label')
    if (aria) return aria
    const by = el.getAttribute('aria-labelledby')
    if (by)
      return by
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText ?? '')
        .join(' ')
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      if (l) return l.innerText
    }
    const wrap = el.closest('label')
    if (wrap) return wrap.innerText
    return ''
  }
  const out = []
  let n = 0
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('[hidden]') || el.closest('.xterm')) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const st = getComputedStyle(el)
    if (st.visibility === 'hidden' || st.display === 'none') continue
    n++
    el.setAttribute('data-eval-id', String(n))
    const tag = el.tagName.toLowerCase()
    const type = el.getAttribute('type')
    let role = el.getAttribute('role') ?? tag
    if (tag === 'input') role = type === 'checkbox' || type === 'radio' ? type : 'input'
    if (tag === 'a') role = 'link'
    const e = {
      id: n,
      role,
      name: clip(labelOf(el) || el.innerText || el.getAttribute('placeholder') || el.title),
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') e.disabled = true
    if (role === 'checkbox' || role === 'radio') e.checked = el.checked
    if (el.getAttribute('aria-selected') === 'true') e.selected = true
    if (tag === 'input' && role === 'input') e.value = clip(el.value, 120)
    if (tag === 'textarea') e.value = clip(el.value, 200)
    if (tag === 'select') {
      e.value = el.value
      e.options = [...el.options].map((o) => o.value || o.text)
    }
    if (r.bottom < 0 || r.top > innerHeight) e.offscreen = true
    out.push(e)
  }
  return out
}

/** 스크린샷에 요소 번호를 얹는다 (set-of-marks) */
function drawMarks(show) {
  for (const m of document.querySelectorAll('.eval-mark')) m.remove()
  if (!show) return
  for (const el of document.querySelectorAll('[data-eval-id]')) {
    const r = el.getBoundingClientRect()
    const m = document.createElement('div')
    m.className = 'eval-mark'
    m.textContent = el.getAttribute('data-eval-id')
    Object.assign(m.style, {
      position: 'fixed',
      left: `${Math.max(0, r.left - 2)}px`,
      top: `${Math.max(0, r.top - 8)}px`,
      font: 'bold 10px sans-serif',
      background: '#e5c100',
      color: '#000',
      padding: '0 2px',
      borderRadius: '2px',
      zIndex: 99999,
      pointerEvents: 'none',
    })
    document.body.appendChild(m)
  }
}

/** 보이는 글자. 터미널은 줄 단위로 따로 모은다 */
function visibleText() {
  const clean = (s) =>
    s
      .split('\n')
      .map((l) => l.replace(/\u00a0/g, ' ').trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  const rows = document.querySelector('.terminal-host:not([hidden]) .xterm-rows')
  const terminal = rows
    ? [...rows.children].map((r) => r.textContent.replace(/\u00a0/g, ' ').trimEnd()).join('\n')
    : ''
  const layout = document.querySelector('.layout') ?? document.body
  const clone = layout.cloneNode(true)
  for (const x of clone.querySelectorAll('.xterm, .eval-mark, [hidden]')) x.remove()
  // innerText는 화면에 붙은 요소에서만 줄바꿈을 지킨다. 복제본은 잠깐 붙였다가 뗀다
  clone.style.position = 'absolute'
  clone.style.left = '-99999px'
  document.body.appendChild(clone)
  const text = clone.innerText
  clone.remove()
  const dialogs = [...document.querySelectorAll('[role=dialog]')].filter(
    (d) => !d.closest('[hidden]') && d.getBoundingClientRect().width > 0,
  ).length
  return { text: clean(text), terminal: clean(terminal).replace(/\n+$/, ''), dialogs }
}

/** 폴링용: DOM을 복제하지 않고 화면 글자와 보이는 터미널 글자만 읽는다 */
function pollText() {
  const rows = document.querySelector('.terminal-host:not([hidden]) .xterm-rows')
  const terminal = rows
    ? [...rows.children].map((r) => r.textContent.replace(/\u00a0/g, ' ').trimEnd()).join('\n')
    : ''
  const layout = document.querySelector('.layout') ?? document.body
  return { text: layout.innerText, terminal }
}

/** 열린 대화상자 수 */
function openDialogs() {
  return [...document.querySelectorAll('[role=dialog]')].filter(
    (d) => !d.closest('[hidden]') && d.getBoundingClientRect().width > 0,
  ).length
}

export class RelayArm {
  /**
   * @param {object} o
   * @param {string} o.dir 이 실행의 작업 폴더
   * @param {string} o.repo 평가 레포
   * @param {string} o.base 평가 레포의 첫 커밋
   * @param {object} o.agentEnv 모델과 effort
   * @param {string} o.agentConfigDir 에이전트의 CLAUDE_CONFIG_DIR
   * @param {(e: object) => void} o.log
   */
  constructor(o) {
    this.o = o
    this.home = path.join(o.dir, 'relay-home')
    this.userData = path.join(o.dir, 'electron-user-data')
    this.notices = []
    this.noticeSeen = 0
    this.launches = 0
    this.snapped = new Map()
    this.guard = new DialogGuard()
  }

  kind = 'relay'

  env() {
    return cleanEnv({
      ...this.o.agentEnv,
      CLAUDE_CONFIG_DIR: this.o.agentConfigDir,
      CLAUDE_BIN: findClaude(),
      RELAY_HOME: this.home,
    })
  }

  async launch() {
    fs.mkdirSync(this.home, { recursive: true })
    this.app = await electron.launch({
      args: [APP_DIR, `--user-data-dir=${this.userData}`],
      env: this.env(),
      timeout: 60_000,
    })
    this.launches++
    const repo = this.o.repo
    // Electron 기본 대화상자는 Playwright가 가로채지 못하므로 메인 프로세스에서 바꿔 끼운다([스모크]와 같음).
    // 폴더 고르기는 평가 레포를, 앱 종료 확인은 [종료]를 고른다. OS 알림은 모아 사람 역할에게 보인다.
    await this.app.evaluate(({ dialog, Notification }, dir) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [dir] })
      dialog.showMessageBox = () => Promise.resolve({ response: 0, checkboxChecked: false })
      globalThis.__evalNotices = []
      const show = Notification.prototype.show
      Notification.prototype.show = function () {
        globalThis.__evalNotices.push({ title: this.title, body: this.body, at: Date.now() })
        try {
          show.call(this)
        } catch {
          // 가상 화면에는 알림 서버가 없을 수 있다
        }
      }
    }, repo)
    this.win = await this.app.firstWindow()
    await this.win.waitForSelector('.layout', { timeout: 60_000 })
    this.noticeSeen = 0
  }

  /** 평가 전 준비: 프로젝트 등록 ([스모크]와 같은 순서). 사람 역할의 부담에 넣지 않는다 */
  async prepare() {
    await this.launch()
    const win = this.win
    await win.locator('.sidebar').getByRole('button', { name: '프로젝트 추가' }).click()
    await win.getByRole('button', { name: '레포 폴더 고르기' }).click()
    await win.locator('table.checks').waitFor({ timeout: 30_000 })
    const register = win.getByRole('button', { name: '등록' })
    await register.waitFor({ timeout: 60_000 })
    for (let i = 0; i < 60 && !(await register.isEnabled()); i++) await sleep(1000)
    if (!(await register.isEnabled())) {
      const checks = await win.locator('table.checks').innerText()
      throw new Error(`프로젝트 등록 점검 실패:\n${checks}`)
    }
    await register.click()
    await win.locator('.project-name').first().waitFor({ timeout: 30_000 })
  }

  async notifications() {
    try {
      const all = await this.app.evaluate(() => globalThis.__evalNotices ?? [])
      const fresh = all.slice(this.noticeSeen)
      this.noticeSeen = all.length
      return fresh.map((n) => `${n.title}: ${n.body}`)
    } catch {
      return []
    }
  }

  /**
   * 폴링 한 번에 한 번만 읽는다. signature는 화면이 바뀌었는지 가를 서명(스크린샷 없이 글자만),
   * terminal은 첫 실행 창을 가를 때 쓴다
   */
  async poll() {
    const v = await this.win.evaluate(pollText)
    return { signature: `${v.text}\n${v.terminal}`, terminal: v.terminal }
  }

  /** 첫 실행 창(신뢰, 권한 우회 경고 등)을 도구가 수락한다. 사람의 부담에 넣지 않는다 */
  async handleSetupDialogs(polled) {
    const d = this.guard.check(polled.terminal)
    if (!d) return null
    await this.focusTerminal()
    for (const k of d.keys) {
      await this.win.keyboard.press(k)
      await sleep(300)
    }
    return d.name
  }

  /** 사람 역할에게 보일 화면 */
  async observe(shotPath) {
    const elements = await this.win.evaluate(collectElements)
    await this.win.evaluate(drawMarks, true)
    await this.win.screenshot({ path: shotPath })
    await this.win.evaluate(drawMarks, false)
    const v = await this.win.evaluate(visibleText)
    return {
      elements,
      text: v.text,
      terminal: v.terminal,
      dialogs: v.dialogs,
      screenshot: shotPath,
    }
  }

  /** 보이는 터미널에 포커스를 준다. 보이는 터미널이 없으면 false */
  async focusTerminal() {
    const ta = this.win.locator('.terminal-host:not([hidden]) textarea.xterm-helper-textarea')
    if ((await ta.count()) === 0) return false
    await ta.first().focus()
    return true
  }

  /** 사람 역할의 행동 하나. { ok, message }를 돌려준다. ok가 false면 헛동작이다 */
  async act(a) {
    const win = this.win
    const el = (id) => win.locator(`[data-eval-id="${id}"]`)
    const ok = (message) => ({ ok: true, message })
    const fail = (message) => ({ ok: false, message })
    switch (a.do) {
      case 'click': {
        const l = el(a.id)
        if ((await l.count()) === 0) return fail(`요소 ${a.id}가 없음`)
        await l.click({ timeout: 5000 })
        return ok(`요소 ${a.id}를 누름`)
      }
      case 'fill': {
        const l = el(a.id)
        if ((await l.count()) === 0) return fail(`요소 ${a.id}가 없음`)
        await l.fill(a.text ?? '', { timeout: 5000 })
        return ok(`요소 ${a.id}에 입력함`)
      }
      case 'select': {
        const l = el(a.id)
        if ((await l.count()) === 0) return fail(`요소 ${a.id}가 없음`)
        await l.selectOption(String(a.value ?? ''), { timeout: 5000 })
        return ok(`요소 ${a.id}에서 ${a.value}를 고름`)
      }
      case 'type': {
        // 맨 CLI 쪽과 같게, 보이는 터미널이 없으면 입력하지 않는다
        if (!(await this.focusTerminal())) return fail('열린 터미널이 없음')
        const text = String(a.text ?? '').replace(/\s*\n\s*/g, ' ')
        if (text) await win.keyboard.insertText(text)
        if (a.enter !== false) {
          await sleep(300)
          await win.keyboard.press('Enter')
        }
        return ok('터미널에 입력함')
      }
      case 'key': {
        // 열린 대화상자가 있으면 그쪽으로, 없으면 터미널로 보낸다
        if (!(await win.evaluate(openDialogs)) && !(await this.focusTerminal()))
          return fail('열린 대화상자도 터미널도 없음')
        await win.keyboard.press(keyName(a.key))
        return ok(`${a.key}를 누름`)
      }
      case 'scroll': {
        // 휠은 마우스가 있는 곳을 굴린다. id가 있으면 그 요소 위에서, 없으면 창 가운데서 굴린다
        if (a.id !== undefined) {
          const l = el(a.id)
          if ((await l.count()) === 0) return fail(`요소 ${a.id}가 없음`)
          await l.hover({ timeout: 5000 })
        } else {
          const size = win.viewportSize() ?? { width: 1500, height: 950 }
          await win.mouse.move(size.width / 2, size.height / 2)
        }
        await win.mouse.wheel(0, a.direction === 'up' ? -600 : 600)
        return ok('스크롤함')
      }
      default:
        return fail(`모르는 행동 ${a.do}`)
    }
  }

  /** 앱이 갑자기 꺼진다(SIGKILL). 잠시 뒤 사람이 다시 켠 것처럼 다시 띄운다 */
  async crash() {
    const pid = this.app.process().pid
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // 이미 끝났다
    }
    await sleep(3000)
    await this.launch()
    return '앱이 갑자기 꺼졌습니다. 다시 실행했습니다.'
  }

  /** Work의 worktree들 */
  worktrees() {
    const trees = []
    const projects = path.join(this.home, 'projects')
    if (!fs.existsSync(projects)) return trees
    for (const p of fs.readdirSync(projects)) {
      const wt = path.join(projects, p, 'worktrees')
      if (!fs.existsSync(wt)) continue
      for (const w of fs.readdirSync(wt)) {
        const dir = path.join(wt, w)
        if (fs.existsSync(path.join(dir, '.git'))) trees.push({ path: dir, label: w })
      }
    }
    return trees
  }

  /**
   * worktree를 복사해 둔다. 사람이 [Work 정리]로 worktree를 지워도 고친 코드를 판정할 수 있게 사람의 차례마다 부른다
   */
  snapshot() {
    for (const t of this.worktrees()) {
      copyTree(t.path, path.join(this.o.dir, 'snapshots', t.label))
      this.snapped.set(t.label, gitState(t.path, this.o.base))
    }
  }

  /** 에이전트가 고친 코드가 있는 곳들: Work의 worktree, 지워졌으면 마지막 스냅숏 */
  finalTrees() {
    const live = this.worktrees()
    const trees = live.map((t) => ({ ...t, git: gitState(t.path, this.o.base) }))
    const snaps = path.join(this.o.dir, 'snapshots')
    if (fs.existsSync(snaps)) {
      for (const label of fs.readdirSync(snaps)) {
        if (live.some((t) => t.label === label)) continue
        trees.push({
          path: path.join(snaps, label),
          label,
          git: this.snapped.get(label) ?? null,
          removed: true,
        })
      }
    }
    return trees
  }

  /** 끝난 Work의 상태 (work.json 요약) */
  works() {
    const out = []
    const projects = path.join(this.home, 'projects')
    if (!fs.existsSync(projects)) return out
    for (const p of fs.readdirSync(projects)) {
      const ws = path.join(projects, p, 'works')
      if (!fs.existsSync(ws)) continue
      for (const w of fs.readdirSync(ws)) {
        const file = path.join(ws, w, 'work.json')
        if (!fs.existsSync(file)) continue
        const j = JSON.parse(fs.readFileSync(file, 'utf8'))
        out.push({
          id: w,
          dir: path.join(ws, w),
          status: j.status,
          branch: j.branch ?? null,
          tasks: (j.tasks ?? []).map((t) => ({
            node: t.node,
            status: t.status,
            approved_by: t.approved_by ?? null,
          })),
        })
      }
    }
    return out
  }

  async close() {
    try {
      await this.app?.close()
    } catch {
      try {
        process.kill(this.app.process().pid, 'SIGKILL')
      } catch {
        // 이미 끝났다
      }
    }
  }
}

const KEYS = {
  enter: 'Enter',
  escape: 'Escape',
  esc: 'Escape',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  tab: 'Tab',
  'shift+tab': 'Shift+Tab',
  space: 'Space',
  backspace: 'Backspace',
  'ctrl+c': 'Control+c',
}

export function keyName(k) {
  const s = String(k ?? '').trim()
  return KEYS[s.toLowerCase()] ?? KEYS[s.toLowerCase().replace(/^arrow/, '')] ?? s
}
