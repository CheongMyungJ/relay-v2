// 내부에서 쓰는 식별자. 순서대로 늘어나서 로그와 시험에서 읽기 쉽다.

export function createIdGenerator(prefix) {
  let seq = 0
  return () => `${prefix}-${String(++seq).padStart(6, '0')}`
}

export function shortHash(text) {
  // FNV-1a 32비트. 암호용이 아니라 로그에서 값을 짧게 보여 주는 용도
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
