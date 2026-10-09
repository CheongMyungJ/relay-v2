// review run의 맹검 질문과 비교 (requirements-extraction-flow.md 16.7, 결정 12, AI 결정 112). 앱과 평가 하네스가 함께 쓴다.
// - 검토 대상: 위험 등급(수치, 하드웨어·통신 제약, 동시성, 부재 주장, "전체" 구성, 요구 후보)은 모두, 나머지는 표본(SAMPLE_RATE,
//   주장 ID의 해시로 고르므로 다시 해도 같다). 미확정·충돌·구성·경계·구현 선택은 검토하지 않는다(이미 빈 곳이거나 제약이 아니다).
// - 맹검 질문은 주장 칸(기호, 구성, 이름과 종류)에서 만들고 주장의 값·서술·이유·근거는 주지 않는다. 행동 서술은 서술 그대로
//   주고 반박을 시도하게 한다. 답의 비교는 앱이 한다(16.9): 값은 (수, 단위) 후보로, 구성은 집합으로 견준다.
// 파일을 읽지 않는 순수 함수만 둔다.
import { createHash } from 'node:crypto';

/** review 단위 하나의 질문과 서술 수 상한. 스키마의 필수 키 수와 run 시간을 정한다(결정 36, AI 결정 112) */
export const REVIEW_BATCH = 8;
/** 위험 등급이 아닌 주장 가운데 검토하는 비율 */
export const SAMPLE_RATE = 0.2;

const RISK_AREAS = new Set(['hardware', 'communication', 'concurrency']);
const REVIEWED_SECTIONS = new Set(['quantities', 'requirements', 'constraints', 'absences', 'observations', 'inventory', 'not_found']);

const isAll = (c) => Array.isArray(c) && c.length === 1 && c[0] === 'all';

/**
 * 주장의 위험 등급(결정 12). 위험 등급이 아니면 null, 검토 대상이 아닌 절이면 undefined
 * @param {{ section: string, body: Record<string, any> }} claim
 */
export function riskClass(claim) {
  if (!REVIEWED_SECTIONS.has(claim.section)) return undefined;
  const b = claim.body ?? {};
  if (claim.section === 'quantities') return 'number';
  if (claim.section === 'absences' || claim.section === 'not_found') return 'absence';
  if (claim.section === 'constraints' && RISK_AREAS.has(b.area)) return b.area === 'concurrency' ? 'concurrency' : 'hw_comm';
  if (claim.section === 'requirements') return 'requirement';
  if (isAll(b.configs)) return 'all_configs';
  return null;
}

/** 표본으로 고르는가: 주장 ID의 sha256 앞 8자리를 [0, 1)로 */
export function sampled(id, rate = SAMPLE_RATE) {
  const h = createHash('sha256').update(String(id)).digest('hex').slice(0, 8);
  return parseInt(h, 16) / 0x100000000 < rate;
}

/** 검토할 주장인가(위험 등급이면 모두, 아니면 표본) */
export function wantsReview(claim) {
  const r = riskClass(claim);
  if (r === undefined) return false;
  return r !== null || sampled(claim.id);
}

/** 위험 등급의 차례: 먼저 검토할 것부터(예산이 모자라면 앞의 것이 먼저 돈다) */
const ORDER = ['number', 'absence', 'all_configs', 'hw_comm', 'concurrency', 'requirement'];
export function reviewOrder(claim) {
  const r = riskClass(claim);
  const i = ORDER.indexOf(r ?? '');
  return i < 0 ? ORDER.length : i;
}

/**
 * 검토 묶음을 나눈다: 검토할 주장을 위험 등급 차례(같으면 만든 차례)로 세우고 REVIEW_BATCH개씩
 * @param {{ id: string, section: string, body: object }[]} claims
 */
export function reviewBatches(claims, size = REVIEW_BATCH) {
  const want = claims.filter(wantsReview).map((c, i) => ({ c, i }));
  want.sort((a, b) => reviewOrder(a.c) - reviewOrder(b.c) || a.i - b.i);
  const out = [];
  for (let i = 0; i < want.length; i += size) out.push(want.slice(i, i + size).map((x) => x.c));
  return out;
}

const cfgText = (c) => (Array.isArray(c) && c.length ? c.join(', ') : 'the configurations given');
const one = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/**
 * 주장 하나의 검토 항목: 값 질문(기호가 있는 수치), 구성 질문(survey의 대상), 서술(나머지). 주장의 값·이유·근거는 넣지 않는다
 * @returns {{ kind: 'value' | 'configs' | 'statement', text: string }}
 */
export function reviewItem(claim) {
  const b = claim.body ?? {};
  if (claim.section === 'quantities' && one(b.symbol))
    return {
      kind: 'value',
      text: `In ${cfgText((b.values ?? []).flatMap((v) => v.configs ?? []).filter((x, i, a) => a.indexOf(x) === i))}: what value does \`${one(b.symbol)}\` take, per configuration, with the unit you can derive?`,
    };
  if (claim.section === 'inventory')
    return { kind: 'configs', text: `In which configurations is \`${one(b.name)}\` (${one(b.kind)}) built and reached?` };
  const configs = Array.isArray(b.configs) ? ` [${b.configs.join(', ')}]` : '';
  let text;
  if (claim.section === 'requirements') text = [b.condition, b.behavior, b.result].map(one).filter(Boolean).join(' → ');
  else if (claim.section === 'quantities') text = `\`${one(b.expr)}\` has the value ${(b.values ?? []).map((v) => `${one(v.value)} (${cfgText(v.configs)})`).join('; ')}`;
  else if (claim.section === 'absences') text = one(b.claim);
  else if (claim.section === 'not_found') text = `Not in the repository: ${one(b.what)}`;
  else text = one(b.text ?? b.statement ?? b.claim);
  return { kind: 'statement', text: `(${claim.section})${configs} ${text}` };
}

/**
 * 묶음의 질문(q1..)과 서술(s1..). 같은 주장 목록이면 같은 키다(앱이 반영할 때 다시 만든다)
 * @returns {{ key: string, claim: string, kind: 'value' | 'configs' | 'statement', text: string }[]}
 */
export function reviewItems(claims) {
  let q = 0;
  let s = 0;
  return claims.map((c) => {
    const it = reviewItem(c);
    const key = it.kind === 'statement' ? `s${++s}` : `q${++q}`;
    return { key, claim: c.id, ...it };
  });
}

// ---- 답 비교 (16.9: 맹검 답의 비교는 앱이 한다) ----

/** 단위 키(평가 채점기의 unitKey와 같은 꼴) */
export function unitKey(unit) {
  const u = String(unit ?? '').split(/[(=;,]/)[0].trim().toLowerCase();
  if (!u) return '';
  if (/^(ms|msec|millisecond|milliseconds|밀리초)$/.test(u)) return 'ms';
  if (/^(s|sec|secs|second|seconds|초)$/.test(u)) return 's';
  if (/^(us|µs|microsecond|microseconds)$/.test(u)) return 'us';
  if (/^(hz|hertz)(\s|$)/.test(u)) return 'hz';
  if (/^(khz)$/.test(u)) return 'khz';
  if (/^(mhz)$/.test(u)) return 'mhz';
  if (/^(ticks?|interrupts?|틱)\s*(\/\s*(s|sec|second)|per\s+second)$/.test(u)) return 'hz';
  if (/tick|틱/.test(u)) return 'tick';
  if (/^(bytes?|b)$/.test(u)) return 'byte';
  if (/cycle|사이클/.test(u)) return 'cycle';
  if (/^(count|counts|times|retries|attempts|tries|회|번)$/.test(u)) return 'count';
  return u;
}

const TOKEN =
  /(0x[0-9a-f]+|-?\d+(?:\.\d+)?)\s*((?:ticks?|interrupts?|틱)\s*(?:\/\s*(?:s|sec|second)|per\s+second)|milliseconds?|msec|ms|microseconds?|µs|us|seconds?|secs?|s|ticks?|hertz|khz|mhz|hz|bytes?|cycles?|밀리초|초|틱|사이클|회|번)?(?![A-Za-z0-9])/gi;

/** 값 글의 (수, 단위) 후보. 단위가 없는 수는 declared 단위로 본다. 시간은 ms로, 주파수는 Hz로 바꾼다 */
export function valueCandidates(text, declared = '') {
  const out = [];
  for (const m of String(text ?? '').replace(/,/g, '').matchAll(TOKEN)) {
    let x = m[1].toLowerCase().startsWith('0x') ? parseInt(m[1], 16) : Number(m[1]);
    if (Number.isNaN(x)) continue;
    let key = m[2] ? unitKey(m[2]) : unitKey(declared);
    if (key === 's') [x, key] = [x * 1000, 'ms'];
    else if (key === 'us') [x, key] = [x / 1000, 'ms'];
    else if (key === 'khz') [x, key] = [x * 1e3, 'hz'];
    else if (key === 'mhz') [x, key] = [x * 1e6, 'hz'];
    out.push({ x, key });
  }
  return out;
}

const near = (a, b) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 0.01);

/** 'all'을 확정 구성으로 펼친다 */
const expand = (c, confirmed) => (isAll(c) ? [...confirmed] : Array.isArray(c) ? c : []);

/**
 * 맹검 답을 주장과 견준다(앱의 일, 16.9). agree: 맞음(검토 이력), conflict: 어긋남(상태를 "충돌"로 내림), unanswered: 답이
 * 없거나 견줄 수 없음(이력만)
 * @param {{ section: string, body: Record<string, any> }} claim
 * @param {'value' | 'configs'} kind
 * @param {{ status: string, values?: {configs: string[], value: string}[], configs?: string[] }} answer
 * @param {string[]} confirmed 확정 구성 이름
 * @returns {{ result: 'agree' | 'conflict' | 'unanswered', note: string }}
 */
export function compareAnswer(claim, kind, answer, confirmed) {
  if (!answer || answer.status !== 'answered') return { result: 'unanswered', note: '답하지 못함' };
  if (kind === 'configs') {
    const want = new Set(expand(claim.body?.configs, confirmed));
    const got = new Set(expand(answer.configs, confirmed));
    const missing = [...want].filter((c) => !got.has(c));
    const extra = [...got].filter((c) => !want.has(c));
    if (!missing.length && !extra.length) return { result: 'agree', note: `구성 ${[...want].join(', ') || '없음'}` };
    return { result: 'conflict', note: `주장 [${[...want].join(', ')}], 검토 [${[...got].join(', ')}]` };
  }
  const declared = claim.body?.unit ?? '';
  const pairs = [];
  for (const v of claim.body?.values ?? []) {
    const cs = expand(v.configs, confirmed);
    for (const a of answer.values ?? []) {
      const as = expand(a.configs, confirmed);
      const shared = cs.filter((c) => as.includes(c));
      if (!shared.length && !(cs.length === 0 || as.length === 0)) continue;
      pairs.push({ shared, mine: valueCandidates(v.value, declared), theirs: valueCandidates(a.value, declared) });
    }
  }
  let agree = 0;
  const conflicts = [];
  for (const p of pairs) {
    const keys = [...new Set(p.mine.map((x) => x.key))].filter((k) => p.theirs.some((y) => y.key === k));
    if (!keys.length) continue;
    const ok = keys.some((k) => p.mine.filter((x) => x.key === k).some((x) => p.theirs.filter((y) => y.key === k).some((y) => near(x.x, y.x))));
    if (ok) agree++;
    else conflicts.push(p.shared.join(', ') || '구성 미상');
  }
  if (conflicts.length) return { result: 'conflict', note: `값이 다른 구성: ${conflicts.join('; ')}` };
  if (agree) return { result: 'agree', note: '값이 맞음' };
  return { result: 'unanswered', note: '단위가 달라 견줄 수 없음' };
}

/** 서술의 판정을 검토 상태로(결정 12: 내리기만 한다). 반박 못 함은 상태가 아니라 이력이다 */
export const VERDICT_STATUS = {
  refuted: 'refuted',
  overclaimed: 'overclaim',
  needs_more: 'needs_more',
  not_refuted: null,
};
