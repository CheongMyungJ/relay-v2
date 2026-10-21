// [흐름] Work 정리 (docs/implementation.md M5, 시나리오 8, D16, I25, I26).
// 정리 뒤 worktree는 없고 산출물은 남는다. 되감기 백업 브랜치는 "함께 삭제"(기본 체크)로 지운다. 작업 브랜치는
// 기본으로 두고 push됐거나 머지됐을 때만 지운다. 커밋 안 된 변경은 사람이 확인해야 지운다(--force).
// 보관된 Work의 탭과 읽기 전용 승인 화면은 메인 체크아웃에서 git을 돌려 그대로 보인다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { CleanPreview } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import {
  addSubmodule,
  git,
  harness,
  makeRepo,
  register,
  settle,
  type Harness,
} from '../support/harness'
import { FIXED_FILES, REPO_FILES, REQUEST, scenario, type Scenario } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 파일을 지울 수 없게 표시한다 (Linux의 chattr +i, root만). 없거나 안 되면 false */
function immutable(file: string, on: boolean): boolean {
  if (process.platform !== 'linux') return false
  return spawnSync('chattr', [on ? '+i' : '-i', file]).status === 0
}

/** worktree 지우기를 도중에 실패시킬 수 있는가 (A8). Windows의 잠긴 파일은 실기 확인에 맡긴다 */
const canLock = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-chattr-'))
  const file = path.join(dir, 'x')
  fs.writeFileSync(file, '')
  const ok = immutable(file, true)
  if (ok) immutable(file, false)
  fs.rmSync(dir, { recursive: true, force: true })
  return ok
})()

interface Setup {
  h: Harness
  repo: string
  remote: string
  key: string
  dir: string
  tree: string
  workId: string
  branch: string
}

async function setup(s: Scenario): Promise<Setup> {
  h = await harness({ scenario: s })
  const hh = h
  const { repo, remote } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
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

async function preview(s: Setup): Promise<CleanPreview> {
  const r = await s.h.relay.cleanPreview(s.key)
  if (!r.ok) throw new Error(`정리 요약 실패: ${r.error}`)
  return r.preview
}

/** 가짜 claude의 파일 목록: Work 디렉터리 아래(상대 경로) */
function listFiles(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p).replace(/\\/g, '/')]
  })
}

describe('[흐름] Work 정리 (M5, 시나리오 8)', () => {
  it('정리 뒤 worktree는 없고 산출물은 남는다. 되감기 백업 브랜치는 함께 지우고 작업 브랜치는 둔다 (8-2, D16, D424)', async () => {
    // [push]로 완료한다. 되감기 백업 브랜치는 D418 전의 앱이 남긴 것이라고 치자 (D424)
    const s = await setup(scenario())
    const paused = await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.h, s.key)
    const backup = `${s.branch}-discarded-1`
    git(s.repo, 'branch', backup, s.branch)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    const before = listFiles(s.dir)

    // 확인 요약 (8-1): push됐으니 작업 브랜치 삭제를 제안한다. 백업 브랜치가 있다
    const summary = await preview(s)
    expect(summary).toEqual({
      worktree: true,
      uncommitted: [],
      locks: [],
      submodules: [],
      live: 0,
      branch: {
        name: s.branch,
        exists: true,
        pushed: true,
        merged: false,
        deletable: true,
        lost: [],
      },
      backups: [backup],
      merged: false,
      remote: null,
      integration: null,
      confirm: [],
      expect: {
        uncommitted: [],
        locks: [],
        live: 0,
        backups: [backup],
        remote: false,
        lost: [],
        submodules: [],
      },
    })
    expect(s.h.ui.works.get(s.key)?.actions.clean).toBe(true)
    expect(
      await s.h.relay.clean(s.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: false,
        expect: summary.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, s.key)

    // worktree는 없고, 작업 브랜치는 남고, 백업 브랜치는 지웠다
    expect(fs.existsSync(s.tree)).toBe(false)
    expect(git(s.repo, 'worktree', 'list', '--porcelain')).not.toContain(s.workId)
    expect(git(s.repo, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
    expect(git(s.repo, 'branch', '--list', backup)).toBe('')
    // 산출물과 기록은 그대로 있다
    const after = listFiles(s.dir)
    expect(after.filter((f) => f !== 'work.json' && f !== 'events.jsonl')).toEqual(
      before.filter((f) => f !== 'work.json' && f !== 'events.jsonl'),
    )
    for (const f of ['request.md', 'intent.md', 'decisions.md', 'tasks/03-verify/pr.md']) {
      expect(after, f).toContain(f)
    }
    const w = work(s)
    expect(w.status).toBe('archived')
    expect(w.operation).toBeUndefined()
    expect(w.cleaned).toEqual({
      at: w.cleaned?.at,
      head,
      forced: false,
      deleted_branches: [backup],
    })
    expect(events(s).at(-1)).toMatchObject({
      type: 'work.cleaned',
      payload: { forced: false, deleted_branches: [backup] },
    })
    const view = s.h.ui.works.get(s.key)
    expect(view?.badge).toEqual({ kind: 'done', label: '보관됨', hot: false })
    expect(view?.statusLabel).toBe('보관됨')
    expect(Object.values(view?.actions ?? {}).every((v) => !v)).toBe(true)
    expect(view?.delivery).toMatchObject({ label: 'push', status: 'succeeded' })

    // 보관된 Work의 탭과 읽기 전용 승인 화면: 메인 체크아웃에서 커밋끼리 비교한다
    const verify = await s.h.relay.review(s.key, 't-03')
    expect(verify?.diff).toBe('')
    expect(verify?.completion?.mode).toBeNull()
    expect(verify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
    const fix = await s.h.relay.review(s.key, 't-02')
    expect(fix?.diff).toContain('+  if (xs.length === 0) return 0')
    expect(fix?.emphasis.map((e) => e.kind)).not.toContain('uncommitted')
    expect((await s.h.relay.terminalAttach(`${s.key}/t-03`)).data).toContain('FAKE-CLAUDE READY')
    // worktree가 없어 탭의 상대 경로는 메인 체크아웃에서 푼다 (D411)
    expect(await s.h.relay.terminalPaths(`${s.key}/t-03`, [['src/avg.js']])).toEqual([0])
    // 다시 정리하지 않는다
    expect((await s.h.relay.cleanPreview(s.key)).ok).toBe(false)
    expect(
      (
        await s.h.relay.clean(s.key, {
          deleteBranch: false,
          deleteBackups: true,
          confirmed: false,
          expect: summary.expect,
        })
      ).ok,
    ).toBe(false)
  })

  it('push됐으면 작업 브랜치를 지울 수 있다. 백업 브랜치의 "함께 삭제"를 끄면 둔다 (8-2)', async () => {
    const s = await setup(scenario())
    await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    // 사람이 만든 다른 백업 브랜치라고 치자
    const backup = `${s.branch}-discarded-1`
    git(s.repo, 'branch', backup, 'main')
    const summary = await preview(s)
    expect(summary.branch.deletable).toBe(true)
    expect(summary.backups).toEqual([backup])
    expect(
      await s.h.relay.clean(s.key, {
        deleteBranch: true,
        deleteBackups: false,
        confirmed: false,
        expect: summary.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(git(s.repo, 'branch', '--list', s.branch)).toBe('')
    expect(git(s.repo, 'branch', '--list', backup)).toContain(backup)
    // 원격의 브랜치는 그대로다
    expect(git(s.remote, 'branch', '--list', s.branch)).toContain(s.branch)
    expect(work(s).cleaned?.deleted_branches).toEqual([s.branch])
  })

  it('체크아웃된 서브모듈이 있으면 그 안의 작업도 지움을 확인해야 지운다(--force) (8-1, D382)', async () => {
    const s = await setup(scenario())
    await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.h, s.key)
    // 완료한 뒤 worktree에서 서브모듈을 더했다 (체크아웃된 채다)
    addSubmodule(s.tree, path.join(s.h.root, 'lib-src'), 'lib', { 'lib.txt': 'lib\n' })

    const summary = await preview(s)
    const confirm =
      '체크아웃된 서브모듈 1개(lib) 안의 커밋 안 된 변경과 push 안 한 커밋도 함께 지웁니다'
    expect(summary).toMatchObject({ uncommitted: [], submodules: ['lib'], confirm: [confirm] })
    const input = {
      deleteBranch: false,
      deleteBackups: true,
      confirmed: false,
      expect: summary.expect,
    }
    expect(await s.h.relay.clean(s.key, input)).toEqual({
      ok: false,
      error: `확인이 필요함: ${confirm}`,
    })
    expect(await s.h.relay.clean(s.key, { ...input, confirmed: true })).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(fs.existsSync(s.tree)).toBe(false)
    expect(work(s)).toMatchObject({ status: 'archived', cleaned: { forced: true } })
  })

  it('포기한 Work의 커밋 안 된 변경은 확인해야 지운다(--force). push나 머지 전의 작업 브랜치는 지우지 않는다 (8-1)', async () => {
    const s = await setup({
      tasks: {
        ...scenario().tasks,
        fix: [
          { do: 'prompt' },
          { do: 'commit', files: FIXED_FILES, message: 'fix: 빈 배열의 평균은 0' },
          { do: 'edit', files: { 'scratch.txt': '실험 메모\n' } },
          { do: 'wait' },
        ],
      },
    })
    const fixing = drive(s.h.relay, s.h.ui, s.key)
    await s.h.ui.until(() => fs.existsSync(path.join(s.tree, 'scratch.txt')), '고치는 중', 30_000)
    await settle(s.h, s.key)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    expect(await s.h.relay.abandon(s.key)).toEqual({ ok: true })
    await fixing
    await settle(s.h, s.key)

    const summary = await preview(s)
    expect(summary).toMatchObject({
      uncommitted: ['?? scratch.txt'],
      live: 0,
      branch: { pushed: false, merged: false, deletable: false },
      backups: [],
      confirm: ['커밋 안 된 변경 1개를 백업 없이 지웁니다'],
    })
    const input = {
      deleteBranch: false,
      deleteBackups: true,
      confirmed: false,
      expect: summary.expect,
    }
    expect(await s.h.relay.clean(s.key, input)).toEqual({
      ok: false,
      error: '확인이 필요함: 커밋 안 된 변경 1개를 백업 없이 지웁니다',
    })
    expect(await s.h.relay.clean(s.key, { ...input, confirmed: true, deleteBranch: true })).toEqual(
      {
        ok: false,
        error: '작업 브랜치는 push됐거나 머지됐을 때만 지움',
      },
    )
    // 확인한 뒤 바뀌었으면 받지 않는다
    fs.writeFileSync(path.join(s.tree, 'more.txt'), '더\n')
    expect(await s.h.relay.clean(s.key, { ...input, confirmed: true })).toEqual({
      ok: false,
      error: '확인한 뒤 Work가 바뀌었음. [Work 정리]를 다시 여세요',
    })
    fs.rmSync(path.join(s.tree, 'more.txt'))

    expect(await s.h.relay.clean(s.key, { ...input, confirmed: true })).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(fs.existsSync(s.tree)).toBe(false)
    expect(git(s.repo, 'rev-parse', `refs/heads/${s.branch}`)).toBe(head)
    const w = work(s)
    expect(w).toMatchObject({ status: 'archived', abandoned_at: expect.any(String) })
    expect(w.cleaned).toMatchObject({ forced: true, deleted_branches: [], head })
    expect(s.h.ui.works.get(s.key)?.completedAt).toBeNull()
  })

  it('사람이 worktree 폴더를 먼저 지웠으면 git worktree prune만 하고, 보관된 Work의 [변경]은 작업 브랜치의 커밋까지 본다 (8-2)', async () => {
    const s = await setup(scenario())
    const done = await drive(s.h.relay, s.h.ui, s.key)
    expect(done.status).toBe('completed')
    await settle(s.h, s.key)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    fs.rmSync(s.tree, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    const summary = await preview(s)
    expect(summary).toMatchObject({
      worktree: false,
      uncommitted: [],
      locks: [],
      live: 0,
      branch: { exists: true },
      confirm: [],
    })
    expect(
      await s.h.relay.clean(s.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: false,
        expect: summary.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, s.key)
    // 폴더가 없어진 worktree의 관리 정보도 치웠다
    expect(git(s.repo, 'worktree', 'list', '--porcelain')).not.toContain(s.workId)
    const w = work(s)
    expect(w.status).toBe('archived')
    expect(w.cleaned).toMatchObject({ head, forced: false, deleted_branches: [] })
    const verify = await s.h.relay.review(s.key, 't-03')
    expect(verify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
  })

  it.runIf(canLock)(
    'worktree를 지우다 도중에 실패해 반쯤 지운 폴더가 남으면 그 경로와 직접 지우라는 안내를 보인다. 지우면 다시 정리한다 (D140)',
    async () => {
      const s = await setup(scenario())
      const done = await drive(s.h.relay, s.h.ui, s.key)
      expect(done.status).toBe('completed')
      await settle(s.h, s.key)
      const stuck = path.join(s.tree, 'stuck', 'x.txt')
      fs.mkdirSync(path.dirname(stuck))
      fs.writeFileSync(stuck, '지울 수 없음\n')
      expect(immutable(stuck, true)).toBe(true)
      const hint = `반쯤 지운 worktree 폴더가 남아 있음: ${s.tree} (git은 이 폴더를 더 이상 worktree로 보지 않음). 폴더를 직접 지운 뒤 다시 누르세요`
      try {
        const first = await preview(s)
        const r = await s.h.relay.clean(s.key, {
          deleteBranch: false,
          deleteBackups: true,
          confirmed: true,
          expect: first.expect,
        })
        expect(r.ok).toBe(false)
        expect(!r.ok && r.error).toMatch(/^정리 실패: /)
        expect(!r.ok && r.error).toContain(hint)
        await settle(s.h, s.key)
        expect(work(s).status).toBe('completed')
        expect(await s.h.relay.cleanPreview(s.key)).toEqual({
          ok: false,
          error: `정리 요약을 만들지 못함: ${hint}`,
        })
      } finally {
        immutable(stuck, false)
      }
      fs.rmSync(s.tree, { recursive: true, force: true })
      const again = await preview(s)
      expect(again.worktree).toBe(false)
      expect(
        await s.h.relay.clean(s.key, {
          deleteBranch: false,
          deleteBackups: true,
          confirmed: false,
          expect: again.expect,
        }),
      ).toEqual({ ok: true })
      await settle(s.h, s.key)
      expect(work(s).status).toBe('archived')
    },
  )

  it('다시 켜도 보관된 Work는 보관됨이고 읽기 전용 화면이 열린다 (시나리오 8, 9)', async () => {
    const s = await setup(scenario())
    const done = await drive(s.h.relay, s.h.ui, s.key)
    expect(done.status).toBe('completed')
    const summary = await preview(s)
    expect(summary.branch).toMatchObject({ pushed: false, merged: false, deletable: false })
    expect(
      await s.h.relay.clean(s.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: false,
        expect: summary.expect,
      }),
    ).toEqual({ ok: true })
    await s.h.relay.close()
    await s.h.reopen()
    const view = s.h.ui.works.get(s.key) ?? s.h.relay.snapshot().works.find((w) => w.key === s.key)
    expect(view?.status).toBe('archived')
    const verify = await s.h.relay.review(s.key, 't-03')
    expect(verify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
    expect(work(s).status).toBe('archived')
  })

  it('보관된 Work를 아카이브로 옮기면 다시 켜도 아카이브에 있고 기록을 읽을 수 있다', async () => {
    const s = await setup(scenario())
    const done = await drive(s.h.relay, s.h.ui, s.key)
    expect(done.status).toBe('completed')
    const summary = await preview(s)
    expect(
      await s.h.relay.clean(s.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: false,
        expect: summary.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(s.h.ui.works.get(s.key)).toMatchObject({ shelved: false, canShelve: true })
    expect(await s.h.relay.shelve(s.key)).toEqual({ ok: true })
    expect(s.h.ui.works.get(s.key)).toMatchObject({ shelved: true, canShelve: false })
    expect(work(s)).toMatchObject({ status: 'archived', shelved_at: expect.any(String) })
    await s.h.relay.close()
    await s.h.reopen()
    const view = s.h.ui.works.get(s.key) ?? s.h.relay.snapshot().works.find((w) => w.key === s.key)
    expect(view).toMatchObject({ status: 'archived', shelved: true })
    const verify = await s.h.relay.review(s.key, 't-03')
    expect(verify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
  })
})

describe('[흐름] Work 기록 지우기와 프로젝트 등록 해제 (D407~D409)', () => {
  /** Work 없이 등록한 프로젝트 */
  async function project(): Promise<{ h: Harness; repo: string; projectId: string; dir: string }> {
    h = await harness({ scenario: scenario() })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    return { h, repo, projectId, dir: path.join(h.home, 'projects', projectId) }
  }

  /** 처음 정리 요약으로 만든 정리 확인 */
  async function cleanInput(s: Setup) {
    const summary = await preview(s)
    return { deleteBranch: false, deleteBackups: true, confirmed: false, expect: summary.expect }
  }

  it('완료한 Work는 정리 확인과 함께 지운다: worktree와 기록이 없고 작업 브랜치는 남으며, 다시 켜도 없다', async () => {
    const s = await setup(scenario())
    const done = await drive(s.h.relay, s.h.ui, s.key)
    expect(done.status).toBe('completed')
    expect(s.h.ui.works.get(s.key)).toMatchObject({ canDelete: true, canShelve: false })
    // 정리하지 않은 Work는 정리 확인 없이 지우지 않는다
    const refused = await s.h.relay.deleteWork(s.key, null)
    expect(refused.ok).toBe(false)
    expect(fs.existsSync(s.dir)).toBe(true)
    expect(await s.h.relay.deleteWork(s.key, await cleanInput(s))).toEqual({ ok: true })
    expect(fs.existsSync(s.tree)).toBe(false)
    expect(fs.existsSync(s.dir)).toBe(false)
    expect(git(s.repo, 'branch', '--list', s.branch).trim()).not.toBe('')
    expect(s.h.ui.removed).toEqual([s.key])
    expect(s.h.ui.works.has(s.key)).toBe(false)
    expect(s.h.relay.snapshot().works).toEqual([])
    expect((await s.h.relay.deleteWork(s.key, null)).ok).toBe(false)
    await s.h.relay.close()
    await s.h.reopen()
    expect(s.h.relay.snapshot().works).toEqual([])
  })

  it('보관된 Work는 확인만으로 지운다', async () => {
    const s = await setup(scenario())
    await drive(s.h.relay, s.h.ui, s.key)
    expect(await s.h.relay.clean(s.key, await cleanInput(s))).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(s.h.ui.works.get(s.key)).toMatchObject({ status: 'archived', canDelete: true })
    expect(await s.h.relay.deleteWork(s.key, null)).toEqual({ ok: true })
    expect(fs.existsSync(s.dir)).toBe(false)
    expect(s.h.ui.removed).toEqual([s.key])
  })

  it.runIf(canLock)(
    '기록을 지우다 실패하면 work.json을 다시 써 Work를 남기고 까닭을 돌려준다. 원인을 치우면 다시 지운다',
    async () => {
      const s = await setup(scenario())
      await drive(s.h.relay, s.h.ui, s.key)
      expect(await s.h.relay.clean(s.key, await cleanInput(s))).toEqual({ ok: true })
      await settle(s.h, s.key)
      const stuck = path.join(s.dir, 'stuck', 'x.txt')
      fs.mkdirSync(path.dirname(stuck))
      fs.writeFileSync(stuck, '지울 수 없음\n')
      expect(immutable(stuck, true)).toBe(true)
      try {
        const r = await s.h.relay.deleteWork(s.key, null)
        expect(r.ok).toBe(false)
        expect(!r.ok && r.error).toMatch(/^Work 기록을 지우지 못함: /)
        expect(work(s).status).toBe('archived')
        expect(s.h.ui.removed).toEqual([])
        expect(s.h.ui.works.get(s.key)?.status).toBe('archived')
      } finally {
        immutable(stuck, false)
      }
      expect(await s.h.relay.deleteWork(s.key, null)).toEqual({ ok: true })
      expect(fs.existsSync(s.dir)).toBe(false)
    },
  )

  it('프로젝트는 Work가 모두 보관됐을 때만 해제하고 기록을 함께 지운다. 레포는 그대로이고 다시 등록하면 Work가 없다', async () => {
    const s = await setup(scenario())
    const projectId = s.key.split('/')[0] ?? ''
    const projectDir = path.join(s.h.home, 'projects', projectId)
    await drive(s.h.relay, s.h.ui, s.key)
    const preview = await s.h.relay.projectRemovePreview(projectId)
    expect(preview.ok && preview.preview.block).toContain(s.workId)
    const blocked = await s.h.relay.removeProject(projectId)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error).toContain(s.workId)
    expect(fs.existsSync(path.join(projectDir, 'project.json'))).toBe(true)
    expect(await s.h.relay.clean(s.key, await cleanInput(s))).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(await s.h.relay.shelve(s.key)).toEqual({ ok: true })
    expect(await s.h.relay.projectRemovePreview(projectId)).toEqual({
      ok: true,
      preview: { block: null, works: 1, shelved: 1 },
    })
    expect(await s.h.relay.removeProject(projectId)).toEqual({ ok: true })
    expect(fs.existsSync(projectDir)).toBe(false)
    expect(s.h.ui.projectList).toEqual([])
    expect(s.h.ui.removed).toEqual([s.key])
    expect(s.h.relay.snapshot()).toMatchObject({ projects: [], works: [] })
    expect(git(s.repo, 'branch', '--list', s.branch).trim()).not.toBe('')
    expect(fs.existsSync(path.join(s.repo, '.git'))).toBe(true)
    // 지운 프로젝트에는 Work를 만들지 않는다
    const r = await s.h.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    expect(r.ok).toBe(false)
    await s.h.relay.close()
    await s.h.reopen()
    expect(s.h.relay.snapshot()).toMatchObject({ projects: [], works: [] })
    expect(await register(s.h, s.repo)).toBe(projectId)
    expect(s.h.relay.snapshot().works).toEqual([])
  })

  it('앱이 읽지 못한 Work 기록이나 남은 worktree 폴더가 있으면 해제하지 않는다 (D409)', async () => {
    const p = await project()
    const unread = path.join(p.dir, 'works', 'w-20261017-099')
    fs.mkdirSync(unread, { recursive: true })
    fs.writeFileSync(path.join(unread, 'work.json'), '{ 깨진 기록')
    const r1 = await p.h.relay.removeProject(p.projectId)
    expect(!r1.ok && r1.error).toContain('읽지 못한 Work 기록이 있음 (w-20261017-099)')
    expect(fs.existsSync(path.join(unread, 'work.json'))).toBe(true)
    fs.rmSync(unread, { recursive: true })
    const tree = path.join(p.dir, 'worktrees', 'w-20261017-098')
    fs.mkdirSync(tree, { recursive: true })
    const preview = await p.h.relay.projectRemovePreview(p.projectId)
    expect(preview.ok && preview.preview.block).toContain(
      'worktree 폴더가 남아 있음: w-20261017-098',
    )
    expect((await p.h.relay.removeProject(p.projectId)).ok).toBe(false)
    expect(fs.existsSync(tree)).toBe(true)
    fs.rmSync(tree, { recursive: true })
    expect(await p.h.relay.removeProject(p.projectId)).toEqual({ ok: true })
    expect(fs.existsSync(p.dir)).toBe(false)
  })

  it('하던 [기록 지우기]와 겹친 등록 해제는 그 지우기를 기다린 뒤 해제한다', async () => {
    const s = await setup(scenario())
    const projectId = s.key.split('/')[0] ?? ''
    await drive(s.h.relay, s.h.ui, s.key)
    expect(await s.h.relay.clean(s.key, await cleanInput(s))).toEqual({ ok: true })
    await settle(s.h, s.key)
    const deleting = s.h.relay.deleteWork(s.key, null)
    expect(await s.h.relay.deleteWork(s.key, null)).toEqual({
      ok: false,
      error: '이 Work를 지우는 중입니다',
    })
    const [deleted, removed] = await Promise.all([deleting, s.h.relay.removeProject(projectId)])
    expect(deleted).toEqual({ ok: true })
    expect(removed).toEqual({ ok: true })
    expect(s.h.ui.removed).toEqual([s.key])
    expect(fs.existsSync(path.join(s.h.home, 'projects', projectId))).toBe(false)
  })

  it('Work를 만드는 중에는 등록 해제하지 않는다', async () => {
    const p = await project()
    const creating = p.h.relay.createWork(p.projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    const removed = await p.h.relay.removeProject(p.projectId)
    expect(removed).toEqual({ ok: false, error: '다른 Work를 만드는 중입니다' })
    const created = await creating
    expect(created.ok).toBe(true)
    expect(fs.existsSync(path.join(p.dir, 'project.json'))).toBe(true)
    expect(p.h.ui.projectList).toHaveLength(1)
  })

  it.runIf(canLock)(
    'project.json을 지우지 못하면 등록된 채 두고, 그 뒤 폴더를 다 지우지 못하면 해제는 하고 직접 지우라고 알린다',
    async () => {
      const p = await project()
      const json = path.join(p.dir, 'project.json')
      expect(immutable(json, true)).toBe(true)
      try {
        const r = await p.h.relay.removeProject(p.projectId)
        expect(!r.ok && r.error).toMatch(/^project.json을 지우지 못함: /)
        expect(p.h.ui.projectList).toHaveLength(1)
      } finally {
        immutable(json, false)
      }
      const stuck = path.join(p.dir, 'stuck', 'x.txt')
      fs.mkdirSync(path.dirname(stuck))
      fs.writeFileSync(stuck, '지울 수 없음\n')
      expect(immutable(stuck, true)).toBe(true)
      try {
        const r = await p.h.relay.removeProject(p.projectId)
        expect(!r.ok && r.error).toMatch(/^등록은 해제했지만 프로젝트 폴더를 다 지우지 못함: /)
        expect(p.h.ui.projectList).toEqual([])
        expect(fs.existsSync(json)).toBe(false)
      } finally {
        immutable(stuck, false)
      }
    },
  )
})
