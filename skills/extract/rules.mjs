// extract run 결과의 반영 검사 규칙 표(16.8, 16.11, 결정 13, 37). 앱이 제출 때 검사해 되돌리는 규칙의 원본이다.
// 지시(L1 contract.md의 "What the app checks on submit")는 이 표의 id를 주석으로 적고, skills/check.mjs가 둘이 같은지 본다.
// 결과 하나만으로 가를 수 있는 규칙은 check 함수를 둔다. 레포나 패킷이 있어야 가르는 규칙(인용 대조, 기준 커밋의 경로,
// 구성 이름)은 needs만 적는다: 앱의 반영 검사가 구현하고, 여기의 check는 ctx로 준 것만 본다.
// 렌즈 카드의 Example은 통과하고, skills/extract/counter/<규칙>.json은 그 규칙에서만 실패해야 한다(check.mjs).
import { inventoryProblems } from './build-index.mjs';

/** 결과 안의 모든 값을 경로와 함께 */
function* walk(node, at = '') {
  yield [at, node];
  if (Array.isArray(node)) for (let i = 0; i < node.length; i++) yield* walk(node[i], `${at}/${i}`);
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) yield* walk(v, `${at}/${k}`);
}

const isAnchor = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && 'kind' in v && 'path' in v && 'quote' in v && 'command' in v;
const keyed = (r) => [...walk(r)].filter(([at, v]) => v && typeof v === 'object' && typeof v.key === 'string' && !at.includes('/checklist/'));
const cells = (r) => Object.entries(r?.checklist ?? {});
const configLists = (r) =>
  [...walk(r)].filter(([at, v]) => /\/configs$/.test(at) && Array.isArray(v) && v.every((x) => typeof x === 'string'));

/** @type {{ id: string, text: string, needs?: string, check?: (r: any, ctx: any) => string[] }[]} */
export const RULES = [
  {
    id: 'key_unique',
    text: 'Local keys are unique',
    check: (r) => {
      const seen = new Map();
      for (const [at, v] of keyed(r)) seen.set(v.key, [...(seen.get(v.key) ?? []), at]);
      return [...seen].filter(([, ats]) => ats.length > 1).map(([k, ats]) => `key ${k}: ${ats.join(', ')}`);
    },
  },
  {
    id: 'refs_exist',
    text: 'Every refs entry names a key in this result',
    check: (r) => {
      const keys = new Set(keyed(r).map(([, v]) => v.key));
      return [...walk(r)]
        .filter(([at, v]) => /\/(refs|depends_on)$/.test(at) && Array.isArray(v))
        .flatMap(([at, v]) => v.filter((k) => !keys.has(k)).map((k) => `${at}: ${k}`));
    },
  },
  {
    id: 'covered_refs',
    text: 'A covered checklist cell has refs',
    check: (r) => cells(r).filter(([, c]) => c.status === 'covered' && !c.refs?.length).map(([id]) => id),
  },
  {
    id: 'not_applicable_searches',
    text: 'A not_applicable checklist cell has searches',
    check: (r) => cells(r).filter(([, c]) => c.status === 'not_applicable' && !c.searches?.length).map(([id]) => id),
  },
  {
    id: 'absence_searches',
    text: 'Every absences and not_found item has searches',
    check: (r) =>
      [...(r.absences ?? []), ...(r.not_found ?? [])].filter((a) => !a.searches?.length).map((a) => a.key),
  },
  {
    id: 'checkpoint_outcome',
    text: 'incomplete has a checkpoint and other outcomes have none',
    check: (r) => ((r.outcome === 'incomplete') === (r.checkpoint != null) ? [] : [`${r.outcome} / checkpoint`]),
  },
  {
    id: 'done_unreached',
    text: 'done has no unreached checklist cell',
    check: (r) => (r.outcome === 'done' ? cells(r).filter(([, c]) => c.status === 'unreached').map(([id]) => id) : []),
  },
  {
    id: 'spec_anchor',
    text: 'nature spec has an external_spec anchor',
    check: (r) =>
      (r.quantities ?? [])
        .filter((q) => q.nature === 'spec')
        .filter((q) => ![...walk(q)].some(([, v]) => isAnchor(v) && v.kind === 'external_spec'))
        .map((q) => q.key),
  },
  {
    id: 'anchor_command',
    text: 'tool_output anchors have command, other anchors have command null',
    check: (r) =>
      [...walk(r)]
        .filter(([, v]) => isAnchor(v))
        .filter(([, v]) => (v.kind === 'tool_output' ? !v.command : v.command !== null))
        .map(([at]) => at),
  },
  {
    id: 'all_alone',
    text: 'all stands alone in configs',
    check: (r) => configLists(r).filter(([, v]) => v.includes('all') && v.length > 1).map(([at]) => at),
  },
  {
    id: 'config_known',
    text: 'Every configuration name is one the packet or survey gave',
    needs: 'packet',
    check: (r, ctx) => {
      if (!ctx?.configs) return [];
      const known = new Set([...ctx.configs, 'all']);
      return configLists(r).flatMap(([at, v]) => v.filter((c) => !known.has(c)).map((c) => `${at}: ${c}`));
    },
  },
  {
    // 앱이 구성별 빌드 인덱스(build-index.mjs)를 만들었을 때만 본다(AI 결정 87·88)
    id: 'config_active',
    text: 'Each inventory item is built in every configuration it lists',
    needs: 'build',
    check: (r, ctx) => (ctx?.build ? inventoryProblems(r, ctx.build) : []),
  },
  { id: 'path_at_base', text: "Each code anchor's path exists at the base commit", needs: 'repo' },
  { id: 'quote_match', text: "Each code anchor's quote is on the cited lines", needs: 'repo' },
];

/**
 * 결과 하나에 규칙을 돌린다. ctx.configs가 있으면 구성 이름도, ctx.build(구성별 빌드 인덱스)가 있으면 구성 활성도 본다
 * @returns {{ rule: string, problem: string }[]}
 */
export function checkResult(result, ctx = {}) {
  return RULES.filter((r) => r.check).flatMap((r) => r.check(result, ctx).map((problem) => ({ rule: r.id, problem })));
}
