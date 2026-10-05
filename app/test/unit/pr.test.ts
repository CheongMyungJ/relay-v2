import { createWork } from '../../src/core/machine'
// [단위] PR 진행의 판정 (docs/implementation.md M9, core/pr): gh 버전(D198), PR 주소(I50), 체크 분류와 CI(D176, D196, D201),
// 작성자 거르기(D160, D161, D197), 항목 모으기와 상태(D189, D199), 원격 head 비교(D193), 머지 조건(D176), 배지(D183),
// 실패 로그의 끝부분(S7 관찰 2), 머지 방식(D177), PR 패널.
import { describe, expect, it } from 'vitest'
import {
  CHECK_WAIT_MS,
  acceptance,
  actionsIds,
  allowedMethods,
  applyItemAction,
  botName,
  bucketOf,
  checkLabel,
  checksOf,
  ciItemId,
  ciState,
  commentFacts,
  divergedFact,
  failedLogTail,
  gatherItems,
  ciLogRead,
  ghTooOld,
  ghVersionOf,
  ghVersionReason,
  mergeGate,
  prBadgeKind,
  prItemView,
  prLocation,
  prView,
  preferredMethod,
  reapplyRules,
  repoArg,
  restRepo,
  rollupRuns,
  syncKind,
  type CheckFact,
  type CommentFact,
  type PrReadState,
  type ReadFacts,
} from '../../src/core/pr'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { PrItem } from '../../src/shared/pr'
import type { WorkState } from '../../src/shared/work'

const H1 = 'a'.repeat(40)
const H2 = 'b'.repeat(40)
const B1 = 'c'.repeat(40)
const B2 = 'd'.repeat(40)

// ---------- gh 버전 (D198) ----------

describe('gh 버전 (D198)', () => {
  it('gh --version의 첫 줄에서 버전을 읽는다', () => {
    expect(
      ghVersionOf(
        'gh version 2.101.0 (2026-09-01)\nhttps://github.com/cli/cli/releases/tag/v2.101.0\n',
      ),
    ).toBe('2.101.0')
    expect(ghVersionOf('gh version 2.48.0-pre.1 (2024-04-01)\n')).toBe('2.48.0-pre.1')
    expect(ghVersionOf('command not found')).toBeNull()
  })

  it('2.48.0보다 낮으면 낮다. 모르거나 읽을 수 없으면 막지 않는다', () => {
    expect(ghTooOld('2.47.9')).toBe(true)
    expect(ghTooOld('1.14.0')).toBe(true)
    expect(ghTooOld('2.48.0')).toBe(false)
    expect(ghTooOld('v2.101.0')).toBe(false)
    expect(ghTooOld('3.0.0')).toBe(false)
    expect(ghTooOld(null)).toBe(false)
    expect(ghTooOld(undefined)).toBe(false)
    expect(ghTooOld('DEV')).toBe(false)
    expect(ghVersionReason('2.40.1')).toBe('gh 2.48.0 이상이 필요함 (지금 2.40.1)')
  })
})

// ---------- PR 주소 (I50) ----------

describe('PR 주소 (I50)', () => {
  it('https://<host>/<owner>/<repo>/pull/<n>에서 레포와 번호를 읽는다', () => {
    const l = prLocation('https://github.com/CheongMyungJ/relay-v2-test/pull/12')
    expect(l).toEqual({
      host: 'github.com',
      owner: 'CheongMyungJ',
      repo: 'relay-v2-test',
      number: 12,
    })
    if (!l) throw new Error('읽지 못함')
    expect(repoArg(l)).toBe('github.com/CheongMyungJ/relay-v2-test')
    expect(restRepo(l)).toBe('repos/CheongMyungJ/relay-v2-test')
    expect(prLocation('https://GHE.example.com:8443/o/r/pull/3')).toMatchObject({
      host: 'ghe.example.com:8443',
      number: 3,
    })
  })

  it('PR 주소가 아니면 null이다', () => {
    for (const url of [
      'https://github.com/o/r',
      'https://github.com/o/r/issues/1',
      'https://github.com/o/r/pull/0',
      'https://github.com/o/r/pull/x',
      'git@github.com:o/r.git',
      '',
    ]) {
      expect(prLocation(url)).toBeNull()
    }
  })
})

// ---------- 체크 (D176, D196) ----------

const run = (
  name: string,
  status: string,
  conclusion: string,
  startedAt: string,
  job = 2,
  runId = 1,
) => ({
  __typename: 'CheckRun',
  name,
  workflowName: 'ci',
  status,
  conclusion,
  startedAt,
  completedAt: '',
  detailsUrl: `https://github.com/o/r/actions/runs/${runId}/job/${job}`,
})

/** 실행 id → 이벤트 (main이 gh api로 읽어 준다, D201) */
const events = (e: Record<number, string>) =>
  new Map(Object.entries(e).map(([k, v]) => [Number(k), v]))

describe('체크 분류 (cli/cli pkg/cmd/pr/checks/aggregate.go)', () => {
  it('gh pr checks와 같은 분류다', () => {
    expect(bucketOf('SUCCESS')).toBe('pass')
    for (const s of ['SKIPPED', 'NEUTRAL']) expect(bucketOf(s)).toBe('skipping')
    for (const s of ['ERROR', 'FAILURE', 'TIMED_OUT', 'ACTION_REQUIRED'])
      expect(bucketOf(s)).toBe('fail')
    expect(bucketOf('CANCELLED')).toBe('cancel')
    for (const s of ['EXPECTED', 'QUEUED', 'PENDING', 'IN_PROGRESS', 'STALE', '']) {
      expect(bucketOf(s)).toBe('pending')
    }
  })

  it('CheckRun은 끝났으면 conclusion, 아니면 status다. 같은 체크는 가장 늦게 시작한 것만 남긴다 (다시 실행)', () => {
    const checks = checksOf(
      [
        run('test', 'COMPLETED', 'FAILURE', '2026-09-29T00:00:00Z', 10),
        run('test', 'COMPLETED', 'SUCCESS', '2026-09-29T00:05:00Z', 11),
        run('lint', 'IN_PROGRESS', '', '2026-09-29T00:00:00Z', 12),
        {
          __typename: 'StatusContext',
          context: 'deploy/preview',
          state: 'ERROR',
          targetUrl: 'https://ci.example.com/1',
          startedAt: '2026-09-29T00:00:00Z',
        },
      ],
      events({ 1: 'pull_request' }),
    )
    expect(checks.map((c) => [c.key, c.label, c.state, c.bucket, c.run, c.job])).toEqual([
      ['ci/lint (pull_request)', 'ci / lint (pull_request)', 'IN_PROGRESS', 'pending', 1, 12],
      ['ci/test (pull_request)', 'ci / test (pull_request)', 'SUCCESS', 'pass', 1, 11],
      ['deploy/preview', 'deploy/preview', 'ERROR', 'fail', null, null],
    ])
    expect(checksOf(null)).toEqual([])
    expect(checksOf([])).toEqual([])
  })

  it('이벤트가 다른 실행(push, pull_request)은 따로 남고, 이벤트가 같은 실행은 늦게 시작한 것만 남는다 (gh와 같음, D201)', () => {
    const rollup = [
      // push 실행이 실패하면 늦게 시작한 pull_request 실행이 통과해도 실패는 남는다
      run('test', 'COMPLETED', 'FAILURE', '2026-09-29T00:00:00Z', 21, 20),
      // PR을 다시 열어 같은 이벤트로 새로 돈 실행(40)은 옛 실행(30)을 덮는다
      run('test', 'COMPLETED', 'FAILURE', '2026-09-29T00:00:30Z', 31, 30),
      run('test', 'COMPLETED', 'SUCCESS', '2026-09-29T00:01:00Z', 41, 40),
      // 큐에 있는 실행(시작 전)도 이벤트가 다르면 남는다
      run('lint', 'COMPLETED', 'SUCCESS', '2026-09-29T00:00:00Z', 22, 20),
      run('lint', 'QUEUED', '', '', 42, 40),
    ]
    const checks = checksOf(rollup, events({ 20: 'push', 30: 'pull_request', 40: 'pull_request' }))
    expect(checks.map((c) => [c.key, c.bucket, c.run, c.event])).toEqual([
      ['ci/lint (pull_request)', 'pending', 40, 'pull_request'],
      ['ci/lint (push)', 'pass', 20, 'push'],
      ['ci/test (pull_request)', 'pass', 40, 'pull_request'],
      ['ci/test (push)', 'fail', 20, 'push'],
    ])
    expect(ciState(checks, true)).toBe('fail')
    // 두 실행이 모두 실패하면 CI 실패 항목도 둘이다
    const both = checksOf(
      [
        run('test', 'COMPLETED', 'FAILURE', '2026-09-29T00:00:00Z', 21, 20),
        run('test', 'COMPLETED', 'FAILURE', '2026-09-29T00:01:00Z', 31, 30),
      ],
      events({ 20: 'push', 30: 'pull_request' }),
    )
    expect(both.map((c) => ciItemId(H1, c))).toEqual([
      `ci:${H1}:ci/test (pull_request)`,
      `ci:${H1}:ci/test (push)`,
    ])
  })

  it('이벤트를 모르는 Actions 체크는 실행 id로 가려 다른 실행과 합치지 않는다 (I52)', () => {
    const checks = checksOf(
      [
        run('test', 'COMPLETED', 'FAILURE', '2026-09-29T00:00:00Z', 21, 20),
        run('test', 'COMPLETED', 'SUCCESS', '2026-09-29T00:01:00Z', 31, 30),
      ],
      events({ 30: 'pull_request' }),
    )
    expect(checks.map((c) => [c.key, c.label, c.bucket])).toEqual([
      ['ci/test (pull_request)', 'ci / test (pull_request)', 'pass'],
      ['ci/test #20', 'ci / test (실행 20)', 'fail'],
    ])
  })

  it('이벤트를 읽을 실행은 Actions 체크의 실행 id를 한 번씩이다 (D201)', () => {
    expect(
      rollupRuns([
        run('test', 'COMPLETED', 'SUCCESS', 'a', 21, 20),
        run('lint', 'COMPLETED', 'SUCCESS', 'a', 22, 20),
        run('test', 'COMPLETED', 'SUCCESS', 'a', 31, 30),
        {
          __typename: 'CheckRun',
          name: 'codecov',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          detailsUrl: 'https://codecov.example.com/1',
        },
        {
          __typename: 'StatusContext',
          context: 'deploy',
          state: 'SUCCESS',
          targetUrl: 'https://github.com/o/r/actions/runs/50/job/51',
        },
      ]),
    ).toEqual([20, 30])
    expect(rollupRuns(null)).toEqual([])
  })

  it('체크의 이름은 워크플로 / 이름 (이벤트)다 (D201)', () => {
    expect(checkLabel({ name: 'test', workflow: 'ci', event: 'push', run: 1 })).toBe(
      'ci / test (push)',
    )
    expect(checkLabel({ name: 'test', workflow: 'ci', event: null, run: 7 })).toBe(
      'ci / test (실행 7)',
    )
    expect(checkLabel({ name: 'codecov', workflow: null, run: null })).toBe('codecov')
  })

  it('Actions 체크의 링크에서 실행과 작업 id를 읽는다 (S7 관찰 2)', () => {
    expect(actionsIds('https://github.com/o/r/actions/runs/123/job/456')).toEqual({
      run: 123,
      job: 456,
    })
    expect(actionsIds('https://ci.example.com/build/1')).toEqual({ run: null, job: null })
    expect(actionsIds(null)).toEqual({ run: null, job: null })
  })

  it('CI는 실패 > 취소 > 도는 중 > 통과다. 체크가 없으면 처음 읽은 뒤 60초는 기다림, 그 뒤는 통과로 본다 (D196)', () => {
    const b = (...bs: CheckFact['bucket'][]) => bs.map((bucket) => ({ bucket }))
    expect(ciState(b('pass', 'fail', 'cancel', 'pending'), true)).toBe('fail')
    expect(ciState(b('pass', 'cancel', 'pending'), true)).toBe('cancel')
    expect(ciState(b('pass', 'pending'), true)).toBe('pending')
    expect(ciState(b('pass', 'skipping'), false)).toBe('pass')
    expect(ciState([], false)).toBe('waiting')
    expect(ciState([], true)).toBe('none')
    expect(CHECK_WAIT_MS).toBe(60_000)
  })
})

// ---------- 코멘트와 거르기 (D160, D161, D197) ----------

const user = (login: string, type = 'User') => ({ login, type })

describe('작성자 거르기 (D160, D161, D197)', () => {
  it('사람은 소유자·조직 구성원·협업자만 받는다', () => {
    for (const association of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      expect(acceptance({ login: 'a', bot: false, association }, []).ok).toBe(true)
    }
    for (const association of ['CONTRIBUTOR', 'FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'NONE']) {
      expect(acceptance({ login: 'a', bot: false, association }, [])).toEqual({
        ok: false,
        why: `작성자 관계 ${association}: 소유자·조직 구성원·협업자만 받음 (D160)`,
      })
    }
  })

  it('봇은 받을 봇에 적힌 것만 받는다. 이름 끝 [bot]은 떼고 비교한다 (D197)', () => {
    const bot = { login: 'github-actions[bot]', bot: true, association: 'NONE' }
    expect(acceptance(bot, [])).toEqual({
      ok: false,
      why: '봇 github-actions: 프로젝트 설정의 받을 봇에 없음 (D161)',
    })
    expect(acceptance(bot, ['github-actions']).ok).toBe(true)
    expect(acceptance(bot, ['github-actions[bot]']).ok).toBe(true)
    expect(acceptance(bot, [' github-actions ']).ok).toBe(true)
    expect(acceptance(bot, ['dependabot']).ok).toBe(false)
    // 협업자인 봇이라도 받을 봇에 없으면 받지 않는다
    expect(acceptance({ ...bot, association: 'COLLABORATOR' }, []).ok).toBe(false)
    // 봇과 같은 이름의 사람 계정은 사람 규칙을 따른다
    expect(
      acceptance({ login: 'github-actions', bot: false, association: 'NONE' }, ['github-actions'])
        .ok,
    ).toBe(false)
    expect(botName('renovate[bot]')).toBe('renovate')
  })

  it('REST 목록 셋을 코멘트로 모은다. 본문이 빈 리뷰와 제출하지 않은 리뷰는 뺀다 (S7 관찰 3)', () => {
    const facts = commentFacts({
      reviews: [
        {
          id: 1,
          user: user('me'),
          author_association: 'OWNER',
          body: '리뷰 본문',
          state: 'CHANGES_REQUESTED',
          submitted_at: '2026-09-29T00:00:00Z',
          html_url: 'u1',
        },
        { id: 2, user: user('me'), author_association: 'OWNER', body: '', state: 'COMMENTED' },
        { id: 3, user: user('me'), author_association: 'OWNER', body: '  ', state: 'COMMENTED' },
        { id: 4, user: user('me'), author_association: 'OWNER', body: '초안', state: 'PENDING' },
      ],
      inline: [
        {
          id: 10,
          user: user('me'),
          author_association: 'OWNER',
          body: '여기',
          path: 'a.js',
          line: null,
          original_line: 7,
          created_at: 'c',
          updated_at: 'u',
        },
        {
          id: 11,
          user: user('me'),
          author_association: 'OWNER',
          body: '답글',
          path: 'a.js',
          line: 7,
          in_reply_to_id: 10,
        },
      ],
      convo: [
        {
          id: 10,
          user: user('github-actions[bot]', 'Bot'),
          author_association: 'NONE',
          body: '봇',
        },
      ],
    })
    expect(facts.map((f) => f.id)).toEqual(['review:1', 'inline:10', 'inline:11', 'convo:10'])
    expect(facts[0]).toMatchObject({ kind: 'review', review_state: 'CHANGES_REQUESTED', url: 'u1' })
    expect(facts[1]).toMatchObject({ line: 7, reply_to: null, path: 'a.js' })
    expect(facts[2]).toMatchObject({ reply_to: 10 })
    expect(facts[3]?.author).toEqual({
      login: 'github-actions[bot]',
      bot: true,
      association: 'NONE',
    })
  })
})

// ---------- 항목 (D189, D199) ----------

const owner = { login: 'me', bot: false, association: 'OWNER' }
const botAuthor = { login: 'github-actions[bot]', bot: true, association: 'NONE' }

function comment(id: string, body: string, author = owner): CommentFact {
  const kind = id.split(':')[0] as CommentFact['kind']
  return { id, kind, author, body, url: null, created_at: 't0', updated_at: 't0' }
}

function check(name: string, bucket: CheckFact['bucket'] = 'fail'): CheckFact {
  return {
    key: `ci/${name} (pull_request)`,
    name,
    workflow: 'ci',
    event: 'pull_request',
    label: `ci / ${name} (pull_request)`,
    state: bucket === 'fail' ? 'FAILURE' : 'SUCCESS',
    bucket,
    url: 'https://github.com/o/r/actions/runs/1/job/2',
    run: 1,
    job: 2,
    startedAt: 't',
  }
}

function read(o: Partial<ReadFacts> = {}): ReadFacts {
  return { at: 'T', head: H1, comments: [], failing: [], conflict: null, diverged: null, ...o }
}

const rules = { allowedBots: [] as string[] }
const status = (items: readonly PrItem[]) => Object.fromEntries(items.map((i) => [i.id, i.status]))

describe('항목 모으기 (D189, D199)', () => {
  it('새 코멘트는 규칙대로 새 항목이나 받지 않음이다. 고친 코멘트는 id가 같아 본문만 바뀐다', () => {
    const first = gatherItems(
      [],
      read({ comments: [comment('convo:1', '처음'), comment('convo:2', '봇', botAuthor)] }),
      rules,
    )
    expect(status(first.items)).toEqual({ 'convo:1': 'new', 'convo:2': 'not_accepted' })
    expect(first.received).toEqual(['convo:1'])
    expect(first.notAccepted).toEqual(['convo:2'])
    const edited = gatherItems(
      first.items,
      read({
        at: 'T2',
        comments: [
          { ...comment('convo:1', '고침'), updated_at: 't1' },
          comment('convo:2', '봇', botAuthor),
        ],
      }),
      rules,
    )
    expect(edited.received).toEqual([])
    expect(edited.items.find((i) => i.id === 'convo:1')).toMatchObject({
      body: '고침',
      updated_at: 't1',
      first_seen_at: 'T',
    })
  })

  it('받을 봇을 바꾸면 사람이 정하지 않은 항목만 규칙을 다시 적용한다 (D161)', () => {
    const items = gatherItems(
      [],
      read({
        comments: [comment('convo:1', '봇', botAuthor), comment('convo:2', '봇2', botAuthor)],
      }),
      rules,
    ).items
    const accepted = applyItemAction(items, 'convo:2', 'accept')
    if (!accepted.ok) throw new Error(accepted.error)
    const withBot = gatherItems(
      accepted.items,
      read({
        comments: [comment('convo:1', '봇', botAuthor), comment('convo:2', '봇2', botAuthor)],
      }),
      { allowedBots: ['github-actions'] },
    )
    expect(status(withBot.items)).toEqual({ 'convo:1': 'new', 'convo:2': 'new' })
    expect(withBot.received).toEqual(['convo:1'])
    // 봇을 다시 빼면 사람이 [받기]한 것은 그대로다
    const again = reapplyRules(withBot.items, rules)
    expect(status(again.items)).toEqual({ 'convo:1': 'not_accepted', 'convo:2': 'new' })
    expect(again.changed).toEqual(['convo:1'])
  })

  it('GitHub에서 없어진 코멘트는 해소됨이다. 사람이 제외한 것은 제외인 채 없어졌다고 적는다', () => {
    const items = gatherItems(
      [],
      read({
        comments: [
          comment('convo:1', 'a'),
          comment('convo:2', 'b'),
          comment('convo:3', 'c', botAuthor),
        ],
      }),
      rules,
    ).items
    const ex = applyItemAction(items, 'convo:2', 'exclude')
    if (!ex.ok) throw new Error(ex.error)
    const gone = gatherItems(ex.items, read({ at: 'T2' }), rules)
    expect(gone.items.map((i) => [i.id, i.status, i.gone])).toEqual([
      ['convo:1', 'resolved', true],
      ['convo:2', 'excluded', true],
      ['convo:3', 'resolved', true],
    ])
    expect(gone.resolved).toEqual(['convo:1', 'convo:3'])
    expect(gone.items[0]?.resolved_at).toBe('T2')
  })

  it('CI 실패는 head와 체크의 id다. 새 head에서 풀리면 해소됨이고, 같은 id가 다시 실패하면 새 항목으로 돌아온다 (D199)', () => {
    const logs = new Map([[ciItemId(H1, check('test')), { log: '로그' }]])
    const failed = gatherItems([], read({ failing: [check('test')], logs }), rules)
    const id = `ci:${H1}:ci/test (pull_request)`
    expect(failed.items).toEqual([
      expect.objectContaining({ id, kind: 'ci', status: 'new', head: H1, log: '로그' }),
    ])
    // 새 head에서 통과
    const passed = gatherItems(failed.items, read({ at: 'T2', head: H2 }), rules)
    expect(status(passed.items)).toEqual({ [id]: 'resolved' })
    // 같은 head가 다시 실패로 읽힘 (다시 실행이 실패해 옛 head로 되돌린 경우 등)
    const back = gatherItems(passed.items, read({ at: 'T3', failing: [check('test')] }), rules)
    expect(status(back.items)).toEqual({ [id]: 'new' })
    expect(back.received).toEqual([id])
    expect(back.items[0]?.resolved_at).toBeUndefined()
  })

  it('같은 head에서 다시 실행해 통과하면 해소됨이다. 사람이 제외한 CI 실패는 풀려도 그대로다 (D199)', () => {
    const two = gatherItems([], read({ failing: [check('test'), check('lint')] }), rules)
    const ex = applyItemAction(two.items, `ci:${H1}:ci/lint (pull_request)`, 'exclude')
    if (!ex.ok) throw new Error(ex.error)
    const rerun = gatherItems(ex.items, read({ at: 'T2' }), rules)
    expect(status(rerun.items)).toEqual({
      [`ci:${H1}:ci/test (pull_request)`]: 'resolved',
      [`ci:${H1}:ci/lint (pull_request)`]: 'excluded',
    })
  })

  it('로그를 아직 못 읽었으면 까닭을 두고, 다음 읽기에서 로그를 채운다', () => {
    const id = ciItemId(H1, check('test'))
    const pending = gatherItems(
      [],
      read({ failing: [check('test')], logs: new Map([[id, { note: '기다림' }]]) }),
      rules,
    )
    expect(pending.items[0]).toMatchObject({ log_note: '기다림' })
    expect(pending.items[0]?.log).toBeUndefined()
    const filled = gatherItems(
      pending.items,
      read({ failing: [check('test')], logs: new Map([[id, { log: '끝' }]]) }),
      rules,
    )
    expect(filled.items[0]).toMatchObject({ log: '끝' })
    expect(filled.items[0]?.log_note).toBeUndefined()
    expect(filled.received).toEqual([])
  })

  it('충돌은 기준 브랜치 커밋의 id다. 새 기준 커밋으로 이어지면 옛 항목은 해소됨이고 새 항목이 생긴다. 모르면 그대로다', () => {
    const c1 = gatherItems([], read({ conflict: B1 }), rules)
    expect(c1.items).toEqual([
      expect.objectContaining({ id: `conflict:${B1}`, kind: 'conflict', base_commit: B1 }),
    ])
    const unknown = gatherItems(c1.items, read({ conflict: undefined }), rules)
    expect(status(unknown.items)).toEqual({ [`conflict:${B1}`]: 'new' })
    const c2 = gatherItems(c1.items, read({ conflict: B2 }), rules)
    expect(status(c2.items)).toEqual({ [`conflict:${B1}`]: 'resolved', [`conflict:${B2}`]: 'new' })
    const clear = gatherItems(c2.items, read({ conflict: null }), rules)
    expect(status(clear.items)).toEqual({
      [`conflict:${B1}`]: 'resolved',
      [`conflict:${B2}`]: 'resolved',
    })
  })

  it('원격과 갈라짐은 원격 head의 id다. 같아지면 해소됨이다. 비교하지 못했으면 그대로다 (D193, D199)', () => {
    const d = gatherItems([], read({ diverged: { remote: H2, local: H1 } }), rules)
    expect(d.items).toEqual([
      expect.objectContaining({
        id: `diverged:${H2}`,
        remote_head: H2,
        local_head: H1,
        status: 'new',
      }),
    ])
    expect(status(gatherItems(d.items, read({ diverged: undefined }), rules).items)).toEqual({
      [`diverged:${H2}`]: 'new',
    })
    expect(status(gatherItems(d.items, read({ diverged: null }), rules).items)).toEqual({
      [`diverged:${H2}`]: 'resolved',
    })
  })
})

describe('항목 조작 (D160, D161, D170, D189)', () => {
  const items = gatherItems(
    [],
    read({ comments: [comment('convo:1', 'a'), comment('convo:2', 'b', botAuthor)] }),
    rules,
  ).items

  it('[제외]는 새 항목, [다시 넣기]는 제외, [받기]는 받지 않음에만 한다. 사람이 정했다고 적는다', () => {
    const ex = applyItemAction(items, 'convo:1', 'exclude')
    expect(ex.ok && ex.items[0]).toMatchObject({ status: 'excluded', by_human: true })
    if (!ex.ok) return
    const back = applyItemAction(ex.items, 'convo:1', 'include')
    expect(back.ok && back.items[0]).toMatchObject({ status: 'new', by_human: true })
    const accepted = applyItemAction(items, 'convo:2', 'accept')
    expect(accepted.ok && accepted.items[1]).toMatchObject({ status: 'new', by_human: true })
    expect(applyItemAction(items, 'convo:1', 'include')).toEqual({
      ok: false,
      error: '새 항목인 항목에는 [다시 넣기]를 할 수 없음',
    })
    expect(applyItemAction(items, 'convo:9', 'exclude')).toEqual({
      ok: false,
      error: '항목이 없음: convo:9',
    })
  })
})

// ---------- 원격 head 비교 (D193) ----------

describe('원격 PR 브랜치와 로컬 Work 브랜치의 비교 (D193)', () => {
  const base = {
    local: H1,
    remote: H2,
    localInRemote: false,
    remoteInLocal: false,
    clean: true,
    onBranch: true,
  }
  it('같음, 원격만 앞섬, 로컬만 앞섬, 갈라짐을 가른다. 원격만 앞서도 깨끗하지 않거나 Work 브랜치가 아니면 받지 않는다', () => {
    expect(syncKind({ ...base, remote: H1 })).toBe('same')
    expect(syncKind({ ...base, localInRemote: true })).toBe('ff')
    expect(syncKind({ ...base, localInRemote: true, clean: false })).toBe('dirty')
    expect(syncKind({ ...base, localInRemote: true, onBranch: false })).toBe('off_branch')
    expect(syncKind({ ...base, remoteInLocal: true })).toBe('local_ahead')
    expect(syncKind(base)).toBe('diverged')
  })

  it('갈라졌거나 깨끗하지 않을 때만 갈라짐 항목이다', () => {
    expect(divergedFact('diverged', H2, H1)).toEqual({ remote: H2, local: H1 })
    expect(divergedFact('dirty', H2, H1)).toEqual({ remote: H2, local: H1 })
    for (const k of ['same', 'ff', 'local_ahead', 'off_branch'] as const)
      expect(divergedFact(k, H2, H1)).toBeNull()
  })
})

// ---------- 머지 조건 (D176) ----------

const PR: NonNullable<WorkState['pr']> = {
  number: 1,
  url: 'https://github.com/o/r/pull/1',
  head: H1,
  gh_version: '2.101.0',
  started_at: 'T',
}

function prWork(
  o: Partial<WorkState> = {},
): Pick<WorkState, 'status' | 'operation' | 'pr' | 'tasks' | 'settings'> {
  return { status: 'pr', pr: PR, tasks: [], settings: {}, ...o }
}

function readState(o: Partial<PrReadState> = {}): PrReadState {
  return {
    at: 'T',
    state: 'OPEN',
    head: H1,
    headRef: 'relay/w-1',
    baseRef: 'main',
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: null,
    checks: [check('test', 'pass')],
    ci: 'pass',
    sync: 'same',
    ...o,
  }
}

const gate = (
  o: {
    work?: Partial<WorkState>
    read?: Partial<PrReadState> | null
    items?: PrItem[]
    local?: string | null
  } = {},
) =>
  mergeGate({
    work: prWork(o.work),
    read: o.read === null ? null : readState(o.read),
    items: o.items ?? [],
    localHead: o.local === undefined ? H1 : o.local,
  })

describe('머지 조건 (D176, D196)', () => {
  it('CI 통과, 충돌 없음, 할 일 없음, 원격과 로컬이 같으면 켜진다. 체크가 없어도 기다림이 지났으면 켜진다', () => {
    expect(gate()).toEqual({ enabled: true, reasons: [] })
    expect(gate({ read: { checks: [], ci: 'none' } }).enabled).toBe(true)
  })

  it('어긴 조건을 모두 보인다', () => {
    const failing = { ...check('test'), bucket: 'fail' as const }
    expect(
      gate({
        read: { ci: 'fail', checks: [failing], mergeable: 'CONFLICTING' },
        items: gatherItems([], read({ comments: [comment('convo:1', 'a')] }), rules).items,
        local: H2,
      }).reasons,
    ).toEqual([
      'CI 실패: ci / test (pull_request)',
      '기준 브랜치와 충돌',
      '처리하지 않은 항목 1개 ([제외]하면 머지를 막지 않음)',
      `원격 PR head(${H1.slice(0, 8)})와 로컬 Work 브랜치(${H2.slice(0, 8)})가 다름`,
    ])
    expect(gate({ read: { checks: [], ci: 'waiting' } }).reasons).toEqual([
      '체크 기다림: 새 head의 체크가 아직 없음 (처음 읽은 뒤 60초, D196)',
    ])
    expect(
      gate({ read: { ci: 'pending', checks: [{ ...check('lint'), bucket: 'pending' }] } }).reasons,
    ).toEqual(['체크가 도는 중: ci / lint (pull_request)'])
    expect(gate({ read: { mergeable: 'UNKNOWN' } }).reasons).toEqual([
      'GitHub가 머지 가능 여부를 계산하는 중',
    ])
    expect(gate({ read: { sync: 'local_ahead' }, local: H2 }).reasons).toEqual([
      `원격 PR head(${H1.slice(0, 8)})와 로컬 Work 브랜치(${H2.slice(0, 8)})가 다름: 로컬 Work 브랜치에 push하지 않은 커밋이 있음`,
    ])
    expect(gate({ read: null }).reasons).toEqual(['아직 PR을 읽지 못함'])
    expect(gate({ local: null }).reasons).toEqual(['로컬 Work 브랜치를 읽지 못함'])
    expect(
      gate({ read: { state: 'CLOSED' }, work: { pr: { ...PR, closed_at: 'T' } } }).reasons,
    ).toEqual(['PR이 닫혀 있음', 'PR이 열려 있지 않음 (CLOSED)'])
    expect(
      gate({ work: { operation: { kind: 'merge', started_at: 'T', method: 'merge', head: H1 } } })
        .reasons,
    ).toEqual(['진행 중인 작업이 있음'])
    expect(gate({ work: { status: 'completed' } })).toEqual({
      enabled: false,
      reasons: ['PR 진행인 Work가 아님'],
    })
  })

  it('제외, 받지 않음, 해소됨인 항목은 머지를 막지 않는다', () => {
    const items = gatherItems(
      [],
      read({
        comments: [comment('convo:1', 'a'), comment('convo:2', 'b', botAuthor)],
        conflict: B1,
      }),
      rules,
    ).items
    const ex = applyItemAction(items, 'convo:1', 'exclude')
    if (!ex.ok) throw new Error(ex.error)
    const resolved = gatherItems(
      ex.items,
      read({ comments: [comment('convo:1', 'a'), comment('convo:2', 'b', botAuthor)] }),
      rules,
    ).items
    expect(status(resolved)).toEqual({
      'convo:1': 'excluded',
      'convo:2': 'not_accepted',
      [`conflict:${B1}`]: 'resolved',
    })
    expect(gate({ items: resolved }).enabled).toBe(true)
  })
})

describe('배지 (D183)', () => {
  const open = gatherItems([], read({ comments: [comment('convo:1', 'a')] }), rules).items
  const on = { enabled: true, reasons: [] }
  const off = { enabled: false, reasons: ['CI 실패'] }
  it('대응 거리 있음 > PR 닫힘 > 머지 가능 > 리뷰·CI 대기', () => {
    expect(prBadgeKind(open, true, on)).toBe('pr_items')
    expect(prBadgeKind([], true, on)).toBe('pr_closed')
    expect(prBadgeKind([], false, on)).toBe('mergeable')
    expect(prBadgeKind([], false, off)).toBe('pr_waiting')
  })
})

// ---------- 실패 로그 (S7 관찰 2) ----------

describe('실패 로그의 끝부분 (S7 관찰 2)', () => {
  it('줄 앞의 작업, 스텝, 시각과 색 제어 문자를 떼고 끝 줄만 남긴다', () => {
    const out = [
      'test\tRun npm test\t2026-09-29T00:00:01.1234567Z ^[[36;1mnpm test^[[0m',
      `test\tRun npm test\t2026-09-29T00:00:02.1234567Z \u001b[31mnot ok 1 - 합계\u001b[0m`,
      'test\tRun npm test\t2026-09-29T00:00:03.1234567Z ##[error]Process completed with exit code 1.',
      '',
    ].join('\n')
    expect(failedLogTail(out)).toBe(
      'npm test\nnot ok 1 - 합계\n##[error]Process completed with exit code 1.',
    )
    expect(failedLogTail(out, 1)).toBe('##[error]Process completed with exit code 1.')
  })

  it('스텝이 UNKNOWN STEP이면 작업 로그 전체라 "Post job cleanup." 앞에서 자른다', () => {
    const out = [
      'test\tUNKNOWN STEP\t2026-09-29T00:00:01Z ##[error]실패',
      'test\tUNKNOWN STEP\t2026-09-29T00:00:02Z Post job cleanup.',
      'test\tUNKNOWN STEP\t2026-09-29T00:00:03Z git config --unset',
    ].join('\n')
    expect(failedLogTail(out)).toBe('##[error]실패')
  })
})

// ---------- 머지 방식 (D177) ----------

describe('머지 방식 (D177)', () => {
  it('레포가 허용하는 방식을 merge, squash, rebase 차례로 보인다. 기본은 프로젝트 설정이 허용되면 그것, 아니면 첫 방식이다', () => {
    const view = { mergeCommitAllowed: false, squashMergeAllowed: true, rebaseMergeAllowed: true }
    expect(allowedMethods(view)).toEqual(['squash', 'rebase'])
    expect(allowedMethods({})).toEqual([])
    expect(preferredMethod(['squash', 'rebase'], 'rebase')).toBe('rebase')
    expect(preferredMethod(['squash', 'rebase'], 'merge')).toBe('squash')
    expect(preferredMethod(['squash', 'rebase'], null)).toBe('squash')
    expect(preferredMethod([], null)).toBeNull()
  })
})

// ---------- 화면 ----------

describe('PR 패널 (D183)', () => {
  it('항목을 새 항목, 대응 중, 처리됨, 해소됨, 제외, 받지 않음 차례로 보이고 종류마다 제목을 만든다', () => {
    const items = gatherItems(
      [],
      read({
        comments: [
          comment('convo:1', '첫 줄\n둘째 줄'),
          comment('convo:2', '봇', botAuthor),
          { ...comment('inline:5', '여기'), path: 'a.js', line: 3, reply_to: 4 },
        ],
        failing: [check('test')],
        conflict: B1,
      }),
      rules,
    ).items
    const ex = applyItemAction(items, 'convo:1', 'exclude')
    if (!ex.ok) throw new Error(ex.error)
    const v = prView({
      work: prWork(),
      config: DEFAULT_CONFIG,
      read: readState(),
      file: { schema_version: 1, items: ex.items, synced: [], rounds: [] },
      rules,
      localHead: H1,
      reading: false,
      error: null,
    })
    expect(v?.items.map((i) => [i.id, i.statusLabel])).toEqual([
      ['inline:5', '새 항목'],
      [`ci:${H1}:ci/test (pull_request)`, '새 항목'],
      [`conflict:${B1}`, '새 항목'],
      ['convo:1', '제외'],
      ['convo:2', '받지 않음'],
    ])
    const byId = (id: string) => v?.items.find((i) => i.id === id)
    expect(byId('convo:1')).toMatchObject({ title: 'me: 첫 줄', text: '첫 줄\n둘째 줄' })
    // 한 줄짜리 본문은 제목에만 보인다
    expect(byId('inline:5')).toMatchObject({ title: 'me: 여기', text: null })
    expect(byId('convo:2')).toMatchObject({
      title: 'github-actions: 봇',
      why: '봇 github-actions: 프로젝트 설정의 받을 봇에 없음 (D161)',
    })
    expect(byId('inline:5')?.where).toBe('a.js:3 (스레드 inline:4의 답글)')
    expect(byId(`ci:${H1}:ci/test (pull_request)`)).toMatchObject({
      title: `ci / test (pull_request): FAILURE, head ${H1.slice(0, 8)}`,
      text: null,
      note: '로그를 아직 읽지 않음',
    })
    expect(byId(`conflict:${B1}`)?.title).toBe(`기준 브랜치 ${B1.slice(0, 8)}와 충돌`)
    expect(v?.labels).toEqual({
      state: '열림',
      ci: '통과',
      review: null,
      mergeable: '없음',
      sync: '원격 head와 같음',
    })
    expect(prItemView(ex.items[0] as PrItem, rules).kindLabel).toBe('대화 코멘트')
  })

  it('머지로 완료했고 정리 창을 열지 않았으면 정리를 권한다. 앱이 머지했으면 읽은 상태보다 머지됨이 앞선다 (D178, D200)', () => {
    const merged = prWork({
      status: 'completed',
      pr: { ...PR, merged: { at: 'T2', head: H1, method: 'squash', outside: false } },
    })
    const input = {
      work: merged,
      config: DEFAULT_CONFIG,
      read: readState(),
      file: { schema_version: 1 as const, items: [], synced: [], rounds: [] },
      rules,
      localHead: H1,
      reading: false,
      error: null,
    }
    expect(prView(input)).toMatchObject({
      state: 'MERGED',
      offerClean: true,
      labels: { state: '머지됨' },
    })
    expect(
      prView({
        ...input,
        work: {
          ...merged,
          pr: {
            ...PR,
            merged: { at: 'T2', head: H1, method: 'squash', outside: false },
            clean_offered_at: 'T3',
          },
        },
      })?.offerClean,
    ).toBe(false)
    expect(prView({ ...input, work: { status: 'active', tasks: [], settings: {} } })).toBeNull()
  })
})

describe('PR 패널: 엔진별 자동 승인', () => {
  it('다음 대응은 기본 엔진, 진행 중인 대응은 고정된 엔진의 정책을 표시한다', () => {
    const config = {
      ...DEFAULT_CONFIG,
      agent_engine: 'codex' as const,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, respond: true },
    }
    const input = {
      work: prWork(),
      config,
      read: readState(),
      file: { schema_version: 1 as const, items: [], synced: [], rounds: [] },
      rules,
      localHead: H1,
      reading: false,
      error: null,
    }
    expect(prView(input)?.auto.approve).toBe(false)
    const base = createWork({
      type: 'bugfix',
      workId: 'w',
      baseBranch: 'main',
      baseCommit: H1,
      at: 'T',
    }).work.tasks[0]
    if (!base) throw new Error('task 없음')
    const active = {
      ...base,
      node: 'respond' as const,
      status: 'working' as const,
      engine: 'claude' as const,
    }
    expect(prView({ ...input, work: prWork({ tasks: [active] }) })?.auto.approve).toBe(true)
    expect(
      prView({
        ...input,
        config: { ...config, agent_engine: 'claude' },
        work: prWork({ tasks: [{ ...active, engine: 'codex' }] }),
      })?.auto.approve,
    ).toBe(false)
    expect(
      prView({
        ...input,
        work: prWork({
          tasks: [{ ...active, engine: JSON.parse('"future-engine"') as typeof active.engine }],
        }),
      })?.auto.approve,
    ).toBe(false)
    expect(
      prView({ ...input, work: prWork({ tasks: [{ ...active, status: 'approved' }] }) })?.auto
        .approve,
    ).toBe(false)
  })
})

describe('PR 읽기의 가장자리 (2026-10 정리)', () => {
  it('이름이 같은 커밋 상태와 체크 실행은 서로 덮지 않는다', () => {
    const checks = checksOf([
      {
        __typename: 'StatusContext',
        context: 'Vercel',
        state: 'FAILURE',
        targetUrl: 'https://vercel.example/1',
        startedAt: '2026-09-29T00:00:00Z',
      },
      {
        __typename: 'CheckRun',
        name: 'Vercel',
        workflowName: '',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        startedAt: '2026-09-29T00:05:00Z',
        completedAt: '',
        detailsUrl: 'https://vercel.example/2',
      },
    ])
    // 이름이 겹칠 때만 커밋 상태의 키와 이름에 "(상태)"를 붙인다: 항목 id와 화면의 줄이 겹치지 않게 (PR #30 리뷰)
    expect(checks.map((c) => [c.key, c.label, c.bucket]).sort()).toEqual([
      ['Vercel (상태)', 'Vercel (상태)', 'fail'],
      ['Vercel', 'Vercel', 'pass'],
    ])
    expect(ciState(checks, true)).toBe('fail')
    expect(new Set(checks.map((c) => ciItemId(H1, c))).size).toBe(2)
    // 겹치지 않으면 커밋 상태의 키는 그대로다
    expect(
      checksOf([
        {
          __typename: 'StatusContext',
          context: 'deploy/preview',
          state: 'ERROR',
          targetUrl: null,
          startedAt: '2026-09-29T00:00:00Z',
        },
      ]).map((c) => c.key),
    ).toEqual(['deploy/preview'])
  })

  it('같은 체크가 다른 작업으로 다시 실패하면 옛 작업의 로그를 버린다', () => {
    const id = `ci:${H1}:ci/test (pull_request)`
    const first = gatherItems(
      [],
      read({ failing: [check('test')], logs: new Map([[id, { log: '처음 실패' }]]) }),
      rules,
    )
    const again = { ...check('test'), job: 3, url: 'https://github.com/o/r/actions/runs/1/job/3' }
    const second = gatherItems(
      first.items,
      read({ at: 'T2', failing: [again], logs: new Map([[id, { note: '로그를 읽지 못함' }]]) }),
      rules,
    )
    const item = second.items.find((i) => i.id === id)
    expect(item?.check?.job).toBe(3)
    expect(item?.log).toBeUndefined()
    expect(item?.log_note).toBe('로그를 읽지 못함')
    expect(ciLogRead(first.items, id, 2)).toBe(true)
    expect(ciLogRead(first.items, id, 3)).toBe(false)
  })
})
