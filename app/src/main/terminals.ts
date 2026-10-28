// task 터미널의 출력 보관 (I14). task는 main이 시작하고 탭은 그 뒤에 붙으므로,
// 붙을 때 지금까지의 출력을 넘겨 준다. 조각마다 seq를 붙여 겹치거나 빠지지 않게 한다.
// 출력을 그린 PTY 크기도 넘긴다: 숨은 탭의 xterm이 같은 크기로 그려야 글자가 엉키지 않는다 (I189)
import type { TerminalBacklog, TerminalChunk, TerminalSize } from '../shared/views'

/** 탭에 다시 보여 줄 최대 분량 (글자 수). 넘으면 앞부분을 버린다. 전체는 pty.log에 있다 */
const MAX_CHARS = 4 * 1024 * 1024

/** 터미널이 없을 때의 지난 출력 */
export function noBacklog(): TerminalBacklog {
  return { data: '', next: 0, live: false, sizes: [] }
}

const same = (a: TerminalSize | null, b: TerminalSize | null) =>
  a === b || (!!a && !!b && a.cols === b.cols && a.rows === b.rows)

export class TerminalBuffer {
  private chunks: string[] = []
  /** 조각마다 그린 PTY 크기 (chunks와 같은 차례). PTY를 띄우기 전에 넣은 줄은 null */
  private sizes: (TerminalSize | null)[] = []
  private size = 0
  private seq = 0
  live = true
  /** 지금 PTY의 크기. PTY가 끝나도 남긴다(지난 출력을 그린 크기) */
  private ptySize: TerminalSize | null = null
  /** 마지막으로 보낸 조각의 크기. 크기가 바뀐 조각에만 크기를 붙인다 */
  private sent: TerminalSize | null = null

  /** PTY를 이 크기로 띄웠다 */
  start(size: TerminalSize): void {
    this.live = true
    this.ptySize = { ...size }
  }

  /** PTY 크기를 바꿨다 */
  resized(size: TerminalSize): void {
    this.ptySize = { ...size }
  }

  push(data: string): TerminalChunk {
    const chunk: TerminalChunk = { seq: this.seq++, data }
    if (this.ptySize && !same(this.ptySize, this.sent)) chunk.size = { ...this.ptySize }
    this.sent = this.ptySize
    this.chunks.push(data)
    this.sizes.push(this.ptySize)
    this.size += data.length
    while (this.size > MAX_CHARS && this.chunks.length > 1) {
      this.size -= this.chunks.shift()?.length ?? 0
      this.sizes.shift()
    }
    return chunk
  }

  backlog(): TerminalBacklog {
    const sizes: TerminalBacklog['sizes'] = []
    let at = 0
    let last: TerminalSize | null = null
    this.chunks.forEach((data, i) => {
      const size = this.sizes[i] ?? null
      if (size && !same(size, last)) sizes.push({ at, size: { ...size } })
      if (size) last = size
      at += data.length
    })
    // 출력 없이 크기만 바뀌었으면 끝에 둔다: 이어 오는 조각은 그 크기다
    if (this.ptySize && !same(this.ptySize, last)) sizes.push({ at, size: { ...this.ptySize } })
    return { data: this.chunks.join(''), next: this.seq, live: this.live, sizes }
  }

  /** pty.log로 채운 읽기 전용 보관 (세션이 이 앱에서 돌지 않은 task) */
  static fromLog(text: string): TerminalBuffer {
    const b = new TerminalBuffer()
    b.live = false
    if (text) b.push(text.length > MAX_CHARS ? text.slice(-MAX_CHARS) : text)
    return b
  }
}
