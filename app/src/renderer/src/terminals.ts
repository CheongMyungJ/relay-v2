// task마다 xterm 인스턴스를 React 수명주기 밖에서 들고 있는다.
// React가 컴포넌트를 다시 붙여도(StrictMode 포함) 화면과 구독이 끊기지 않게 하려고.
// task는 main이 시작하므로 탭은 나중에 붙는다. 붙을 때 지금까지의 출력을 받고, 그 뒤의 조각을 이어 쓴다.
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { AppInfo } from '../../shared/api'
import type { TerminalChunk } from '../../shared/views'

export interface TermEntry {
  term: Terminal
  fit: FitAddon
  dispose: () => void
}

const entries = new Map<string, TermEntry>()

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
    // ConPTY에 맞춘 동작을 켠다 (xterm.d.ts windowsPty)
    windowsPty: info.windowsBuild
      ? { backend: 'conpty', buildNumber: info.windowsBuild }
      : undefined,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)

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

  // 붙기 전에 온 조각은 모았다가, 지금까지의 출력 뒤에 이어 쓴다 (seq로 겹침을 뺀다)
  let next = -1
  let replaying = true
  const pending: TerminalChunk[] = []
  const offData = api.onData(key, (c) => {
    if (next < 0) pending.push(c)
    else if (c.seq >= next) term.write(c.data)
  })
  void api.attach(key).then((b) => {
    term.write(b.data, () => {
      replaying = false
    })
    next = b.next
    for (const c of pending) if (c.seq >= next) term.write(c.data)
    pending.length = 0
  })
  // 지나간 출력을 다시 그리는 동안 xterm이 만든 응답은 보내지 않는다
  const inData = term.onData((d) => {
    if (!replaying) void api.write(key, d)
  })
  const inResize = term.onResize(({ cols, rows }) => void api.resize(key, cols, rows))

  const entry: TermEntry = {
    term,
    fit,
    dispose: () => {
      offData()
      inData.dispose()
      inResize.dispose()
      term.dispose()
    },
  }
  entries.set(key, entry)
  return entry
}

/** 보이는 상태일 때만 맞춘다. 숨긴 탭은 크기가 0이라 맞추면 안 된다 */
export function fitIfVisible(entry: TermEntry, el: HTMLElement): void {
  if (el.clientWidth > 0 && el.clientHeight > 0) entry.fit.fit()
}
