// 중앙값
export function median(xs) {
  const s = [...xs].sort()
  return s[Math.floor(s.length / 2)]
}
