// 배치 요약 기록. 최근 keep개만 둔다.

export class BatchHistory {
  constructor({ keep = 20 } = {}) {
    if (!(keep >= 1)) throw new Error('keep은 1 이상이어야 합니다')
    this.keep = keep
    this.items = []
  }

  add(summary) {
    this.items.push({
      batch: summary.batch,
      finishedAt: summary.finishedAt,
      durationMs: summary.durationMs,
      counts: { ...summary.counts },
      failed: summary.failed.map((f) => f.jobId),
    })
    if (this.items.length > this.keep) this.items.splice(0, this.items.length - this.keep)
  }

  latest() {
    return this.items[this.items.length - 1]
  }

  find(batch) {
    return this.items.find((i) => i.batch === batch)
  }

  /** 가장 최근부터 거꾸로 세어 연달아 실패가 있었던 배치 수 */
  failureStreak() {
    let n = 0
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].counts.failed === 0) break
      n++
    }
    return n
  }

  /** 작업 id별 실패 횟수 (자주 실패하는 작업 찾기) */
  failureCounts() {
    const counts = {}
    for (const item of this.items) for (const id of item.failed) counts[id] = (counts[id] ?? 0) + 1
    return counts
  }
}
