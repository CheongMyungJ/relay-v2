// 화면 읽기와 첫 실행 창 수락 (I17). 앱에는 넣지 않고 [실제] 시험 도구로만 쓴다.
// 앱은 첫 실행 창을 건드리지 않고 사람이 수락한다(D69). 여기서는 시험 도구가 사람 역할을 한다.
// 출처: spikes/lib/session.mjs (Session.screen, handleDialogs와 판별 규칙)
import headless from '@xterm/headless'
import type { Relay } from '../../src/main/relay'
import type { TerminalChunk } from '../../src/shared/views'
import { FakeUi, sleep } from '../flow/harness'

const { Terminal } = headless
type HeadlessTerminal = InstanceType<typeof Terminal>

// 첫 실행 창 판별. 문구는 Claude Code 버전에 따라 바뀔 수 있으므로 이름 붙이기에만 쓰고,
// 처리는 화면 모양(선택 목록, "Enter를 누르라"는 안내)으로 한다. 출처: spikes/lib/session.mjs
const DIALOG_NAMES = [
  { name: 'bypass_permissions_warning', match: /bypass permissions/i },
  { name: 'folder_trust', match: /trust (the files in )?this folder|do you trust|trust this/i },
  { name: 'api_key_approval', match: /api key/i },
  { name: 'theme_or_onboarding', match: /text style|theme/i },
  { name: 'security_notes', match: /security notes/i },
  { name: 'terminal_setup', match: /terminal setup|shift\s*\+\s*enter/i },
  { name: 'login', match: /select login method|log in|login/i },
]
// 선택 목록의 현재 항목 표시. macOS·Linux는 "❯", Windows 콘솔은 ">"로 그린다. 번호가 없는 목록도 있다.
const NUMBERED_CURSOR = /(?:^|\s)[❯>]\s*\d+\.\s/m
const CONFIRM_HINT = /enter to confirm|esc to cancel/i
const CURSOR_LINE = /^\s*[│|]?\s*[❯>]\s+\S/
// 수락 항목: "Yes", "2. Yes, I accept", "1. Yes, proceed" 등
const ACCEPT_LINE = /^\s*[│|]?\s*(?:[❯>]\s*)?(?:\d+\.\s*)?(yes|i accept|accept|proceed|trust)\b/i
const PRESS_ENTER = /press enter|enter to continue/i
const KEY_UP = '\x1b[A'
const KEY_DOWN = '\x1b[B'

/** 로그와 결과에 API 키가 남지 않게 가린다. 출처: spikes/lib/session.mjs redact */
export function redact(text: string): string {
  return text.replace(/sk-ant-[^\s│]*/g, 'sk-ant-[가림]')
}

/** 받은 터미널 출력을 task마다 xterm headless에 그려 화면 글자를 읽는다 */
export class ScreenUi extends FakeUi {
  private readonly terms = new Map<string, HeadlessTerminal>()
  private readonly handled = new Map<string, { screen: string; at: number }>()
  readonly dialogs: { key: string; name: string; action: string; screen: string }[] = []

  /** 앱이 새 PTY에 쓰는 크기와 같게 둔다 (main/relay의 기본 크기) */
  constructor(private readonly size = { cols: 120, rows: 32 }) {
    super()
  }

  override terminal(key: string, chunk: TerminalChunk): void {
    let t = this.terms.get(key)
    if (!t) {
      t = new Terminal({ ...this.size, allowProposedApi: true, scrollback: 5000 })
      this.terms.set(key, t)
    }
    t.write(chunk.data)
    super.terminal(key, chunk)
  }

  /** 지금 보이는 화면의 글자 */
  screen(key: string): string {
    const t = this.terms.get(key)
    if (!t) return ''
    const buf = t.buffer.active
    const lines: string[] = []
    for (let i = 0; i < t.rows; i++) {
      lines.push(buf.getLine(buf.viewportY + i)?.translateToString(true) ?? '')
    }
    return lines.join('\n')
  }

  /**
   * 보이는 창이 첫 실행 창(선택 목록이나 Enter 안내)이면 수락한다. 수락했으면 true.
   * 선택 목록에 수락 항목이 있으면 화살표로 그 항목까지 옮겨 Enter를 누르고, 없으면 기본 항목에서 Enter를 누른다.
   * 출처: spikes/lib/session.mjs Session.handleDialogs
   */
  async handleDialogs(relay: Relay, key: string): Promise<boolean> {
    const scr = this.screen(key)
    const isSelect = NUMBERED_CURSOR.test(scr) || CONFIRM_HINT.test(scr)
    const isEnter = PRESS_ENTER.test(scr)
    if (!isSelect && !isEnter) return false
    const last = this.handled.get(key)
    if (last && last.screen === scr && Date.now() - last.at < 3000) return false
    const name = DIALOG_NAMES.find((d) => d.match.test(scr))?.name ?? 'unknown'
    const lines = scr.split('\n')
    const cursorIdx = lines.findIndex((l) => CURSOR_LINE.test(l))
    const acceptIdx = isSelect ? lines.findIndex((l) => ACCEPT_LINE.test(l)) : -1
    let action = 'Enter(기본 항목)'
    if (cursorIdx >= 0 && acceptIdx >= 0 && acceptIdx !== cursorIdx) {
      const k = acceptIdx > cursorIdx ? KEY_DOWN : KEY_UP
      for (let i = 0; i < Math.abs(acceptIdx - cursorIdx); i++) {
        relay.terminalWrite(key, k)
        await sleep(300)
      }
      action = `${lines[acceptIdx]?.trim() ?? ''}로 옮겨 Enter`
    } else if (acceptIdx >= 0) {
      action = `${lines[acceptIdx]?.trim() ?? ''}에서 Enter`
    }
    this.dialogs.push({ key, name, action, screen: redact(scr) })
    console.log(`[실제] 첫 실행 창 ${name}: ${action}`)
    await sleep(300)
    relay.terminalWrite(key, '\r')
    this.handled.set(key, { screen: scr, at: Date.now() })
    await sleep(1500)
    return true
  }
}
