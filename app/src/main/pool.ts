// 살아 있는 세션의 합계 상한과 대기열 (D18, 시나리오 2-6). 모든 Work가 풀 하나를 같이 쓴다.
// 세션을 띄우기 전에 자리를 잡고, 세션이 끝나면 돌려준다. 자리가 없으면 대기열에 넣고, 자리가 나면
// 먼저 들어온 차례로 자리를 잡아 준 뒤 시작을 부른다. 앱을 다시 켜면 대기열은 비어 있다 (D78).
export class SessionPool {
  private used = 0
  private readonly waiting: { key: string; start: () => void }[] = []
  private closed = false

  /** limit는 판정하는 때의 세션 상한이다. 설정을 바꾸면 바로 적용한다 (D73) */
  constructor(private readonly limit: () => number) {}

  /** 쓰고 있는 자리 */
  get live(): number {
    return this.used
  }

  /** 대기열의 키. 먼저 들어온 것이 앞이다 */
  get queued(): string[] {
    return this.waiting.map((w) => w.key)
  }

  /** 자리를 잡는다. 기다리는 task가 있으면 앞지르지 않는다 */
  tryAcquire(): boolean {
    if (this.closed || this.used >= this.limit() || this.waiting.length > 0) return false
    this.used++
    return true
  }

  /** 대기열에 넣는다. 자리가 나면 자리를 잡아 준 뒤 start를 부른다. start는 자리를 쓰거나 돌려줘야 한다 */
  enqueue(key: string, start: () => void): void {
    this.remove(key)
    this.waiting.push({ key, start })
    this.fill()
  }

  /** 대기열에서 뺀다 */
  remove(key: string): void {
    const i = this.waiting.findIndex((w) => w.key === key)
    if (i >= 0) this.waiting.splice(i, 1)
  }

  /** 자리를 돌려주고 기다리는 task를 시작한다 */
  release(): void {
    this.used = Math.max(0, this.used - 1)
    this.fill()
  }

  /** 자리가 나 있으면 기다리는 task를 차례로 시작한다. 상한을 올렸을 때도 부른다 */
  fill(): void {
    while (!this.closed && this.used < this.limit()) {
      const next = this.waiting.shift()
      if (!next) return
      this.used++
      next.start()
    }
  }

  /** 앱을 끝낸다. 더는 시작하지 않는다 */
  close(): void {
    this.closed = true
    this.waiting.length = 0
  }
}
