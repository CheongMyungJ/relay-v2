// 요구사항 추출 extract run의 지시·결과 스키마 조립과 실행 인자 (docs/requirements-extraction-flow.md 16.2, 16.3, 결정 9, 36).
// 앱, skills/check.mjs, 평가 하네스(app/eval/extract)가 이 한 모듈을 함께 써서, 평가에서 잰 판의 바이트와 제품이 넘기는
// 바이트가 같게 한다(16.3). 파일을 읽지 않는 순수 함수만 둔다. 읽기는 load.mjs가 한다.
//
// - 결과 스키마(L4): docs/contracts/extract-<kind>.v0.schema.json(기본 스키마)에서 title·description 같은 주석 키워드를
//   빼고, trace면 렌즈 카드의 점검표 ID를 checklist의 필수 키로 넣는다(결정 36). --json-schema의 argv로 넘긴다.
// - 필드 안내(L3): 기본 스키마의 description과 카드의 점검표 뜻을 렌더링한다(16.2). 영어다(D98).
// - 지시: 층(L1 고정 계약, L2 종류 절차, L2b 렌즈 카드, L3 필드 안내)을 이 차례로 잇는다. 빈 층은 뺀다.
import { createHash } from 'node:crypto';

export const KINDS = ['survey', 'trace', 'integrate', 'review', 'summarize'];
/** 생산 run(16.4): 주장을 내는 종류. 나머지(integrate, review, summarize)는 앱이 기록에서 만든 패킷을 받는다(AI 결정 107) */
export const PRODUCING_KINDS = ['survey', 'trace'];
export const LENSES = ['command', 'state', 'timing', 'shared', 'variant', 'lifecycle', 'protocol'];
/** run이 쓰는 도구. AskUserQuestion과 서브에이전트(Agent)는 넣지 않는다(결정 7, 16.5). 녹화: -p에서는 넣어도 쓰이지 않는다 */
export const RUN_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'Write'];
/**
 * argv로 넘기는 스키마의 크기 목표(16.10의 잠정 6,000자를 녹화 6 뒤 고침, AI 결정 46). cmd.exe로 감싼 claude.cmd는 명령 줄
 * 전체가 8,191자에서 막히고(녹화: 스키마 7,966자 통과, 8,166자 실패), claude.exe를 바로 띄우면 30,000자도 받는다. 앱과
 * 하네스는 npm 설치의 claude.cmd 대신 옆의 claude.exe를 띄운다
 */
export const SCHEMA_ARGV_TARGET = 12000;
/** cmd.exe가 다르게 읽는 글자. 조립한 스키마에 있으면 안 된다(Windows claude.cmd, 녹화 6) */
export const CMD_META = /[%^&|<>!]/;

const ANNOTATIONS = new Set(['title', 'description', '$comment', '$id', '$schema', 'examples']);

export function sha256(text) {
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 마크다운의 `## <제목>` 절에 있는 `| \`id\` | 뜻 |` 표 */
function parseIdTable(md, heading, what) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) throw new Error(`${what}에 ## ${heading} 절이 없음`);
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const m = /^\|\s*`([a-z][a-z0-9_]*)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m) out.push({ id: m[1], meaning: m[2] });
  }
  if (!out.length) throw new Error(`${what}의 ${heading} 표가 비었음`);
  const dup = out.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dup.length) throw new Error(`${heading} ID 중복: ${dup.join(', ')}`);
  return out;
}

/** 렌즈 카드의 `## Checklist` 표: `| \`id\` | 뜻 |` 줄들 */
export function parseChecklist(card) {
  return parseIdTable(card, 'Checklist', '렌즈 카드');
}

/** integrate의 관점 목록 perspectives.md의 `## Perspectives` 표(coverage의 키, 16.3, AI 결정 111) */
export function parsePerspectives(md) {
  return parseIdTable(md, 'Perspectives', 'perspectives.md');
}

/** trace run이 렌즈 카드에서 받는 절(16.3). Checklist의 뜻은 필드 안내(L3)로 가고, Review questions는 review run의 몫이다 */
export const LENS_TRACE_SECTIONS = ['Scope', 'Trace', 'Pitfalls', 'Phrasing', 'Example'];

/** 원본 글에서 사람용 HTML 주석을 뺀다. 지시 층의 바이트는 이 결과다 */
export function layerText(md) {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[\s\S]*?-->\n?/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 렌즈 카드에서 trace run에 줄 층(L2b): 제목과 LENS_TRACE_SECTIONS 절을 카드의 차례대로. 그 절이 하나도 없으면 빈 글이다
 * (점검표만 있는 카드)
 */
export function lensLayer(card) {
  const text = layerText(card);
  const parts = text.split(/\n(?=## )/);
  const title = parts[0].startsWith('# ') ? parts[0].split('\n')[0] : null;
  const keep = parts.filter((p) => {
    const m = /^## (.+)$/m.exec(p.split('\n')[0]);
    return m && LENS_TRACE_SECTIONS.includes(m[1].trim());
  });
  if (!keep.length) return '';
  return [title, ...keep.map((p) => p.trim())].filter(Boolean).join('\n\n');
}

/** 마크다운의 `## 제목` 절 본문(제목 줄 빼고). 없으면 null */
export function section(md, heading) {
  const parts = layerText(md).split(/\n(?=## )/);
  const p = parts.find((x) => x.split('\n')[0].trim() === `## ${heading}`);
  return p ? p.split('\n').slice(1).join('\n').trim() : null;
}

/** 스키마에서 주석 키워드를 뺀다. properties·$defs의 키는 이름이라 건드리지 않는다 */
function strip(node) {
  if (Array.isArray(node)) return node.map(strip);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (ANNOTATIONS.has(k)) continue;
    if (k === 'properties' || k === '$defs') {
      out[k] = Object.fromEntries(Object.entries(v).map(([name, s]) => [name, strip(s)]));
    } else out[k] = strip(v);
  }
  return out;
}

/**
 * 앱이 run마다 키를 채우는 칸(결정 36): 기본 스키마의 그 이름 칸을 필수 키가 있는 객체로 바꾼다. 키마다 값의 모양이다.
 * checklist(trace): 렌즈 카드의 점검표 ID, coverage(integrate): perspectives.md의 관점 ID, answers·verdicts(review): 패킷의
 * 질문·서술 키(AI 결정 108, 112)
 */
export const SLOTS = {
  checklist: { def: 'check', value: () => ({ $ref: '#/$defs/check' }) },
  coverage: { def: 'cell', value: () => ({ type: 'array', minItems: 1, items: { $ref: '#/$defs/cell' } }) },
  answers: { def: 'answer', value: () => ({ $ref: '#/$defs/answer' }) },
  verdicts: { def: 'verdict', value: () => ({ $ref: '#/$defs/verdict' }) },
};

/** 칸에 넣을 키 목록. 점검표·관점은 {id} 목록, 질문·서술은 키 글자 목록이다 */
const slotIds = (v) => (v ?? []).map((x) => (typeof x === 'string' ? x : x.id));

/**
 * run에 넘길 결과 스키마(L4). trace는 점검표가 있어야 하고, survey에는 점검표가 없다. integrate는 관점(coverage), review는
 * 질문(answers)과 서술(verdicts) 키를 more로 받는다. survey·trace의 바이트는 more 없이 예전과 같다
 * @param {object} base 기본 스키마
 * @param {{id: string}[] | null} checklist
 * @param {{ coverage?: {id: string}[], answers?: string[], verdicts?: string[] }} [more]
 */
export function assembleSchema(base, checklist, more = {}) {
  const hasSlot = !!base.properties?.checklist;
  if (hasSlot && !checklist?.length) throw new Error('점검표 칸이 있는 스키마에 점검표가 없음');
  if (!hasSlot && checklist?.length) throw new Error('점검표 칸이 없는 스키마에 점검표를 넣으려 함');
  const s = strip(base);
  const fill = { ...(hasSlot ? { checklist } : {}), ...more };
  for (const [name, slot] of Object.entries(SLOTS)) {
    const has = !!base.properties?.[name];
    if (!has) {
      if (fill[name] !== undefined) throw new Error(`${name} 칸이 없는 스키마에 키를 넣으려 함`);
      continue;
    }
    if (fill[name] === undefined) throw new Error(`${name} 칸에 넣을 키가 없음`);
    if (name === 'coverage' && !fill[name].length) throw new Error('coverage 칸에 관점이 없음');
    if (!s.$defs?.[slot.def]) throw new Error(`기본 스키마에 $defs.${slot.def}가 없음`);
    const ids = slotIds(fill[name]);
    const dup = ids.filter((id, i, a) => a.indexOf(id) !== i);
    if (dup.length) throw new Error(`${name} 키 중복: ${dup.join(', ')}`);
    s.properties[name] = {
      type: 'object',
      additionalProperties: false,
      required: ids,
      properties: Object.fromEntries(ids.map((id) => [id, slot.value()])),
    };
  }
  return s;
}

/** argv 문자열. 키 순서는 원본 그대로라 같은 입력이면 같은 바이트다 */
export function schemaArg(schema) {
  return JSON.stringify(schema);
}

/** Windows에서 cmd.exe로 감쌀 때의 길이 어림: 큰따옴표마다 역슬래시가 붙는다(녹화 6) */
export function cmdLength(arg) {
  return arg.length + (arg.match(/"/g)?.length ?? 0) + 2;
}

function refName(s) {
  return typeof s?.$ref === 'string' ? s.$ref.replace('#/$defs/', '') : null;
}

function enumText(s) {
  return Array.isArray(s?.enum) ? ` One of: ${s.enum.map((e) => `\`${e}\``).join(', ')}.` : '';
}

/**
 * 필드 안내(L3). 맨 위 필드와 $defs의 필드마다 한 줄. 스키마에 정의한 필드만 나온다.
 * @param {object} base 기본 스키마
 * @param {{id: string, meaning: string}[] | null} checklist
 */
export function fieldGuide(base, checklist, more = {}) {
  const out = ['## Result fields', ''];
  const line = (name, s) => {
    const d = s?.description ?? '';
    const r = refName(s) ?? refName(s?.items);
    const t = r ? ` (see \`${r}\`)` : '';
    return `- \`${name}\`: ${d}${enumText(s)}${t}`.replace(/:\s*$/, '').trimEnd();
  };
  for (const [name, s] of Object.entries(base.properties ?? {})) out.push(line(name, s));
  out.push('', '### Item shapes', '');
  for (const [def, s] of Object.entries(base.$defs ?? {})) {
    const head = s.description ? `- \`${def}\`: ${s.description}` : `- \`${def}\``;
    out.push(head);
    for (const [name, p] of Object.entries(s.properties ?? {})) {
      if (!p.description && !p.enum) continue;
      out.push(`  ${line(`${def}.${name}`, p)}`);
    }
  }
  if (checklist?.length) {
    out.push('', '### Checklist keys', '');
    for (const c of checklist) out.push(`- \`${c.id}\`: ${c.meaning}`);
  }
  if (more.coverage?.length) {
    out.push('', '### Coverage keys (perspectives)', '');
    for (const c of more.coverage) out.push(`- \`${c.id}\`: ${c.meaning}`);
  }
  return out.join('\n') + '\n';
}

/**
 * run에 줄 지시(--append-system-prompt-file의 내용). 층을 정한 차례로 잇는다(16.2).
 * @param {{ contract?: string, kind?: string, lens?: string, guide: string }} layers
 */
export function assembleInstructions(layers) {
  const parts = [layers.contract, layers.kind, layers.lens, layers.guide]
    .map((p) => (p ?? '').replace(/\r\n?/g, '\n').trim())
    .filter(Boolean);
  if (!parts.length) throw new Error('지시가 비었음');
  return parts.join('\n\n') + '\n';
}

/**
 * claude -p의 run 인자(16.2의 실행 모양을 녹화로 고친 것). 출력은 stream-json이라 system/init(도구·MCP·스킬 확인),
 * rate_limit_event(재설정 시각), result를 읽는다. 사용자·프로젝트 설정, MCP, 스킬은 싣지 않는다(녹화 4). 스킬은 Skill 도구가
 * 없어 부를 수 없지만, 환경에 따라 init의 skills에 번들 스킬이 실려 --disable-slash-commands로 뺀다
 * @param {{ model: string, effort?: string, schema: string, instructionsPath: string, settingsPath: string,
 *   addDirs: string[], sessionId: string }} o
 */
export function runArgs(o) {
  return [
    '-p',
    '--model',
    o.model,
    ...(o.effort ? ['--effort', o.effort] : []),
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    o.schema,
    '--append-system-prompt-file',
    o.instructionsPath,
    '--settings',
    o.settingsPath,
    '--setting-sources',
    '',
    '--strict-mcp-config',
    '--disable-slash-commands',
    '--dangerously-skip-permissions',
    ...o.addDirs.flatMap((d) => ['--add-dir', d]),
    '--tools',
    RUN_TOOLS.join(','),
    '--session-id',
    o.sessionId,
  ];
}

/**
 * run 하나에 넘길 바이트를 만든다: 결과 스키마(argv)와 지시. 해시는 AnalysisRun과 평가 결과에 남긴다(16.2, 결정 32).
 * integrate는 관점(more.coverage), review는 질문·서술 키(more.answers, more.verdicts)를 함께 준다(AI 결정 108, 112)
 * @param {{ base: object, checklist: {id: string, meaning: string}[] | null,
 *   layers?: { contract?: string, kind?: string, lens?: string },
 *   more?: { coverage?: {id: string, meaning: string}[], answers?: string[], verdicts?: string[] } }} o
 */
export function buildRun(o) {
  const more = o.more ?? {};
  const schema = assembleSchema(o.base, o.checklist, more);
  const arg = schemaArg(schema);
  const instructions = assembleInstructions({ ...(o.layers ?? {}), guide: fieldGuide(o.base, o.checklist, more) });
  return {
    schema,
    schemaArg: arg,
    instructions,
    hashes: { schema: sha256(arg), instructions: sha256(instructions) },
  };
}
