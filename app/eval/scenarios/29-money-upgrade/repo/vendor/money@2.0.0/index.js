// money 2.0.0 — 원 단위 금액 도우미 (vendored). 바뀐 점은 CHANGELOG.md

const MODES = {
  'half-even': (n) => {
    const f = Math.floor(n)
    const d = n - f
    if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1
    return Math.round(n)
  },
  'half-up': (n) => Math.floor(n + 0.5),
  floor: Math.floor,
}

/** 원 단위로 반올림한다. 기본은 half-even(은행가 반올림) */
export function roundWon(n, { mode = 'half-even' } = {}) {
  const f = MODES[mode]
  if (!f) throw new Error(`모르는 반올림 방식: ${mode}`)
  return f(n)
}

/** 12345 → "12,345원". suffix: false면 "12,345" */
export function won(n, { suffix = true } = {}) {
  const s = String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return suffix ? `${s}원` : s
}
