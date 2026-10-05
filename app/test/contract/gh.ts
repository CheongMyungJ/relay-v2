// 계약: relay가 gh(GitHub CLI)와 GitHub에 기대는 것 (docs/implementation.md 8.1의 [계약]).
// 앱의 PR 읽기(src/main/pr.ts readPr)가 읽는 필드와 타입이다. 가짜 gh(test/support/fake-gh)는 이것을 지켜야 [흐름]의 PR
// 시험이 실제에서도 뜻이 있다. 실제 gh가 지키는지는 녹화본(fixtures/gh.json)과 live-gh.test.ts로 본다.
// 읽기는 앱의 어댑터 그대로(ghPrView, ghApiList, ghApi, ghMergeSettings)이고, 읽은 것을 앱의 해석(commentFacts, checksOf)에
// 넣어 본다.
import fs from 'node:fs'
import path from 'node:path'
import { ghApi, ghApiList, ghMergeSettings, ghPrView } from '../../src/adapters/gh'
import {
  checksOf,
  commentFacts,
  repoArg,
  restRepo,
  rollupRuns,
  type PrLocation,
} from '../../src/core/pr'
import { typeOf, type FieldType } from './claude'

export type GhKind = 'prView' | 'review' | 'inline' | 'convo' | 'checkRun' | 'run' | 'mergeSettings'

const AUTHOR: Record<string, FieldType[]> = {
  id: ['number'],
  user: ['object'],
  'user.login': ['string'],
  'user.type': ['string'],
  author_association: ['string'],
  body: ['string'],
  html_url: ['string'],
}

/** 종류마다 앱이 읽는 필드(점은 한 단계 안)와 받아들이는 타입 */
export const GH_CONTRACT: Record<GhKind, Record<string, FieldType[]>> = {
  // gh pr view --json (src/adapters/gh.ts PR_VIEW_FIELDS, src/main/pr.ts viewFacts)
  prView: {
    number: ['number'],
    url: ['string'],
    state: ['string'],
    isDraft: ['boolean'],
    headRefName: ['string'],
    headRefOid: ['string'],
    baseRefName: ['string'],
    mergeable: ['string'],
    mergeStateStatus: ['string'],
    reviewDecision: ['string'],
    statusCheckRollup: ['array'],
    mergedAt: ['string', 'null'],
    mergeCommit: ['object', 'null'],
  },
  // REST pulls/<n>/reviews, pulls/<n>/comments, issues/<n>/comments (core/pr commentFacts, S7 관찰 3)
  review: { ...AUTHOR, state: ['string'], submitted_at: ['string'] },
  inline: {
    ...AUTHOR,
    path: ['string'],
    line: ['number', 'null'],
    original_line: ['number', 'null'],
    created_at: ['string'],
    updated_at: ['string'],
  },
  convo: { ...AUTHOR, created_at: ['string'], updated_at: ['string'] },
  // statusCheckRollup의 CheckRun (core/pr checksOf)
  checkRun: {
    __typename: ['string'],
    name: ['string'],
    workflowName: ['string'],
    status: ['string'],
    conclusion: ['string'],
    detailsUrl: ['string'],
    startedAt: ['string'],
  },
  // REST actions/runs/<실행> (D201)
  run: { event: ['string'] },
  // gh repo view --json (D177)
  mergeSettings: {
    mergeCommitAllowed: ['boolean'],
    squashMergeAllowed: ['boolean'],
    rebaseMergeAllowed: ['boolean'],
  },
}

/** 맨 위 필드와, 객체 필드는 한 단계 안의 필드까지의 타입 */
export function ghShapeOf(v: Record<string, unknown>): Record<string, FieldType> {
  const out: Record<string, FieldType> = {}
  for (const k of Object.keys(v).sort()) {
    out[k] = typeOf(v[k])
    const inner = v[k]
    if (out[k] === 'object')
      for (const [ik, iv] of Object.entries(inner as Record<string, unknown>))
        out[`${k}.${ik}`] = typeOf(iv)
  }
  return out
}

export function ghViolations(kind: GhKind, v: Record<string, unknown>): string[] {
  const shape = ghShapeOf(v)
  return Object.entries(GH_CONTRACT[kind]).flatMap(([k, ts]) =>
    shape[k] === undefined
      ? [`${kind}.${k} 없음`]
      : ts.includes(shape[k])
        ? []
        : [`${kind}.${k}의 타입이 ${shape[k]} (기대 ${ts.join('|')})`],
  )
}

export interface GhRead {
  prView: Record<string, unknown>
  reviews: Record<string, unknown>[]
  inline: Record<string, unknown>[]
  convo: Record<string, unknown>[]
  checkRuns: Record<string, unknown>[]
  runs: Record<string, unknown>[]
  mergeSettings: Record<string, unknown>
}

const asObjects = (xs: unknown[]) =>
  xs.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)

/** 앱의 어댑터로 PR 하나를 읽는다 (readPr과 같은 요청). 읽은 것을 앱의 해석에 넣어 던지지 않는지도 본다 */
export async function readWithApp(
  bin: string,
  location: PrLocation,
  cwd: string,
  env?: NodeJS.ProcessEnv,
): Promise<GhRead> {
  const repo = repoArg(location)
  const rest = restRepo(location)
  const n = location.number
  const list = async (p: string) =>
    asObjects(await ghApiList(bin, { host: location.host, path: p, cwd, ...(env ? { env } : {}) }))
  const prView = await ghPrView(bin, { repo, number: n, cwd, ...(env ? { env } : {}) })
  const [reviews, inline, convo] = await Promise.all([
    list(`${rest}/pulls/${n}/reviews?per_page=100`),
    list(`${rest}/pulls/${n}/comments?per_page=100`),
    list(`${rest}/issues/${n}/comments?per_page=100`),
  ])
  const rollup = prView['statusCheckRollup']
  const runIds = rollupRuns(rollup)
  const runs = await Promise.all(
    runIds.map((id) =>
      ghApi(bin, {
        host: location.host,
        path: `${rest}/actions/runs/${id}?exclude_pull_requests=true`,
        cwd,
        ...(env ? { env } : {}),
      }),
    ),
  )
  const mergeSettings = (await ghMergeSettings(bin, {
    repo,
    cwd,
    ...(env ? { env } : {}),
  })) as unknown as Record<string, unknown>
  // 앱의 해석이 받아들이는지
  commentFacts({ reviews, inline, convo })
  checksOf(rollup, new Map(runIds.map((id, i) => [id, String(runs[i]?.['event'] ?? '')])))
  const checkRuns = asObjects(Array.isArray(rollup) ? rollup : []).filter(
    (c) => c['__typename'] === 'CheckRun',
  )
  return { prView, reviews, inline, convo, checkRuns, runs, mergeSettings }
}

/** 종류마다 견줄 대표 하나 (목록은 첫 항목). 없으면 그 종류는 빠진다 */
export function samplesOf(r: GhRead): Partial<Record<GhKind, Record<string, unknown>>> {
  const out: Partial<Record<GhKind, Record<string, unknown>>> = {
    prView: r.prView,
    mergeSettings: r.mergeSettings,
  }
  if (r.reviews[0]) out.review = r.reviews[0]
  if (r.inline[0]) out.inline = r.inline[0]
  if (r.convo[0]) out.convo = r.convo[0]
  if (r.checkRuns[0]) out.checkRun = r.checkRuns[0]
  if (r.runs[0]) out.run = r.runs[0]
  return out
}

export interface GhFixture {
  ghVersion: string
  recordedAt: string
  /** 녹화한 PR (시험용 레포) */
  source: string
  shapes: Partial<Record<GhKind, Record<string, FieldType>>>
}

export const GH_FIXTURE = path.join(__dirname, 'fixtures', 'gh.json')

export function readGhFixture(): GhFixture | null {
  return fs.existsSync(GH_FIXTURE)
    ? (JSON.parse(fs.readFileSync(GH_FIXTURE, 'utf8')) as GhFixture)
    : null
}
