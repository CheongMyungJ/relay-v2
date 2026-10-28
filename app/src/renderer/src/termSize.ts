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
  /**
   * 지난 출력을 그린 크기로 다시 그린다(크기가 바뀐 자리마다 바꾼다). 크기를 모르면 숨은 터미널은 fallback 크기로
   * 그린다. 다 그리면 done을 부르고, 보이면 화면에 다시 맞춘다(refit)
   */
  backlog(
    b: Pick<TerminalBacklog, 'data' | 'sizes'>,
    fallback: TerminalSize | null,
    done: () => void,
  ): void
  /** 조각을 쓴다. PTY 크기가 바뀐 조각은 앞 조각을 다 그린 뒤에 크기를 맞추고 그린다 */
  chunk(c: TerminalChunk): void
  /** PTY를 따라 xterm 크기를 바꾸는 중이다. 이 크기는 PTY와 main(새 PTY의 크기)에 보내지 않는다 */
  readonly following: boolean
  /** 지난 출력을 그리는 중이다. 그동안 화면에 맞추지 않는다: 다 그린 뒤에 맞춘다 */
  readonly replaying: boolean
}

export function ptyFollower(
  term: SizedTerm,
  opts: { shown: () => boolean; resizePty: (size: TerminalSize) => void; refit: () => void },
): PtyFollower {
  let following = false
  let replaying = false
  let ptySize: TerminalSize | null = null
  const toSize = (size: TerminalSize) => {
    if (sameSize({ cols: term.cols, rows: term.rows }, size)) return
    following = true
    try {
      term.resize(size.cols, size.rows)
    } finally {
      following = false
    }
  }
  const follow = (size: TerminalSize) => {
    const fix = sizeFix({ cols: term.cols, rows: term.rows }, size, opts.shown())
    if (fix === 'pty') opts.resizePty({ cols: term.cols, rows: term.rows })
    else if (fix === 'term') toSize(size)
  }
  return {
    backlog(b, fallback, done) {
      const sizes = b.sizes
      ptySize = sizes.at(-1)?.size ?? null
      replaying = true
      const first = sizes[0]?.size ?? (opts.shown() ? null : fallback)
      if (first) toSize(first)
      if (sizes.length === 0) term.write(b.data)
      sizes.forEach((s, i) => {
        if (i > 0) term.write('', () => toSize(s.size))
        term.write(b.data.slice(i === 0 ? 0 : s.at, sizes[i + 1]?.at ?? b.data.length))
      })
      term.write('', () => {
        replaying = false
        done()
        if (opts.shown()) opts.refit()
      })
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
    get replaying() {
      return replaying
    },
  }
}
