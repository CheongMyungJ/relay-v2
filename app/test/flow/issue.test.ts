// [흐름] 이슈 기록 (docs/implementation.md M19, 설계 3.7, D336~D349, I96~I101).
// 의도 승인 때 가짜 gh로 이슈를 만들고, 승인된 task마다 코멘트를 덧붙이고, [PR 생성]의 본문 끝에 Closes를 붙인다.
// 되감기는 코멘트 하나로 알리고, Work가 끝나면 끝 코멘트를 단 뒤 닫는다(기존 이슈는 닫지 않음). 게시가 실패해도 흐름은
// 막히지 않고 [다시 시도]와 앱을 다시 켤 때 앞부터 순서대로 올라가며, 결과를 모르는 게시는 표시로 찾아 두 번 올리지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, type Harness } from './harness'
import { REPO_FILES, REQUEST, scenario, type Scenario } from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** origin을 GitHub 주소로 두고 push는 로컬 bare 원격으로 간다 (delivery.test.ts와 같음) */
const GITHUB = 'https://github.com/relay-test/sample.git'
/** gh --repo에 주는 origin의 레포 (core/delivery ghRepo) */
const GH_REPO = 'github.com/relay-test/sample'
const ISSUE_URL = 'https://github.com/relay-test/sample/issues'

interface FakeIssue {
  number: number
  url: string
  repo: string
  title: string
  body: string
  labels: string[]
  state: 'open' | 'closed'
  state_reason?: string
  comments: { id: number; url: string; body: string }[]
}

interface FakeIssues {
  labels: Record<string, string[]>
  issues: FakeIssue[]
  faults: string[]
}

interface Setup {
  h: Harness
  key: string
  dir: string
  workId: string
}

interface Options {
  config?: object
  env?: Record<string, string>
  /** 새 Work 대화상자의 이슈 번호 (D338) */
  issueNumber?: number
  /** 시작할 때의 issues.json */
  issues?: Partial<FakeIssues>
}

async function setup(s: Scenario, o: Options = {}): Promise<Setup> {
  h = await harness({ scenario: s, config: o.config ?? {}, env: o.env ?? {} })
  const hh = h
  if (o.issues) {
    fs.mkdirSync(path.join(hh.root, 'record'), { recursive: true })
    fs.writeFileSync(path.join(hh.root, 'record', 'issues.json'), JSON.stringify(o.issues))
  }
  const { repo, remote } = makeRepo(hh.root, 'sample', REPO_FILES)
  git(repo, 'remote', 'set-url', 'origin', GITHUB)
  git(repo, 'remote', 'set-url', '--push', 'origin', remote)
  const projectId = await register(hh, repo, 'main', { issueLog: true })
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation: 'local',
    ...(o.issueNumber ? { issueNumber: o.issueNumber } : {}),
  })
  if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
  const workId = r.workKey.split('/')[1] ?? ''
  return {
    h: hh,
    key: r.workKey,
    dir: path.join(hh.home, 'projects', projectId, 'works', workId),
    workId,
  }
}

const work = (s: Setup) => JSON.parse(read(path.join(s.dir, 'work.json'))) as WorkState

function events(s: Setup): LifecycleEvent[] {
  return read(path.join(s.dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

function issues(s: Setup): FakeIssues {
  const file = path.join(s.h.root, 'record', 'issues.json')
  return fs.existsSync(file)
    ? (JSON.parse(read(file)) as FakeIssues)
    : { labels: {}, issues: [], faults: [] }
}

const gh = (s: Setup, type: string) =>
  s.h.ghRecords().filter((r) => r['type'] === type) as { args: string[]; body?: string }[]

/** 하던 게시가 끝날 때까지 기다린다 (I98) */
async function published(s: Setup): Promise<void> {
  await settle(s.h, s.key)
  await s.h.relay.work(s.key)?.issueIdle()
  await settle(s.h, s.key)
}

/** 리뷰와 검증이 승인 대기가 될 때까지 간다 */
async function toVerify(s: Setup, awaitAuto = false): Promise<void> {
  const r = await drive(s.h.relay, s.h.ui, s.key, {
    awaitAuto,
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused', reason: '03 리뷰와 검증: 승인 대기' })
  await published(s)
}

/** 보이지 않는 표시 (D349). 표시 id는 work-id에 임의의 글자를 붙인 것이다 */
function marker(s: Setup, key: string): string {
  const mark = work(s).issue?.mark ?? ''
  expect(mark).toMatch(new RegExp(`^${s.workId}-[0-9a-f]{8}$`))
  return `<!-- relay:${mark}/issue/${key} -->`
}

describe('[흐름] 이슈 기록 (M19, 설계 3.7)', () => {
  it('의도 승인에서 라벨을 붙인 이슈를 만들고, 승인된 task마다 코멘트를 달고, [PR 생성]에 Closes를 붙인다 (D336, D339, D342, D346, D348)', async () => {
    const s = await setup(scenario(), {
      config: { auto_approve: { fix: true }, auto_approve_countdown_sec: 1 },
    })
    await toVerify(s, true)
    let all = issues(s)
    expect(all.labels[GH_REPO]).toEqual(['relay'])
    expect(all.issues).toHaveLength(1)
    const issue = all.issues[0]
    expect(issue).toMatchObject({
      number: 1,
      url: `${ISSUE_URL}/1`,
      repo: GH_REPO,
      title: '빈 배열의 평균이 NaN이 되는 문제를 고친다.',
      labels: ['relay'],
      state: 'open',
    })
    // 본문은 intent(머리글 뺌)와 표시다 (D336, D349)
    expect(issue?.body).toContain('## 목표\n빈 배열의 평균이 NaN이 되는 문제를 고친다.')
    expect(issue?.body).not.toContain('schema_version')
    expect(issue?.body).toContain(marker(s, 'body'))
    // intake와 fix의 코멘트. verify는 아직 승인하지 않았다
    const [intake, fix] = issue?.comments ?? []
    expect(issue?.comments).toHaveLength(2)
    // 새 이슈의 v1 intent는 본문과 같아 intake 코멘트에서 뺀다 (D339)
    expect(intake?.body).toContain('### t-01 의도 정리 · 승인(사람)')
    expect(intake?.body).toContain('**요약**\n\n의도 초안을 썼다.')
    expect(intake?.body).toContain('- 빈 배열의 평균은 0 — 빈 배열의 평균은 0인 이유 (AI)')
    expect(intake?.body).not.toContain('**intent v1**')
    expect(intake?.body).not.toContain('<details>')
    expect(intake?.body).toContain(marker(s, 't-01'))
    // 자동 승인은 머리 줄에 적는다 (D342). 산출물은 접는다 (D339)
    expect(fix?.body).toContain('### t-02 원인 분석과 수정 · 승인(자동)')
    expect(fix?.body).toContain('- 원인은 0으로 나눔 — 원인은 0으로 나눔인 이유 (AI)')
    expect(fix?.body).toContain('<details><summary>fix.md</summary>')
    expect(fix?.url).toMatch(new RegExp(`^${ISSUE_URL}/1#issuecomment-\\d+$`))

    expect(await s.h.relay.deliver(s.key, { choice: 'pr', uncommitted: null })).toEqual({
      ok: true,
    })
    await published(s)
    // PR 본문 끝에 Closes를 붙인다 (D346)
    expect(gh(s, 'pr create')[0]?.body?.endsWith('\n\nCloses #1\n')).toBe(true)
    all = issues(s)
    const verify = all.issues[0]?.comments[2]
    expect(verify?.body).toContain('### t-03 리뷰와 검증 · 승인(사람)')
    expect(verify?.body).toContain('<details><summary>verification.md</summary>')
    expect(verify?.body).toContain('<details><summary>pr.md</summary>')
    // PR 진행이라 아직 끝 코멘트와 닫기가 없다
    expect(all.issues[0]?.comments).toHaveLength(3)
    expect(all.issues[0]?.state).toBe('open')
    const w = work(s)
    expect(w.issue).toMatchObject({
      linked: false,
      number: 1,
      url: `${ISSUE_URL}/1`,
      pending: [],
    })
    expect(w.issue?.posted.map((p) => p.key)).toEqual(['body', 't-01', 't-02', 't-03'])
    expect(w.issue?.posted[1]?.comment_id).toBe(all.issues[0]?.comments[0]?.id)
    const logged = events(s).filter((e) => e.type.startsWith('issue.'))
    expect(logged.map((e) => [e.type, e.payload['key'] ?? null])).toEqual([
      ['issue.created', null],
      ['issue.posted', 't-01'],
      ['issue.posted', 't-02'],
      ['issue.posted', 't-03'],
    ])
    expect(logged[0]?.payload).toEqual({ number: 1, url: `${ISSUE_URL}/1`, labeled: true })
    expect(s.h.ui.works.get(s.key)?.issue).toEqual({
      number: 1,
      url: `${ISSUE_URL}/1`,
      linked: false,
      pending: 0,
      publishing: false,
      failure: null,
      closed: false,
    })
  })

  it('[push]로 끝나면 끝 코멘트를 달고 completed로 닫는다 (D346, D347)', async () => {
    const s = await setup(scenario())
    await toVerify(s)
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await published(s)
    const issue = issues(s).issues[0]
    expect(issue?.comments.map((c) => c.body.split('\n')[0])).toEqual([
      '### t-01 의도 정리 · 승인(사람)',
      '### t-02 원인 분석과 수정 · 승인(사람)',
      '### t-03 리뷰와 검증 · 승인(사람)',
      `Work 완료(push): 브랜치 \`relay/${s.workId}\``,
    ])
    expect(issue).toMatchObject({ state: 'closed', state_reason: 'completed' })
    expect(work(s).issue).toMatchObject({ pending: [], closed: { reason: 'completed' } })
    expect(work(s).issue?.posted.map((p) => p.key)).toEqual([
      'body',
      't-01',
      't-02',
      't-03',
      'end',
      'close',
    ])
  })

  it('[Work 포기]는 끝 코멘트를 달고 not planned로 닫는다. 라벨을 만들 권한이 없으면 라벨 없이 만든다. 의도 승인 전에 포기하면 아무것도 올리지 않는다 (D346, D349)', async () => {
    const s = await setup(scenario(), { env: { FAKE_GH_FAIL: 'label' } })
    const r = await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(await s.h.relay.abandon(s.key)).toEqual({ ok: true })
    await published(s)
    const issue = issues(s).issues[0]
    expect(issue?.comments.map((c) => c.body.split('\n')[0])).toEqual([
      '### t-01 의도 정리 · 승인(사람)',
      'Work 포기',
    ])
    expect(issue).toMatchObject({ state: 'closed', state_reason: 'not planned', labels: [] })
    expect(events(s).find((e) => e.type === 'issue.created')?.payload['labeled']).toBe(false)
    await h?.close()

    const t = await setup(scenario())
    await t.h.ui.until(
      () => t.h.ui.works.get(t.key)?.tasks[0]?.status === 'awaiting_approval' || null,
      'intake 승인 대기',
    )
    expect(await t.h.relay.abandon(t.key)).toEqual({ ok: true })
    await published(t)
    expect(issues(t).issues).toEqual([])
    expect(work(t).issue).toEqual({
      linked: false,
      number: null,
      url: null,
      mark: expect.stringMatching(new RegExp(`^${t.workId}-[0-9a-f]{8}$`)) as unknown,
      pending: [],
      posted: [],
    })
  })

  it('기존 이슈 번호를 적으면 새 이슈 없이 intent부터 코멘트로 달고, 끝나도 닫지 않는다 (D338, D339, D346)', async () => {
    const existing: FakeIssue = {
      number: 7,
      url: `${ISSUE_URL}/7`,
      repo: GH_REPO,
      title: '평균이 이상함',
      body: '빈 배열이면 NaN',
      labels: [],
      state: 'open',
      comments: [],
    }
    const s = await setup(scenario(), {
      issueNumber: 7,
      issues: { labels: {}, issues: [existing], faults: [] },
    })
    await toVerify(s)
    // [완료만]
    expect(await s.h.relay.approve(s.key, 't-03', {})).toEqual({ ok: true })
    await published(s)
    expect(gh(s, 'issue create')).toEqual([])
    expect(gh(s, 'label create')).toEqual([])
    expect(gh(s, 'issue close')).toEqual([])
    const issue = issues(s).issues[0]
    expect(issue).toMatchObject({ number: 7, body: '빈 배열이면 NaN', state: 'open' })
    expect(issue?.comments[0]?.body).toContain('**intent v1**\n\n## 목표')
    expect(issue?.comments.map((c) => c.body.split('\n')[0])).toEqual([
      '### t-01 의도 정리 · 승인(사람)',
      '### t-02 원인 분석과 수정 · 승인(사람)',
      '### t-03 리뷰와 검증 · 승인(사람)',
      'Work 완료',
    ])
    expect(work(s).issue).toMatchObject({ linked: true, number: 7, url: `${ISSUE_URL}/7` })
  })

  it('되감기로 올린 task를 폐기하면 코멘트 하나로 알린다 (D341)', async () => {
    const s = await setup(scenario())
    await toVerify(s)
    const p = await s.h.relay.stepPreview(s.key, 'fix', false)
    if (!p.ok) throw new Error(p.error)
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'fix',
        keepCode: false,
        instruction: '경계값도 확인한다',
        expect: p.preview.expect,
      }),
    ).toEqual({ ok: true })
    await published(s)
    const comments = issues(s).issues[0]?.comments ?? []
    expect(comments.map((c) => c.body.split('\n')[0])).toEqual([
      '### t-01 의도 정리 · 승인(사람)',
      '### t-02 원인 분석과 수정 · 승인(사람)',
      '### 되감기: t-02 원인 분석과 수정, t-03 리뷰와 검증 폐기',
    ])
    expect(comments[2]?.body).toContain('t-04 원인 분석과 수정부터 다시 한다.')
    expect(comments[2]?.body).toContain('**추가 지시**\n\n경계값도 확인한다')
    expect(comments[2]?.body).toContain(marker(s, 'rewind-t-04'))
  })

  it('게시가 실패해도 흐름은 막히지 않고, [다시 시도]와 앱을 다시 켤 때 앞부터 순서대로 올린다 (D344, I98)', async () => {
    const s = await setup(scenario(), { env: { FAKE_GH_FAIL: 'issue' } })
    // 이슈를 만들지 못해도 fix와 verify는 간다
    await toVerify(s)
    let w = work(s)
    expect(w.issue?.pending.map((e) => e.kind)).toEqual(['issue', 'task', 'task'])
    expect(w.issue?.failure).toMatchObject({ key: 'body' })
    // 만들기 전에 라벨을 읽다가 실패해 만들기를 시도하지 않았다
    expect(w.issue?.failure?.error).toContain('gh label list 실패')
    expect(w.issue?.attempted_at).toBeUndefined()
    expect(gh(s, 'issue create')).toEqual([])
    expect(s.h.ui.works.get(s.key)?.issue).toMatchObject({ number: null, pending: 3 })
    // 실패하는 동안의 [다시 시도]는 다시 실패한다
    expect(await s.h.relay.issueRetry(s.key)).toEqual({ ok: true })
    await published(s)
    expect(work(s).issue?.pending).toHaveLength(3)
    expect(
      events(s)
        .filter((e) => e.type === 'issue.post_failed')
        .map((e) => e.payload['key']),
    ).toEqual(['body', 'body', 'body'])

    // gh가 돌아온 뒤 앱을 다시 켜면 남은 게시를 앞부터 잇는다
    await s.h.relay.close()
    await s.h.relay.settled()
    delete s.h.env['FAKE_GH_FAIL']
    await s.h.reopen()
    await published(s)
    w = work(s)
    expect(w.issue).toMatchObject({ number: 1, pending: [] })
    expect(w.issue?.failure).toBeUndefined()
    expect(issues(s).issues[0]?.comments.map((c) => c.body.split('\n')[0])).toEqual([
      '### t-01 의도 정리 · 승인(사람)',
      '### t-02 원인 분석과 수정 · 승인(사람)',
    ])
  })

  it('결과를 모르는 게시는 다시 할 때 표시로 찾아 두 번 올리지 않는다 (D349)', async () => {
    // 이슈 만들기와 첫 코멘트가 GitHub에는 올라갔지만 오류로 끝난다
    const s = await setup(scenario(), {
      issues: { labels: {}, issues: [], faults: ['posted', 'posted'] },
    })
    await s.h.ui.until(
      () => s.h.ui.works.get(s.key)?.tasks[0]?.status === 'awaiting_approval' || null,
      'intake 승인 대기',
    )
    expect(await s.h.relay.approve(s.key, 't-01', {})).toEqual({ ok: true })
    await published(s)
    expect(work(s).issue).toMatchObject({ number: null, failure: { key: 'body' } })
    expect(work(s).issue?.attempted_at).toBeDefined()
    expect(await s.h.relay.issueRetry(s.key)).toEqual({ ok: true })
    await published(s)
    expect(work(s).issue).toMatchObject({ number: 1, failure: { key: 't-01' } })
    expect(await s.h.relay.issueRetry(s.key)).toEqual({ ok: true })
    await published(s)
    const all = issues(s)
    expect(all.issues).toHaveLength(1)
    expect(all.issues[0]?.comments).toHaveLength(1)
    expect(gh(s, 'issue create')).toHaveLength(1)
    expect(gh(s, 'issue comment')).toHaveLength(1)
    const w = work(s)
    expect(w.issue).toMatchObject({ number: 1, pending: [] })
    expect(w.issue?.posted.map((p) => [p.key, p.comment_id ?? null])).toEqual([
      ['body', null],
      ['t-01', all.issues[0]?.comments[0]?.id],
    ])
    // 찾은 이슈의 라벨을 읽어 적는다
    expect(
      events(s)
        .filter((e) => e.type === 'issue.created' || e.type === 'issue.posted')
        .map((e) => [e.payload['found'] ?? false, e.payload['labeled'] ?? null]),
    ).toEqual([
      [true, true],
      [true, null],
    ])
  })

  it('이슈 기록을 끈 프로젝트는 이슈를 올리지 않는다 (D337, I96)', async () => {
    h = await harness({ scenario: scenario() })
    const hh = h
    const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
    const projectId = await register(hh, repo)
    expect(hh.ui.projectList[0]?.issueLog).toBe(false)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const workId = r.workKey.split('/')[1] ?? ''
    const w = JSON.parse(
      read(path.join(hh.home, 'projects', projectId, 'works', workId, 'work.json')),
    ) as WorkState
    expect(w.issue).toBeUndefined()
  })
})
