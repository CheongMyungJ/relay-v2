// xterm과 PTY의 크기 맞추기 (I189). 숨은 탭은 크기를 잴 수 없어 xterm이 기본 80x24로 남는데, PTY는 마지막으로 보인
// 터미널의 크기로 돈다. 다른 폭으로 그린 CLI의 다시 그리기(위로 올라가 지우고 다시 씀)가 덜 지워져 글자가 엉키고,
// 보일 때 맞춰도 PTY 크기가 그대로라 CLI가 다시 그리지 않는다. 그래서 숨은 xterm은 PTY 크기를 따른다
import type { TerminalBacklog, TerminalChunk, TerminalSize } from '../../shared/views'

/** 크기를 맞추고 출력을 쓰는 데 쓰는 xterm의 부분 */
export interface SizedTerm {
  readonly cols: number
  readonly rows: number
  resize(cols: number, rows: number): void
  write(data: string, callback?: () => void): void
}

export function sameSize(a: TerminalSize | null | undefined, b: TerminalSize | null | undefined) {
  return !!a && !!b && a.cols === b.cols && a.rows === b.rows
}

/**
 * xterm과 PTY의 크기가 다를 때 맞출 쪽. 보이는 터미널은 화면에 맞춘 xterm이 기준이라 PTY를 바꾸고(`pty`),
 * 숨은 터미널은 xterm을 PTY에 맞춘다(`term`). PTY 크기를 모르거나 같으면 null
 */
export function sizeFix(
  term: TerminalSize,
  pty: TerminalSize | null | undefined,
  shown: boolean,
): 'term' | 'pty' | null {
  if (!pty || sameSize(term, pty)) return null
  return shown ? 'pty' : 'term'
}

export interface PtyFollower {
  /** 지난 출력을 쓴다. PTY 크기를 모르면 fallback 크기로 그린다. done은 다 그린 뒤 부른다 */
  backlog(
    b: Pick<TerminalBacklog, 'data' | 'size'>,
    fallback: TerminalSize | null,
    done: () => void,
  ): void
  /** 조각을 쓴다. PTY 크기가 바뀐 조각은 앞 조각을 다 그린 뒤에 크기를 맞추고 그린다 */
  chunk(c: TerminalChunk): void
  /** PTY를 따라 xterm 크기를 바꾸는 중이다. 이 크기는 PTY와 main(새 PTY의 크기)에 보내지 않는다 */
  readonly following: boolean
}

export function ptyFollower(
  term: SizedTerm,
  opts: { shown: () => boolean; resizePty: (size: TerminalSize) => void },
): PtyFollower {
  let following = false
  let ptySize: TerminalSize | null = null
  const follow = (size: TerminalSize | null | undefined) => {
    const fix = sizeFix({ cols: term.cols, rows: term.rows }, size, opts.shown())
    if (fix === 'pty') opts.resizePty({ cols: term.cols, rows: term.rows })
    if (fix !== 'term' || !size) return
    following = true
    try {
      term.resize(size.cols, size.rows)
    } finally {
      following = false
    }
  }
  return {
    backlog(b, fallback, done) {
      ptySize = b.size ?? null
      follow(b.size ?? fallback)
      term.write(b.data, done)
    },
    chunk(c) {
      if (c.size && !sameSize(c.size, ptySize)) {
        const size = c.size
        ptySize = size
        term.write('', () => follow(size))
      }
      term.write(c.data)
    },
    get following() {
      return following
    },
  }
}
