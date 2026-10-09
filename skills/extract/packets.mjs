// integrate·review·summarize run의 패킷과 기록 목록 (requirements-extraction-flow.md 9절, 16.4, 결정 96, AI 결정 109~113).
// 이 세 종류는 앞선 run들의 기록을 입력으로 받는다. 앱(core/requirements의 접은 기록)과 평가 하네스(시나리오의 손으로 쓴 기록)가
// 이 한 모듈로 패킷을 만들어, 평가에서 잰 패킷의 꼴과 제품의 꼴이 같다(결정 17, 70의 꼴). 파일을 읽지 않는 순수 함수만 둔다.
//
// 기록(record)의 꼴(접은 기록에서 앱이 넘긴다):
//   { configs: [{name, status, select, build_command}], units: [{id, kind, lens, purpose, scope, status, reason}],
//     claims: [{id, unit, run, section, key, body}], evidence: [{id, kind, path, start, end, command}],
//     decisions: [{id, trigger, question, answer: string | null}], links: [{id, kind, from, to, reason}],
//     reviews: [{claim, result, status, note}], coverage: {관점: [칸]} | null, partial: boolean,
//     build_index: {status, detail} | null, notes?: [{at, text}] }
import { reviewItems } from './review.mjs';

const one = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const clip = (s, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const cfg = (c) => (Array.isArray(c) && c.length ? `[${c.join(', ')}]` : '');

/** 주장 한 줄 요약(절마다 사람이 읽는 칸) */
export function claimSummary(c) {
  const b = c.body ?? {};
  switch (c.section) {
    case 'quantities':
      return `${one(b.symbol) || one(b.expr)} = ${(b.values ?? []).map((v) => `${one(v.value)} ${cfg(v.configs)}`.trim()).join('; ') || one(b.expr) || '?'} (${[b.unit, b.unit_status, b.nature].map(one).filter(Boolean).join(', ')})`;
    case 'requirements':
      return [b.condition, b.behavior, b.result].map(one).filter(Boolean).join(' → ');
    case 'unknowns':
      return `${one(b.question)} (needs ${one(b.needs)})`;
    case 'inventory':
      return `${one(b.name)} (${one(b.kind)})${b.notes ? `: ${one(b.notes)}` : ''}`;
    case 'configs':
      return `${one(b.name)} (${one(b.status)}): ${one(b.select)}`;
    case 'boundaries':
      return `${one(b.path)} (${one(b.kind)}): ${one(b.reason)}`;
    case 'not_found':
      return one(b.what);
    case 'absences':
      return one(b.claim);
    case 'constraints':
      return `${one(b.text)}${b.area ? ` (${b.area})` : ''}`;
    default:
      return one(b.text ?? b.summary ?? b.claim ?? b.question ?? '');
  }
}

/** 주장의 근거 위치(앵커가 바뀐 근거 ID를 따라간다) */
export function claimLocations(c, evidence) {
  const ev = new Map((evidence ?? []).map((e) => [e.id, e]));
  const ids = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (typeof v.evidence === 'string' && ev.has(v.evidence)) ids.push(v.evidence);
      else Object.values(v).forEach(walk);
    }
  };
  walk(c.body);
  return [...new Set(ids)].map((id) => {
    const e = ev.get(id);
    return e.kind === 'tool_output' ? `output ${e.path}:${e.start}-${e.end}` : e.kind === 'external_spec' ? `spec ${e.path}` : `${e.path}:${e.start}-${e.end}`;
  });
}

/** 접히는 주장: supersedes·merges 연결의 from 쪽 → 그것을 대신하는 주장 */
export function foldedBy(links) {
  const out = new Map();
  for (const l of links ?? []) if (l.kind === 'supersedes' || l.kind === 'merges') for (const f of l.from ?? []) out.set(f, [...(out.get(f) ?? []), ...(l.to ?? [])]);
  return out;
}

/** 풀림 후보가 있는 미확정: resolves 연결의 from 쪽 → 답하는 주장 */
export function resolvedBy(links) {
  const out = new Map();
  for (const l of links ?? []) if (l.kind === 'resolves') for (const f of l.from ?? []) out.set(f, [...(out.get(f) ?? []), ...(l.to ?? [])]);
  return out;
}

/**
 * 기록 목록: 주장 한 줄씩(전역 ID | 단위 | run | 절 | 구성 | 요약 | 근거 위치 | 연결). integrate run이 Grep·Read로 찾는 파일이다.
 * run 칸은 같은 단위의 뒤 run(supersedes)을 가르는 데 쓴다
 * @param {object} record
 */
export function recordListing(record) {
  const folded = foldedBy(record.links);
  const resolved = resolvedBy(record.links);
  const lines = ['# Record listing: global ID | unit | run | section | configurations | summary | evidence | links', ''];
  for (const c of record.claims ?? []) {
    const marks = [
      ...(folded.has(c.id) ? [`folded into ${folded.get(c.id).join(', ')}`] : []),
      ...(resolved.has(c.id) ? [`answered by ${resolved.get(c.id).join(', ')}`] : []),
    ];
    lines.push(
      [c.id, c.unit, c.run ?? '-', c.section, cfg(c.body?.configs) || '-', clip(claimSummary(c), 400) || '-', claimLocations(c, record.evidence).join(', ') || '-', marks.join('; ') || '-'].join(' | '),
    );
  }
  return lines.join('\n') + '\n';
}

function head(title, o) {
  return [
    `# Packet: ${title}`,
    '',
    '## Source',
    '',
    `- Repository (read-only): ${o.repo}`,
    `- Base commit: ${o.base}`,
    `- Scratch directory (you may write here): ${o.scratch}`,
    ...(o.listing ? [`- Record listing (read-only): ${o.listing}`] : []),
    '',
    '## Intent',
    '',
    one(o.intent) ? String(o.intent).trim() : '(none)',
    '',
  ];
}

function configsBlock(record) {
  const cs = record.configs ?? [];
  if (!cs.length) return [];
  return [
    '## Configurations (from the survey)',
    '',
    ...cs.map((c) => `- ${c.name} (${c.status}): ${c.build_command ? `\`${c.build_command}\`` : 'build command unknown'}; selected by ${c.select}`),
    '',
  ];
}

function decisionsBlock(record) {
  const answered = (record.decisions ?? []).filter((d) => d.answer);
  const notes = record.notes ?? [];
  return [
    ...(answered.length ? ['## Human decisions', '', ...answered.flatMap((d) => [`- ${d.id} Q: ${one(d.question)}`, `  A: ${one(d.answer)}`]), ''] : []),
    // 사람 메모: 범위 줄이기와 되감기의 추가 지시(AI 결정 114, 120)
    ...(notes.length ? ['## Notes from a person', '', ...notes.map((n) => `- ${one(n.text)}`), ''] : []),
  ];
}

function limits(o) {
  return ['## Limits', '', `- Soft deadline: ${o.soft} minutes. Hard limit: ${o.hard} minutes.`, ''];
}

/** 목록이 길면 앞의 n줄만 패킷에 두고 나머지는 기록 목록을 보게 한다(패킷 크기 목표 24,000자, 16.10) */
function capped(lines, n, rest) {
  return lines.length <= n ? lines : [...lines.slice(0, n), `- … ${lines.length - n} more: ${rest}`];
}

/**
 * integrate 패킷(AI 결정 110, 111)
 * @param {{ repo: string, base: string, scratch: string, listing: string, intent: string, soft: number, hard: number,
 *   record: object, since?: string[] }} o since: 마지막 integrate 뒤에 반영한 run의 id(없으면 모두 새것)
 */
export function renderIntegratePacket(o) {
  const r = o.record;
  const folded = foldedBy(r.links);
  const resolved = resolvedBy(r.links);
  const current = (sec) => (r.claims ?? []).filter((c) => c.section === sec && !folded.has(c.id));
  const out = [...head('integrate', o), ...configsBlock(r), ...decisionsBlock(r)];
  out.push('## Units', '', '| unit | kind | scope | state | reason |', '| --- | --- | --- | --- | --- |');
  for (const u of r.units ?? [])
    out.push(`| ${u.id} | ${u.kind === 'trace' ? `trace (${u.lens})` : u.kind} | ${clip(one(u.kind === 'survey' ? 'whole repository' : u.scope), 160).replace(/\|/g, '/')} | ${u.status} | ${clip(one(u.reason), 120).replace(/\|/g, '/')} |`);
  out.push('');
  const inv = current('inventory').map((c) => `- ${c.id} ${claimSummary(c)} ${cfg(c.body?.configs)}`.trim());
  out.push('## Entry points (from the survey)', '', ...(inv.length ? capped(inv, 150, 'see the listing, section inventory') : ['- (none)']), '');
  const unk = current('unknowns')
    .filter((c) => !resolved.has(c.id))
    .map((c) => `- ${c.id} (${c.unit}): ${clip(claimSummary(c), 300)}`);
  out.push('## Open unknowns', '', ...(unk.length ? capped(unk, 120, 'see the listing, section unknowns') : ['- (none)']), '');
  const since = o.since ? new Set(o.since) : null;
  const fresh = (r.claims ?? []).filter((c) => !since || since.has(c.run)).map((c) => c.id);
  out.push('## New since the last integrate run', '', fresh.length ? `- ${fresh.length} claims: ${capped(fresh, 300, 'see the listing').join(', ')}` : '- (none)', '');
  const links = (r.links ?? []).map((l) => `- ${l.id} ${l.kind}: ${(l.from ?? []).join(', ')} → ${(l.to ?? []).join(', ')}`);
  out.push('## Links already made', '', ...(links.length ? capped(links, 150, 'see the listing, column links') : ['- (none)']), '');
  out.push(...limits(o));
  return out.join('\n');
}

/**
 * review 패킷(결정 12, AI 결정 112): 질문(q)과 서술(s). 주장의 ID·값·이유·근거는 넣지 않는다
 * @param {{ repo: string, base: string, scratch: string, intent: string, soft: number, hard: number, record: object,
 *   claims: object[] }} o claims: 이 묶음의 주장
 * @returns {{ packet: string, items: ReturnType<typeof reviewItems> }}
 */
export function renderReviewPacket(o) {
  const items = reviewItems(o.claims);
  const out = [...head('review', { ...o, listing: null }), ...configsBlock(o.record), ...decisionsBlock(o.record)];
  const qs = items.filter((i) => i.kind !== 'statement');
  const ss = items.filter((i) => i.kind === 'statement');
  out.push('## Questions', '', ...(qs.length ? qs.map((i) => `- ${i.key} (${i.kind}): ${i.text}`) : ['- (none)']), '');
  out.push('## Statements', '', ...(ss.length ? ss.map((i) => `- ${i.key}: ${i.text}`) : ['- (none)']), '');
  out.push(...limits(o));
  return { packet: out.join('\n'), items };
}

/**
 * summarize 패킷(결정 15, AI 결정 113): 앱이 기록에서 만든 통계와 목록
 * @param {{ intent: string, soft: number, hard: number, record: object, scratch: string }} o
 */
export function renderSummarizePacket(o) {
  const r = o.record;
  const folded = foldedBy(r.links);
  const resolved = resolvedBy(r.links);
  const claims = (r.claims ?? []).filter((c) => !folded.has(c.id));
  const by = (sec) => claims.filter((c) => c.section === sec);
  const out = ['# Packet: summarize', '', `- Scratch directory (you may write here): ${o.scratch}`, '', '## Intent', '', one(o.intent) ? String(o.intent).trim() : '(none)', ''];
  out.push('## State of the analysis', '');
  out.push(`- Partial analysis: ${r.partial ? 'yes, stopped at the run limit; open units were held' : 'no'}`);
  if (r.build_index) out.push(`- Build index: ${r.build_index.status}${r.build_index.detail ? ` (${one(r.build_index.detail)})` : ''}`);
  const count = (xs) => Object.entries(xs.reduce((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {})).map(([k, n]) => `${k} ${n}`).join(', ');
  // 이 run의 summarize 단위는 도는 중이라 열려 있다: 목록과 수에서 뺀다(14차 [실제] 사례의 verify 지적)
  const units = (r.units ?? []).filter((u) => u.kind !== 'summarize');
  out.push(`- Units: ${units.length} (${count(units.map((u) => u.status)) || 'none'})`);
  out.push(`- Claims: ${claims.length} (${count(claims.map((c) => c.section)) || 'none'}); folded by links: ${folded.size}`);
  const lowered = (r.reviews ?? []).filter((x) => x.status);
  out.push(`- Reviews: ${(r.reviews ?? []).length} (lowered ${lowered.length}); every claim is unreviewed or lowered`, '');
  out.push(...configsBlock(r));
  out.push('## Units', '', ...units.map((u) => `- ${u.id} ${u.kind === 'trace' ? `trace (${u.lens})` : u.kind} ${u.status}: ${clip(one(u.kind === 'survey' ? 'whole repository' : u.purpose), 160)}${u.reason ? ` — ${clip(one(u.reason), 160)}` : ''}`), '');
  const list = (title, sec, n) => {
    const xs = by(sec).map((c) => `- ${c.id} ${cfg(c.body?.configs)} ${clip(claimSummary(c), 240)}`.replace(/\s+/g, ' ').replace(/^- /, '- '));
    out.push(`## ${title}`, '', ...(xs.length ? capped(xs, n, `${xs.length - n} not shown`) : ['- (none)']), '');
  };
  list('Requirement candidates', 'requirements', 60);
  list('Constraint candidates', 'constraints', 40);
  list('Quantities', 'quantities', 40);
  const unk = by('unknowns').map((c) => `- ${c.id} ${clip(claimSummary(c), 240)}${resolved.has(c.id) ? ` (answer candidates: ${resolved.get(c.id).join(', ')}; not confirmed)` : ''}`);
  out.push('## Unknowns', '', ...(unk.length ? capped(unk, 60, 'more') : ['- (none)']), '');
  list('Conflicts', 'conflicts', 30);
  const links = (r.links ?? []).filter((l) => l.kind === 'conflicts').map((l) => `- ${l.id}: ${(l.from ?? []).join(', ')} ↔ ${(l.to ?? []).join(', ')}: ${clip(one(l.reason), 200)}`);
  if (links.length) out.push('## Conflicting claims (links)', '', ...links, '');
  // 내린 주장의 글도 보인다: 관찰·목록·부재는 다른 절에 나오지 않는다
  const byId = new Map((r.claims ?? []).map((c) => [c.id, c]));
  const what = (id) => (byId.has(id) ? ` (${byId.get(id).section}) ${clip(claimSummary(byId.get(id)), 200)}` : '');
  if (lowered.length) out.push('## Claims a review lowered', '', ...lowered.map((x) => `- ${x.claim}${what(x.claim)}: ${x.status}${x.note ? ` (${clip(one(x.note), 160)})` : ''}`), '');
  if (r.coverage) {
    const gaps = Object.entries(r.coverage).flatMap(([p, cells]) => (cells ?? []).filter((c) => c.status === 'unreached' || c.status === 'unknown').map((c) => `- ${p} ${cfg(c.configs)}: ${c.status}${c.note ? ` (${clip(one(c.note), 160)})` : ''}`));
    out.push('## Coverage gaps', '', ...(gaps.length ? gaps : ['- (none)']), '');
  }
  out.push(...decisionsBlock(r), ...limits(o));
  return out.join('\n');
}

/** 패킷에 나온 전역 ID(규칙 global_refs의 ctx.ids). 기록 목록을 주는 integrate는 기록의 모든 ID다 */
export function packetIds(text) {
  return [...new Set([...String(text).matchAll(/\b[cuh]-\d{4,}\b/g)].map((m) => m[0]))];
}
