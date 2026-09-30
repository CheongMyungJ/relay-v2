// 글을 n자 안으로 줄인다. 줄였으면 끝에 '…'를 붙이고, 붙인 것까지 n자다
export function truncate(text, n) {
  return text.slice(0, n) + '…'
}
