// 검색용 문자열 정규화: 전각/반각 통일, 소문자, 기호 제거, 공백 정리

export function normalize(text) {
  if (text == null) return ''
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// 한글 음절이 들어 있는지
export function hasHangul(text) {
  return /[가-힣]/.test(text)
}
