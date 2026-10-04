// 일반 Work의 완료조건 줄 끝의 확인 방법 (docs/design.md D305). skills/check.mjs가 쓰고, 앱의 같은 규칙
// (app/src/core/validate.ts의 CHECK_METHOD, I86)과 같은지 app/test/unit/validate.test.ts가 비교한다(PR #29 리뷰).
//
// 대시 하나 뒤의 `확인:`이고 그 뒤에 글이 있어야 한다. 긴 대시(—, –)는 앞 글자에 붙여 써도 되고, 하이픈(-, --)은
// 낱말 안에도 나오므로 앞에 공백이 있어야 한다.
export const CHECK_METHOD = /(?:\s*[—–]|\s--?)\s*확인\s*:\s*\S/;
