// task마다 xterm 인스턴스를 React 수명주기 밖에서 들고 있는다.
// React가 컴포넌트를 다시 붙여도(StrictMode 포함) 화면과 구독이 끊기지 않게 하려고.
// task는 main이 시작하므로 탭은 나중에 붙는다. 붙을 때 지금까지의 출력을 받고, 그 뒤의 조각을 이어 쓴다.
import { Terminal, type ILink } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { AppInfo } from '../../shared/api'
import type { FilesOpenTarget, TerminalChunk, TerminalSize } from '../../shared/views'
import { findLinks, logicalLine, pasteText, pastesFiles, type LinkMatch } from './links'
import { ptyFollower, type PtyFollower } from './termSize'

export interface TermEntry {
  term: Terminal
  fit: FitAddon
  follower: PtyFollower
  dispose: () => void
}

const entries = new Map<string, TermEntry>()

/**
 * 마지막으로 화면에 맞춘 크기. PTY 크기를 모르는 숨은 터미널(pty.log로 채운 것, 대기열)이 따른다. main도 새 PTY를 마지막에
 * 받은 크기로 띄운다 (I189)
 */
let lastFit: TerminalSize | null = null

/** 화면에 보여 크기를 잴 수 있다. 숨긴 탭(display:none)은 크기가 0이다 */
function measurable(el: HTMLElement | null | undefined): el is HTMLElement {
  return !!el && el.clientWidth > 0 && el.clientHeight > 0
}

/** 화면에 맞춘다. 글자 크기를 아직 잴 수 없으면 맞추지 않는다 */
function fitNow(term: Terminal, fit: FitAddon): void {
  if (!fit.proposeDimensions()) return
  fit.fit()
  lastFit = { cols: term.cols, rows: term.rows }
}

/**
 * xterm의 색. styles.css의 --term-bg, --term-fg, --term-selection을 읽는다: 둘레의 .terminal과 같은 바탕이어야
 * 테두리 띠가 보이지 않는다. 터미널은 테마와 관계없이 어둡다 (D335)
 */
function terminalTheme(): {
  background: string
  foreground: string
  cursor: string
  selectionBackground: string
} {
  const css = getComputedStyle(document.documentElement)
  const token = (name: string) => css.getPropertyValue(name).trim()
  const foreground = token('--term-fg')
  return {
    background: token('--term-bg'),
    foreground,
    cursor: foreground,
    selectionBackground: token('--term-selection'),
  }
}

/** 터미널에 포커스를 준다. 글을 넣지는 않는다 (D222). 아직 만들지 않은 터미널이면 false */
export function focusTerm(key: string): boolean {
  const entry = entries.get(key)
  if (!entry) return false
  entry.term.focus()
  return true
}

/** 터미널 키의 xterm. 없으면 만들고 출력을 붙인다 */
export function ensureTerm(key: string, info: AppInfo): TermEntry {
  const existing = entries.get(key)
  if (existing) return existing
  const api = window.relay.terminal
  const term = new Terminal({
    fontFamily: "'Cascadia Mono', Consolas, 'D2Coding', monospace",
    fontSize: 14,
    scrollback: 10000,
    cursorBlink: true,
    theme: terminalTheme(),
    // ConPTY에 맞춘 동작을 켠다 (xterm.d.ts windowsPty)
    windowsPty: info.windowsBuild
      ? { backend: 'conpty', buildNumber: info.windowsBuild }
      : undefined,
    // 프로그램이 건 링크(OSC 8). file: 주소도 받아 main이 경로로 연다 (D411)
    linkHandler: {
      allowNonHttpProtocols: true,
      activate: (ev, uri) => openLink(key, ev, uri),
      hover: () => setOpenHint(term, true),
      leave: () => setOpenHint(term, false),
    },
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  const links = term.registerLinkProvider({
    provideLinks: (y, cb) => void provideLinks(key, term, y).then(cb, () => cb(undefined)),
  })

  // 일반 터미널(Windows Terminal)처럼 Ctrl+V는 붙여넣기, 선택이 있을 때 Ctrl+C는 복사.
  // false를 돌려주면 xterm이 키를 보내지 않고 브라우저 기본 동작(copy/paste 이벤트)이 일어난다.
  term.attachCustomKeyEventHandler((ev) => {
    if (ev.type !== 'keydown' || !ev.ctrlKey || ev.altKey || ev.metaKey) return true
    const k = ev.key.toLowerCase()
    if (k === 'v' && !ev.shiftKey) return false
    if (k === 'c' && term.hasSelection()) {
      setTimeout(() => term.clearSelection(), 0)
      return false
    }
    return true
  })

  // 숨은 xterm은 PTY 크기를 따른다 (I189)
  const follower = ptyFollower(term, {
    shown: () => measurable(term.element?.parentElement),
    resizePty: ({ cols, rows }) => void api.resize(key, cols, rows),
    refit: () => fitNow(term, fit),
  })

  // 붙기 전에 온 조각은 모았다가, 지금까지의 출력 뒤에 이어 쓴다 (seq로 겹침을 뺀다)
  let next = -1
  let replaying = true
  const pending: TerminalChunk[] = []
  const offData = api.onData(key, (c) => {
    if (next < 0) pending.push(c)
    else if (c.seq >= next) follower.chunk(c)
  })
  void api.attach(key).then((b) => {
    // 지난 출력은 그린 크기로 다시 그린다. 모르면 숨은 터미널은 마지막으로 맞춘 크기로
    follower.backlog(b, lastFit, () => {
      replaying = false
    })
    next = b.next
    for (const c of pending) if (c.seq >= next) follower.chunk(c)
    pending.length = 0
  })
  // 지나간 출력을 다시 그리는 동안 xterm이 만든 응답은 보내지 않는다
  const inData = term.onData((d) => {
    if (!replaying) void api.write(key, d)
  })
  const inResize = term.onResize(({ cols, rows }) => {
    if (!follower.following) void api.resize(key, cols, rows)
  })

  const entry: TermEntry = {
    term,
    fit,
    follower,
    dispose: () => {
      offData()
      links.dispose()
      inData.dispose()
      inResize.dispose()
      term.dispose()
    },
  }
  entries.set(key, entry)
  return entry
}

/**
 * 보이는 상태일 때만 맞춘다. 숨긴 탭은 크기가 0이라 맞추면 안 된다. 숨긴 탭은 PTY 크기를 따르고, 지난 출력을 그리는
 * 동안은 그린 크기를 지킨다: 다 그린 뒤에 맞춘다 (I189)
 */
export function fitIfVisible(entry: TermEntry, el: HTMLElement): void {
  if (measurable(el) && !entry.follower.replaying) fitNow(entry.term, entry.fit)
}

// ---------- 파일 열기 (D411) ----------

const OPEN_HINT = 'Ctrl+클릭으로 열기'

/** Work worktree의 글 파일을 [파일] 탭에서 여는 곳 (D491). App이 정한다 */
let filesOpener: ((target: FilesOpenTarget) => void) | null = null

export function setFilesOpener(open: ((target: FilesOpenTarget) => void) | null): void {
  filesOpener = open
}

/** 링크 위에 있는 동안 여는 방법을 알린다 */
function setOpenHint(term: Terminal, on: boolean): void {
  const el = term.element
  if (!el) return
  if (on) el.title = OPEN_HINT
  else el.removeAttribute('title')
}

/**
 * Ctrl(macOS는 Cmd)+클릭만 연다. 그냥 누르기는 포커스와 선택에 쓴다. 주소는 브라우저로, 나머지는 경로로 연다.
 * Work worktree의 글 파일은 [파일] 탭에서 열고, Shift를 더하면 OS 앱으로 연다 (D491)
 */
function openLink(key: string, ev: MouseEvent, target: string): void {
  if (!ev.ctrlKey && !ev.metaKey) return
  if (/^https?:\/\//i.test(target)) {
    window.relay.openExternal(target).catch((e: unknown) => console.warn(e))
    return
  }
  window.relay.terminal
    .open(key, target, ev.shiftKey || !filesOpener)
    .then((files) => {
      if (files) filesOpener?.(files)
    })
    .catch((e: unknown) => console.warn(e))
}

/** 터미널 줄(1부터)의 주소와 있는 파일 경로 */
async function provideLinks(key: string, term: Terminal, y: number): Promise<ILink[]> {
  const { text, cells } = logicalLine(term.buffer.active, y - 1)
  const found = findLinks(text)
  const toLink = (m: LinkMatch): ILink | null => {
    const a = cells[m.start]
    const b = cells[m.end - 1]
    if (!a || !b) return null
    return {
      range: { start: { x: a.x, y: a.y }, end: { x: b.x + b.w - 1, y: b.y } },
      text: m.text,
      activate: (ev, t) => openLink(key, ev, t),
      hover: () => setOpenHint(term, true),
      leave: () => setOpenHint(term, false),
    }
  }
  const out: ILink[] = []
  for (const u of found.urls) {
    const link = toLink(u)
    if (link) out.push(link)
  }
  if (found.paths.length) {
    // 경로를 보지 못해도 주소 링크는 남긴다
    const hits = await window.relay.terminal
      .paths(
        key,
        found.paths.map((tries) => tries.map((m) => m.text)),
      )
      .catch((e: unknown) => {
        console.warn(e)
        return []
      })
    found.paths.forEach((tries, i) => {
      const hit = hits[i]
      const link = typeof hit === 'number' && tries[hit] ? toLink(tries[hit]) : null
      if (link) out.push(link)
    })
  }
  return out
}

// ---------- 파일과 그림 붙여넣기 (D410) ----------

/**
 * 붙여넣거나 끌어 놓은 파일과 그림을 경로로 넣는다. 글이 있는 붙여넣기는 그대로 xterm이 한다.
 * 디스크에 없는 그림(화면 캡처, 브라우저의 그림)은 main이 저장한 파일의 경로를 넣는다. 구독을 끊는 함수를 돌려준다
 */
export function acceptFiles(key: string, el: HTMLElement, info: AppInfo): () => void {
  const onPaste = (ev: ClipboardEvent) => {
    const data = ev.clipboardData
    if (!data) return
    const files = Array.from(data.files)
    const onDisk = files.some((f) => window.relay.terminal.fileFor(f))
    if (!pastesFiles(data.getData('text/plain'), files.length, onDisk)) return
    ev.preventDefault()
    ev.stopPropagation()
    void insertFiles(key, files, info)
  }
  const onDragOver = (ev: DragEvent) => {
    if (!ev.dataTransfer?.types.includes('Files')) return
    ev.preventDefault()
    ev.dataTransfer.dropEffect = entries.get(key)?.term.options.disableStdin ? 'none' : 'copy'
  }
  const onDrop = (ev: DragEvent) => {
    const files = Array.from(ev.dataTransfer?.files ?? [])
    if (files.length === 0) return
    ev.preventDefault()
    ev.stopPropagation()
    void insertFiles(key, files, info)
  }
  // 붙여넣기는 xterm의 textarea보다 먼저 받는다
  el.addEventListener('paste', onPaste, true)
  el.addEventListener('dragover', onDragOver)
  el.addEventListener('drop', onDrop)
  return () => {
    el.removeEventListener('paste', onPaste, true)
    el.removeEventListener('dragover', onDragOver)
    el.removeEventListener('drop', onDrop)
  }
}

async function insertFiles(key: string, files: File[], info: AppInfo): Promise<void> {
  const term = entries.get(key)?.term
  if (!term || term.options.disableStdin) return
  const api = window.relay.terminal
  const paths: string[] = []
  for (const file of files) {
    let p = api.fileFor(file)
    if (!p && file.type.startsWith('image/')) {
      p = await api.saveImage(await file.arrayBuffer(), file.type).catch((e: unknown) => {
        console.warn(e)
        return ''
      })
    }
    if (p) paths.push(p)
  }
  // 경로마다 따로 붙여넣는다: 엔진은 붙여넣은 글 하나가 그림 경로일 때 그림으로 받는다
  paths.forEach((p, i) => {
    if (i > 0) term.input(' ')
    term.paste(pasteText(p, info.platform))
  })
  term.focus()
}
