// task 터미널의 출력 보관 (I14). task는 main이 시작하고 탭은 그 뒤에 붙으므로,
// 붙을 때 지금까지의 출력을 넘겨 준다. 조각마다 seq를 붙여 겹치거나 빠지지 않게 한다.
import type { TerminalBacklog, TerminalChunk } from '../shared/views'

/** 탭에 다시 보여 줄 최대 분량 (글자 수). 넘으면 앞부분을 버린다. 전체는 pty.log에 있다 */
const MAX_CHARS = 4 * 1024 * 1024

export class TerminalBuffer {
  private chunks: string[] = []
  private size = 0
  private seq = 0
  live = true

  push(data: string): TerminalChunk {
    const chunk = { seq: this.seq++, data }
    this.chunks.push(data)
    this.size += data.length
    while (this.size > MAX_CHARS && this.chunks.length > 1) {
      this.size -= this.chunks.shift()?.length ?? 0
    }
    return chunk
  }

  backlog(): TerminalBacklog {
    return { data: this.chunks.join(''), next: this.seq, live: this.live }
  }

  /** pty.log로 채운 읽기 전용 보관 (세션이 이 앱에서 돌지 않은 task) */
  static fromLog(text: string): TerminalBuffer {
    const b = new TerminalBuffer()
    b.live = false
    if (text) b.push(text.length > MAX_CHARS ? text.slice(-MAX_CHARS) : text)
    return b
  }
}
