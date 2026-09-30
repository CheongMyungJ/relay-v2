// 작업을 concurrency개씩 묶어 동시에 돌린다.

/**
 * @template T, R
 * @param {T[]} items
 * @param {(item: T) => Promise<R>} worker
 * @param {{ concurrency?: number, onChunk?: (p: { start: number, size: number, done: number, total: number }) => void }} [o]
 * @returns {Promise<R[]>}
 */
export async function runPool(items, worker, o = {}) {
  const size = Math.max(1, o.concurrency ?? 1)
  const results = []
  for (let start = 0; start < items.length; start += size) {
    const chunk = items.slice(start, start + size)
    await Promise.all(
      chunk.map(async (item) => {
        const result = await worker(item)
        results.push(result)
      }),
    )
    o.onChunk?.({ start, size: chunk.length, done: results.length, total: items.length })
  }
  return results
}

/** 배열을 n개씩 나눈다 */
export function chunks(items, n) {
  const out = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out
}
