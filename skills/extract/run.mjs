// 요구사항 추출 extract run의 지시·결과 스키마 조립과 실행 인자 (docs/requirements-extraction-flow.md 16.2, 16.3, 결정 9, 36).
// 앱, skills/check.mjs, 평가 하네스(app/eval/extract)가 이 한 모듈을 함께 써서, 평가에서 잰 판의 바이트와 제품이 넘기는
// 바이트가 같게 한다(16.3). 파일을 읽지 않는 순수 함수만 둔다. 읽기는 load.mjs가 한다.
//
// - 결과 스키마(L4): docs/contracts/extract-<kind>.v0.schema.json(기본 스키마)에서 title·description 같은 주석 키워드를
//   빼고, trace면 렌즈 카드의 점검표 ID를 checklist의 필수 키로 넣는다(결정 36). --json-schema의 argv로 넘긴다.
// - 필드 안내(L3): 기본 스키마의 description과 카드의 점검표 뜻을 렌더링한다(16.2). 영어다(D98).
// - 지시: 층(L1 고정 계약, L2 종류 절차, L2b 렌즈 카드, L3 필드 안내)을 이 차례로 잇는다. 빈 층은 뺀다.
import { createHash } from 'node:crypto';

export const KINDS = ['survey', 'trace'];
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

/** 렌즈 카드의 `## Checklist` 표: `| \`id\` | 뜻 |` 줄들 */
export function parseChecklist(card) {
  const lines = card.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => l.trim() === '## Checklist');
  if (start < 0) throw new Error('렌즈 카드에 ## Checklist 절이 없음');
  const out = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const m = /^\|\s*`([a-z][a-z0-9_]*)`\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m) out.push({ id: m[1], meaning: m[2] });
  }
  if (!out.length) throw new Error('렌즈 카드의 점검표가 비었음');
  const dup = out.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
  if (dup.length) throw new Error(`점검표 ID 중복: ${dup.join(', ')}`);
  return out;
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
 * run에 넘길 결과 스키마(L4). trace는 점검표가 있어야 하고, survey에는 점검표가 없다.
 * @param {object} base 기본 스키마
 * @param {{id: string}[] | null} checklist
 */
export function assembleSchema(base, checklist) {
  const hasSlot = !!base.properties?.checklist;
  if (hasSlot && !checklist?.length) throw new Error('점검표 칸이 있는 스키마에 점검표가 없음');
  if (!hasSlot && checklist?.length) throw new Error('점검표 칸이 없는 스키마에 점검표를 넣으려 함');
  const s = strip(base);
  if (hasSlot) {
    if (!s.$defs?.check) throw new Error('기본 스키마에 $defs.check가 없음');
    s.properties.checklist = {
      type: 'object',
      additionalProperties: false,
      required: checklist.map((c) => c.id),
      properties: Object.fromEntries(checklist.map((c) => [c.id, { $ref: '#/$defs/check' }])),
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
export function fieldGuide(base, checklist) {
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
 * @param {{ base: object, checklist: {id: string, meaning: string}[] | null,
 *   layers?: { contract?: string, kind?: string, lens?: string } }} o
 */
export function buildRun(o) {
  const schema = assembleSchema(o.base, o.checklist);
  const arg = schemaArg(schema);
  const instructions = assembleInstructions({ ...(o.layers ?? {}), guide: fieldGuide(o.base, o.checklist) });
  return {
    schema,
    schemaArg: arg,
    instructions,
    hashes: { schema: sha256(arg), instructions: sha256(instructions) },
  };
}
