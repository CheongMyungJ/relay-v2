// [흐름] 전달 (docs/implementation.md M5, 시나리오 7, I25, I26).
// 로컬 bare 원격으로 push하고, 가짜 gh로 pr.md의 제목과 본문, draft 설정으로 PR을 만든다. 같은 브랜치의 PR이
// 열려 있으면 새로 만들지 않는다(7-4). 커밋 안 된 변경의 세 선택지가 각각 끝까지 간다(7-5). 전달이 실패하면
// [다시 시도]와 [전달 없이 완료]다(7-6, D120). verify에서 멈춘 Work는 Work 완료 화면에서 전달한다(D119).
// origin·gh 점검은 verify를 시작할 때와 [다시 점검]에서 다시 한다(D118).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { DeliverInput, WorkView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { git, harness, makeRepo, register, settle, type Harness } from './harness'
import { REPO_FILES, REQUEST, scenario, steps, type Scenario, type Step } from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 테스트 레포의 origin을 GitHub 주소로 두고 push는 로컬 bare 원격으로 간다 (pushurl) */
const GITHUB = 'https://github.com/relay-test/sample.git'
/** gh --repo에 주는 origin의 레포 (core/delivery ghRepo) */
const GH_REPO = 'github.com/relay-test/sample'

interface Setup {
  h: Harness
  repo: string
  remote: string
  key: string
  /** Work 디렉터리 */
  dir: string
  /** worktree */
  tree: string
  workId: string
  branch: string
}

interface Options {
  config?: object
  env?: Record<string, string>
  /** origin 주소를 GitHub 주소로 둔다 */
  github?: boolean
}

async function setup(s: Scenario, o: Options = {}): Promise<Setup> {
  h = await harness({ scenario: s, config: o.config ?? {}, env: o.env ?? {} })
  const hh = h
  const { repo, remote } = makeRepo(hh.root, 'sample', REPO_FILES)
  if (o.github) {
    git(repo, 'remote', 'set-url', 'origin', GITHUB)
    git(repo, 'remote', 'set-url', '--push', 'origin', remote)
  }
  const projectId = await register(hh, repo)
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
  const workId = r.workKey.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    remote,
    key: r.workKey,
    dir: path.join(hh.home, 'projects', projectId, 'works', workId),
    tree: path.join(hh.home, 'projects', projectId, 'worktrees', workId),
    workId,
    branch: `relay/${workId}`,
  }
}

function work(s: Setup): WorkState {
  return JSON.parse(read(path.join(s.dir, 'work.json'))) as WorkState
}

function events(s: Setup): LifecycleEvent[] {
  return read(path.join(s.dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

const view = (s: Setup) => s.h.ui.works.get(s.key)

/** 스냅샷이 pred를 만족할 때까지 기다린다 */
function until(s: Setup, pred: (w: WorkView) => boolean, label: string) {
  return s.h.ui.until(
    () => {
      const w = view(s)
      return w && pred(w) ? w : null
    },
    label,
    60_000,
  )
}

/** S 경로로 최종 검증이 승인 대기가 될 때까지 간다 */
async function toVerify(s: Setup): Promise<void> {
  const r = await drive(s.h.relay, s.h.ui, s.key, {
    size: 'S',
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused', reason: '03 최종 검증: 승인 대기' })
  await settle(s.h, s.key)
}

function deliver(s: Setup, choice: DeliverInput['choice'], u: DeliverInput['uncommitted'] = null) {
  return s.h.relay.deliver(s.key, { choice, uncommitted: u })
}

/** 가짜 gh의 기록 */
function gh(s: Setup, type: string) {
  return s.h.ghRecords().filter((r) => r['type'] === type) as {
    args: string[]
    cwd: string
    body?: string
  }[]
}

/** verify가 승인 대기를 만든 뒤 커밋하지 않은 변경을 남긴다: 추적 파일 수정과 추적하지 않는 파일 (7-5) */
const DIRTY_VERIFY: Step[] = [
  ...steps('verify', 'S').slice(0, -1),
  {
    do: 'edit',
    files: {
      'src/avg.js':
        'export function avg(xs) {\n  if (xs.length === 0) return 0\n  return xs.reduce((a, b) => a + b, 0) / xs.length\n}\n// 디버그\n',
      'debug.log': '실험 출력\n',
    },
  },
  { do: 'stop' },
  { do: 'wait' },
]

const DIRTY = [' M src/avg.js', '?? debug.log']

describe('[흐름] 전달 (M5, 시나리오 7)', () => {
  it('[push]는 Work 브랜치를 로컬 bare 원격에 push하고 승인을 기록한 뒤 Work를 완료한다 (7-4, 7-6, D120)', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    // verify를 시작할 때 origin과 gh를 다시 점검했다 (D118). 마무리 안내 문구는 누를 수 있는 전달 버튼이다 (D104)
    expect(gh(s, 'auth')).toHaveLength(2)
    const ctx = read(path.join(s.dir, 'tasks', '03-verify', 'context.md'))
    expect(ctx).toContain('[완료만], [push], [PR 생성] 중 하나를 누르세요')
    const review = await s.h.relay.review(s.key, 't-03')
    expect(review?.completion).toMatchObject({
      mode: 'deliver',
      stopped: false,
      buttons: {
        none: { enabled: true },
        push: { enabled: true, reason: null },
        pr: { enabled: true, reason: null },
      },
      delivery: null,
    })

    expect(await deliver(s, 'push')).toEqual({ ok: true })
    await settle(s.h, s.key)
    // origin(로컬 bare)의 같은 이름 브랜치가 Work의 HEAD다
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
    expect(git(s.repo, 'rev-parse', `refs/remotes/origin/${s.branch}`)).toBe(head)
    const w = work(s)
    expect(w.status).toBe('completed')
    expect(w.operation).toBeUndefined()
    expect(w.tasks.map((t) => [t.id, t.status])).toEqual([
      ['t-01', 'approved'],
      ['t-02', 'approved'],
      ['t-03', 'approved'],
    ])
    expect(w.tasks[2]?.session?.alive).toBe(false)
    // origin이 로컬 경로라 비교 URL은 없다
    expect(w.delivery).toEqual({
      choice: 'push',
      status: 'succeeded',
      at: w.completed_at,
      branch: s.branch,
      compare_url: null,
    })
    expect(
      events(s)
        .slice(-4)
        .map((e) => [e.type, e.task_id ?? null, e.payload]),
    ).toEqual([
      ['task.awaiting_approval', 't-03', {}],
      ['task.approved', 't-03', { by: 'human' }],
      ['delivery.succeeded', null, { choice: 'push', branch: s.branch, compare_url: null }],
      ['work.completed', null, { delivery: 'push' }],
    ])
    expect(read(path.join(s.dir, 'decisions.md'))).toContain('## t-03 verify — ')
    expect(view(s)?.delivery).toMatchObject({ label: 'push', status: 'succeeded' })
    expect(view(s)?.badge).toEqual({ kind: 'done', label: '완료', hot: false })
    // 완료한 Work의 Work 완료 화면은 읽기 전용이다
    expect((await s.h.relay.review(s.key, 't-03'))?.completion?.mode).toBeNull()
    expect(gh(s, 'pr create')).toEqual([])
  })

  it('[PR 생성]은 push한 뒤 pr.md의 제목과 본문, draft 설정으로 가짜 gh를 부르고 PR 주소와 비교 URL을 남긴다 (7-4, D62, D71)', async () => {
    const s = await setup(scenario('S'), { github: true, config: { pr_draft: true } })
    await toVerify(s)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    expect(await deliver(s, 'pr')).toEqual({ ok: true })
    await settle(s.h, s.key)
    // push는 origin의 pushurl(로컬 bare)로 갔다
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
    // 같은 브랜치의 열린 PR을 먼저 찾고, 없으니 만든다
    expect(gh(s, 'pr list').map((r) => r.args)).toEqual([
      [
        'pr',
        'list',
        '--repo',
        GH_REPO,
        '--head',
        s.branch,
        '--state',
        'open',
        '--json',
        'url,number,isDraft,baseRefName',
        '--limit',
        '1',
      ],
    ])
    const [create] = gh(s, 'pr create')
    expect(create?.args).toEqual([
      'pr',
      'create',
      '--repo',
      GH_REPO,
      '--base',
      'main',
      '--head',
      s.branch,
      '--title',
      '빈 배열의 평균을 0으로',
      '--body-file',
      expect.any(String),
      '--draft',
    ])
    expect(create?.body).toBe('## 요약\n## 원인\n## 변경\n## 테스트')
    expect(fs.realpathSync.native(create?.cwd ?? '')).toBe(fs.realpathSync.native(s.repo))
    const compare = `https://github.com/relay-test/sample/compare/main...relay%2F${s.workId}?expand=1`
    const w = work(s)
    expect(w.status).toBe('completed')
    expect(w.delivery).toEqual({
      choice: 'pr',
      status: 'succeeded',
      at: w.completed_at,
      branch: s.branch,
      compare_url: compare,
      pr_url: 'https://github.com/relay-test/sample/pull/1',
      draft: true,
    })
    expect(events(s).at(-1)).toMatchObject({ type: 'work.completed', payload: { delivery: 'pr' } })
    expect(view(s)?.delivery).toMatchObject({
      label: 'PR 생성',
      prUrl: 'https://github.com/relay-test/sample/pull/1',
      compareUrl: compare,
      draft: true,
      prExisting: false,
    })
  })

  it('같은 브랜치의 PR이 이미 열려 있으면 새로 만들지 않고 링크만 기록한다. draft 설정이 꺼져 있으면 일반 PR이다 (7-4, D71)', async () => {
    const open = 'https://github.com/relay-test/sample/pull/7'
    const s = await setup(scenario('S'), { github: true, env: { FAKE_GH_OPEN_PR: open } })
    await toVerify(s)
    expect(await deliver(s, 'pr')).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(gh(s, 'pr list')).toHaveLength(1)
    expect(gh(s, 'pr create')).toEqual([])
    expect(work(s).delivery).toMatchObject({
      status: 'succeeded',
      pr_url: open,
      pr_existing: true,
    })
    expect(work(s).delivery?.draft).toBeUndefined()
    expect(events(s).find((e) => e.type === 'delivery.succeeded')?.payload).toMatchObject({
      pr_url: open,
      pr_existing: true,
    })
  })

  it('draft 설정이 꺼져 있으면 일반 PR로 만든다 (D71)', async () => {
    const s = await setup(scenario('S'), { github: true })
    await toVerify(s)
    expect(await deliver(s, 'pr')).toEqual({ ok: true })
    const [create] = gh(s, 'pr create')
    expect(create?.args).not.toContain('--draft')
    expect(work(s).delivery).toMatchObject({ draft: false })
  })

  it('커밋 안 된 변경이 있으면 push를 막고 목록을 보인다. [변경 버리고 진행]은 git stash -u로 백업한 뒤 전달한다 (7-5)', async () => {
    const s = await setup({ tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY } })
    await toVerify(s)
    const fixed = git(s.tree, 'rev-parse', 'HEAD')
    const blocked = await deliver(s, 'push')
    expect(blocked.ok).toBe(false)
    expect(!blocked.ok && blocked.error).toBe('커밋 안 된 변경이 있어 push와 PR을 할 수 없음')
    expect(!blocked.ok && [...(blocked.uncommitted ?? [])].sort()).toEqual(DIRTY)
    // 고르기 전에는 아무것도 바뀌지 않는다: verify 세션도 살아 있다
    await settle(s.h, s.key)
    expect(work(s).tasks[2]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: true },
    })
    expect(git(s.remote, 'branch', '--list', s.branch)).toBe('')
    // 보인 목록과 다르면 받지 않는다
    const stale = await deliver(s, 'push', { action: 'discard', expect: [' M src/avg.js'] })
    expect(!stale.ok && stale.error).toBe('확인한 뒤 커밋 안 된 변경이 바뀌었음. 다시 고르세요')

    expect(await deliver(s, 'push', { action: 'discard', expect: DIRTY })).toEqual({ ok: true })
    await settle(s.h, s.key)
    const stash = git(s.repo, 'rev-parse', 'refs/stash')
    expect(git(s.repo, 'stash', 'list')).toContain(`relay(${s.workId}): 완료 전 버린 변경`)
    expect(git(s.repo, 'show', `${stash}^3:debug.log`)).toBe('실험 출력')
    expect(git(s.tree, 'status', '--porcelain')).toBe('')
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(fixed)
    expect(work(s)).toMatchObject({
      status: 'completed',
      delivery: { choice: 'push', status: 'succeeded', stashes: [stash] },
    })
  })

  it('[커밋하고 진행]은 확인한 파일을 앱이 커밋한 뒤 전달한다 (7-5)', async () => {
    const s = await setup({ tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY } })
    await toVerify(s)
    const fixed = git(s.tree, 'rev-parse', 'HEAD')
    expect(await deliver(s, 'push', { action: 'commit', expect: DIRTY })).toEqual({ ok: true })
    await settle(s.h, s.key)
    const tip = git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)
    expect(git(s.repo, 'rev-parse', `${tip}^`)).toBe(fixed)
    expect(git(s.repo, 'log', '-1', '--format=%s', tip)).toBe(
      `relay(${s.workId}): 완료 전 남은 변경`,
    )
    expect(git(s.repo, 'show', '--name-only', '--format=', tip).split('\n').sort()).toEqual([
      'debug.log',
      'src/avg.js',
    ])
    expect(work(s)).toMatchObject({
      status: 'completed',
      delivery: { status: 'succeeded', commits: [tip] },
    })
  })

  for (const action of ['discard', 'commit'] as const) {
    const label = action === 'discard' ? '[변경 버리고 진행]' : '[커밋하고 진행]'
    const made = action === 'discard' ? 'stash는' : '커밋은'
    it(`${label} 뒤 push가 실패해도 앱이 만든 ${made} 전달 결과에 남고, [다시 시도]가 성공해도 이어진다 (7-5, 7-6)`, async () => {
      const s = await setup({ tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY } })
      await toVerify(s)
      fs.renameSync(s.remote, `${s.remote}.off`)
      const r = await deliver(s, 'push', { action, expect: DIRTY })
      expect(!r.ok && r.error).toMatch(/^전달 실패: git push 실패: /)
      await settle(s.h, s.key)
      const backup =
        action === 'discard'
          ? git(s.repo, 'rev-parse', 'refs/stash')
          : git(s.tree, 'rev-parse', 'HEAD')
      const field = action === 'discard' ? 'stashes' : 'commits'
      expect(git(s.tree, 'status', '--porcelain')).toBe('')
      expect(work(s).delivery).toMatchObject({
        status: 'failed',
        stage: 'push',
        [field]: [backup],
      })
      expect(events(s).at(-1)).toMatchObject({
        type: 'delivery.failed',
        payload: { [field]: [backup] },
      })
      // [다시 시도]: 작업 트리는 이미 깨끗해 바로 push한다
      fs.renameSync(`${s.remote}.off`, s.remote)
      expect(await deliver(s, 'push')).toEqual({ ok: true })
      await settle(s.h, s.key)
      expect(work(s)).toMatchObject({
        status: 'completed',
        delivery: { status: 'succeeded', [field]: [backup] },
      })
      expect(events(s).find((e) => e.type === 'delivery.succeeded')?.payload).toMatchObject({
        [field]: [backup],
      })
    })
  }

  it('[AI 세션 열기]는 기록하지 않는 정리 세션을 열고, 턴이 끝나 깨끗하면 버튼을 강조한다. [정리 끝 → push/PR 진행]으로 전달한다 (7-5)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY },
      cleanup: [
        { do: 'waitEnter' },
        { do: 'prompt', text: '커밋 안 된 변경을 되돌려 줘' },
        { do: 'git', args: ['checkout', '--', '.'] },
        { do: 'git', args: ['clean', '-f', '-d', '-q'] },
        { do: 'stop' },
        { do: 'wait' },
      ],
    })
    await toVerify(s)
    const fixed = git(s.tree, 'rev-parse', 'HEAD')
    const verifyPid = work(s).tasks[2]?.session?.pid ?? 0
    expect(await s.h.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    const opened = await until(s, (w) => w.cleanup?.status === 'live', '정리 세션')
    expect(opened.cleanup).toMatchObject({ choice: 'push', clean: false, uncommitted: [] })
    // verify 세션은 끝났고 승인 대기로 남는다. 정리 세션은 task가 아니다
    await settle(s.h, s.key)
    expect(alive(verifyPid)).toBe(false)
    expect(work(s).tasks).toHaveLength(3)
    expect(work(s).tasks[2]).toMatchObject({
      status: 'awaiting_approval',
      session: { alive: false },
    })
    // 첫 프롬프트, 세션 id, 스킬 없이 연다. 설정 파일은 push와 PR을 막고 자동 메모리를 끈다
    // 가짜 claude는 뜬 뒤에 기록을 남긴다
    const start = (await s.h.ui.until(
      () => s.h.records().find((r) => r['type'] === 'start' && r['cleanup'] === true),
      '정리 세션의 기록',
      30_000,
    )) as { args: string[]; cwd: string } | undefined
    expect(start?.args.slice(0, 2)).toEqual(['--dangerously-skip-permissions', '--settings'])
    expect(start?.args).toHaveLength(3)
    expect(fs.realpathSync.native(start?.cwd ?? '')).toBe(fs.realpathSync.native(s.tree))
    const settings = JSON.parse(read(start?.args[2] ?? '')) as {
      permissions: { deny: string[] }
      autoMemoryEnabled: boolean
      hooks: Record<string, { hooks: { url: string }[] }[]>
    }
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining(['Bash(git push*)', 'Bash(gh pr*)']),
    )
    expect(settings.permissions.deny.filter((r) => r.includes('/tasks/'))).toHaveLength(3)
    expect(settings.autoMemoryEnabled).toBe(false)
    expect(settings.hooks['Stop']?.[0]?.hooks[0]?.url).toMatch(/\/hook\/cleanup\/Stop$/)
    // 정리 세션이 열려 있으면 전달하지 않는다
    expect(await deliver(s, 'push')).toMatchObject({ ok: false })

    // 사람이 터미널에서 시키면 정리하고 턴을 끝낸다. 깨끗하면 버튼을 강조한다
    s.h.relay.terminalWrite(opened.cleanup?.terminal ?? '', '\r')
    await until(s, (w) => w.cleanup?.clean === true, '깨끗해짐')
    expect(await s.h.relay.finishCleanup(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(fixed)
    const w = work(s)
    expect(w).toMatchObject({
      status: 'completed',
      delivery: { choice: 'push', status: 'succeeded' },
    })
    expect(w.tasks).toHaveLength(3)
    // 정리 세션은 기록하지 않는다: 설정 파일도 지운다
    expect(fs.existsSync(start?.args[2] ?? '')).toBe(false)
    expect(events(s).filter((e) => e.type === 'task.started')).toHaveLength(3)
    expect(view(s)?.cleanup).toBeNull()
  })

  it('worktree가 Work 브랜치에 있지 않으면 전달하지 않는다. 돌아오면 전달한다 (D138)', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    // 에이전트가 분리된 HEAD에 커밋을 남겼다
    git(s.tree, 'checkout', '--quiet', '--detach')
    fs.writeFileSync(path.join(s.tree, 'detached.txt'), '분리된 HEAD의 커밋\n')
    git(s.tree, 'add', 'detached.txt')
    git(s.tree, 'commit', '--quiet', '-m', 'detached')
    const refused = {
      ok: false,
      error: `worktree가 Work 브랜치에 있지 않음(지금: 분리된 HEAD). worktree에서 \`git switch ${s.branch}\`로 돌아온 뒤 다시 누르세요`,
    }
    expect(await deliver(s, 'push')).toEqual(refused)
    expect(await deliver(s, 'pr')).toEqual(refused)
    expect(git(s.remote, 'branch', '--list', s.branch)).toBe('')
    expect(work(s).status).toBe('active')
    // 다른 브랜치면 그 이름을 보인다
    git(s.tree, 'switch', '--quiet', '-c', 'other')
    expect(await deliver(s, 'push')).toEqual({
      ok: false,
      error: `worktree가 Work 브랜치에 있지 않음(지금: other). worktree에서 \`git switch ${s.branch}\`로 돌아온 뒤 다시 누르세요`,
    })

    git(s.tree, 'switch', '--quiet', s.branch)
    expect(await deliver(s, 'push')).toEqual({ ok: true })
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
  })

  it('정리 세션이 열린 동안에는 다른 조작을 받지 않는다. [정리 세션 닫기]는 전달 없이 세션만 끝낸다 (D137)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY },
      cleanup: [{ do: 'waitEnter' }, { do: 'wait' }],
    })
    await toVerify(s)
    expect(await s.h.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    const opened = await until(s, (w) => w.cleanup?.status === 'live', '정리 세션')
    await settle(s.h, s.key)
    const dirty = git(s.tree, 'status', '--porcelain')
    expect(dirty).not.toBe('')
    // 버튼을 끄고 main도 받지 않는다
    expect(opened.actions).toMatchObject({
      resume: false,
      retry: false,
      selectStep: false,
      abandon: false,
    })
    const blocked = {
      ok: false,
      error: '정리 세션이 열려 있음: 먼저 [정리 세션 닫기]나 [정리 끝 → push/PR 진행]을 누르세요',
    }
    expect(await s.h.relay.resume(s.key, 't-03')).toEqual(blocked)
    expect(await s.h.relay.retry(s.key, 't-03')).toEqual(blocked)
    expect(await s.h.relay.approve(s.key, 't-03', {})).toEqual(blocked)
    expect(await s.h.relay.abandon(s.key)).toEqual(blocked)
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'fix',
        keepCode: false,
        instruction: '',
        expect: { taskId: 't-03', done: false },
      }),
    ).toEqual(blocked)
    expect(work(s).tasks).toHaveLength(3)

    expect(await s.h.relay.closeCleanup(s.key)).toEqual({ ok: true })
    await settle(s.h, s.key)
    const closed = view(s)
    expect(closed?.cleanup).toBeNull()
    expect(closed?.actions).toMatchObject({ resume: true, selectStep: true, abandon: true })
    // 전달하지 않았고 변경은 worktree에 남는다
    const w = work(s)
    expect(w.status).toBe('active')
    expect(w.delivery).toBeUndefined()
    expect(w.cleanup_process).toBeUndefined()
    expect(git(s.tree, 'status', '--porcelain')).toBe(dirty)
    expect(git(s.remote, 'branch', '--list', s.branch)).toBe('')
    expect(await s.h.relay.resume(s.key, 't-03')).toEqual({ ok: true })
  })

  it('정리 세션을 /exit로 끝냈는데 변경이 남았으면 선택지로 돌아간다 (7-5)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY },
      cleanup: [{ do: 'prompt' }, { do: 'stop' }, { do: 'exit' }],
    })
    await toVerify(s)
    expect(await s.h.relay.openCleanup(s.key, 'pr')).toEqual({ ok: true })
    const ended = await until(
      s,
      (w) => w.cleanup?.status === 'ended' && w.cleanup.uncommitted.length > 0,
      '변경이 남은 채 끝남',
    )
    expect([...(ended.cleanup?.uncommitted ?? [])].sort()).toEqual(DIRTY)
    expect(ended.cleanup?.clean).toBe(false)
    expect(work(s).status).toBe('active')
    // 선택지로 돌아가 [변경 버리고 진행]을 고르면 원래 고른 전달을 한다
    expect(await deliver(s, 'push', { action: 'discard', expect: DIRTY })).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(work(s).status).toBe('completed')
    expect(view(s)?.cleanup).toBeNull()
  })

  it('정리 세션을 /exit로 끝냈을 때 깨끗하면 원래 고른 전달을 한다 (7-5)', async () => {
    const s = await setup({
      tasks: { ...scenario('S').tasks, 'final-verify': DIRTY_VERIFY },
      cleanup: [
        { do: 'prompt' },
        { do: 'git', args: ['add', '-A'] },
        { do: 'git', args: ['commit', '-q', '-m', 'chore: 디버그 출력 정리'] },
        { do: 'stop' },
        { do: 'exit' },
      ],
    })
    await toVerify(s)
    const fixed = git(s.tree, 'rev-parse', 'HEAD')
    expect(await s.h.relay.openCleanup(s.key, 'push')).toEqual({ ok: true })
    await until(s, (w) => w.status === 'completed', 'Work 완료')
    await settle(s.h, s.key)
    // 정리 세션이 한 커밋까지 push했다
    const tip = git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)
    expect(git(s.repo, 'rev-parse', `${tip}^`)).toBe(fixed)
    expect(git(s.repo, 'log', '-1', '--format=%s', tip)).toBe('chore: 디버그 출력 정리')
  })

  it('전달이 실패하면 완료하지 않고 verify는 승인 대기로 남는다. [다시 시도]하면 전달한다 (7-6, D120)', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    fs.renameSync(s.remote, `${s.remote}.off`)
    const r = await deliver(s, 'push')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/^전달 실패: git push 실패: /)
    await settle(s.h, s.key)
    let w = work(s)
    expect(w.status).toBe('active')
    expect(w.operation).toBeUndefined()
    expect(w.tasks[2]).toMatchObject({ status: 'awaiting_approval', session: { alive: false } })
    expect(w.tasks[2]?.approved_at).toBeUndefined()
    expect(w.delivery).toMatchObject({ choice: 'push', status: 'failed', stage: 'push' })
    expect(events(s).at(-1)).toMatchObject({
      type: 'delivery.failed',
      payload: { choice: 'push', stage: 'push' },
    })
    expect(read(path.join(s.dir, 'decisions.md'))).not.toContain('## t-03 verify — ')
    const review = await s.h.relay.review(s.key, 't-03')
    expect(review?.completion).toMatchObject({
      mode: 'deliver',
      delivery: { status: 'failed', stage: 'push', label: 'push' },
    })
    expect(view(s)?.badge.kind).toBe('awaiting_approval')

    // [다시 시도]
    fs.renameSync(`${s.remote}.off`, s.remote)
    expect(await deliver(s, 'push')).toEqual({ ok: true })
    await settle(s.h, s.key)
    w = work(s)
    expect(w).toMatchObject({ status: 'completed', delivery: { status: 'succeeded' } })
    expect(git(s.remote, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
  })

  it('PR을 만들지 못하면 push만 된 채 완료하지 않는다. [전달 없이 완료]는 [완료만]과 같다 (7-6, D120)', async () => {
    const s = await setup(scenario('S'), { env: { FAKE_GH_FAIL: 'create' } })
    await toVerify(s)
    const r = await deliver(s, 'pr')
    expect(!r.ok && r.error).toMatch(/^전달 실패: gh pr create 실패: /)
    await settle(s.h, s.key)
    expect(work(s).delivery).toMatchObject({ choice: 'pr', status: 'failed', stage: 'pr' })
    expect(git(s.remote, 'branch', '--list', s.branch)).toContain(s.branch)
    // [전달 없이 완료]
    expect(await s.h.relay.approve(s.key, 't-03', {})).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = work(s)
    expect(w.status).toBe('completed')
    expect(w.delivery?.status).toBe('failed')
    expect(events(s).at(-1)).toMatchObject({
      type: 'work.completed',
      payload: { delivery: 'none' },
    })
    expect(view(s)?.delivery).toMatchObject({ status: 'failed' })
  })

  it('[이 단계 끝나면 멈춤]이면 verify는 [승인하고 멈춤]이고, 멈춘 Work의 Work 완료 화면에서 전달한다 (D119)', async () => {
    const s = await setup(scenario('S'))
    await toVerify(s)
    // verify가 도는 중에 멈춤을 켜도 마무리 안내 문구가 맞다: [승인하고 멈춤]을 함께 적었다 (D104)
    expect(read(path.join(s.dir, 'tasks', '03-verify', 'context.md'))).toContain(
      '[이 단계 끝나면 멈춤]이 켜져 있거나 이전 단계를 추천했으면 [승인하고 멈춤]을 누르고',
    )
    expect(await s.h.relay.stopAfter(s.key, true)).toEqual({ ok: true })
    expect((await s.h.relay.review(s.key, 't-03'))?.completion?.mode).toBe('stop')
    expect(await deliver(s, 'push')).toEqual({
      ok: false,
      error: '승인하면 Work가 멈춤: [승인하고 멈춤]을 누르세요',
    })
    // [승인하고 멈춤]
    expect(await s.h.relay.approve(s.key, 't-03', {})).toEqual({ ok: true })
    const stopped = await until(s, (w) => w.status === 'stopped', '멈춤')
    expect(stopped.actions.resumeWork).toBe(false)
    expect(stopped.stopHint).toBe('Work 완료 화면에서 전달을 고르면 Work를 완료합니다.')
    const review = await s.h.relay.review(s.key, 't-03')
    expect(review?.completion).toMatchObject({ mode: 'deliver', stopped: true })
    expect(await deliver(s, 'push')).toEqual({ ok: true })
    await settle(s.h, s.key)
    const w = work(s)
    expect(w.status).toBe('completed')
    expect(w.stop).toBeUndefined()
    expect(
      events(s).filter((e) => e.type === 'task.approved' && e.task_id === 't-03'),
    ).toHaveLength(1)
    expect(git(s.remote, 'branch', '--list', s.branch)).toContain(s.branch)
  })

  it('origin·gh는 verify를 시작할 때와 [다시 점검]에서 다시 점검한다. 전달 버튼과 마무리 안내 문구가 따른다 (D67, D104, D118)', async () => {
    const s = await setup(scenario('S'), { env: { FAKE_GH_AUTH: 'fail' } })
    await toVerify(s)
    const ctx = read(path.join(s.dir, 'tasks', '03-verify', 'context.md'))
    expect(ctx).toContain('[완료만], [push] 중 하나를 누르세요')
    let review = await s.h.relay.review(s.key, 't-03')
    expect(review?.completion?.buttons.pr).toEqual({
      enabled: false,
      reason: 'gh가 없거나 로그인되지 않음',
    })
    expect(await deliver(s, 'pr')).toEqual({
      ok: false,
      error: '[PR 생성]을 쓸 수 없음: gh가 없거나 로그인되지 않음',
    })
    // gh에 로그인한 뒤 [다시 점검]
    delete s.h.env['FAKE_GH_AUTH']
    expect(await s.h.relay.recheckWork(s.key)).toEqual({ ok: true })
    review = await s.h.relay.review(s.key, 't-03')
    expect(review?.completion?.buttons.pr).toEqual({ enabled: true, reason: null })
    const project = JSON.parse(
      read(path.join(s.h.home, 'projects', s.key.split('/')[0] ?? '', 'project.json')),
    ) as { checks: { origin: boolean; gh: boolean } }
    expect(project.checks).toMatchObject({ origin: true, gh: true })
    expect(s.h.ui.projectList[0]).toMatchObject({ origin: true, gh: true })
    // origin을 지우면 [push]와 [PR 생성]이 모두 꺼진다
    git(s.repo, 'remote', 'remove', 'origin')
    expect(await s.h.relay.recheckWork(s.key)).toEqual({ ok: true })
    review = await s.h.relay.review(s.key, 't-03')
    expect(review?.completion?.buttons).toMatchObject({
      none: { enabled: true },
      push: { enabled: false, reason: 'origin 원격이 없음' },
      pr: { enabled: false, reason: 'origin 원격이 없음' },
    })
  })
})

function alive(pid: number): boolean {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
