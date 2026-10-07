// [어댑터] 프로젝트 등록 점검(D67), worktree와 기준 커밋(D97), 원격 기준 위치와 fetch 실패 (시나리오 0, 1).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { sha256, pathKey } from '../../src/adapters/store'
import type { CheckId, ProjectInspection } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import {
  addSubmodule,
  git,
  harness,
  makeRepo,
  register,
  settle,
  type Harness,
} from '../support/harness'
import { REPO_FILES } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

function checks(i: ProjectInspection): Record<CheckId, [boolean, boolean]> {
  return Object.fromEntries(i.checks.map((c) => [c.id, [c.ok, c.blocking]])) as Record<
    CheckId,
    [boolean, boolean]
  >
}

/** intake에서 멈춰 기다리는 가짜 claude */
const WAIT = { tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }

describe('[어댑터] 프로젝트 등록 점검 (시나리오 0, D67)', () => {
  it('레포 루트, claude 로그인, 중복은 막고 origin과 gh는 경고만 한다', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)

    const ok = await h.relay.inspectProject(repo)
    expect(checks(ok)).toEqual({
      git_root: [true, true],
      claude: [true, true],
      duplicate: [true, true],
      origin: [true, false],
      gh: [true, false],
    })
    expect(ok).toMatchObject({ canRegister: true, name: 'sample', defaultBranch: 'main' })

    // 레포가 아닌 폴더와 레포의 하위 폴더
    const plain = path.join(h.root, 'plain')
    fs.mkdirSync(plain)
    expect(checks(await h.relay.inspectProject(plain)).git_root).toEqual([false, true])
    const sub = await h.relay.inspectProject(path.join(repo, 'src'))
    expect(sub.canRegister).toBe(false)
    expect(sub.checks[0]?.detail).toContain('레포 루트')

    // 등록하면 같은 경로는 다시 등록할 수 없다
    const projectId = await register(h, repo)
    const again = await h.relay.inspectProject(repo)
    expect(checks(again).duplicate).toEqual([false, true])
    expect(again.canRegister).toBe(false)
    expect((await h.relay.registerProject(repo, 'main')).ok).toBe(false)

    // project.json (5.1): project-id는 폴더 이름과 레포 절대 경로 해시 앞 6자다
    const project = JSON.parse(
      fs.readFileSync(path.join(h.home, 'projects', projectId, 'project.json'), 'utf8'),
    ) as Record<string, unknown>
    expect(projectId).toBe(`sample-${sha256(pathKey(repo)).slice(0, 6)}`)
    expect(project).toMatchObject({
      schema_version: 1,
      project_id: projectId,
      default_branch: 'main',
      checks: { origin: true, gh: true },
    })
    expect(pathKey(String(project['repo_path']))).toBe(pathKey(repo))
  })

  it('claude auth status가 실패하면 막는다', async () => {
    h = await harness({ scenario: WAIT, env: { FAKE_CLAUDE_AUTH: 'fail' } })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const i = await h.relay.inspectProject(repo)
    expect(checks(i).claude).toEqual([false, true])
    expect(i.canRegister).toBe(false)
    const r = await h.relay.registerProject(repo, 'main')
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('claude auth status') })
  })

  it('claude 실행 파일이 없으면 막는다 (D106)', async () => {
    h = await harness({ scenario: WAIT, claudeBin: path.join('없는 폴더', 'claude.exe') })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const i = await h.relay.inspectProject(repo)
    expect(checks(i).claude).toEqual([false, true])
  })

  it('서브모듈이 있으면 relay가 다루지 않는 것을 경고만 하고 등록한다 (D382)', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    addSubmodule(repo, path.join(h.root, 'lib-src'), 'lib', { 'lib.txt': 'lib\n' })
    const i = await h.relay.inspectProject(repo)
    expect(checks(i).submodules).toEqual([false, false])
    expect(i.checks.find((c) => c.id === 'submodules')?.detail).toContain('서브모듈 안의 변경')
    expect(i.canRegister).toBe(true)
  })

  it('origin이 없거나 gh가 로그인되지 않았으면 경고만 하고 등록한다', async () => {
    h = await harness({ scenario: WAIT, env: { FAKE_GH_AUTH: 'fail' } })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    git(repo, 'remote', 'remove', 'origin')
    const i = await h.relay.inspectProject(repo)
    expect(checks(i)).toMatchObject({ origin: [false, false], gh: [false, false] })
    expect(i.canRegister).toBe(true)
    const projectId = await register(h, repo)
    expect(h.relay.snapshot().projects).toEqual([
      expect.objectContaining({ id: projectId, origin: false, gh: false }),
    ])
  })

  it('gh 로그인은 origin의 호스트에서만 본다: 다른 호스트의 로그인 실패는 상관없다 (D67)', async () => {
    const t = await harness({
      scenario: WAIT,
      env: { FAKE_GH_AUTH_HOSTS: 'github.com,ghe.corp.test', FAKE_GH_AUTH_BROKEN: 'github.com' },
    })
    h = t
    const { repo } = makeRepo(t.root, 'sample', REPO_FILES)
    const gh = async () => (await t.relay.inspectProject(repo)).checks.find((c) => c.id === 'gh')
    // origin이 GitHub 레포 주소가 아니면(로컬 경로) 모든 호스트를 보므로 github.com 때문에 실패한다
    expect((await gh())?.ok).toBe(false)
    // 사내 GitHub Enterprise 레포
    git(repo, 'remote', 'set-url', 'origin', 'https://ghe.corp.test/team/sample.git')
    expect(await gh()).toMatchObject({ ok: true, detail: expect.stringContaining('ghe.corp.test') })
    t.env['FAKE_GH_AUTH_BROKEN'] = 'ghe.corp.test'
    expect(await gh()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('ghe.corp.test: '),
    })
    // 로그인하지 않은 호스트의 레포: 다른 호스트에 로그인했어도 PR을 만들 수 없다
    t.env['FAKE_GH_AUTH_BROKEN'] = ''
    git(repo, 'remote', 'set-url', 'origin', 'https://ghe.other.test/team/sample.git')
    expect(await gh()).toMatchObject({
      ok: false,
      detail: expect.stringContaining('ghe.other.test: '),
    })
  })

  it('gh 로그인은 gh가 쓰는 호스트 이름(ssh.github.com은 github.com)과 활성 계정으로 본다 (D67)', async () => {
    const t = await harness({ scenario: WAIT, env: { FAKE_GH_AUTH_INACTIVE_BROKEN: 'github.com' } })
    h = t
    const { repo } = makeRepo(t.root, 'sample', REPO_FILES)
    const gh = async () => (await t.relay.inspectProject(repo)).checks.find((c) => c.id === 'gh')
    // 방화벽 뒤에서 443으로 쓰는 SSH 주소. 같은 호스트의 쓰지 않는 계정이 만료되어도 PR은 활성 계정으로 만든다
    git(repo, 'remote', 'set-url', 'origin', 'ssh://git@ssh.github.com:443/o/sample.git')
    expect(await gh()).toMatchObject({ ok: true, detail: expect.stringContaining('github.com, ') })
    // --active가 없는 gh(2.57.0 아래)는 모든 계정을 본다
    t.env['FAKE_GH_VERSION'] = '2.56.0'
    expect((await gh())?.ok).toBe(false)
  })

  it('기본 브랜치는 origin/HEAD, 없으면 현재 브랜치다 (시나리오 0-3)', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    git(repo, 'checkout', '-q', '-b', 'dev')
    expect((await h.relay.inspectProject(repo)).defaultBranch).toBe('dev')
    git(repo, 'remote', 'set-head', 'origin', 'main')
    expect((await h.relay.inspectProject(repo)).defaultBranch).toBe('main')
    // 사람이 고칠 수 있다. 없는 브랜치는 받지 않는다
    expect((await h.relay.registerProject(repo, 'nope')).ok).toBe(false)
    const projectId = await register(h, repo, 'dev')
    expect(await h.relay.branches(projectId)).toEqual(['dev', 'main'])
  })

  it('폴더 이름의 권한 규칙 패턴 문자는 project-id에서 _로 바꾼다 (D111)', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, '[x] repo', REPO_FILES)
    const projectId = await register(h, repo)
    expect(projectId).toMatch(/^_x_ repo-[0-9a-f]{6}$/)
    const workKey = await create(h, projectId, 'local')
    const settings = JSON.parse(
      fs.readFileSync(
        path.join(workDirOf(h, workKey), 'tasks/01-intake/task.settings.json'),
        'utf8',
      ),
    ) as { permissions: { deny: string[] } }
    const pathRules = settings.permissions.deny.filter((r) => r.startsWith('Edit('))
    expect(pathRules.length).toBeGreaterThan(0)
    for (const rule of pathRules) {
      expect(rule).toContain(`/projects/${projectId}/works/`)
      // 경로 부분(규칙 끝의 ** 빼고)에 패턴 문자가 없다
      expect(rule.replace(/\/\*\*\)$/, ')')).not.toMatch(/[[\]*?]/)
    }
  })
})

async function create(h: Harness, projectId: string, baseLocation: 'local' | 'remote') {
  const r = await h.relay.createWork(projectId, {
    request: '요청\n',
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation,
  })
  if (!r.ok || !r.workKey) throw new Error(`Work 생성 실패: ${JSON.stringify(r)}`)
  await settle(h, r.workKey)
  return r.workKey
}

function workDirOf(h: Harness, workKey: string): string {
  const [projectId = '', workId = ''] = workKey.split('/')
  return path.join(h.home, 'projects', projectId, 'works', workId)
}

function worktreeOf(h: Harness, workKey: string): string {
  const [projectId = '', workId = ''] = workKey.split('/')
  return path.join(h.home, 'projects', projectId, 'worktrees', workId)
}

describe('[어댑터] Work 생성: worktree와 기준 커밋 (시나리오 1, D97)', () => {
  it('로컬 기준: relay/<work-id> 브랜치의 worktree를 기준 브랜치에서 만들고 기준 커밋을 적는다', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const base = git(repo, 'rev-parse', 'main')
    const workKey = await create(h, projectId, 'local')
    const [, workId] = workKey.split('/')
    expect(workId).toMatch(/^w-\d{8}-001$/)
    const tree = worktreeOf(h, workKey)
    expect(git(tree, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(`relay/${workId}`)
    expect(git(tree, 'rev-parse', 'HEAD')).toBe(base)
    expect(git(repo, 'config', '--get', 'core.longpaths')).toBe('true')
    const work = JSON.parse(
      fs.readFileSync(path.join(workDirOf(h, workKey), 'work.json'), 'utf8'),
    ) as WorkState
    expect(work).toMatchObject({ base_branch: 'main', base_commit: base })
    expect(fs.readFileSync(path.join(workDirOf(h, workKey), 'request.md'), 'utf8')).toBe('요청\n')
    // 여러 Work를 나란히 만든다 (D18). work-id의 순번이 오르고 worktree가 따로 있다
    const second = await create(h, projectId, 'local')
    expect(second.split('/')[1]).toMatch(/^w-\d{8}-002$/)
    expect(git(worktreeOf(h, second), 'rev-parse', '--abbrev-ref', 'HEAD')).toBe(
      `relay/${second.split('/')[1] ?? ''}`,
    )
  })

  it('원격 기준: fetch한 origin/<브랜치>에서 분기한다', async () => {
    h = await harness({ scenario: WAIT })
    const { repo, remote } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    // 다른 클론이 원격에 커밋을 더한다. 로컬 main은 뒤처진다
    const other = path.join(h.root, 'other')
    git(h.root, 'clone', '-q', remote, other)
    git(other, 'config', 'user.email', 'o@example.com')
    git(other, 'config', 'user.name', 'o')
    fs.writeFileSync(path.join(other, 'NEW.md'), '새 커밋\n')
    git(other, 'add', '-A')
    git(other, 'commit', '-q', '-m', 'remote change')
    git(other, 'push', '-q', 'origin', 'main')
    const remoteHead = git(other, 'rev-parse', 'HEAD')
    expect(git(repo, 'rev-parse', 'main')).not.toBe(remoteHead)

    const workKey = await create(h, projectId, 'remote')
    expect(git(worktreeOf(h, workKey), 'rev-parse', 'HEAD')).toBe(remoteHead)
    const work = JSON.parse(
      fs.readFileSync(path.join(workDirOf(h, workKey), 'work.json'), 'utf8'),
    ) as WorkState
    expect(work).toMatchObject({ base_branch: 'main', base_commit: remoteHead })
  })

  it('원격 기준에서 fetch가 실패하면 오류를 보이고 Work를 만들지 않는다', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    git(repo, 'remote', 'set-url', 'origin', path.join(h.root, '없는 원격.git'))
    const r = await h.relay.createWork(projectId, {
      request: '요청',
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'remote',
    })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('git fetch') })
    expect(fs.existsSync(path.join(h.home, 'projects', projectId, 'works'))).toBe(false)
    expect(fs.existsSync(path.join(h.home, 'projects', projectId, 'worktrees'))).toBe(false)
    expect(git(repo, 'branch', '--list', 'relay/*')).toBe('')
    expect(h.relay.snapshot().works).toEqual([])
  })

  it('없는 기준 브랜치는 받지 않는다', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const r = await h.relay.createWork(projectId, {
      request: '요청',
      baseBranch: 'nope',
      type: 'bugfix',
      baseLocation: 'local',
    })
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('nope') })
  })

  it('work-id는 그날 쓰인 번호(relay/ 브랜치 포함)를 건너뛴다', async () => {
    h = await harness({ scenario: WAIT })
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const today = new Date()
    const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    git(repo, 'branch', `relay/w-${ymd}-001`)
    const workKey = await create(h, projectId, 'local')
    expect(workKey.split('/')[1]).toBe(`w-${ymd}-002`)
  })
})
