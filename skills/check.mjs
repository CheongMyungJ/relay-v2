// relay 스킬 정적 검증 (docs/design.md 5.6).
// 모델을 부르지 않는다. 실행: cd skills && npm install && npm run check
//
// 1. 머리글: disable-model-invocation: true, description 있음, name 없음 (D33)
// 2. 크기: SKILL.md + _common.md. Claude Code 어림(글자 수 / 4)으로 판정, 모델 토큰 어림은 참고 (D31, D95)
// 3. 템플릿: 주석 단 템플릿에 값을 채운 예시가 docs/contracts 스키마를 통과하는지 (D87)
// 4. 설계 대조: 산출물 템플릿의 절 제목, 입력·결정 지점·사람이 정할 결정·완료조건 항목 (5.6.1~5.6.8)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import Ajv2020 from 'ajv/dist/2020.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');

const SIZE_TARGET = 5000; // D31
const SKILLS = ['work-start', 'evidence', 'root-cause', 'fix', 'final-verify'];

const design = read('docs/design.md');
const common = read('skills/_common.md');
const skills = Object.fromEntries(SKILLS.map((s) => [s, read(`skills/${s}/SKILL.md`)]));

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
for (const [name, text] of Object.entries(skills)) {
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
const intentSchema = JSON.parse(read('docs/contracts/intent-draft.v1.schema.json'));
const vHandoff = ajv.compile(handoffSchema);
const vIntent = ajv.compile(intentSchema);
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
  awaiting.decisions = [{ what: '크기는 M', why: '재현 방법이 요청에 없음', by: 'ai' }];
  check(vHandoff(awaiting), `채운 예시(awaiting_approval, blocked_reason 빈 값) 통과 ${errs(vHandoff)}`);

  const blocked = { ...tplFm.data, status: 'blocked', blocked_reason: '재현에 필요한 운영 로그가 없음' };
  check(vHandoff(blocked), `채운 예시(blocked + blocked_reason) 통과 ${errs(vHandoff)}`);

  const back = { ...awaiting, recommended_next: { node: 'rca', reason: '원인이 틀림' } };
  check(vHandoff(back), `채운 예시(recommended_next 있음) 통과 ${errs(vHandoff)}`);

  // 스키마가 막아야 하는 것
  check(!vHandoff({ ...tplFm.data, status: 'blocked' }), '반례: blocked인데 blocked_reason 빈 값 → 오류');
  check(!vHandoff({ ...tplFm.data, status: null }), '반례: status 빈 값 → 오류');
}

// intent 초안 템플릿 (work-start)
const intentTpl = codeBlocks(skills['work-start'], 'markdown').find((b) => b.startsWith('---\n'));
check(!!intentTpl, 'work-start: intent.draft.md 템플릿 있음');
if (intentTpl) {
  const fm = frontMatter(intentTpl);
  check(sameSet(Object.keys(fm.data), Object.keys(intentSchema.properties)), `intent 템플릿 필드 = 스키마 필드 (${Object.keys(fm.data).join(', ')})`);
  check(sameSet(commentEnum(fm.raw, 'size') ?? [], intentSchema.properties.size.enum), 'size 주석의 허용값 = 스키마 열거값');
  check(vIntent({ ...fm.data, size: 'M' }), `채운 예시(size: M) 통과 ${errs(vIntent)}`);
  check(!vIntent(fm.data), '반례: size 빈 값 → 오류');

  // 본문 필수 절과 완료조건 줄 (5.2.1)
  const hs = headings(fm.body);
  for (const h of ['목표', '비목표', '원하는 결과', '완료조건']) check(hs.includes(`## ${h}`), `intent 템플릿 본문 절: ${h}`);
  const cond = fm.body.split('## 완료조건\n')[1]?.split('\n## ')[0] ?? '';
  const lines = cond.split('\n').filter((l) => l.trim());
  check(lines.length >= 3 && lines.every((l) => l.startsWith('- [ ] ')), '완료조건 줄이 모두 "- [ ] "로 시작');
}

// ---------- 4. 설계 대조 ----------

console.log('\n[4] 설계 대조: 산출물 템플릿의 절 제목');
const templateSources = {
  'work-start': ['### 5.3'],
  evidence: ['#### 5.6.5'],
  'root-cause': ['#### 5.6.6'],
  fix: ['#### 5.6.7'],
  'final-verify': ['#### 5.6.8'],
};
for (const [name, sections] of Object.entries(templateSources)) {
  const skillHeadings = codeBlocks(skills[name], 'markdown').flatMap(headings);
  for (const sec of sections) {
    const designHeadings = codeBlocks(designSection(sec), 'markdown').flatMap((b) => headings(frontMatter(b)?.body ?? b));
    const missing = designHeadings.filter((h) => !skillHeadings.includes(h));
    check(missing.length === 0, `${name}: 설계 ${sec.replace(/#+ /, '')} 템플릿 절 ${designHeadings.length}개 모두 있음${missing.length ? ` (빠짐: ${missing.join(', ')})` : ''}`);
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
    ['5.2.1', '추가 검사: recommended_next.node', /`recommended_next\.node` is one of the selectable next steps/],
    ['5.2.1', '추가 검사: 필수 산출물', /required artifacts exist in the task directory/],
    ['5.2.1', '추가 검사: intent 초안 절과 완료조건 줄', /`목표`, `비목표`, `원하는 결과`, `완료조건`[\s\S]*`- \[ \] `/],
    ['5.2.1', '추가 검사: pr.md 첫 줄', /first line of `pr\.md` starts with `# `/],
    ['D100', '형식 오류 되돌림: 파일 고침, 판단은 유지, 3~4 다시', /fix the file it names[\s\S]*Do not change your judgments[\s\S]*steps 3 and 4 again/],
  ],
  'work-start': [
    ['5.6.3', '입력: context.md부터 (요청 원문 포함)', /Read it first[\s\S]*request text/],
    ['D40', '되감기: 현재 intent를 출발점으로', /Start from the current intent/],
    ['5.6.4', '코드를 바꾸지 않음', /does not change code/],
    ['5.6.4', '재현·원인 추적 안 함', /Do not reproduce the bug or trace the cause/],
    ['D39', '사람 의심 지점 → 추가 의견, 확인 안 됨', /\(사람 추정, 확인 안 됨\)/],
    ['5.6.4', '에이전트 가설은 handoff에만', /hypotheses[\s\S]*## 다음 task가 알아야 할 것/],
    ['D36', '결정 지점 세 가지, 사람이 정할 결정 없음', /`비목표`[\s\S]*`완료조건`[\s\S]*`size`[\s\S]*no human decisions/],
    ['D41', '"모름" → 그럴듯한 값 + open_questions', /모름[\s\S]*most plausible value[\s\S]*`open_questions`/],
    ['D37', '기본 완료조건 세 개', /재현 절차가 더 이상 실패하지 않는다[\s\S]*가 통과한다[\s\S]*기존 테스트를 약화하거나 삭제하지 않는다/],
    ['D37', '테스트 명령은 레포에서 찾기, 없으면 이 항목만 뺌', /Find the concrete test command in the repo[\s\S]*no tests/],
    ['5.3', '완료조건에 push/PR 없음', /Never include push or PR/],
    ['D42', 'size 근거는 handoff decisions', /rationale in handoff `decisions`/],
    ['D63', 'S 기준 세 가지', /way to reproduce[\s\S]*one place[\s\S]*non-goals or constraints/],
    ['D43', '완료조건 네 항목', /## Done when[\s\S]*required sections[\s\S]*verifiable[\s\S]*`size` is proposed[\s\S]*`open_questions`/],
  ],
  evidence: [
    ['5.6.5', '입력: context.md, request.md 경로', /`context\.md`[\s\S]*`request\.md`/],
    ['D44', '코드를 바꾸지 않음, 재현 테스트는 fix', /does not change code[\s\S]*job of fix/],
    ['5.6.5', '결정 지점: 재현 방법', /How to reproduce/],
    ['D45', '재현 안 될 때 세 선택지', /does not reproduce[\s\S]*try again[\s\S]*without reproduction[\s\S]*`blocked`/],
    ['D46', '관찰만, 사람 추정은 판정 안 함', /Observe only[\s\S]*Do not judge whether the suspicion is true/],
    ['D46', '가설은 handoff에만', /hypotheses[\s\S]*## 다음 task가 알아야 할 것/],
    ['5.6.5', '완료조건: 네 절, 재현 또는 질문, 출처', /## Done when[\s\S]*four template sections[\s\S]*recorded the answer in `decisions`[\s\S]*has a source/],
  ],
  'root-cause': [
    ['5.6.6', '입력: context.md, evidence.md', /`context\.md`[\s\S]*`evidence\.md`/],
    ['5.6.6', '코드를 바꾸지 않음, 임시 변경 되돌림', /does not change code[\s\S]*Revert/],
    ['5.6.6', '결정 지점: 원인, 수정 방향', /Which cause, and the fix direction/],
    ['D49', '재현/비재현 조건 모두 설명, 실험 또는 assumptions', /reproduces and those where it does not[\s\S]*experiment[\s\S]*`assumptions`/],
    ['D48', '사람 추정 판정, 틀리면 rejected', /맞음 \/ 틀림 \/ 판단 불가[\s\S]*`rejected`/],
    ['D50', '원인을 좁히지 못할 때 세 선택지', /cannot narrow the cause[\s\S]*more investigation[\s\S]*most likely candidate[\s\S]*`blocked`/],
    ['D51', '범위 확대·비목표/제약 → 사람 결정', /widens the scope, or touches the intent's non-goals or constraints/],
    ['5.6.6', '완료조건: 다섯 절, 원인 또는 질문, 추정 판정', /## Done when[\s\S]*five template sections[\s\S]*`decisions`[\s\S]*suspicion is judged/],
  ],
  fix: [
    ['5.6.7', '입력: context.md, rca.md, evidence.md', /`context\.md`[\s\S]*`rca\.md`[\s\S]*`evidence\.md`/],
    ['D97', '기준 커밋은 context.md', /base commit[\s\S]*base commit \(from `context\.md`\)/],
    ['6.2', '현재 코드 위에서 이어서', /Continuing on current code/],
    ['D64', 'S: 재현 확인과 원인 → 원인과 재현 절', /S path[\s\S]*`원인과 재현`[\s\S]*replaces `rca와 달라진 점`/],
    ['D66', 'S: 실패하면 evidence/rca 추천, size 안 바꿈', /`recommended_next` to `evidence` or `rca`[\s\S]*Do not change `size`/],
    ['D53', '재현 테스트: 수정 전 실패, 후 통과, 못 하면 이유', /fails before the fix and passes after[\s\S]*`risks`/],
    ['D54', '커밋 수 제한 없음, 레포 관례', /any number[\s\S]*commit message convention/],
    ['D55', 'rca가 틀리면 recommended_next rca', /`recommended_next: \{node: rca, reason\}`[\s\S]*only the fix location differs/],
    ['D56', '기존 테스트 변경 → risks, 변경 요약에 표시', /existing test must change[\s\S]*`risks`[\s\S]*`변경 요약`/],
    ['D57', '테스트 명령 실행, 기준 커밋 실패 구분', /Run tests[\s\S]*also fails at the base commit/],
    ['5.6.7', '결정 지점: 구현 방식', /How to implement within the fix direction/],
    ['5.6.2', '코드를 바꾸는 단계: 모두 커밋', /Commit all changes before you close/],
    ['5.6.7', '완료조건: 네 절, 커밋, 재현 테스트, 테스트 명령', /## Done when[\s\S]*four template sections[\s\S]*committed[\s\S]*fails before[\s\S]*test command/],
  ],
  'final-verify': [
    ['5.6.8', '입력: evidence.md, fix.md, rca.md', /`evidence\.md` and `fix\.md`, and `rca\.md`/],
    ['D65', 'S: 원인과 재현의 재현 절차, 없으면 판정 불가', /S path[\s\S]*`원인과 재현`[\s\S]*판정 불가/],
    ['5.6.8', '코드를 바꾸지 않음', /does not change code/],
    ['D58', '모든 완료조건을 직접 다시 실행', /Re-run everything yourself[\s\S]*only for comparison/],
    ['D59', '판정 값 셋, 판정 불가 이유', /통과 \/ 실패 \/ 판정 불가[\s\S]*give the reason/],
    ['D45', '재현 없이 진행한 Work는 판정 불가', /without reproduction[\s\S]*판정 불가/],
    ['D60', '기준 커밋과 비교한 테스트 파일 모두 판정', /changed since the base commit[\s\S]*약화 아님[\s\S]*약화 의심/],
    ['D60', '약화 의심 → 사람 결정', /looks like weakening[\s\S]*통과[\s\S]*실패/],
    ['D61', '실패·판정 불가 → 되돌아가기 / 이대로', /Any 실패 or 판정 불가[\s\S]*`recommended_next`[\s\S]*`recommended_next: null`/],
    ['5.6.8', '결정 지점: 판정', /The verdict of each 완료조건/],
    ['D62', 'pr.md 첫 줄 # 제목', /first line is `# <PR title>`/],
    ['D101', 'pr.md 언어는 레포 관례, PR 템플릿 따르기', /language the repo uses[\s\S]*PR template/],
    ['5.6.8', '완료조건: 판정, 테스트 파일, pr.md, 질문', /## Done when[\s\S]*verdict and evidence[\s\S]*test file is judged[\s\S]*`pr\.md` is written[\s\S]*`decisions`/],
  ],
};
for (const [name, items] of Object.entries(spec)) {
  const text = name === '_common' ? common : skills[name];
  for (const [ref, desc, re] of items) check(re.test(text), `${name}: ${desc} (${ref})`);
}

console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과');
process.exit(failures ? 1 : 0);
