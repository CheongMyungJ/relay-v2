// [흐름] 서브모듈 Work (D413~D417). 메인 프로젝트의 서브모듈을 대상으로 고르면 앱이 받고 서브모듈 프로젝트를 만든다.
// Work는 메인 레포의 통합 검증 worktree 안 서브모듈 자리에서 일하고, 서브모듈 레포로만 전달한다. 에이전트의 git
// submodule update는 이 서브모듈을 건너뛰고, 막지 못한 것은 턴이 끝날 때 앱이 되돌린다. 정리는 서브모듈 worktree,
// 메인 worktree 차례로 지운다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import type { ProjectView } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import {
  addSubmodule,
  git,
  harness,
  makeRepo,
  register,
  settle,
  writeFiles,
  type Harness,
  workBranchOf,
} from '../support/harness'
import { REQUEST, scenario, steps, type Scenario } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 로컬 경로의 서브모듈을 받게 한다 (git 2.38.1부터 file 전송은 기본으로 막힘). 앱의 보호는 이 뒤에 붙는다 */
const FILE_ENV = {
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'protocol.file.allow',
  GIT_CONFIG_VALUE_0: 'always',
}

interface Setup {
  h: Harness
  /** 사용자의 메인 체크아웃 (서브모듈을 받지 않은 clone) */
  checkout: string
  mainId: string
  sub: ProjectView
  /** 서브모듈 레포 (서브모듈 Work의 origin) */
  libSource: string
  mainRemote: string
}

async function setup(s: Scenario): Promise<Setup> {
  h = await harness({ scenario: s, env: FILE_ENV })
  const hh = h
  const { repo, remote } = makeRepo(hh.root, 'app', { 'README.md': '# app\n' })
  const libSource = path.join(hh.root, 'lib-src')
  addSubmodule(repo, libSource, 'lib', { 'lib.txt': 'lib\n' })
  addSubmodule(repo, path.join(hh.root, 'vendor-src'), 'vendor', { 'v.txt': 'v\n' })
  git(repo, 'push', '-q', 'origin', 'main')
  const checkout = path.join(hh.root, 'checkout')
  git(hh.root, 'clone', '-q', remote, checkout)
  const mainId = await register(hh, checkout)

  // 대상 목록: 아직 받지 않았고 서브모듈 프로젝트도 없다 (D413)
  expect(await hh.relay.submodules(mainId)).toEqual([
    { name: 'lib', path: 'lib', initialized: false, projectId: null },
    { name: 'vendor', path: 'vendor', initialized: false, projectId: null },
  ])
  const r = await hh.relay.prepareSubmodule(mainId, 'lib')
  if (!r.ok || !r.project) throw new Error(`서브모듈 준비 실패: ${r.ok ? '' : r.error}`)
  // 고르면 메인 체크아웃에 받는다
  expect(fs.existsSync(path.join(checkout, 'lib', 'lib.txt'))).toBe(true)
  // 가짜 claude가 서브모듈 레포에 커밋할 수 있게 사용자 설정을 둔다(CI에는 전역 설정이 없다, support/repo.ts와 같음)
  const lib = path.join(checkout, 'lib')
  git(lib, 'config', 'user.email', 'relay-test@example.com')
  git(lib, 'config', 'user.name', 'relay test')
  git(lib, 'config', 'commit.gpgsign', 'false')
  const off = await hh.relay.updateProjectSettings(r.project.id, {
    allowed_bots: [],
    merge_method: null,
    issue_log: false,
  })
  if (!off.ok) throw new Error(off.error)
  return { h: hh, checkout, mainId, sub: r.project, libSource, mainRemote: remote }
}

async function create(s: Setup, integration = true) {
  const r = await s.h.relay.createWork(s.sub.id, {
    request: REQUEST,
    type: 'bugfix',
    baseBranch: 'main',
    baseLocation: 'remote',
    ...(integration
      ? { integration: { baseBranch: 'main', baseLocation: 'remote' as const } }
      : {}),
  })
  if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
  const workId = r.workKey.split('/')[1] ?? ''
  const root = path.join(s.h.home, 'projects', s.sub.id, 'worktrees', workId)
  return {
    key: r.workKey,
    workId,
    branch: workBranchOf(workId),
    dir: path.join(s.h.home, 'projects', s.sub.id, 'works', workId),
    root,
    tree: integration ? path.join(root, 'lib') : root,
  }
}

type Created = Awaited<ReturnType<typeof create>>

const work = (w: Created) => JSON.parse(read(path.join(w.dir, 'work.json'))) as WorkState

async function toVerify(s: Setup, w: Created): Promise<void> {
  const r = await drive(s.h.relay, s.h.ui, w.key, {
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused' })
  await settle(s.h, w.key)
}

/** fix가 고친 것을 커밋한 뒤 메인 worktree에서 git submodule update를 한다 */
function fixWith(args: string[]): Scenario {
  const fix = steps('fix')
  const at = fix.findIndex((st) => st.do === 'commit') + 1
  return scenario({ fix: [...fix.slice(0, at), { do: 'git', args }, ...fix.slice(at)] })
}

describe('[흐름] 서브모듈 Work (D413~D417)', () => {
  it('통합 검증 worktree 안에서 일하고 서브모듈 레포로만 push한다. 정리는 둘 다 지우고 사용자 체크아웃은 그대로다', async () => {
    const s = await setup(fixWith(['-C', '..', 'submodule', 'update', '--init', '--recursive']))
    expect(s.sub).toMatchObject({ name: 'lib', parent: { id: s.mainId, path: 'lib' } })
    expect(s.sub.defaultBranch).toBe('main')
    expect((await s.h.relay.submodules(s.mainId))[0]).toMatchObject({
      initialized: true,
      projectId: s.sub.id,
    })
    // 같은 서브모듈을 다시 고르면 같은 프로젝트다
    const again = await s.h.relay.prepareSubmodule(s.mainId, 'lib')
    expect(again.ok && again.project?.id).toBe(s.sub.id)

    const w = await create(s)
    const mainHead = git(s.checkout, 'rev-parse', 'HEAD')
    expect(work(w).integration).toEqual({ base_branch: 'main', base_commit: mainHead })
    expect(git(w.root, 'rev-parse', 'HEAD')).toBe(mainHead)
    expect(git(w.root, 'branch', '--show-current')).toBe('')
    expect(git(w.tree, 'branch', '--show-current')).toBe(w.branch)
    expect(s.h.ui.works.get(w.key)?.integration).toMatchObject({ root: w.root, baseBranch: 'main' })

    await toVerify(s, w)
    // 에이전트는 서브모듈 worktree에서 시작하고 메인 worktree도 함께 쓴다 (D414)
    const start = s.h.records().find((r) => r['type'] === 'start' && r['taskId'] === 't-02')
    expect(start?.['cwd']).toBe(w.tree)
    expect(start?.['args']).toEqual(expect.arrayContaining(['--add-dir', w.root]))
    const fix = work(w).tasks[1]
    if (!fix) throw new Error('fix task가 없음')
    const ctx = read(path.join(w.dir, 'tasks', taskDirName(fix), 'context.md'))
    expect(ctx).toContain('## 서브모듈 Work')
    expect(ctx).toContain(`메인 레포의 통합 검증 worktree: \`${w.root}\``)
    // 보호한 git submodule update: 다른 서브모듈은 받고 이 서브모듈과 사용자 체크아웃은 그대로다 (D415)
    expect(fs.existsSync(path.join(w.root, 'vendor', 'v.txt'))).toBe(true)
    expect(git(w.tree, 'branch', '--show-current')).toBe(w.branch)
    expect(git(path.join(s.checkout, 'lib'), 'status', '--porcelain')).toBe('')

    // 메인 쪽 변경은 승인 화면에 알리고 전달하지 않는다
    writeFiles(w.root, { 'README.md': '메인 쪽 변경\n' })
    const shown = (await s.h.relay.review(w.key, 't-03'))?.emphasis ?? []
    expect(shown.map((e) => e.kind)).toEqual(['main_changes'])
    expect(shown[0]?.lines).toEqual([' M README.md'])

    const head = git(w.tree, 'rev-parse', 'HEAD')
    expect(await s.h.relay.deliver(w.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.h, w.key)
    expect(git(s.libSource, 'rev-parse', `refs/heads/${w.branch}`)).toBe(head)
    expect(git(s.mainRemote, 'branch', '--list', 'relay/*')).toBe('')
    expect(work(w).status).toBe('completed')

    // 정리 (D416): 메인 쪽 변경을 확인받고 서브모듈 worktree, 메인 worktree 차례로 지운다
    const p = await s.h.relay.cleanPreview(w.key)
    if (!p.ok) throw new Error(p.error)
    expect(p.preview.integration).toEqual({ root: w.root, changes: [' M README.md'] })
    expect(p.preview.confirm).toContain(
      '메인 통합 검증 worktree의 메인 쪽 변경 1개(전달 안 됨)를 백업 없이 지웁니다',
    )
    expect(
      await s.h.relay.clean(w.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: true,
        expect: p.preview.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, w.key)
    expect(work(w).status).toBe('archived')
    expect(fs.existsSync(w.root)).toBe(false)
    expect(git(s.checkout, 'worktree', 'list')).not.toContain(w.root)
    expect(git(path.join(s.checkout, 'lib'), 'worktree', 'list')).not.toContain(w.tree)
    expect(git(path.join(s.checkout, 'lib'), 'status', '--porcelain')).toBe('')
    expect(git(s.checkout, 'status', '--porcelain')).toBe('')

    // 서브모듈 프로젝트가 있으면 메인 프로젝트를 등록 해제하지 않는다 (D417)
    const blocked = await s.h.relay.removeProject(s.mainId)
    expect(!blocked.ok && blocked.error).toContain('서브모듈 프로젝트가 있음 (lib)')
    expect(await s.h.relay.removeProject(s.sub.id)).toEqual({ ok: true })
    expect(await s.h.relay.removeProject(s.mainId)).toEqual({ ok: true })
  })

  it('막지 못한 --checkout은 턴이 끝날 때 되돌리고, 작업 브랜치에서 벗어난 것과 함께 그 task의 승인 화면에 알린다 (D415)', async () => {
    const s = await setup(fixWith(['-C', '..', 'submodule', 'update', '--checkout', '--', 'lib']))
    const w = await create(s)
    const r = await drive(s.h.relay, s.h.ui, w.key, {
      pauseAt: (t) => t.node === 'fix' && t.status === 'awaiting_approval',
    })
    expect(r, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, w.key)
    // 사용자 체크아웃의 서브모듈은 다시 git이 된다. 서브모듈 worktree는 메인이 가리키는 커밋으로 분리됐다
    expect(git(path.join(s.checkout, 'lib'), 'status', '--porcelain')).toBe('')
    expect(git(w.tree, 'branch', '--show-current')).toBe('')
    const shown = (await s.h.relay.review(w.key, 't-02'))?.emphasis ?? []
    const guard = shown.find((e) => e.kind === 'submodule_guard')?.lines ?? []
    expect(guard).toHaveLength(2)
    expect(guard[0]).toContain(`작업 브랜치 ${w.branch}에 있지 않습니다 (지금: 분리된 HEAD)`)
    expect(guard[1]).toContain('core.worktree')
    expect(s.h.ui.works.get(w.key)?.problems.join('\n')).toContain('core.worktree가 바뀌어')
  })

  it('통합 검증을 끄면 서브모듈 레포만의 worktree다', async () => {
    const s = await setup(scenario())
    const w = await create(s, false)
    expect(work(w).integration).toBeUndefined()
    expect(git(w.tree, 'branch', '--show-current')).toBe(w.branch)
    // Windows의 git은 경로를 /로 쓴다
    expect(path.resolve(git(w.tree, 'rev-parse', '--show-toplevel'))).toBe(w.tree)
    expect(s.h.ui.works.get(w.key)?.integration).toBeNull()
    // 메인 프로젝트에서 통합 검증을 고르면 받지 않는다
    const r = await s.h.relay.createWork(s.mainId, {
      request: REQUEST,
      type: 'bugfix',
      baseBranch: 'main',
      baseLocation: 'local',
      integration: { baseBranch: 'main', baseLocation: 'local' },
    })
    expect(!r.ok && r.error).toBe('메인 통합 검증은 서브모듈 프로젝트에서만 고릅니다')
  })

  it('메인 기준 브랜치에 그 서브모듈 자리가 없으면 Work를 만들지 않는다 (D414)', async () => {
    const s = await setup(scenario())
    // 서브모듈을 더하기 전의 커밋
    git(s.checkout, 'branch', 'old', git(s.checkout, 'rev-list', '--max-parents=0', 'HEAD'))
    const r = await s.h.relay.createWork(s.sub.id, {
      request: REQUEST,
      type: 'bugfix',
      baseBranch: 'main',
      baseLocation: 'remote',
      integration: { baseBranch: 'old', baseLocation: 'local' },
    })
    expect(!r.ok && r.error).toBe(
      '메인 레포의 old에는 서브모듈 lib이 없습니다. 메인 기준 브랜치를 바꾸거나 통합 검증을 끄세요',
    )
    expect(fs.existsSync(path.join(s.h.home, 'projects', s.sub.id, 'worktrees'))).toBe(false)
    expect(git(s.checkout, 'worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(1)
  })
})
