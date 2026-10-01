// 공용 스킬의 유형별 조립 (docs/design.md D279). skills/check.mjs가 쓰고, 앱의 selectType(app/src/adapters/claude.ts)과
// 같은 결과인지 app/test/adapters/store.test.ts가 비교한다 (I68, PR #24 리뷰).
//
// `<!-- type: a b -->` 줄과 `<!-- /type -->` 줄 사이는 적힌 유형에만 남고, 표시 줄은 지운다. 표시 밖은 모든 유형에 남는다.
// 표시처럼 보이지만 모양이 다른 줄(`<!--type: x-->`, 대문자, 끝 공백 등), 모르는 유형, 겹침, 짝 없음은 오류다.

export const TYPES = ['bugfix', 'feature', 'refactor'];

const OPEN = /^<!-- type: ([a-z]+(?: [a-z]+)*) -->$/;
const CLOSE = '<!-- /type -->';
const LOOKS_LIKE = /^\s*<!--\s*\/?\s*type\b/i;

export function assemble(text, type) {
  const out = [];
  let open = null;
  for (const [i, line] of text.replace(/\r\n?/g, '\n').split('\n').entries()) {
    const m = OPEN.exec(line);
    if (m) {
      if (open) throw new Error(`유형 표시가 겹침 (${i + 1}행)`);
      const types = m[1].split(' ');
      const unknown = types.filter((t) => !TYPES.includes(t));
      if (unknown.length) throw new Error(`유형 표시에 모르는 유형: ${unknown.join(', ')} (${i + 1}행)`);
      open = types;
    } else if (line === CLOSE) {
      if (!open) throw new Error(`유형 표시 닫기에 짝이 없음 (${i + 1}행)`);
      open = null;
    } else if (LOOKS_LIKE.test(line)) {
      throw new Error(`유형 표시의 모양이 틀림: ${line.trim()} (${i + 1}행)`);
    } else if (!open || open.includes(type)) out.push(line);
  }
  if (open) throw new Error('유형 표시가 닫히지 않음');
  return out.join('\n');
}
