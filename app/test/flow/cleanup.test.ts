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
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  FIXED_FILES,
  REPO_FILES,
  REQUEST,
  handoff,
  scenario,
  steps,
  type Scenario,
} from '../support/scenarios'

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
  it('정리 뒤 worktree는 없고 산출물은 남는다. 되감기 백업 브랜치는 함께 지우고 작업 브랜치는 둔다 (8-2, D16)', async () => {
    // verify(t-03)가 fix를 추천해 멈추면 fix로 되감는다(백업 브랜치). 그 뒤 fix(t-04) → verify(t-05)를 지나
    // [push]로 완료한다
    const recommending = steps('verify').map((st) =>
      st.do === 'write' && st.file === 'handoff.md'
        ? { ...st, text: handoff({ recommended_next: { node: 'fix', reason: '완료조건 2 실패' } }) }
        : st,
    )
    const s = await setup({ tasks: { ...scenario().tasks, 't-03': recommending } })
    const stopped = await drive(s.h.relay, s.h.ui, s.key)
    expect(stopped, s.h.ui.dump()).toMatchObject({ status: 'stopped' })
    const p = await s.h.relay.stepPreview(s.key, 'fix', false)
    if (!p.ok) throw new Error(p.error)
    const backup = p.preview.code.backupBranch ?? ''
    expect(backup).toBe(`${s.branch}-discarded-1`)
    expect(
      await s.h.relay.selectStep(s.key, {
        node: 'fix',
        keepCode: false,
        instruction: '',
        expect: p.preview.expect,
      }),
    ).toEqual({ ok: true })
    const paused = await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.h, s.key)
    const head = git(s.tree, 'rev-parse', 'HEAD')
    const before = listFiles(s.dir)
    const oldFix = (await s.h.relay.review(s.key, 't-02'))?.diff

    // 확인 요약 (8-1): push됐으니 작업 브랜치 삭제를 제안한다. 백업 브랜치가 있다
    const summary = await preview(s)
    expect(summary).toEqual({
      worktree: true,
      uncommitted: [],
      locks: [],
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
      confirm: [],
      expect: { uncommitted: [], locks: [], live: 0, backups: [backup], remote: false, lost: [] },
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
    for (const f of ['request.md', 'intent.md', 'decisions.md', 'tasks/05-verify/pr.md']) {
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
    const verify = await s.h.relay.review(s.key, 't-05')
    expect(verify?.diff).toBe('')
    expect(verify?.completion?.mode).toBeNull()
    expect(verify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
    const fix = await s.h.relay.review(s.key, 't-04')
    expect(fix?.diff).toContain('+  if (xs.length === 0) return 0')
    expect(fix?.emphasis.map((e) => e.kind)).not.toContain('uncommitted')
    // 폐기된 fix는 백업 커밋을 가리킨다. 백업 브랜치를 지워도 git이 치우기 전에는 읽는다
    expect((await s.h.relay.review(s.key, 't-02'))?.diff).toBe(oldFix)
    expect((await s.h.relay.terminalAttach(`${s.key}/t-05`)).data).toContain('FAKE-CLAUDE READY')
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
    // 보관 전에는 옮기지 않는다
    expect(await s.h.relay.shelve(s.key)).toMatchObject({ ok: false })
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
    expect(s.h.ui.works.get(s.key)?.shelved).toBe(false)
    expect(await s.h.relay.shelve(s.key)).toEqual({ ok: true })
    expect(s.h.ui.works.get(s.key)?.shelved).toBe(true)
    expect(work(s)).toMatchObject({ status: 'archived', shelved_at: expect.any(String) })
    await s.h.relay.close()
    await s.h.reopen()
    const view = s.h.ui.works.get(s.key) ?? s.h.relay.snapshot().works.find((w) => w.key === s.key)
    expect(view).toMatchObject({ status: 'archived', shelved: true })
    const verify = await s.h.relay.review(s.key, 't-03')
    expect(verify?.completion?.diff).toContain('+  if (xs.length === 0) return 0')
  })
})
