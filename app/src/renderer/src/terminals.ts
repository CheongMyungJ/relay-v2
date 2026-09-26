// 탭마다 xterm 인스턴스를 React 수명주기 밖에서 들고 있는다.
// React가 컴포넌트를 다시 붙여도(StrictMode 포함) 화면과 구독이 끊기지 않게 하려고.
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { AppInfo } from '../../shared/api'

export interface TermEntry {
  term: Terminal
  fit: FitAddon
  started: boolean
  dispose: () => void
}

const entries = new Map<string, TermEntry>()

export function createTerm(id: string, info: AppInfo, onExit: (code: number) => void): TermEntry {
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
    const key = ev.key.toLowerCase()
    if (key === 'v' && !ev.shiftKey) return false
    if (key === 'c' && term.hasSelection()) {
      setTimeout(() => term.clearSelection(), 0)
      return false
    }
    return true
  })

  const offData = api.onData(id, (d) => term.write(d))
  const offExit = api.onExit(id, onExit)
  const inData = term.onData((d) => void api.write(id, d))
  const inResize = term.onResize(({ cols, rows }) => void api.resize(id, cols, rows))

  const entry: TermEntry = {
    term,
    fit,
    started: false,
    dispose: () => {
      offData()
      offExit()
      inData.dispose()
      inResize.dispose()
      term.dispose()
    },
  }
  entries.set(id, entry)
  return entry
}

export function getTerm(id: string): TermEntry | undefined {
  return entries.get(id)
}

export function disposeTerm(id: string): void {
  entries.get(id)?.dispose()
  entries.delete(id)
}

/** 보이는 상태일 때만 맞춘다. 숨긴 탭은 크기가 0이라 맞추면 안 된다 */
export function fitIfVisible(entry: TermEntry, el: HTMLElement): void {
  if (el.clientWidth > 0 && el.clientHeight > 0) entry.fit.fit()
}
