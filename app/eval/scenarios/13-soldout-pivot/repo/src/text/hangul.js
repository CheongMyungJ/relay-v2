// 초성 검색: 'ㅌㅂㄹ' → '텀블러'

const CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const CHOSEONG_SET = new Set(CHOSEONG)
const BASE = 0xac00
const LAST = 0xd7a3

// 한글 음절은 초성으로 바꾸고 나머지 글자는 그대로 둔다
export function toChoseong(text) {
  let out = ''
  for (const ch of String(text)) {
    const code = ch.codePointAt(0)
    if (code >= BASE && code <= LAST) out += CHOSEONG[Math.floor((code - BASE) / 588)]
    else out += ch.toLowerCase()
  }
  return out
}

// 초성으로만 된 두 글자 이상 단어인지 (한 글자는 너무 많이 걸려서 뺀다)
export function isChoseongOnly(text) {
  const chars = [...String(text)]
  return chars.length >= 2 && chars.every((ch) => CHOSEONG_SET.has(ch))
}
