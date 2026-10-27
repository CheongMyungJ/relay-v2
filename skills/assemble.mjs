// 스킬의 유형별 조립 (docs/design.md D279, 5.6.15). skills/check.mjs가 쓰고, 앱의 조립(app/src/adapters/claude.ts)과
// 같은 결과인지 app/test/adapters/store.test.ts가 비교한다 (I68, PR #24 리뷰). 아래 assemble은 옛 Work의 verify(D501)가 쓰는
// 유형 표시를 고르고, 뒤의 selectFlags·fillSlots·assembleSkill은 유형 설정으로 고르는 지금의 조립이다 (D508).
//
// `<!-- type: a b -->` 줄과 `<!-- /type -->` 줄 사이는 적힌 유형에만 남고, 표시 줄은 지운다. 표시 밖은 모든 유형에 남는다.
// 표시처럼 보이지만 모양이 다른 줄(`<!--type: x-->`, 대문자, 끝 공백 등), 모르는 유형, 겹침, 짝 없음은 오류다.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TYPES = ['bugfix', 'feature', 'refactor', 'spec', 'general', 'custom'];

// 스킬 원본 맨 앞의 머리글(`---`로 감싼 YAML)과 그 뒤의 빈 줄을 뗀다 (docs/design.md D440, D444). 앱의
// stripFrontMatter(app/src/adapters/claude.ts)와 같은 결과인지 app/test/adapters/store.test.ts가 비교한다.
export function stripFrontMatter(text) {
  return text.replace(/\r\n?/g, '\n').replace(/^---\n[\s\S]*?\n---\n+/, '');
}

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

// ---------- 유형 정의와 설정 구간 (docs/design.md 5.6.15, D506~D508) ----------
// 공용 스킬(work-start, pr-respond, _final.md, _review.md, custom)은 유형 이름 대신 유형 설정으로 구간을 고른다:
// `<!-- if: code check-method -->` 줄과 `<!-- /if -->` 줄 사이는 적힌 표시가 모두 있을 때만 남는다. `<!-- slot: 이름 -->` 줄은
// 유형 폴더의 칸 글이 들어가는 자리다. 앱의 selectFlags·fillSlots·skillText(app/src/adapters/claude.ts)와 같은 결과인지
// app/test/adapters/store.test.ts가 비교한다.


export const FLAGS = ['code', 'document', 'check-method', 'no-check-method', 'custom', 'builtin'];
export const SLOTS = ['finish', 'pr-template'];
// 기본 유형 (skills/types/<id>/)
export const BUILTIN = ['bugfix', 'feature', 'refactor', 'spec', 'general'];
// 기본 유형의 단계 (절차 파일 skills/types/<유형>/<단계>.md)
export const STEPS = { bugfix: ['fix'], feature: ['design', 'implement'], refactor: ['refactor'], spec: ['spec'], general: ['execute'] };

const FLAG_OPEN = /^<!-- if: ([a-z-]+(?: [a-z-]+)*) -->$/;
const FLAG_CLOSE = '<!-- /if -->';
const FLAG_LIKE = /^\s*<!--\s*\/?\s*if\b/i;
const SLOT = /^<!-- slot: ([a-z-]+) -->$/;
const SLOT_LIKE = /^\s*<!--\s*slot\b/i;
const lf = (s) => s.replace(/\r\n?/g, '\n');

export function selectFlags(text, flags) {
  const out = [];
  let open = null;
  for (const [i, line] of lf(text).split('\n').entries()) {
    const m = FLAG_OPEN.exec(line);
    if (m) {
      if (open) throw new Error(`설정 구간이 겹침 (${i + 1}행)`);
      const names = m[1].split(' ');
      const unknown = names.filter((f) => !FLAGS.includes(f));
      if (unknown.length) throw new Error(`설정 구간에 모르는 표시: ${unknown.join(', ')} (${i + 1}행)`);
      open = names;
    } else if (line === FLAG_CLOSE) {
      if (!open) throw new Error(`설정 구간 닫기에 짝이 없음 (${i + 1}행)`);
      open = null;
    } else if (FLAG_LIKE.test(line)) {
      throw new Error(`설정 구간의 모양이 틀림: ${line.trim()} (${i + 1}행)`);
    } else if (SLOT_LIKE.test(line) && !SLOT.test(line)) {
      throw new Error(`칸 자리의 모양이 틀림: ${line.trim()} (${i + 1}행)`);
    } else if (!open || open.every((f) => flags.includes(f))) out.push(line);
  }
  if (open) throw new Error('설정 구간이 닫히지 않음');
  return out.join('\n');
}

export function fillSlots(text, slots) {
  return lf(text)
    .split('\n')
    .flatMap((line, i) => {
      const m = SLOT.exec(line);
      if (!m) return [line];
      if (!SLOTS.includes(m[1])) throw new Error(`모르는 칸 자리: ${m[1]} (${i + 1}행)`);
      const body = lf(slots[m[1]] ?? '').trim();
      return body ? [body] : [];
    })
    .join('\n');
}

// 유형의 설정 구간 표시 (app/src/core/builtin-types의 assemblyFlags). 커스텀은 기록에 따라 다르고, 표시를 주지 않으면 1판
// 커스텀 유형(확인 방법을 켠 코드 유형)이다
export function flagsOf(type, def) {
  const d = def ?? (type === 'custom' ? { check_method: true, target: 'code' } : readType(type));
  return [d.target ?? 'code', (d.check_method ?? true) ? 'check-method' : 'no-check-method', type === 'custom' ? 'custom' : 'builtin'];
}

// fileURLToPath: Windows의 드라이브 문자와 경로의 공백·한글을 바르게 읽는다
const skillsDir = dirname(fileURLToPath(import.meta.url));
const readOpt = (p) => (existsSync(p) ? lf(readFileSync(p, 'utf8')) : null);
export function readType(type, root = skillsDir) {
  return JSON.parse(readFileSync(join(root, 'types', type, 'type.json'), 'utf8'));
}

const STEP_SKILLS = ['fix', 'design', 'implement', 'refactor', 'spec', 'execute', 'custom'];
const section = (head, text) => `\n\n${head}\n\n${lf(text).trim()}\n`;
const merge = (a, b) => `${lf(a).trimEnd()}\n${lf(b)}`;

// 앱의 skillText와 같은 조립 (5.6.15). o: { type, typeDir?, step?, flags?, stepBase?, finishing? }. typeDir가 없으면 기본 유형 폴더
export function assembleSkill(skill, o, root = skillsDir) {
  const typeDir = o.typeDir ?? join(root, 'types', o.type);
  const flags = o.flags ?? flagsOf(o.type);
  const common = readFileSync(join(root, '_common.md'), 'utf8');
  let own;
  if (STEP_SKILLS.includes(skill)) {
    const step = o.step ?? (skill === 'custom' ? null : skill);
    if (!step) throw new Error('커스텀 단계의 단계 id가 없음');
    const procedure = readOpt(join(typeDir, `${step}.md`));
    if (procedure === null) throw new Error(`단계의 절차 파일이 없음: ${step}.md`);
    if (skill !== 'custom' || o.stepBase === false) own = procedure;
    else {
      const base = stripFrontMatter(readFileSync(join(root, 'custom', 'SKILL.md'), 'utf8'));
      own = `${selectFlags(base, flags).trimEnd()}${section("## This step's procedure", procedure)}`;
    }
  } else {
    const raw = stripFrontMatter(readFileSync(join(root, skill, 'SKILL.md'), 'utf8'));
    if (skill === 'verify') {
      const body = assemble(raw, o.type);
      const notes = o.type === 'custom' ? readOpt(join(typeDir, 'verify.md')) : null;
      own = notes?.trim() ? `${body.trimEnd()}${section("## This Work type's review points", notes)}` : body;
    } else {
      const body = selectFlags(raw, flags);
      const notes = skill === 'work-start' ? readOpt(join(typeDir, 'intake.md')) : null;
      own = notes?.trim() ? `${body.trimEnd()}${section("## This Work type's intake instructions", notes)}` : body;
    }
  }
  if (!o.finishing) return merge(own, common);
  const final = fillSlots(selectFlags(readFileSync(join(root, '_final.md'), 'utf8'), flags), {
    finish: readOpt(join(typeDir, 'finish.md')) ?? '',
    // 비었거나 빈 줄뿐인 pr-template.md도 없는 것으로 보고 일반 템플릿을 쓴다 (D507)
    'pr-template': readOpt(join(typeDir, 'pr-template.md'))?.trim() || readFileSync(join(root, '_pr-template.md'), 'utf8'),
  });
  return merge(merge(own, final), common);
}
