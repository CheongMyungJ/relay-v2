// extract run 결과의 반영 검사 규칙 표(16.8, 16.11, 결정 13, 37). 앱이 제출 때 검사해 되돌리는 규칙의 원본이다.
// 지시(L1 contract.md의 "What the app checks on submit")는 이 표의 id를 주석으로 적고, skills/check.mjs가 둘이 같은지 본다.
// 결과 하나만으로 가를 수 있는 규칙은 check 함수를 둔다. 레포나 패킷이 있어야 가르는 규칙(인용 대조, 기준 커밋의 경로,
// 구성 이름)은 needs만 적는다: 앱의 반영 검사가 구현하고, 여기의 check는 ctx로 준 것만 본다.
// 렌즈 카드의 Example은 통과하고, skills/extract/counter/<규칙>.json은 그 규칙에서만 실패해야 한다(check.mjs).
// kinds가 없는 규칙은 모든 종류에 걸리고 L1의 앱 검사 목록에 적는다. kinds가 있는 규칙은 그 종류의 결과에만 있는 칸을 보며
// kinds/<종류>.md의 "What the app also checks" 목록에 적는다(L1의 바이트를 바꾸지 않는다, AI 결정 108).
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
const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
/** integrate의 coverage 칸: [관점, 칸, 차례] */
const coverageCells = (r) =>
  Object.entries(r?.coverage ?? {}).flatMap(([p, list]) => (Array.isArray(list) ? list.map((c, i) => [p, c, i]) : []));
/** 결과가 가리키는 전역 ID: integrate의 links·coverage, summarize의 서술 */
const globalRefs = (r) => [
  ...(r?.links ?? []).flatMap((l) => [...ids(l.from).map((x) => [`links/${l.key}/from`, x]), ...ids(l.to).map((x) => [`links/${l.key}/to`, x])]),
  ...coverageCells(r).flatMap(([p, c, i]) => ids(c.ids).map((x) => [`coverage/${p}/${i}/ids`, x])),
  ...[...(r?.overview ?? []), ...(r?.handoff_summary ? [r.handoff_summary] : []), ...(r?.risks ?? [])].flatMap((x, i) =>
    ids(x?.ids).map((g) => [`para ${i}`, g]),
  ),
];
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
  // ---- integrate (AI 결정 110, 111) ----
  {
    // 패킷과 기록 목록이 준 전역 ID만 가리킨다. ctx.ids가 없으면 보지 않는다
    id: 'global_refs',
    text: 'Every global ID is one the packet or the listing gave',
    kinds: ['integrate', 'summarize'],
    needs: 'packet',
    check: (r, ctx) => {
      if (!ctx?.ids) return [];
      const known = new Set(ctx.ids);
      return globalRefs(r).filter(([, g]) => !known.has(g)).map(([at, g]) => `${at}: ${g}`);
    },
  },
  {
    // 양쪽이 비지 않고 겹치지 않는다. resolves는 미확정에서 시작한다(ctx.sections가 있을 때: 전역 ID → 절 이름)
    id: 'link_shape',
    text: 'Every link has IDs on both sides and none on both; resolves starts from unknowns',
    kinds: ['integrate'],
    check: (r, ctx) =>
      (r?.links ?? []).flatMap((l) => {
        const from = ids(l.from);
        const to = ids(l.to);
        const out = [];
        if (!from.length || !to.length) out.push(`${l.key}: empty side`);
        const both = from.filter((x) => to.includes(x));
        if (both.length) out.push(`${l.key}: ${both.join(', ')} on both sides`);
        if (l.kind === 'resolves' && ctx?.sections) {
          const not = from.filter((x) => ctx.sections[x] !== undefined && ctx.sections[x] !== 'unknowns');
          if (not.length) out.push(`${l.key}: resolves starts from ${not.join(', ')}, which is not an unknown`);
        }
        return out;
      }),
  },
  {
    id: 'coverage_refs',
    text: 'A covered coverage cell has ids',
    kinds: ['integrate'],
    check: (r) => coverageCells(r).filter(([, c]) => c.status === 'covered' && !ids(c.ids).length).map(([p, , i]) => `${p}/${i}`),
  },
  {
    id: 'coverage_searches',
    text: 'A not_applicable coverage cell has searches',
    kinds: ['integrate'],
    check: (r) =>
      coverageCells(r).filter(([, c]) => c.status === 'not_applicable' && !c.searches?.length).map(([p, , i]) => `${p}/${i}`),
  },
  {
    id: 'coverage_units',
    text: 'An unreached coverage cell names units proposed in this result',
    kinds: ['integrate'],
    check: (r) => {
      const keys = new Set((r?.units ?? []).map((u) => u.key));
      return coverageCells(r).flatMap(([p, c, i]) => {
        if (c.status !== 'unreached') return [];
        const us = ids(c.units);
        if (!us.length) return [`${p}/${i}: no unit`];
        return us.filter((k) => !keys.has(k)).map((k) => `${p}/${i}: unit ${k} is not in units`);
      });
    },
  },
  // ---- review (결정 12, AI 결정 112) ----
  {
    id: 'counter_anchor',
    text: 'A refuted or overclaimed verdict has a counter anchor',
    kinds: ['review'],
    check: (r) =>
      Object.entries(r?.verdicts ?? {})
        .filter(([, v]) => (v?.verdict === 'refuted' || v?.verdict === 'overclaimed') && !v.anchors?.length)
        .map(([k]) => k),
  },
  {
    id: 'attempts_listed',
    text: 'Every verdict lists its attempts',
    kinds: ['review'],
    check: (r) =>
      Object.entries(r?.verdicts ?? {})
        .filter(([, v]) => !ids(v?.attempts).some((a) => a.trim()))
        .map(([k]) => k),
  },
  {
    id: 'answer_anchor',
    text: 'An answered answer has an anchor',
    kinds: ['review'],
    check: (r) =>
      Object.entries(r?.answers ?? {})
        .filter(([, a]) => a?.status === 'answered' && !a.anchors?.length)
        .map(([k]) => k),
  },
];

/** 그 종류의 결과에 걸리는 규칙: 모든 종류에 걸리는 것(kinds 없음)과 그 종류의 것 */
export function rulesFor(kind) {
  return RULES.filter((r) => !r.kinds || r.kinds.includes(kind));
}

/**
 * 결과 하나에 규칙을 돌린다. ctx.configs가 있으면 구성 이름도, ctx.build(구성별 빌드 인덱스)가 있으면 구성 활성도,
 * ctx.ids·ctx.sections(패킷이 준 전역 ID와 그 절)가 있으면 전역 ID도 본다. ctx.kind가 있으면 그 종류의 규칙만 돌린다
 * @returns {{ rule: string, problem: string }[]}
 */
export function checkResult(result, ctx = {}) {
  const rules = ctx.kind ? rulesFor(ctx.kind) : RULES;
  return rules.filter((r) => r.check).flatMap((r) => r.check(result, ctx).map((problem) => ({ rule: r.id, problem })));
}
