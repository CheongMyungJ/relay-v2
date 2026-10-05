// relay 스킬 정적 검증 (docs/design.md 5.6).
// 모델을 부르지 않는다. 실행: cd skills && npm install && npm run check
//
// 1. 머리글: disable-model-invocation: true, description 있음, name 없음 (D33)
// 2. 크기: SKILL.md + _common.md. Claude Code 어림(글자 수 / 4)으로 판정, 모델 토큰 어림은 참고 (D31, D95)
// 3. 템플릿: 주석 단 템플릿에 값을 채운 예시가 docs/contracts 스키마를 통과하는지 (D87). intent 초안은 머리글이 없다 (D236)
// 4. 설계 대조: 산출물 템플릿의 절 제목, 입력·결정 지점·사람이 정할 결정·완료조건 항목 (5.6.1~5.6.11, I60, I65, I89)
// 5. 유형별 조립: 공용 스킬의 유형 표시, 조립한 글에 다른 유형의 산출물이 없음 (D279, I68)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES, assemble } from './assemble.mjs';
import { CHECK_METHOD } from './check-method.mjs';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

const SIZE_TARGET = 5000; // D31
const SKILLS = ['work-start', 'fix', 'design', 'implement', 'refactor', 'execute', 'verify', 'pr-respond'];

// 업무 유형(D232, D258, D302)과 유형마다 조립하는 공용 스킬(D279)
const SHARED = ['work-start', 'verify', 'pr-respond'];

const design = read('docs/design.md');
const common = read('skills/_common.md');
// 스킬 원본(유형 표시 포함, 공통 규칙을 붙이기 전)
const skills = Object.fromEntries(SKILLS.map((s) => [s, read(`skills/${s}/SKILL.md`)]));

// 에이전트가 받는 스킬 본문: 공용 스킬은 유형마다 하나씩, 나머지는 그 유형 하나다
const OWN_TYPE = { fix: 'bugfix', design: 'feature', implement: 'feature', refactor: 'refactor', execute: 'general' };
const variants = SKILLS.flatMap((name) =>
  (SHARED.includes(name) ? TYPES : [OWN_TYPE[name]]).map((type) => {
    try {
      return { name, type, label: SHARED.includes(name) ? `${name}·${type}` : name, text: assemble(skills[name], type) };
    } catch (e) {
      return { name, type, label: name, text: skills[name], error: e.message };
    }
  }),
);

let failures = 0;
const ok = (msg) => console.log(`  ok    ${msg}`);
const fail = (msg) => { failures++; console.log(`  FAIL  ${msg}`); };
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

// ---------- 도우미 ----------

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  return m ? { data: YAML.parse(m[1]) ?? {}, raw: m[1], body: text.slice(m[0].length) } : null;
}

function codeBlocks(text, lang) {
  const re = new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```', 'gm');
  return [...text.matchAll(re)].map((m) => m[1]);
}

function headings(text) {
  return text.split('\n').filter((l) => /^#{1,2} /.test(l)).map((l) => l.trim());
}

// 설계 문서에서 "#### 5.6.x" 같은 절 하나를 잘라 낸다.
function designSection(prefix) {
  const start = design.indexOf(`\n${prefix}`);
  if (start < 0) throw new Error(`설계 절 없음: ${prefix}`);
  const level = prefix.match(/^#+/)[0].length;
  const lines = design.slice(start + 1).split('\n');
  let fenced = false;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].startsWith('```')) fenced = !fenced;
    const h = !fenced && lines[i].match(/^(#+) /);
    if (h && h[1].length <= level) return lines.slice(0, i).join('\n');
  }
  return lines.join('\n');
}

// "field:  # a | b | c" 형태의 주석에서 허용값을 읽는다.
function commentEnum(templateYaml, field) {
  const line = templateYaml.split('\n').find((l) => l.startsWith(`${field}:`));
  const comment = line?.split('#')[1] ?? '';
  const m = comment.match(/^\s*([\w-]+(?:\s*\|\s*[\w-]+)+)/);
  return m ? m[1].split('|').map((s) => s.trim()) : null;
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// ---------- 1. 머리글 ----------

console.log('\n[1] 머리글 (D33)');
for (const [name, text] of Object.entries(skills)) {
  const fm = frontMatter(text);
  check(fm && fm.data['disable-model-invocation'] === true, `${name}: disable-model-invocation: true`);
  check(fm && typeof fm.data.description === 'string' && fm.data.description.length > 0, `${name}: description 있음`);
  check(fm && !('name' in fm.data), `${name}: name 없음 (배포 폴더 이름 relay-${name}이 명령이 됨)`);
}
check(!/^---\n[\s\S]*?\n---\n/.test(common) || !YAML.parse(common.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? '')?.description,
  '_common.md: 머리글 없음 (SKILL.md 끝에 붙음)');

// ---------- 2. 크기 ----------

console.log(`\n[2] 크기: SKILL.md + _common.md (목표 ${SIZE_TARGET}, D31·D95)`);
const hangul = (s) => (s.match(/[가-힣]/g) ?? []).length;
const rows = [];
for (const { label: name, text } of variants) {
  const merged = `${text.trimEnd()}\n${common}`; // 앱이 SKILL.md 끝에 붙인다 (5.6.3)
  const chars = merged.length;
  const cc = Math.round(chars / 4); // Claude Code 어림 (2.1.283에서 확인)
  const h = hangul(merged);
  const model = h + Math.round((chars - h) / 4); // 참고용 모델 토큰 어림 (기본값)
  rows.push({ skill: name, chars, 'Claude Code 어림': cc, '모델 토큰 어림(참고)': model, 판정: cc <= SIZE_TARGET ? '목표 안' : '목표 초과' });
}
console.table(rows);
const over = rows.filter((r) => r['Claude Code 어림'] > SIZE_TARGET);
if (over.length) console.log(`  WARN  목표 초과: ${over.map((r) => r.skill).join(', ')}. 사람에게 알린다(D31).`);
else ok('모든 스킬이 목표 안');

// ---------- 3. 템플릿과 스키마 (D87) ----------

console.log('\n[3] 템플릿 예시와 스키마 (D87)');
const ajv = new Ajv2020({ allErrors: true, strict: false });
const handoffSchema = JSON.parse(read('docs/contracts/handoff.v1.schema.json'));
const vHandoff = ajv.compile(handoffSchema);
const errs = (v) => (v.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');

// handoff 템플릿 (_common.md)
const handoffTpl = codeBlocks(common, 'yaml').find((b) => b.includes('status:'));
check(!!handoffTpl, '_common.md: handoff 템플릿 있음');
if (handoffTpl) {
  const tplFm = frontMatter(handoffTpl);
  const keys = Object.keys(tplFm.data);
  check(sameSet(keys, Object.keys(handoffSchema.properties)), `handoff 템플릿 필드 = 스키마 필드 (${keys.join(', ')})`);

  const designTpl = codeBlocks(designSection('#### 5.6.2'), 'yaml').find((b) => b.includes('status:'));
  check(designTpl && sameSet(keys, Object.keys(frontMatter(designTpl).data)), 'handoff 템플릿 필드 = 설계 5.6.2 템플릿 필드');

  check(sameSet(commentEnum(tplFm.raw, 'status') ?? [], handoffSchema.properties.status.enum), 'status 주석의 허용값 = 스키마 열거값');
  const byEnum = handoffSchema.properties.decisions.items.properties.by.enum;
  check(byEnum.every((v) => new RegExp(`by: .*\\b${v}\\b`).test(tplFm.raw)), 'decisions 주석에 by 허용값(human | ai)');

  // 템플릿을 그대로 채운 예시: 빈 칸은 status뿐, blocked_reason은 비워 둔다 (D96)
  const awaiting = { ...tplFm.data, status: 'awaiting_approval' };
  awaiting.decisions = [{ what: '빈 배열은 0', why: '요청의 기대 동작', by: 'ai' }];
  check(vHandoff(awaiting), `채운 예시(awaiting_approval, blocked_reason 빈 값) 통과 ${errs(vHandoff)}`);

  const blocked = { ...tplFm.data, status: 'blocked', blocked_reason: '재현에 필요한 운영 로그가 없음' };
  check(vHandoff(blocked), `채운 예시(blocked + blocked_reason) 통과 ${errs(vHandoff)}`);

  const back = { ...awaiting, recommended_next: { node: 'fix', reason: '원인이 틀림' } };
  check(vHandoff(back), `채운 예시(recommended_next 있음) 통과 ${errs(vHandoff)}`);

  // 스키마가 막아야 하는 것
  check(!vHandoff({ ...tplFm.data, status: 'blocked' }), '반례: blocked인데 blocked_reason 빈 값 → 오류');
  check(!vHandoff({ ...tplFm.data, status: null }), '반례: status 빈 값 → 오류');

  // 값을 채운 handoff 예시 (D221): 글 값은 큰따옴표로 감싸고 스키마를 통과한다. 본문은 필수 절 둘을 갖춘다
  const filled = codeBlocks(common, 'yaml').find((b) => b !== handoffTpl && b.includes('status: awaiting_approval'));
  check(!!filled, '_common.md: 값을 채운 handoff 예시 있음');
  if (filled) {
    const fm = frontMatter(filled);
    check(sameSet(Object.keys(fm.data), Object.keys(handoffSchema.properties)), '채운 예시의 필드 = 스키마 필드');
    check(vHandoff(fm.data), `채운 예시가 스키마를 통과 ${errs(vHandoff)}`);
    check(/^## 요약\n[\s\S]*^## 다음 task가 알아야 할 것\n/m.test(fm.body), '채운 예시의 본문에 필수 절 둘');
    // 글 값: decisions의 what·why와 글 목록의 항목
    const texts = fm.raw.split('\n').filter((l) => /^\s*- (?!\w+:)|^\s*(- )?(what|why): /.test(l));
    check(texts.length > 0 && texts.every((l) => /: "[^"]*"$|^\s*- "[^"]*"$/.test(l)), `채운 예시의 글 값은 큰따옴표로 감쌈 (${texts.length}줄)`);
  }
}

// intent 초안 템플릿 (work-start). 머리글이 없다: 유형과 버전은 앱이 의도 승인 때 붙인다 (D236, I58)
// intent 초안 템플릿은 유형마다 조립한 work-start에서 본다 (D279)
for (const v of variants.filter((x) => x.name === 'work-start')) {
  const intentTpl = codeBlocks(v.text, 'markdown').find((b) => b.startsWith('## 목표\n'));
  check(!!intentTpl, `${v.label}: intent.draft.md 템플릿 있음`);
  if (!intentTpl) continue;
  check(!frontMatter(intentTpl), `${v.label}: intent 템플릿에 머리글 없음 (D236)`);

  // 본문 필수 절과 완료조건 줄 (5.2.1)
  const hs = headings(intentTpl);
  for (const h of ['목표', '비목표', '원하는 결과', '완료조건']) check(hs.includes(`## ${h}`), `${v.label}: intent 템플릿 본문 절: ${h}`);
  const cond = intentTpl.split('## 완료조건\n')[1]?.split('\n## ')[0] ?? '';
  const lines = cond.split('\n').filter((l) => l.trim());
  check(lines.length >= 3 && lines.every((l) => l.startsWith('- [ ] ')), `${v.label}: 완료조건 줄이 모두 "- [ ] "로 시작`);
  // 일반은 줄마다 확인 방법을 붙인다 (D305). 앱의 검사(core/validate의 CHECK_METHOD, I86)와 같은 규칙이다
  if (v.type === 'general') check(lines.every((l) => CHECK_METHOD.test(l)), `${v.label}: 완료조건 줄마다 확인 방법 (D305)`);
}

console.log('\n[4] 설계 대조: 산출물 템플릿의 절 제목');
const templateSources = {
  'work-start': ['### 5.3'],
  fix: ['#### 5.6.5'],
  design: ['#### 5.6.8'],
  implement: ['#### 5.6.9'],
  refactor: ['#### 5.6.10'],
  execute: ['#### 5.6.11'],
  verify: ['#### 5.6.6'],
  'pr-respond': ['#### 5.6.7'],
};
// 공용 스킬은 유형마다 조립한 글로 본다 (D279). verify의 pr.md 템플릿은 설계 5.6.6에 유형마다 하나씩 있으므로, 그 유형의
// 템플릿 절은 있어야 하고 다른 유형에만 있는 절은 없어야 한다
const PR_MARK = { bugfix: '## 원인', feature: '## 동작', refactor: '## 목표 구조', general: '## 주요 결정' };
for (const [name, sections] of Object.entries(templateSources)) {
  for (const v of variants.filter((x) => x.name === name)) {
    const skillHeadings = codeBlocks(v.text, 'markdown').flatMap(headings);
    for (const sec of sections) {
      const blocks = codeBlocks(designSection(sec), 'markdown').map((b) => headings(frontMatter(b)?.body ?? b));
      const prOf = (t) => blocks.find((hs) => hs.includes('# PR 제목') && hs.includes(PR_MARK[t]));
      const typed = blocks.some((hs) => hs.includes('# PR 제목')) && SHARED.includes(name);
      const own = typed ? prOf(v.type) ?? [] : [];
      const designHeadings = [...new Set([...blocks.filter((hs) => !typed || !hs.includes('# PR 제목')).flat(), ...own])];
      const missing = designHeadings.filter((h) => !skillHeadings.includes(h));
      check(missing.length === 0, `${v.label}: 설계 ${sec.replace(/#+ /, '')} 템플릿 절 ${designHeadings.length}개 모두 있음${missing.length ? ` (빠짐: ${missing.join(', ')})` : ''}`);
      if (typed) {
        const foreign = TYPES.filter((t) => t !== v.type).flatMap((t) => prOf(t) ?? []).filter((h) => !own.includes(h) && skillHeadings.includes(h));
        check(foreign.length === 0, `${v.label}: 다른 유형의 pr.md 템플릿 절이 없음${foreign.length ? ` (${foreign.join(', ')})` : ''}`);
      }
    }
  }
}

console.log('\n[4] 설계 대조: 명세 항목');
// [설계 근거, 설명, 찾을 문구]. 문구는 스킬 원문의 표현이다. 스킬을 고치면 여기도 맞춘다.
const spec = {
  _common: [
    ['D102', '사람이 읽는 글은 한국어', /Korean/],
    ['5.6.1', '질문 방식 두 가지', /초안 우선[\s\S]*결정마다 확인/],
    ['D24', 'AskUserQuestion으로만 묻기', /Use only the `AskUserQuestion` tool/],
    ['D27', '한 번에 최대 4개', /up to 4 questions/],
    ['D27', '추천 선택지 맨 앞, (추천)', /recommended option first[\s\S]*\(추천\)/],
    ['D28', '사람이 정할 결정은 그 자리에서', /Human decisions are never left as a draft/],
    ['5.6.1', '결과물 확정은 묻지 않음', /Never ask "shall I finalize this\?"/],
    ['5.6.1', '답 기록: 사람 선택 → by: human', /`by: human`/],
    ['5.6.1', '답 기록: 알아서 해 → 추천안, by: ai', /알아서 해[\s\S]*`by: ai`/],
    ['5.6.1', '답 기록: 모름', /모름[\s\S]*`assumptions`[\s\S]*`open_questions`/],
    ['D230', 'open_questions는 물었는데 답이 없는 것만', /`open_questions` holds only questions you asked the human that are still unanswered[\s\S]*the intent already settles/],
    ['5.6.2', '실행하는 때: 완료조건 충족', /completion criteria of this skill are met \| `status: awaiting_approval`/],
    ['5.6.2', '실행하는 때: 진행 불가', /cannot proceed \| `status: blocked`/],
    ['5.6.2', '실행하는 때: 사람의 마무리 요청', /asks you to wrap up/],
    ['5.6.2', '실행하는 때: 수정 요청 반영 뒤 다시', /run the procedure again/],
    ['5.6.2', '순서 1: 산출물 확인', /\*\*Artifacts:\*\*/],
    ['5.6.2', '순서 2: 코드 단계는 커밋, 그 밖은 실험 변경 되돌림', /commit all changes[\s\S]*revert the experimental changes[\s\S]*Do not touch files the human changed/],
    ['D29', '순서 3: handoff 작성 뒤 템플릿과 대조', /compare it with the template/],
    ['5.6.2', '순서 4: 마무리 안내 문구 출력, blocked 안내', /closing message from context\.md verbatim[\s\S]*If `blocked`/],
    ['5.2', 'handoff 본문 필수 절 두 개', /## 요약\n## 다음 task가 알아야 할 것/],
    ['D88', '앱이 아는 값은 쓰지 않음', /Do not add fields for IDs/],
    ['D221', '글 값은 큰따옴표로 감쌈', /Put every text value in double quotes[\s\S]*contains `: `[\s\S]*starts with a backtick/],
    ['D221', '큰따옴표 안의 역슬래시는 \\\\로, 경로는 /로', /`\\\\` for a backslash\. Write paths with `\/`, not `\\`/],
    ['5.2.1', '추가 검사: recommended_next.node', /`recommended_next\.node` is one of the selectable next steps/],
    ['5.2.1', '추가 검사: 필수 산출물', /required artifacts exist in the task directory/],
    ['5.2.1', '추가 검사: intent 초안 절과 완료조건 줄', /`목표`, `비목표`, `원하는 결과`, `완료조건`[\s\S]*`- \[ \] `/],
    ['5.2.1', '추가 검사: pr.md 첫 줄', /first line of `pr\.md` starts with `# `/],
    ['5.2.1', '추가 검사: replies.md의 절 (D190)', /`replies\.md` has one `## <item id>` section with a non-empty reply for each comment item/],
    ['D100', '형식 오류 되돌림: 파일 고침, 판단은 유지, 3~4 다시', /fix the file it names[\s\S]*Do not change your judgments[\s\S]*steps 3 and 4 again/],
  ],
  'work-start': [
    ['5.6.3', '입력: context.md부터 (요청 원문 포함)', /Read it first[\s\S]*request text/],
    ['D40', '되감기: 현재 intent를 출발점으로', /Start from the current intent/],
    ['5.6.4', '코드를 바꾸지 않음', /does not change code/],
    ['5.6.4', '재현·원인 추적 안 함', /Do not reproduce the bug or trace the cause/, ['bugfix']],
    ['D39', '사람 의심 지점 → 추가 의견, 확인 안 됨', /\(사람 추정, 확인 안 됨\)/, ['bugfix']],
    ['5.6.4', '에이전트 가설은 handoff에만', /hypotheses[\s\S]*## 다음 task가 알아야 할 것/],
    ['D36', '결정 지점 두 가지(D227: size 없음), 사람이 정할 결정 없음', /`비목표`[\s\S]*`완료조건`[\s\S]*no human decisions/],
    ['D41', '"모름" → 그럴듯한 값 + open_questions', /모름[\s\S]*most plausible value[\s\S]*`open_questions`/],
    ['D37', '기본 완료조건 세 개', /재현 절차가 더 이상 실패하지 않는다[\s\S]*가 통과한다[\s\S]*기존 테스트를 약화하거나 삭제하지 않는다/, ['bugfix']],
    ['D37', '테스트 명령은 레포에서 찾기, 없으면 이 항목만 뺌', /Find the concrete test command in the repo[\s\S]*no tests/],
    ['5.3', '완료조건에 push/PR 없음', /Never include push or PR/],
    ['D43', '완료조건 세 항목', /## Done when[\s\S]*required sections[\s\S]*verifiable[\s\S]*`open_questions`/],
    ['D227', 'size를 쓰지 않음', /^(?![\s\S]*\bsize\b)/],
    ['D236', '유형은 context.md에서 읽음(사람이 고름)', /Work type \(`업무 유형`\) the human picked/],
    ['D236', '템플릿에 머리글 없음, 앱이 붙임', /No front matter: the app adds the type and version/],
    ['5.6.4', '기능 추가의 설계도 하지 않음', /Do not design the feature\. That is the job of design/, ['feature']],
    ['D238', '유형 불일치: 초안 전에 물음, 바꾸면 blocked, 직접 바꾸지 않음', /Type mismatch[\s\S]*ask before you write the draft[\s\S]*`blocked`[\s\S]*Never change the type yourself/],
    ['D239', '기능 추가 기본 완료조건 세 개', /`- \[ \] <test command>가 통과한다` \/ `- \[ \] 기존 테스트를 약화하거나 삭제하지 않는다` \/ `- \[ \] 완료조건의 각 동작을 확인하는 테스트가 있다`/, ['feature']],
    ['D240', '인수 조건: 밖에서 보이는 동작, "<조건>이면 <결과>", 구현 세부 없음', /behavior seen from outside[\s\S]*"<조건>이면 <결과>"[\s\S]*No implementation details/, ['feature']],
    ['D241', '사람 제안: 반드시면 제약, 아니면 (사람 제안)', /`제약` when it is a must[\s\S]*"\(사람 제안\)"/, ['feature', 'refactor']],
    ['5.6.4', '리팩터링의 계획도 하지 않음', /Do not plan how to reach the structure\. That is the job of refactor/, ['refactor']],
    ['D262', '동작 변경·성능 목표가 섞이면 초안 전에 물음: 비목표로 빼거나 유형 바꿈', /behavior change[\s\S]*performance goal[\s\S]*ask before you write the draft[\s\S]*`비목표`[\s\S]*`blocked`/, ['refactor']],
    ['D263', '레포 밖 공개 인터페이스를 바꾸면 intent에 적음', /Interfaces used outside the repo[\s\S]*write what changes in the intent/, ['refactor']],
    ['D264', '리팩터링 기본 완료조건 네 개', /`- \[ \] <test command>가 통과한다` \/ `- \[ \] 기존 테스트를 약화하거나 삭제하지 않는다` \/ `- \[ \] 바꾼 곳의 지금 동작을 잡는 안전망 테스트가 있고 기준 코드에서도 통과한다` \/ `- \[ \] 레포 밖 공개 인터페이스가 바뀌지 않는다`/, ['refactor']],
    ['D266', '구조 조건: 읽거나 명령으로 확인, 한 줄에 하나, 방법은 쓰지 않음', /structural conditions that can be checked[\s\S]*one per line[\s\S]*Not the order or method/, ['refactor']],
    ['D266', '구조 목표가 막연하면 확인할 수 있는 구조를 물음', /vague[\s\S]*ask for a structure that can be checked/, ['refactor']],
    ['5.6.4', '일반의 계획도 하지 않음', /Do not plan how to do the work\. That is the job of execute/, ['general']],
    ['D241', '일반의 사람 제안: 반드시면 제약, 아니면 (사람 제안)', /`제약` when it is a must[\s\S]*"\(사람 제안\)"[\s\S]*execute decides/, ['general']],
    ['D303', '더 맞는 유형: 초안 전에 알리고 물음, 그대로 감 / 유형 바꿈(blocked)', /better[\s\S]*before you write the draft[\s\S]*keep `general` \/ change the type \(`blocked`\)/, ['general']],
    ['D304', '일반 기본 완료조건 둘', /`- \[ \] <test command>가 통과한다 — 확인: <test command>` \/ `- \[ \] 기존 테스트를 약화하거나 삭제하지 않는다 — 확인: [^`]+`/, ['general']],
    ['D305', '확인 방법: 줄마다, 명령 / 읽을 곳 / 사람, 앱이 검사', /Check method:[\s\S]*every line, the default items included[\s\S]*command to run[\s\S]*place to read[\s\S]*`사람`[\s\S]*app rejects/, ['general']],
    ['D306', '사람은 명령이나 읽을 곳으로 확인할 수 없을 때만', /Use `사람` only when no command and no place to read can check it/, ['general']],
    ['D305', '완료조건: 줄마다 확인 방법', /## Done when[\s\S]*ends with a check method/, ['general']],
  ],
  design: [
    ['5.6.8', '입력: context.md, request.md 경로', /`context\.md`[\s\S]*`request\.md`/],
    ['D254', '현재 코드 위에서 이어서: 코드를 읽고 design.md를 고침, 코드는 그대로', /Continuing on current code[\s\S]*revise `design\.md`\. Leave the code as it is/],
    ['D233', '작은 feature도 거치고 분량만 줄임', /Small features go through this step too/],
    ['D243', '코드를 바꾸지 않음, 실험은 되돌림', /does not change code[\s\S]*Revert any experiment/],
    ['5.6.8', '순서: 시나리오 → 요구사항 → 물음 → 접근과 바뀌는 곳 → 계획', /User scenarios\.[\s\S]*Requirements\.[\s\S]*Ask if needed[\s\S]*Approach and what changes[\s\S]*Implementation plan and test plan/],
    ['5.6.8', '유저 시나리오: 누가 무엇을 어떻게, 내부 기능은 호출하는 코드', /who does what[\s\S]*calling code or the developer/],
    ['D245', '기능 요구사항: 출처, intent에 없으면 물음, 참고용', /\(F1, F2…\)[\s\S]*완료조건 n \/ 설계에서 더함[\s\S]*ask the human[\s\S]*verify judges only the intent's 완료조건/],
    ['D246', '비기능 관점 목록, 해당 없으면 없음', /performance, compatibility and migration, security, error handling, accessibility[\s\S]*"없음"/],
    ['D241', '사람 제안마다 받아들일지와 이유를 접근에', /"\(사람 제안\)"[\s\S]*`접근`/],
    ['D247', '구현 계획: 단계마다 바꿀 것과 요구사항, 테스트할 수 있는 크기', /for each step, what changes and which requirements[\s\S]*small enough to test/],
    ['D239', '테스트 계획: 완료조건의 각 동작이 테스트에 닿음, 못 하면 이유', /Each behavior in the intent's 완료조건 must be covered[\s\S]*write why/],
    ['D23', 'intent와 어긋나면 intent_deviation, 의도 변경은 intake', /`intent_deviation`[\s\S]*`recommended_next` to `intake`/],
    ['5.6.8', '결정 지점: 접근, 바뀌는 곳, 계획의 나눔', /The approach, what changes, and how to split the plan/],
    ['D242', '사람이 정할 결정 셋', /Several options change what is seen from outside[\s\S]*widens the scope, or touches the intent's non-goals or constraints[\s\S]*do not take a human suggestion/],
    ['5.6.8', '완료조건: 일곱 절, 요구사항 출처와 계획, 테스트 계획, 사람 결정, 코드 안 바꿈', /## Done when[\s\S]*seven template sections[\s\S]*source and is in a step[\s\S]*test plan[\s\S]*`decisions`[\s\S]*No code changed/],
  ],
  implement: [
    ['5.6.9', '입력: context.md, design.md', /`context\.md`[\s\S]*`design\.md`/],
    ['6.2', '현재 코드 위에서 이어서', /Continuing on current code/],
    ['D247', '순서: 테스트 먼저 → 구현 전 실패 → 구현 → 통과 → 커밋, 끝나면 테스트 명령', /Write the tests[\s\S]*fail before the change[\s\S]*Implement[\s\S]*pass[\s\S]*Commit[\s\S]*test command/],
    ['D247', '처음부터 통과하는 테스트는 고침, 못 하면 이유와 risks', /passes from the start does not catch the new behavior[\s\S]*`risks`/],
    ['D257', '지금 동작을 지키는 완료조건의 테스트는 구현 전 통과도 됨', /keep the current behavior[\s\S]*may pass before the change/],
    ['D54', '커밋 수 제한 없음, 레포 관례', /any number[\s\S]*commit message convention/],
    ['D56', '기존 테스트 변경 → risks, 변경 요약에 표시', /existing test must change[\s\S]*`risks`[\s\S]*`변경 요약`/],
    ['D57', '테스트 명령 실행, 기준 커밋 실패 구분', /Run tests[\s\S]*also fails at the base commit/],
    ['D248', '작은 어긋남은 정해서 계획과 달라진 점에', /Small departures[\s\S]*`계획과 달라진 점`/],
    ['D248', '설계가 틀리면 recommended_next: design', /`recommended_next` to `design`/],
    ['5.6.9', '결정 지점: 계획이 정하지 않은 구현 세부', /Implementation details the plan does not settle/],
    ['D248', '크게 벗어남 넷', /behavior or interface\) differs from the design[\s\S]*scope widens[\s\S]*different way from `접근`[\s\S]*dependency the design does not have, or change a data format or schema/],
    ['5.6.9', '완료조건: 네 절, 계획 단계, 새 동작 테스트, 물음, 커밋, 테스트 명령', /## Done when[\s\S]*four template sections[\s\S]*Every step of the plan[\s\S]*failed before[\s\S]*and passed after[\s\S]*`decisions`[\s\S]*committed[\s\S]*test command/],
  ],
  refactor: [
    ['5.6.10', '입력: context.md, request.md 경로', /`context\.md`[\s\S]*`request\.md`/],
    ['D278', '현재 코드 위에서 이어서: 안전망 커밋을 다시 만들지 않음', /Continuing on current code[\s\S]*Do not make the safety-net commit again/],
    ['5.6.10', '순서: 계획 → 물음 → 안전망 커밋 → 단계마다 커밋 → 테스트 명령', /Plan\.[\s\S]*Ask if needed[\s\S]*Safety net\.[\s\S]*Steps\.[\s\S]*test command at the end/],
    ['D260', '동작을 바꾸지 않음, 찾은 버그는 고치지 않고 적음', /Do not change behavior[\s\S]*do not fix it[\s\S]*`찾은 버그와 받아들인 차이`[\s\S]*`risks`/],
    ['D268', '기존 테스트가 덮으면 근거와 함께 적고 빈 곳만 새로, 커버리지 도구', /existing tests already cover[\s\S]*reason[\s\S]*only for behavior no test covers[\s\S]*coverage tool/],
    ['D259', '새 안전망은 기준 코드에서 통과, 따로 커밋, 해시를 적음(I64)', /must pass on the base code[\s\S]*safety-net commit hash/],
    ['D271', '안전망을 쓸 수 없으면 묻지 않고 이유를 적고 진행, verify는 판정 불가', /No safety net possible[\s\S]*do not ask[\s\S]*`risks`[\s\S]*판정 불가/],
    ['D263', '레포 안 인터페이스는 바꿀 수 있고 호출부도, 밖은 intent가 정할 때만', /used only inside the repo[\s\S]*callers[\s\S]*used outside the repo[\s\S]*only when the intent says so/],
    ['D265', '기존 테스트는 호출 이름·import·위치·준비 코드만, 기대값과 입력은 바꾸지 않음', /call names, import paths, file location and setup code[\s\S]*Never change their expected values or inputs/],
    ['D269', '안전망 커밋 하나와 단계마다 커밋, 커밋마다 테스트 통과', /one safety-net commit, then one commit per plan step[\s\S]*pass at every commit/],
    ['D57', '테스트 명령 실행, 기준 커밋 실패 구분', /Run tests[\s\S]*also fails at the base commit/],
    ['D23', 'intent와 어긋나면 intent_deviation, 의도 변경은 intake', /`intent_deviation`[\s\S]*`recommended_next` to `intake`/],
    ['5.6.10', '결정 지점: 목표 구조, 계획의 나눔, 새 안전망', /The target structure, how to split the plan, which safety-net tests/],
    ['D267', '사람이 정할 결정: 목표 구조 선택지, 범위·비목표·제약, 사람 제안', /Several target structures[\s\S]*widens the scope, or touches the intent's non-goals or constraints[\s\S]*do not take a human suggestion/],
    ['D270', '동작 차이: 다른 방법 / 받아들임 / 범위에서 뺌, 받아들이면 그 기대값만, by: human', /must change behavior a little[\s\S]*keep the current behavior another way \/ accept the difference \/ drop that part[\s\S]*only that expected value[\s\S]*`by: human`/],
    ['5.6.10', '완료조건: 다섯 절, 안전망, 단계 커밋, 찾은 버그, 사람 결정, 테스트 명령', /## Done when[\s\S]*five template sections[\s\S]*safety net[\s\S]*committed separately[\s\S]*plan step is committed[\s\S]*not fixed[\s\S]*`decisions`[\s\S]*test command/],
  ],
  execute: [
    ['5.6.11', '입력: context.md, request.md 경로', /`context\.md`[\s\S]*`request\.md`/],
    ['D316', '현재 코드 위에서 이어서: 폐기된 execution.md를 읽고 새로 씀', /Continuing on current code[\s\S]*discarded `execution\.md`[\s\S]*new `execution\.md`/],
    ['5.6.11', '순서: 계획 → 물음 → 작업과 커밋 → 자체 확인 → 테스트 명령', /Plan\.[\s\S]*Ask if needed[\s\S]*Do the work and commit[\s\S]*Self-check\.[\s\S]*test command at the end/],
    ['D302', '진행 방식은 execute가 정하고 계획과 decisions에 적음', /How to work[\s\S]*yours to decide[\s\S]*`계획`[\s\S]*`decisions`/],
    ['D307', '동작을 바꾸면 테스트를 더함, 순서 자유, 못 하면 이유와 risks, 기존 테스트 약화 금지', /change how code behaves, add a test[\s\S]*before or after[\s\S]*cannot add one[\s\S]*`risks`[\s\S]*Never weaken or delete existing tests/],
    ['D310', '자체 확인: 확인 방법을 실제로 돌려 표에, 사람은 볼 곳, 비교용', /Self-check:[\s\S]*run each 완료조건's check method for real[\s\S]*`완료조건별 자체 확인`[\s\S]*`확인: 사람`[\s\S]*for comparison/],
    ['D309', '커밋 수 제한 없음, 레포 관례, 모두 커밋, 실험 되돌림', /any number[\s\S]*commit message convention[\s\S]*Commit all changes before you close[\s\S]*Revert experimental changes/],
    ['D57', '테스트 명령 실행, 기준 커밋 실패 구분', /Run tests[\s\S]*also fails at the base commit/],
    ['5.6.11', '범위 밖 문제는 고치지 않고 risks, 고치려면 사람 결정', /outside the scope[\s\S]*do not fix them[\s\S]*`risks`[\s\S]*human decision/],
    ['D23', 'intent와 어긋나면 intent_deviation, 의도 변경은 intake', /`intent_deviation`[\s\S]*`recommended_next` to `intake`/],
    ['5.6.11', '결정 지점: 방식, 나눔, 더할 테스트', /How to do the work, how to split it, which tests to add/],
    ['D308', '사람이 정할 결정 셋', /Several options change what is seen from outside[\s\S]*widens the scope, or touches the intent's non-goals or constraints[\s\S]*do not take a human suggestion/],
    ['5.6.11', '완료조건: 네 절, 자체 확인, 테스트, 커밋, 사람 결정, 테스트 명령', /## Done when[\s\S]*four template sections[\s\S]*check method[\s\S]*has a test, or the reason[\s\S]*committed[\s\S]*`decisions`[\s\S]*test command/],
  ],
  fix: [
    ['5.6.5', '입력: context.md, request.md 경로', /`context\.md`[\s\S]*`request\.md`/],
    ['D97', '기준 커밋은 context.md', /base commit[\s\S]*base commit \(from `context\.md`\)/],
    ['6.2', '현재 코드 위에서 이어서', /Continuing on current code/],
    ['D228', '순서: 재현 → 원인 → 필요하면 물음 → 수정', /Reproduce\.[\s\S]*Find the cause\.[\s\S]*Ask if needed[\s\S]*Fix/],
    ['D49', '원인은 재현/비재현 조건 모두 설명, 실험 또는 assumptions', /reproduces and those where it does not[\s\S]*experiment[\s\S]*`assumptions`/],
    ['D48', '사람 추정 판정, 틀리면 rejected', /맞음 \/ 틀림 \/ 판단 불가[\s\S]*`rejected`/],
    ['D53', '재현 테스트: 수정 전 실패, 후 통과, 못 하면 이유', /fails before the fix and passes after[\s\S]*`risks`/],
    ['D54', '커밋 수 제한 없음, 레포 관례', /any number[\s\S]*commit message convention/],
    ['D56', '기존 테스트 변경 → risks, 변경 요약에 표시', /existing test must change[\s\S]*`risks`[\s\S]*`변경 요약`/],
    ['D57', '테스트 명령 실행, 기준 커밋 실패 구분', /Run tests[\s\S]*also fails at the base commit/],
    ['5.6.5', '결정 지점: 재현 방법과 구현 방식', /How to reproduce, and how to implement the fix/],
    ['D45', '재현 안 될 때 세 선택지', /does not reproduce[\s\S]*try again[\s\S]*without reproduction[\s\S]*`blocked`/],
    ['D50', '원인을 좁히지 못할 때 세 선택지', /cannot narrow the cause[\s\S]*investigate more[\s\S]*most likely candidate[\s\S]*`blocked`/],
    ['D228', '동작이 달라지는 수정 방향이 여럿이면 물음', /fix directions differ in behavior/],
    ['D51', '범위 확대·비목표/제약 → 사람 결정', /widens the scope, or touches the intent's non-goals or constraints/],
    ['D228', '그 밖에는 묻지 않고 정함', /In any other case, decide the fix yourself/],
    ['5.6.2', '코드를 바꾸는 단계: 모두 커밋', /Commit all changes before you close/],
    ['5.6.5', '완료조건: 다섯 절, 재현 또는 질문, 원인 또는 질문, 추정 판정, 커밋, 재현 테스트, 테스트 명령', /## Done when[\s\S]*five template sections[\s\S]*reproduced[\s\S]*unnarrowed cause[\s\S]*suspicion is judged[\s\S]*committed[\s\S]*fails before[\s\S]*test command/],
  ],
  verify: [
    ['5.6.6', '입력: context.md, fix.md', /`context\.md`[\s\S]*`fix\.md`/, ['bugfix']],
    ['D97', '리뷰 대상: 기준 커밋(context.md)부터 지금까지의 변경', /base commit \(from `context\.md`\) to now/],
    ['D229', '순서: 리뷰 → 지적 고르기 → 반영 → 검증 → pr.md', /Review\.[\s\S]*Pick findings[\s\S]*Apply[\s\S]*Verify[\s\S]*`pr\.md`/],
    ['D229', '리뷰 지적은 verification.md에 쓴다(review.md 없음)', /`## 리뷰 지적` of `verification\.md`/],
    ['D164', '번호 붙인 지적(심각도, 파일과 줄, 문제와 제안), 없으면 없음', /numbered item[\s\S]*차단 \/ 권장 \/ 사소[\s\S]*file and line[\s\S]*"없음"/],
    ['D165', '반영 뒤 리뷰를 다시 돌리지 않음', /Do not review again/],
    ['5.6.6', '보는 것: 목표·비목표, 원인과 맞는지, 빠진 경우와 경계 조건, 테스트, 관례와 읽기 쉬움, 필요 없는 변경', /`목표` and `비목표`[\s\S]*cause in `fix\.md`[\s\S]*edge conditions[\s\S]*tests[\s\S]*conventions and readability[\s\S]*not needed/, ['bugfix']],
    ['D195', '재현 절차가 쓰는 코드는 바꾸지 않음. 바꿔야 하면 달라진 절차를 반영 절에', /do not change code that they use[\s\S]*`반영`[\s\S]*steps change/, ['bugfix']],
    ['5.6.6', '코드: 사람이 고른 지적만, 바꿨으면 커밋', /change code only for the findings the human picked[\s\S]*Commit/],
    ['D58', '모든 완료조건을 직접 다시 실행', /Re-run everything yourself[\s\S]*only for comparison/],
    ['D59', '판정 값 셋, 판정 불가 이유', /통과 \/ 실패 \/ 판정 불가[\s\S]*give the reason/],
    ['D45', '재현 없이 진행한 Work는 판정 불가', /without reproduction[\s\S]*판정 불가/, ['bugfix']],
    ['D65', '재현 절차도 재현 테스트도 없으면 판정 불가', /neither reproduction steps nor a reproduction test, it is 판정 불가/, ['bugfix']],
    ['D60', '기준 커밋과 비교한 테스트 파일 모두 판정', /changed since the base commit[\s\S]*약화 아님[\s\S]*약화 의심/],
    ['D229', '반영할 지적은 그 자리에서 질문으로 고름, 번호 입력도 받음, decisions by: human', /Which findings to apply[\s\S]*차단·권장만 반영 \/ 모두 반영 \/ 반영하지 않음[\s\S]*type the numbers[\s\S]*`by: human`/],
    ['D60', '약화 의심 → 사람 결정', /looks like weakening[\s\S]*통과[\s\S]*실패/],
    ['D61', '실패·판정 불가 → 되돌아가기 / 이대로', /Any 실패 or 판정 불가[\s\S]*`recommended_next`[\s\S]*`recommended_next: null`/],
    ['5.6.6', '이전 단계 추천: fix', /`recommended_next` to `fix`/, ['bugfix']],
    ['5.6.6', '결정 지점: 고른 지적의 수정 방식, 판정', /How to fix a picked finding, and the verdict of each 완료조건/],
    ['D62', 'pr.md 첫 줄 # 제목', /first line is `# <PR title>`/],
    ['D101', 'pr.md 언어는 레포 관례, PR 템플릿 따르기', /language the repo uses[\s\S]*PR template/],
    ['5.6.6', '완료조건: 여섯 절, 지적 반영, 판정, 테스트 파일, pr.md, 질문', /## Done when[\s\S]*six template sections[\s\S]*picked[\s\S]*verdict and evidence[\s\S]*test file is judged[\s\S]*`pr\.md` is written[\s\S]*`decisions`/],
    ['D253', '기능 추가 입력: design.md와 implement.md (fix.md와 재현 규칙 없음)', /`design\.md` and `implement\.md` at the paths in `context\.md`/, ['feature']],
    ['D245', '기능 추가 리뷰: 설계와 맞는지, 달라진 점, 새 동작 테스트. 설계의 요구사항은 판정 안 하고 지적으로', /fit the user scenarios, requirements and approach[\s\S]*`계획과 달라진 점`[\s\S]*Do not judge requirements added in the design[\s\S]*finding[\s\S]*new behavior tests really catch/, ['feature']],
    ['D251', '새 동작 테스트 항목: 있는지, 동작을 확인하는지, 직접 실행, 구현 전은 implement.md, 없으면 판정 불가', /완료조건의 각 동작을 확인하는 테스트가 있다[\s\S]*really checks that behavior[\s\S]*run it yourself[\s\S]*`implement\.md`[\s\S]*판정 불가/, ['feature']],
    ['D253', '기능 추가 이전 단계 추천: 구현이면 implement, 설계면 design', /`implement` if the implementation is wrong, `design` if the design is wrong/, ['feature']],
    ['D252', '기능 추가 pr.md: 요약 / 동작 / 주요 설계 결정 / 변경 / 테스트', /## 요약\n## 동작\n## 주요 설계 결정\n## 변경\n## 테스트/, ['feature']],
    ['D275', '리팩터링 입력: refactor.md (fix.md와 재현 규칙 없음)', /`refactor\.md` at the path in `context\.md`/, ['refactor']],
    ['D275', '리팩터링 리뷰: 로직 변경 없음, 받아들이지 않은 동작 변경은 차단, 구조 목표, 범위', /logic change[\s\S]*did not accept is a 차단 finding[\s\S]*structural goals[\s\S]*scope grow/, ['refactor']],
    ['D273', '안전망 항목: 같은 worktree에서 안전망 커밋 체크아웃(I64), 마지막 코드에서도, 둘 다 통과, 없으면 판정 불가, 브랜치 확인', /same worktree[\s\S]*safety-net commit[\s\S]*final code too[\s\S]*only if both pass[\s\S]*판정 불가[\s\S]*`git branch --show-current`/, ['refactor']],
    ['D264', '공개 인터페이스 항목: diff로 판정, intent가 정한 것은 뺌', /used outside the repo changed[\s\S]*Leave out what the intent says to change/, ['refactor']],
    ['D265', '따라 고친 기존 테스트는 약화 아님, 기대값·입력 변경이나 삭제는 물음', /followed an internal interface change[\s\S]*약화 아님[\s\S]*expected values or inputs changed[\s\S]*ask/, ['refactor']],
    ['D275', '리팩터링 이전 단계 추천: 변경이면 refactor, 의도면 intake', /`refactor` if the change is wrong, `intake` if the intent is wrong/, ['refactor']],
    ['D274', '리팩터링 pr.md: 요약 / 목표 구조 / 동작 보존 / 변경 / 찾은 버그 / 테스트', /## 요약\n## 목표 구조\n## 동작 보존\n## 변경\n## 찾은 버그\n## 테스트/, ['refactor']],
    ['D314', '일반 입력: execution.md (fix.md와 재현 규칙 없음)', /`execution\.md` at the path in `context\.md`/, ['general']],
    ['D314', '일반 리뷰: 계획과 맞는지, 범위, 확인 방법이 제대로 확인하는지, 동작을 바꾼 곳의 테스트와 이유', /fit the plan in `execution\.md`[\s\S]*scope grow[\s\S]*check method[\s\S]*really check it[\s\S]*change in code behavior have a test[\s\S]*reason/, ['general']],
    ['D312', '확인 방법을 먼저 직접 실행, 부족하면 보완해 판정하고 근거에 둘 다, 남은 위험, intent는 그대로', /run the method at the end of each 완료조건 line yourself[\s\S]*add your own check[\s\S]*write both in the evidence[\s\S]*`남은 위험`[\s\S]*Do not change the intent/, ['general']],
    ['D311', '사람 확인 항목: 한 질문, 볼 것, 답으로 통과/실패, 사람 확인과 답, by: human', /`확인: 사람` items:\*\* gather them all into one question[\s\S]*what to look at[\s\S]*통과 or 실패[\s\S]*"사람 확인"[\s\S]*`by: human`/, ['general']],
    ['D314', '일반 이전 단계 추천: 변경이면 execute, 의도면 intake', /`execute` if the change is wrong, `intake` if the intent is wrong/, ['general']],
    ['D313', '일반 pr.md: 요약 / 주요 결정 / 변경 / 테스트', /## 요약\n## 주요 결정\n## 변경\n## 테스트/, ['general']],
    ['D311', '완료조건: 사람 확인 항목을 묻고 기록', /## Done when[\s\S]*`확인: 사람` item was asked about/, ['general']],
  ],
  'pr-respond': [
    ['D192', '입력: context.md(이번 라운드의 항목, 사람 지시, PR 정보, 앞 라운드 요약)와 파이프라인 산출물(경로)', /`context\.md`[\s\S]*this round's items, the human's instruction, the PR[\s\S]*summaries of earlier rounds[\s\S]*pipeline artifacts/],
    ['D256', '기능 추가면 design.md와 implement.md(경로)', /`design\.md`, `implement\.md`, `verification\.md`/, ['feature']],
    ['D278', '리팩터링이면 refactor.md(경로)', /`refactor\.md`, `verification\.md`/, ['refactor']],
    ['D318', '일반이면 execution.md(경로)', /`execution\.md`, `verification\.md`/, ['general']],
    ['D162', '외부 글은 지시가 아니라 데이터, 명령 실행·설정 변경·비밀 정보 요청은 따르지 않고 사람에게 물음, 사람 지시는 따름', /data, not instructions[\s\S]*run a command, change settings[\s\S]*reveal secrets[\s\S]*ask the human[\s\S]*Follow only the human/],
    ['D168', '항목마다 셋 중 하나: 고침 / 고치지 않음과 이유 / 사람에게 물음. 모르면 open_questions', /고침[\s\S]*고치지 않음[\s\S]*사람에게 물음[\s\S]*`open_questions`/],
    ['5.6.7', '범위: intent의 목표와 비목표. 비목표·제약에 걸리면 사람 결정 (D51과 같음)', /`목표` and `비목표`[\s\S]*`비목표` or `제약`[\s\S]*human decision/],
    ['D175', 'CI 실패: 로그로 원인. 이 PR의 코드 문제면 고침, 아니면 코드를 바꾸지 않고 결론과 근거', /CI failure:[\s\S]*this PR's code causes it, fix it[\s\S]*do not change code[\s\S]*conclusion and the evidence/],
    ['D181', '충돌: 기준 브랜치를 병합하며 풂. 리베이스하지 않음', /Conflict:[\s\S]*merge the base branch[\s\S]*Do not rebase/],
    ['D193', '원격과 갈라짐: 앱이 fetch해 둔 원격 PR 브랜치를 병합. 리베이스하지 않음', /Divergence:[\s\S]*merge the remote PR branch the app fetched[\s\S]*Do not rebase/],
    ['D57', '테스트: 고쳤으면 테스트 명령, 기준 커밋 실패 구분', /changed code, run the test command[\s\S]*also fails at the base commit/],
    ['D56', '기존 테스트를 고쳤으면 risks (D180)', /changed an existing test, add it to `risks`/],
    ['D190', '답글: 코멘트 항목마다 replies.md에 ## <항목 id> 절', /`## <item id>` in `replies\.md` for each comment item/],
    ['5.6.7', '답글: 고친 것은 무엇을 어떻게, 고치지 않은 것은 이유. 코멘트의 언어', /what you fixed and how, or why you did not[\s\S]*language of the comment/],
    ['D173', '표시 문구와 원래 코멘트 링크는 앱이 붙이므로 쓰지 않음 (D207)', /Do not write a signature or a link[\s\S]*the app adds them/],
    ['D15', '코드를 바꾸는 단계: 모두 커밋, push하지 않음(앱이 함)', /this step changes code\. Commit all changes[\s\S]*Do not push/],
    ['D188', 'recommended_next는 늘 null', /`recommended_next`:\*\* always null/],
    ['5.6.7', '결정 지점: 항목마다 고칠지와 방식. 결정마다 확인이면 코드 전에 물음', /Whether and how to fix each item[\s\S]*결정마다 확인, ask before you change code/],
    ['5.6.7', '완료조건: 셋 중 하나 또는 open_questions, 코멘트 항목마다 답글, 커밋과 테스트 결과', /## Done when[\s\S]*settled as one of the three[\s\S]*has a reply in `replies\.md`[\s\S]*committed[\s\S]*test command/],
  ],
};
// 항목의 넷째 값은 유형 목록이다. 공용 스킬에서 없으면 모든 유형에, 있으면 그 유형의 조립 결과에 있어야 한다 (D279)
for (const [name, items] of Object.entries(spec)) {
  for (const [ref, desc, re, types] of items) {
    if (name === '_common') check(re.test(common), `${name}: ${desc} (${ref})`);
    else if (!SHARED.includes(name)) check(re.test(variants.find((v) => v.name === name).text), `${name}: ${desc} (${ref})`);
    else {
      const want = types ?? TYPES;
      const miss = want.filter((t) => !re.test(variants.find((v) => v.name === name && v.type === t).text));
      check(miss.length === 0, `${name}${types ? `·${types.join('·')}` : ''}: ${desc} (${ref})${miss.length ? ` (빠진 유형: ${miss.join(', ')})` : ''}`);
    }
  }
}

console.log('\n[5] 유형별 조립 (D279)');
for (const v of variants) {
  check(!v.error, `${v.label}: 유형 표시가 맞음${v.error ? ` (${v.error})` : ''}`);
  if (!SHARED.includes(v.name)) check(!/<!-- \/?type/.test(skills[v.name]), `${v.name}: 한 유형의 스킬에는 유형 표시가 없음`);
}
check(!/<!-- \/?type/.test(common), '_common.md: 유형 표시가 없음 (모든 유형 공통)');
// 산출물 이름으로 다른 유형의 글이 섞이지 않았는지 본다. work-start는 유형 불일치 질문(D238)에 네 유형을 말하므로 산출물만 본다
const ARTIFACT = { bugfix: ['`fix.md`'], feature: ['`design.md`', '`implement.md`'], refactor: ['`refactor.md`'], general: ['`execution.md`'] };
for (const v of variants.filter((x) => SHARED.includes(x.name))) {
  const foreign = TYPES.filter((t) => t !== v.type).flatMap((t) => ARTIFACT[t]).filter((a) => v.text.includes(a));
  check(foreign.length === 0, `${v.label}: 다른 유형의 산출물이 없음${foreign.length ? ` (${foreign.join(', ')})` : ''}`);
}

console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과');
process.exit(failures ? 1 : 0);
