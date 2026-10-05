// Claude Code의 첫 실행 창(폴더 신뢰, 권한 우회 경고 등)을 도구가 수락한다. 두 쪽(relay, 맨 CLI)에 똑같이 쓰고
// 사람 역할의 부담에 넣지 않는다. 판별 규칙의 출처: test/claude/screen.ts (spikes/lib/session.mjs).
// 이름을 아는 창만 다룬다. 모르는 선택 목록은 AskUserQuestion일 수 있으므로 사람 역할에게 넘긴다.

const DIALOG_NAMES = [
  { name: 'bypass_permissions_warning', match: /bypass permissions/i },
  { name: 'folder_trust', match: /trust (the files in )?this folder|do you trust|trust this/i },
  { name: 'security_notes', match: /security notes/i },
  { name: 'terminal_setup', match: /terminal setup|shift\s*\+\s*enter/i },
  { name: 'theme_or_onboarding', match: /text style|choose the text style|dark mode/i },
]
const NUMBERED_CURSOR = /(?:^|\s)[❯>]\s*\d+\.\s/m
const CONFIRM_HINT = /enter to confirm|esc to cancel/i
const CURSOR_LINE = /^\s*[│|]?\s*[❯>]\s+\S/
const ACCEPT_LINE = /^\s*[│|]?\s*(?:[❯>]\s*)?(?:\d+\.\s*)?(yes|i accept|accept|proceed|trust)\b/i
const PRESS_ENTER = /press enter|enter to continue/i

/** 화면이 이름을 아는 첫 실행 창이면 누를 키(Up, Down, Enter)를 돌려준다 */
function decideDialog(screen) {
  const isSelect = NUMBERED_CURSOR.test(screen) || CONFIRM_HINT.test(screen)
  const isEnter = PRESS_ENTER.test(screen)
  if (!isSelect && !isEnter) return null
  const name = DIALOG_NAMES.find((d) => d.match.test(screen))?.name
  if (!name) return null
  const lines = screen.split('\n')
  const cursor = lines.findIndex((l) => CURSOR_LINE.test(l))
  const accept = isSelect ? lines.findIndex((l) => ACCEPT_LINE.test(l)) : -1
  const keys = []
  if (cursor >= 0 && accept >= 0 && accept !== cursor) {
    for (let i = 0; i < Math.abs(accept - cursor); i++)
      keys.push(accept > cursor ? 'ArrowDown' : 'ArrowUp')
  }
  keys.push('Enter')
  return { name, keys }
}

/**
 * 같은 창이 1초 넘게 그대로일 때만 누른다. Claude Code는 신뢰 창을 처음 그리고 잠시 뒤 다시 그리며 선택을
 * 기본 항목으로 되돌린다(test/claude/screen.ts의 SETTLE_MS). 같은 창을 3초 안에 두 번 누르지 않는다
 */
export class DialogGuard {
  shown = null
  handled = null

  check(screen, now = Date.now()) {
    const d = decideDialog(screen)
    if (!d) {
      this.shown = null
      return null
    }
    if (this.handled && this.handled.screen === screen && now - this.handled.at < 3000) return null
    if (this.shown?.screen !== screen) {
      this.shown = { screen, at: now }
      return null
    }
    if (now - this.shown.at < 1000) return null
    this.handled = { screen, at: now }
    return d
  }
}
