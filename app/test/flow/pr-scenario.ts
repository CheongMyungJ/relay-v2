// PR 진행(M9)의 공통 시나리오 (docs/implementation.md 8.4의 "PR 진행" 1~6, I49). [흐름](pr.test.ts: 가짜 gh와
// 로컬 bare 원격)과 [실제](test/claude/pr.test.ts: 실제 gh와 시험용 레포)가 함께 쓴다. 앱은 같고 GitHub 쪽만 다르다.
// relay 밖의 사람, 봇, CI는 PrWorld가 맡는다. Work는 가짜 claude로 기본 경로(intake → fix → verify)를 지나 [PR 생성]까지 간다.
//
// 1. 읽기: PR 진행이 되고 gh 버전을 적는다(D198). 체크가 없는 새 head는 "체크 기다림"이다(D196). CI가 실패하면 CI 실패
//    항목이 실패한 스텝의 로그 끝부분과 함께 들어온다. 체크의 이름에는 실행을 부른 이벤트가 붙는다(D201).
// 2. 거르기: 소유자의 대화 코멘트와 리뷰(본문과 인라인)는 받고, 봇의 코멘트는 받지 않는다. 받을 봇에 적으면 받는다
//    (D160, D161, D197).
// 3. 항목을 모두 [제외]해도 CI 실패로 [머지]가 꺼져 있다. CI 실패 항목을 [다시 넣고] relay 밖에서 ci-fail을 지우면
//    fast-forward로 받고(D193), 옛 CI 실패 항목은 해소됨이다(D199. 제외한 채였으면 그대로다). 새 head의 CI가 통과하면
//    [머지]가 켜진다.
// 4. 충돌: 기준 브랜치에 같은 자리를 바꾼 커밋을 넣으면 충돌 항목이 fetch한 기준 브랜치 커밋의 id로 생긴다. 다른
//    clone에서 기준 브랜치를 병합해 push하면 받아서 기준 커밋을 옮기고(D181), 충돌 항목은 해소됨이다.
// 5. 머지: 사람이 본 head 뒤에 relay 밖의 커밋이 생기면 [머지]가 GitHub에서 거절되고 PR은 열린 채다(D176). 다시 읽은
//    뒤 [머지]하면 완료(머지됨)가 되고 정리 창을 연다. 정리에서 작업 브랜치와 원격 브랜치를 지운다(D178).
// 6. 밖에서 닫힘·다시 열림·머지(D179): 두 번째 Work의 PR을 닫으면 PR 닫힘이 되고, 다시 열고 [새로 고침]하면 읽기를
//    다시 시작한다. 밖에서 머지하면 완료(머지됨, outside)가 되고 정리 창을 그 Work를 볼 때 연다(D200).
//
// PR 대응(M10)의 공통 시나리오는 runRespondScenario다 (I53: [실제]는 가짜 claude와 실제 gh로 push, 답글 게시와 표시,
// 다시 실행을 본다).
// 7. CI가 실패하면 [실패한 체크 다시 실행]이 그 실행을 다시 돌린다(D203). 소유자의 대화 코멘트와 리뷰(본문, 인라인)가
//    들어오면 [대응 시작](D170)으로 대응 task가 CI 실패를 고치고 답글 초안을 쓴다. 승인하면 앱이 push하고 답글을
//    게시한다: 인라인은 그 스레드에, 리뷰 본문과 대화 코멘트는 원래 코멘트 링크를 붙인 대화 코멘트로, 표시 문구와 보이지
//    않는 표시를 붙여(D173, D194, D207). 항목은 처리됨이 되고, 앱이 게시한 답글은 항목이 아니다(D189, D194). 새 head의
//    CI가 통과하면 [머지]가 켜지고 머지 창이 판정표 경고를 보인다(D180, D206). 머지하고 정리한다.
import fs from 'node:fs'
import path from 'node:path'
import { expect } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { PrItemsFile } from '../../src/shared/pr'
import type { CleanPreview, PrView, TaskView, WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, settle, sleep, type Harness } from './harness'
import { handoff, scenario, steps, type Scenario, type Step } from './scenarios'

/** relay 밖의 GitHub: 사람, 봇, CI */
export interface PrWorld {
  readonly kind: 'fake' | 'real'
  /** PR의 기준 브랜치 (가짜: main, 실제: m9/<run>/base, I48) */
  readonly base: string
  /** 받을 봇에 적을 이름 (웹 화면 모양, D197) */
  readonly bot: string
  /** [새로 고침]을 다시 누르기 전에 쉬는 시간, 한 조건을 기다리는 한도, CI가 끝나기를 기다리는 한도 */
  readonly pollMs: number
  readonly waitMs: number
  readonly ciWaitMs: number
  /** 기준 브랜치의 파일 (시나리오가 바꿀 파일을 만든다) */
  file(name: string): string
  /** head 커밋의 CI가 끝나게 한다. 가짜는 체크를 넣고, 실제는 GitHub Actions가 끝나기를 기다린다 */
  runCi(pr: number, head: string): Promise<void>
  /** 소유자의 대화 코멘트 */
  convo(pr: number, body: string): Promise<void>
  /** 소유자의 리뷰: 본문과 인라인 코멘트 하나 */
  review(
    pr: number,
    head: string,
    r: { body: string; path: string; line: number; comment: string },
  ): Promise<void>
  /** 봇의 대화 코멘트 (시험용 레포의 봇 코멘트 워크플로) */
  botConvo(pr: number, body: string): Promise<void>
  /** relay 밖에서 브랜치에 커밋한다 (웹 편집). 값이 null인 파일은 지운다. 새 커밋을 돌려준다 */
  commit(branch: string, files: Record<string, string | null>, message: string): Promise<string>
  /** 다른 clone에서 기준 브랜치를 PR 브랜치에 병합하고, 충돌은 resolved로 풀어 push한다. 새 커밋을 돌려준다 */
  mergeBase(branch: string, resolved: Record<string, string>, message: string): Promise<string>
  close(pr: number): Promise<void>
  reopen(pr: number): Promise<void>
  /** relay 밖에서 머지한다 */
  merge(pr: number): Promise<void>
  /** 원격 브랜치의 커밋. 없으면 null */
  branchTip(branch: string): Promise<string | null>
  /** PR의 인라인 코멘트와 대화 코멘트 (앱이 게시한 답글 포함) */
  comments(pr: number): Promise<PrComment[]>
  /**
   * Actions 실행을 다시 실행했는가 (D203). 가짜는 gh run rerun의 기록을, 실제는 실행의 run_attempt가 2 이상이 될 때까지
   * 기다린다
   */
  rerunSeen(pr: number, run: number): Promise<boolean>
}

/** PR의 코멘트 하나 (REST pulls/<n>/comments와 issues/<n>/comments) */
export interface PrComment {
  kind: 'inline' | 'convo'
  id: number
  body: string
  /** 인라인 스레드의 답글이면 스레드 첫 코멘트 */
  reply_to: number | null
}

export interface PrContext {
  h: Harness
  world: PrWorld
  projectId: string
  /** 메인 체크아웃 */
  repo: string
  /** 진행 기록 한 줄 ([실제]의 결과 요약) */
  note(line: string): void
  /** 만든 Work의 브랜치와 PR (끝나면 치운다) */
  created: { branch: string; pr: number | null }[]
}

export interface PrWork {
  key: string
  workId: string
  branch: string
  dir: string
  tree: string
  pr: number
}

/** PR 브랜치에 더하는 코드 (S7의 HEAD_CODE와 같은 자리: 파일 끝) */
export const HEAD_CODE =
  '\n/**\n * 수량의 합 (relay M9 시험 변경).\n * @param {{ qty: number }[]} items\n * @returns {number}\n */\nexport function count(items) {\n  return items.reduce((sum, item) => sum + item.qty, 0);\n}\n'
/** 충돌을 만들려고 기준 브랜치가 같은 자리에 더하는 코드 (S7의 BASE_CODE) */
export const BASE_CODE =
  '\n/**\n * 장바구니가 비었는가 (relay M9 기준 브랜치 변경).\n * @param {unknown[]} items\n * @returns {boolean}\n */\nexport function isEmpty(items) {\n  return items.length === 0;\n}\n'
const CART = 'src/cart.mjs'
const CI_FAIL = 'ci-fail'
/**
 * PR 대응 시나리오의 PR이 더하는 새 파일. [실제]는 runPrScenario 뒤에 돌아 기준 브랜치에 HEAD_CODE가 이미 머지돼 있으므로,
 * 같은 코드를 더하면 PR의 diff에 없어 인라인 코멘트의 줄을 GitHub가 받지 않는다(HTTP 422 "Line could not be resolved")
 */
const RESPOND_FILE = 'src/m10.mjs'
const RESPOND_CODE =
  '/**\n * 두 배 (relay M10 시험 변경).\n * @param {number} n\n * @returns {number}\n */\nexport function double(n) {\n  return n * 2;\n}\n'

/** 가짜 claude의 기본 경로. fix가 files를 커밋하고 verify가 pr.md(제목 title)를 쓴다. PR 대응 task도 여기에 둔다 */
export function prClaude(files: Record<string, string>, title: string): Scenario {
  const fix: Step[] = [
    { do: 'prompt' },
    { do: 'commit', files, message: 'fix: relay M9 시험 변경' },
    ...steps('fix').filter((s) => s.do === 'write' || s.do === 'stop'),
  ]
  const verify: Step[] = [
    { do: 'prompt' },
    ...steps('verify').filter((s) => s.do === 'write' && s.file === 'verification.md'),
    { do: 'write', file: 'pr.md', text: `# ${title}\n\n## 요약\nrelay M9 시험 PR입니다.\n` },
    { do: 'write', file: 'handoff.md', text: handoff({ summary: '완료조건을 모두 통과했다.' }) },
    { do: 'stop' },
  ]
  return scenario({ fix, verify })
}

const read = (file: string) => fs.readFileSync(file, 'utf8')

export function workState(w: PrWork): WorkState {
  return JSON.parse(read(path.join(w.dir, 'work.json'))) as WorkState
}

export function workEvents(w: PrWork): LifecycleEvent[] {
  return read(path.join(w.dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

export function view(ctx: PrContext, w: PrWork): WorkView {
  const v = ctx.h.ui.works.get(w.key)
  if (!v) throw new Error(`스냅샷이 없음: ${w.key}`)
  return v
}

function prOf(ctx: PrContext, w: PrWork): PrView {
  const p = view(ctx, w).pr
  if (!p) throw new Error(`PR 패널이 없음: ${w.key}`)
  return p
}

/** PR 패널의 요약 (실패했을 때 보인다) */
export function describePr(p: PrView | null): string {
  if (!p) return '(PR 없음)'
  const items = p.items.map((i) => `${i.id}=${i.status}`).join(', ')
  const checks = p.checks.map((c) => `${c.label}=${c.bucket}`).join(', ')
  return `#${p.number} ${p.state ?? '?'} head ${p.head.slice(0, 8)} ci ${p.ci ?? '-'} checks [${checks}] mergeable ${p.mergeable ?? '-'} sync ${p.sync ?? '-'} gate ${p.gate.enabled ? '켜짐' : `꺼짐(${p.gate.reasons.join(' / ')})`} items [${items}] error ${p.error ?? '-'}`
}

/**
 * [새로 고침]을 누르며 pred를 기다린다. 가짜 세계는 대개 한 번에 맞고, 실제 세계는 GitHub가 계산하고 CI가 돌기를
 * 기다린다
 */
export async function refreshUntil(
  ctx: PrContext,
  w: PrWork,
  pred: (p: PrView, v: WorkView) => boolean,
  label: string,
  timeoutMs = ctx.world.waitMs,
): Promise<PrView> {
  const end = Date.now() + timeoutMs
  for (;;) {
    const r = await ctx.h.relay.prRefresh(w.key)
    await settle(ctx.h, w.key)
    const v = view(ctx, w)
    if (v.pr && pred(v.pr, v)) return v.pr
    if (Date.now() > end) {
      const last = `${r.ok ? '' : `[새로 고침 실패: ${r.error}] `}${describePr(v.pr)}`
      throw new Error(`기다리다 시간 초과: ${label}\n마지막 PR: ${last}`)
    }
    await sleep(ctx.world.pollMs)
  }
}

/** 새 Work를 만들어 기본 경로로 리뷰와 검증까지 가게 하고 [PR 생성]한다. PR 진행이 되고 첫 읽기가 끝날 때까지 기다린다 */
export async function openPrWork(
  ctx: PrContext,
  claude: Scenario,
  request: string,
): Promise<PrWork> {
  const { h } = ctx
  fs.writeFileSync(path.join(h.root, 'scenario.json'), JSON.stringify(claude))
  const created = await h.relay.createWork(ctx.projectId, {
    request,
    baseBranch: ctx.world.base,
    type: 'bugfix',
    baseLocation: 'remote',
  })
  if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
  const workId = created.workKey.split('/')[1] ?? ''
  const entry = { branch: `relay/${workId}`, pr: null as number | null }
  ctx.created.push(entry)
  const r = await drive(h.relay, h.ui, created.workKey, {
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, h.ui.dump()).toMatchObject({ status: 'paused' })
  await settle(h, created.workKey)
  const delivered = await h.relay.deliver(created.workKey, { choice: 'pr', uncommitted: null })
  expect(delivered, h.ui.dump()).toEqual({ ok: true })
  const w: PrWork = {
    key: created.workKey,
    workId,
    branch: entry.branch,
    dir: path.join(h.home, 'projects', ctx.projectId, 'works', workId),
    tree: path.join(h.home, 'projects', ctx.projectId, 'worktrees', workId),
    pr: 0,
  }
  // [PR 생성]이 성공하면 PR 진행이 되고 바로 한 번 읽는다 (시나리오 10-1)
  const first = await h.ui.until(
    () => {
      const p = h.ui.works.get(w.key)?.pr
      return p && p.readAt && !p.reading ? p : null
    },
    `${w.workId}의 첫 PR 읽기`,
    ctx.world.waitMs,
  )
  w.pr = first.number
  entry.pr = first.number
  return w
}

const newItems = (p: PrView, kind?: string) =>
  p.items.filter((i) => i.status === 'new' && (!kind || i.kind === kind))

/** 공통 시나리오를 차례로 돈다 */
export async function runPrScenario(ctx: PrContext): Promise<void> {
  const { h, world } = ctx
  const cart = world.file(CART)
  const fixed = { [CART]: cart + HEAD_CODE, [CI_FAIL]: 'relay M9 시험: CI를 실패시킨다\n' }

  // ---------- 1. 읽기 ----------
  const w = await openPrWork(ctx, prClaude(fixed, 'relay M9 시험: PR 진행'), 'relay M9 시험')
  const started = workState(w)
  expect(started.status).toBe('pr')
  expect(started.pr).toMatchObject({ number: w.pr, head: git(w.tree, 'rev-parse', 'HEAD') })
  // gh 버전을 적는다 (D198)
  expect(started.pr?.gh_version).toMatch(/^\d+\.\d+\.\d+/)
  expect(workEvents(w).map((e) => e.type)).toContain('delivery.succeeded')
  expect(workEvents(w).map((e) => e.type)).not.toContain('work.completed')
  const head1 = started.pr?.head ?? ''
  const first = prOf(ctx, w)
  ctx.note(`1. PR #${w.pr} 첫 읽기: ci ${first.ci}, 체크 ${first.checks.length}개`)
  if (first.checks.length === 0) {
    // 새 head의 체크가 아직 없으면 60초 동안 체크 기다림이다 (D196)
    expect(first.ci).toBe('waiting')
    expect(first.gate.reasons.some((r) => r.startsWith('체크 기다림'))).toBe(true)
    expect(view(ctx, w).badge.kind).toBe('pr_waiting')
  }
  await world.runCi(w.pr, head1)
  const failed = await refreshUntil(
    ctx,
    w,
    (p) => p.ci === 'fail' && newItems(p, 'ci').some((i) => i.text !== null),
    'CI 실패 항목과 로그',
    world.ciWaitMs,
  )
  const ci1 = newItems(failed, 'ci')[0]
  // 체크는 워크플로·이름·이벤트로 가린다. 이벤트는 실행마다 REST로 읽는다 (D201). 시험용 레포의 CI는 PR 브랜치에서
  // pull_request로만 돈다
  expect(ci1?.id).toBe(`ci:${head1}:ci/test (pull_request)`)
  expect(failed.checks.map((c) => c.label)).toEqual(['ci / test (pull_request)'])
  // 실패한 스텝의 로그 끝부분: 줄 앞의 작업, 스텝, 시각과 색 제어 문자를 뗐다 (S7 관찰 2)
  expect(ci1?.text).toContain('ci-fail 파일이 있어 실패합니다')
  expect(ci1?.text).not.toMatch(/\^\[\[|\t/)
  expect(view(ctx, w).badge.kind).toBe('pr_items')
  ctx.note(
    `1. CI 실패 항목 ${ci1?.id}, 체크 ${failed.checks.map((c) => `${c.label}: ${c.state}`).join(', ')}, 로그 ${ci1?.text?.split('\n').length}줄`,
  )

  // ---------- 2. 거르기 ----------
  const path2 = CART
  const line2 =
    (cart + HEAD_CODE).split('\n').findIndex((l) => l.startsWith('export function count')) + 1
  await world.convo(w.pr, 'relay M9 시험: 소유자의 대화 코멘트')
  await world.review(w.pr, head1, {
    body: 'relay M9 시험: 소유자의 리뷰 본문',
    path: path2,
    line: line2,
    comment: 'relay M9 시험: 소유자의 인라인 코멘트',
  })
  await world.botConvo(w.pr, 'relay M9 시험: 봇 코멘트')
  const filtered = await refreshUntil(
    ctx,
    w,
    (p) =>
      ['convo', 'review', 'inline'].every((k) => newItems(p, k).length === 1) &&
      p.items.some((i) => i.kind === 'convo' && i.status === 'not_accepted'),
    '소유자의 코멘트 셋은 새 항목, 봇 코멘트는 받지 않음',
  )
  const bot = filtered.items.find((i) => i.status === 'not_accepted')
  expect(bot?.why).toContain(`봇 ${world.bot}`)
  expect(newItems(filtered, 'inline')[0]?.where).toBe(`${path2}:${line2}`)
  expect(
    h.ui.notices.some(
      (n) => n.workKey === w.key && /PR #\d+: 대응 거리 \d+개가 들어옴/.test(n.body),
    ),
  ).toBe(true)
  // 받을 봇에 적으면 다음 읽기를 기다리지 않고 받는다 (D161, D197). [bot]을 붙여 적어도 같다
  expect(
    await h.relay.updateProjectSettings(ctx.projectId, {
      allowed_bots: [`${world.bot}[bot]`],
      merge_method: null,
    }),
  ).toEqual({ ok: true })
  await settle(h, w.key)
  expect(prOf(ctx, w).items.find((i) => i.id === bot?.id)?.status).toBe('new')
  ctx.note(`2. 거르기: 소유자 3개 받음, 봇 ${bot?.id} 받지 않음 → 받을 봇에 적어 받음`)

  // ---------- 3. 제외, 다시 넣기, relay 밖의 수정 ----------
  for (const i of newItems(prOf(ctx, w))) {
    expect(await h.relay.prItem(w.key, i.id, 'exclude')).toEqual({ ok: true })
  }
  const excluded = prOf(ctx, w)
  expect(newItems(excluded)).toEqual([])
  // 제외해도 CI 실패는 머지를 막는다 (D176)
  expect(excluded.gate.enabled).toBe(false)
  expect(excluded.gate.reasons.some((r) => r.startsWith('CI 실패'))).toBe(true)
  expect(excluded.gate.reasons.some((r) => r.startsWith('처리하지 않은 항목'))).toBe(false)
  // 사람이 제외한 조건 항목은 조건이 풀려도 그대로라(D199) CI 실패 항목은 [다시 넣기]로 되돌린다
  expect(await h.relay.prItem(w.key, ci1?.id ?? '', 'include')).toEqual({ ok: true })
  expect(newItems(prOf(ctx, w)).map((i) => i.id)).toEqual([ci1?.id])
  const head2 = await world.commit(
    w.branch,
    { [CI_FAIL]: null },
    'relay M9 시험: ci-fail 지움 (relay 밖)',
  )
  const synced = await refreshUntil(
    ctx,
    w,
    (p) => p.head === head2 && p.synced.length === 1,
    'relay 밖의 커밋을 fast-forward로 받음',
  )
  expect(synced.synced[0]?.commits).toEqual([head2])
  expect(git(w.tree, 'rev-parse', 'HEAD')).toBe(head2)
  // 옛 head의 CI 실패 항목은 해소됨이다 (D199)
  expect(synced.items.find((i) => i.id === ci1?.id)?.status).toBe('resolved')
  if (world.kind === 'fake') expect(synced.ci).toBe('waiting')
  await world.runCi(w.pr, head2)
  const passing = await refreshUntil(
    ctx,
    w,
    (p) => p.ci === 'pass' && p.gate.enabled,
    '새 head의 CI 통과와 [머지] 켜짐',
    world.ciWaitMs,
  )
  expect(view(ctx, w).badge.kind).toBe('mergeable')
  expect(h.ui.notices.some((n) => n.workKey === w.key && n.body.includes('머지할 수 있음'))).toBe(
    true,
  )
  ctx.note(`3. ${head2.slice(0, 8)}를 받고 CI 통과, [머지] 켜짐 (${passing.checks.length}개 체크)`)

  // ---------- 4. 충돌 ----------
  const base1 = await world.commit(
    world.base,
    { [CART]: cart + BASE_CODE },
    'relay M9 시험: 기준 브랜치 변경 (충돌)',
  )
  const conflicted = await refreshUntil(
    ctx,
    w,
    (p) => newItems(p, 'conflict').length === 1,
    '충돌 항목',
  )
  // 충돌 항목의 id는 fetch한 기준 브랜치의 커밋이다 (PR의 baseRefOid가 아님, S7 관찰 7)
  expect(newItems(conflicted, 'conflict')[0]?.id).toBe(`conflict:${base1}`)
  expect(conflicted.gate.reasons).toContain('기준 브랜치와 충돌')
  const head3 = await world.mergeBase(
    w.branch,
    { [CART]: cart + BASE_CODE + HEAD_CODE },
    'relay M9 시험: 기준 브랜치 병합 (relay 밖)',
  )
  const merged = await refreshUntil(
    ctx,
    w,
    (p) =>
      p.head === head3 &&
      p.synced.length === 2 &&
      p.items.some((i) => i.id === `conflict:${base1}` && i.status === 'resolved'),
    '병합 커밋을 받고 충돌 항목이 해소됨',
  )
  // 받은 커밋에 기준 브랜치 병합이 있어 기준 커밋을 옮겼다 (D181, D193)
  expect(merged.synced[1]?.baseCommit).toBe(base1)
  expect(workState(w).base_commit).toBe(base1)
  expect(
    workEvents(w)
      .filter((e) => e.type === 'pr.synced')
      .at(-1)?.payload,
  ).toMatchObject({
    base_commit: base1,
  })
  await world.runCi(w.pr, head3)
  await refreshUntil(
    ctx,
    w,
    (p) => p.ci === 'pass' && p.gate.enabled,
    '병합 뒤 CI 통과와 [머지] 켜짐',
    world.ciWaitMs,
  )
  ctx.note(
    `4. 충돌 conflict:${base1.slice(0, 8)} → 병합 ${head3.slice(0, 8)}를 받아 해소, 기준 커밋 옮김`,
  )

  // ---------- 5. 머지 ----------
  const info = await h.relay.prMergeInfo(w.key)
  if (!info.ok) throw new Error(`머지 창: ${info.error}`)
  expect(info.info.head).toBe(head3)
  expect(info.info.gate.enabled).toBe(true)
  const method = info.info.preferred
  if (!method) throw new Error('머지 방식이 없음')
  // 사람이 머지 창을 연 뒤 relay 밖에서 커밋이 생겼다
  const head4 = await world.commit(
    w.branch,
    { 'm9-outside.txt': 'relay M9 시험: 머지 창을 연 뒤의 커밋\n' },
    'relay M9 시험: 머지 직전 커밋 (relay 밖)',
  )
  const refused = await h.relay.prMerge(w.key, { method, head: head3 })
  expect(refused.ok).toBe(false)
  expect(!refused.ok && refused.error).toContain('새 커밋')
  await settle(h, w.key)
  expect(workState(w)).toMatchObject({ status: 'pr' })
  expect(workState(w).operation).toBeUndefined()
  await world.runCi(w.pr, head4)
  await refreshUntil(
    ctx,
    w,
    (p) => p.head === head4 && p.ci === 'pass' && p.gate.enabled,
    '새 head를 받고 [머지] 켜짐',
    world.ciWaitMs,
  )
  const info2 = await h.relay.prMergeInfo(w.key)
  if (!info2.ok) throw new Error(`머지 창: ${info2.error}`)
  expect(info2.info.head).toBe(head4)
  expect(await h.relay.prMerge(w.key, { method, head: head4 })).toEqual({ ok: true })
  await settle(h, w.key)
  const done = workState(w)
  expect(done.status).toBe('completed')
  expect(done.operation).toBeUndefined()
  expect(done.pr?.merged).toMatchObject({ head: head4, method, outside: false })
  expect(
    workEvents(w)
      .slice(-2)
      .map((e) => [e.type, e.payload]),
  ).toEqual([
    ['pr.merged', { head: head4, method, outside: false }],
    ['work.completed', { delivery: 'pr', merged: true }],
  ])
  // 머지 뒤 정리 창 (D178, D200): 화면이 열고 연 것을 알린다
  expect(view(ctx, w).pr?.offerClean).toBe(true)
  expect(await h.relay.prCleanOffered(w.key)).toEqual({ ok: true })
  await settle(h, w.key)
  expect(view(ctx, w).pr?.offerClean).toBe(false)
  await cleanMerged(ctx, w)
  ctx.note(`5. 머지 거절(새 커밋) 뒤 ${method}로 머지, 정리에서 작업 브랜치와 원격 브랜치를 지움`)

  // ---------- 6. 밖에서 닫힘·다시 열림·머지 ----------
  const w2 = await openPrWork(
    ctx,
    prClaude(
      { 'src/m9-second.mjs': 'export const second = 2;\n' },
      'relay M9 시험: 밖에서 닫힘과 머지',
    ),
    'relay M9 시험 (둘째)',
  )
  await world.close(w2.pr)
  const closed = await refreshUntil(ctx, w2, (p) => p.closed, 'PR 닫힘')
  expect(closed.state).toBe('CLOSED')
  expect(view(ctx, w2).badge.kind).toBe('pr_closed')
  expect(workState(w2).status).toBe('pr')
  expect(h.ui.notices.some((n) => n.workKey === w2.key && n.body.includes('PR이 닫혀'))).toBe(true)
  await world.reopen(w2.pr)
  await refreshUntil(ctx, w2, (p) => !p.closed && p.state === 'OPEN', 'PR 다시 열림')
  expect(workEvents(w2).map((e) => e.type)).toEqual(
    expect.arrayContaining(['pr.closed', 'pr.reopened']),
  )
  await world.merge(w2.pr)
  await refreshUntil(ctx, w2, (_p, v) => v.status === 'completed', '밖에서 머지됨')
  const done2 = workState(w2)
  expect(done2.pr?.merged).toMatchObject({ outside: true, method: null })
  expect(view(ctx, w2).pr?.offerClean).toBe(true)
  expect(h.ui.notices.some((n) => n.workKey === w2.key && n.body.includes('밖에서 머지됨'))).toBe(
    true,
  )
  expect(await h.relay.prCleanOffered(w2.key)).toEqual({ ok: true })
  await cleanMerged(ctx, w2)
  ctx.note(`6. PR #${w2.pr} 닫힘 → 다시 열림 → 밖에서 머지, 정리`)
}

/** 머지로 완료한 Work를 정리한다: 작업 브랜치 삭제가 기본으로 체크되고, 원격 브랜치도 지운다 (D178) */
export async function cleanMerged(ctx: PrContext, w: PrWork): Promise<CleanPreview> {
  const { h } = ctx
  const p = await h.relay.cleanPreview(w.key)
  if (!p.ok) throw new Error(`정리 요약: ${p.error}`)
  expect(p.preview.merged).toBe(true)
  expect(p.preview.remote).toEqual({ name: w.branch, exists: true })
  expect(p.preview.branch?.deletable).toBe(true)
  const r = await h.relay.clean(w.key, {
    deleteBranch: true,
    deleteBackups: true,
    deleteRemote: true,
    confirmed: p.preview.confirm.length > 0,
    expect: p.preview.expect,
  })
  expect(r).toEqual({ ok: true })
  await settle(h, w.key)
  const s = workState(w)
  expect(s.status).toBe('archived')
  expect(s.cleaned?.deleted_branches).toContain(w.branch)
  expect(s.cleaned?.deleted_remote_branch).toBe(w.branch)
  expect(git(ctx.repo, 'branch', '--list', w.branch)).toBe('')
  expect(await ctx.world.branchTip(w.branch)).toBeNull()
  return p.preview
}

// ---------- PR 대응 (M10) ----------

/** pr-items.json (D191) */
export function prItems(w: PrWork): PrItemsFile {
  return JSON.parse(read(path.join(w.dir, 'pr-items.json'))) as PrItemsFile
}

/**
 * 가짜 claude의 PR 대응 task (5.6.7): CI를 실패시키는 ci-fail을 지워 커밋하고, 항목별 결과와 코멘트 항목마다 답글
 * 초안을 쓴다
 */
export function respondClaude(files: Record<string, string>, title: string): Scenario {
  const base = prClaude(files, title)
  const respond: Step[] = [
    { do: 'prompt' },
    { do: 'git', args: ['rm', '-q', CI_FAIL] },
    { do: 'git', args: ['commit', '-q', '-m', 'fix: ci-fail 지움 (relay M10 대응)'] },
    { do: 'respond', text: '{id}: relay M10 시험 답글입니다. 반영했습니다.' },
    { do: 'write', file: 'handoff.md', text: handoff({ summary: 'CI 실패와 코멘트에 대응했다.' }) },
    { do: 'stop' },
  ]
  return { ...base, tasks: { ...base.tasks, 'pr-respond': respond } }
}

/** 지금 task가 조건을 만족할 때까지 */
export function currentUntil(
  ctx: PrContext,
  w: PrWork,
  pred: (t: TaskView) => boolean,
  label: string,
): Promise<TaskView> {
  return ctx.h.ui.until(
    () => {
      const v = ctx.h.ui.works.get(w.key)
      const t = v?.tasks.find((x) => x.id === v.current)
      return t && pred(t) ? t : null
    },
    label,
    ctx.world.waitMs,
  )
}

/** PR 대응의 공통 시나리오 (파일 머리의 7) */
export async function runRespondScenario(ctx: PrContext): Promise<void> {
  const { h, world } = ctx
  const w = await openPrWork(
    ctx,
    respondClaude(
      { [RESPOND_FILE]: RESPOND_CODE, [CI_FAIL]: 'relay M10 시험: CI를 실패시킨다\n' },
      'relay M10 시험: PR 대응',
    ),
    'relay M10 시험 (대응)',
  )
  const head1 = workState(w).pr?.head ?? ''

  // ---------- CI 실패와 [실패한 체크 다시 실행] (D175, D203) ----------
  await world.runCi(w.pr, head1)
  const failed = await refreshUntil(
    ctx,
    w,
    (p) => p.ci === 'fail' && p.rerun !== null && newItems(p, 'ci').length === 1,
    'CI 실패와 [실패한 체크 다시 실행]',
    world.ciWaitMs,
  )
  expect(failed.rerun).toMatchObject({
    enabled: true,
    checks: ['ci / test (pull_request)'],
    others: [],
  })
  const run = failed.rerun?.runs[0] ?? 0
  expect(failed.rerun?.runs).toEqual([run])
  expect(await h.relay.prRerun(w.key)).toEqual({ ok: true })
  await settle(h, w.key)
  expect(workEvents(w).find((e) => e.type === 'pr.checks_rerun')?.payload).toEqual({
    runs: [run],
    checks: ['ci / test (pull_request)'],
  })
  expect(await world.rerunSeen(w.pr, run)).toBe(true)
  // 다시 돈 실행이 끝나기를 기다린다 (시험용 레포의 CI는 ci-fail이 있어 또 실패한다)
  await world.runCi(w.pr, head1)
  ctx.note(`7. CI 실패 → [실패한 체크 다시 실행]이 실행 ${run}을 다시 돌림`)

  // ---------- 코멘트와 [대응 시작] (D170) ----------
  const line = RESPOND_CODE.split('\n').findIndex((l) => l.startsWith('export function double')) + 1
  await world.convo(w.pr, 'relay M10 시험: 소유자의 대화 코멘트')
  await world.review(w.pr, head1, {
    body: 'relay M10 시험: 소유자의 리뷰 본문',
    path: RESPOND_FILE,
    line,
    comment: 'relay M10 시험: 소유자의 인라인 코멘트',
  })
  const ready = await refreshUntil(
    ctx,
    w,
    (p) => ['ci', 'convo', 'review', 'inline'].every((k) => newItems(p, k).length === 1),
    '대응 거리 넷 (CI 실패, 대화 코멘트, 리뷰 본문, 인라인 코멘트)',
    world.ciWaitMs,
  )
  expect(ready.respond.enabled).toBe(true)
  expect([...ready.respond.items].sort()).toEqual(
    newItems(ready)
      .map((i) => i.id)
      .sort(),
  )
  expect(view(ctx, w).badge.kind).toBe('pr_items')
  expect(
    await h.relay.prRespond(w.key, {
      items: ready.respond.items,
      instruction: 'relay M10 시험: CI 실패도 고쳐 주세요',
    }),
  ).toEqual({ ok: true })
  const task = await currentUntil(
    ctx,
    w,
    (t) => t.node === 'respond' && t.status === 'awaiting_approval',
    '대응 task 승인 대기',
  )
  await settle(h, w.key)
  expect(task.band).toContain('이유: 대응 시작')
  const responding = view(ctx, w)
  // 대응 task가 끝나기 전까지 배지는 task 상태이고, [머지]와 [대응 시작]은 꺼진다 (D176, D183, D170)
  expect(responding.badge.kind).toBe('awaiting_approval')
  expect(responding.pr?.gate.reasons).toContain('돌거나 기다리는 PR 대응 task가 있음')
  expect(responding.pr?.respond.enabled).toBe(false)
  expect(
    responding.pr?.items
      .filter((i) => i.status === 'responding')
      .map((i) => i.id)
      .sort(),
  ).toEqual([...ready.respond.items].sort())
  // 승인 화면: 항목별 결과와 게시될 모양의 답글 (D172, D207)
  const review = await h.relay.review(w.key, task.id)
  const replies = review?.respond?.replies ?? []
  expect(replies.map((r) => [r.item.split(':')[0], r.where.startsWith('스레드')])).toEqual(
    expect.arrayContaining([
      ['convo', false],
      ['review', false],
      ['inline', true],
    ]),
  )
  expect(replies).toHaveLength(3)
  for (const r of replies) {
    expect(r.body).toContain('relay M10 시험 답글입니다')
    expect(r.body).toContain(DEFAULT_CONFIG.reply_signature)
    expect(r.body).not.toContain('<!-- relay:')
  }
  const convoReply = replies.find((r) => r.item.startsWith('convo:'))
  expect(convoReply?.body).toMatch(/^> @\S+의 대화 코멘트에 대한 답글: https?:\/\//)
  expect(review?.respond?.results).toContain(ready.respond.items[0])
  expect(review?.emphasis.map((e) => e.kind)).not.toContain('existing_tests')

  // ---------- 승인 → push와 답글 게시 (D169, D172, D194) ----------
  expect(await h.relay.approve(w.key, task.id, {})).toEqual({ ok: true })
  await settle(h, w.key)
  const after = workState(w)
  expect(after.status).toBe('pr')
  expect(after.operation).toBeUndefined()
  const record = after.tasks.find((t) => t.id === task.id)
  expect(record?.status).toBe('approved')
  expect(record?.respond?.published_at).toBeDefined()
  const head2 = git(w.tree, 'rev-parse', 'HEAD')
  expect(await world.branchTip(w.branch)).toBe(head2)
  const round = prItems(w).rounds.find((r) => r.task_id === task.id)
  expect(round?.pushed?.commits).toEqual([head2])
  expect(round?.replies.every((r) => r.comment_id !== undefined && r.url)).toBe(true)
  const posted = await world.comments(w.pr)
  const inlineItem = ready.items.find((i) => i.kind === 'inline')?.id ?? ''
  for (const r of round?.replies ?? []) {
    const c = posted.find((x) => x.id === r.comment_id)
    expect(c, r.item).toBeDefined()
    expect(c?.body).toContain(r.marker)
    expect(c?.body).toContain(DEFAULT_CONFIG.reply_signature)
    if (r.item === inlineItem) {
      expect(c).toMatchObject({ kind: 'inline', reply_to: Number(inlineItem.split(':')[1]) })
    } else {
      expect(c?.kind).toBe('convo')
      expect(c?.body).toMatch(/^> @\S+의 (리뷰|대화 코멘트)에 대한 답글: /)
    }
  }
  const types = workEvents(w).map((e) => e.type)
  expect(types).toEqual(expect.arrayContaining(['pr.pushed', 'pr.replied']))
  ctx.note(
    `7. [대응 시작] → 대응 task ${task.id} 승인 → push ${head2.slice(0, 8)}, 답글 ${round?.replies.length}개 게시 (${(round?.replies ?? []).map((r) => r.item).join(', ')})`,
  )

  // ---------- 처리됨, 앱의 답글은 항목이 아님, 머지 (D189, D194, D206) ----------
  await world.runCi(w.pr, head2)
  const passing = await refreshUntil(
    ctx,
    w,
    (p) => p.head === head2 && p.ci === 'pass' && p.gate.enabled,
    '대응 뒤 CI 통과와 [머지] 켜짐',
    world.ciWaitMs,
  )
  expect(
    passing.items.filter((i) => ready.respond.items.includes(i.id)).map((i) => i.status),
  ).toEqual(ready.respond.items.map(() => 'done'))
  // 앱이 게시한 답글과 그 때문에 생긴 본문 없는 리뷰는 항목이 아니다
  expect(passing.items.map((i) => i.id).sort()).toEqual([...ready.respond.items].sort())
  expect(passing.rounds).toMatchObject([{ round: 1, state: 'published', taskId: task.id }])
  const info = await h.relay.prMergeInfo(w.key)
  if (!info.ok) throw new Error(`머지 창: ${info.error}`)
  expect(info.info.stale).toEqual({ rounds: 1, synced: 0 })
  expect(info.info.verdicts.length).toBeGreaterThan(0)
  const method = info.info.preferred
  if (!method) throw new Error('머지 방식이 없음')
  expect(await h.relay.prMerge(w.key, { method, head: head2 })).toEqual({ ok: true })
  await settle(h, w.key)
  expect(workState(w).status).toBe('completed')
  expect(await h.relay.prCleanOffered(w.key)).toEqual({ ok: true })
  await cleanMerged(ctx, w)
  ctx.note(
    `7. 항목 넷 처리됨, 앱의 답글은 항목 아님, 판정표 경고(라운드 1) 뒤 ${method}로 머지, 정리`,
  )
}
