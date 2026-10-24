// 프로젝트 등록 (시나리오 0). 레포를 점검하고(D67) project.json을 만든다.
// git 레포 루트, claude 로그인, 중복 등록은 실패하면 막고, origin과 gh(로그인과 버전, D198)는 경고만 한다.
// 서브모듈이 있으면 relay가 다루지 않는 것을 경고한다(D382).
import path from 'node:path'
import { agentRuntime } from '../adapters/agent'
import type { AgentEngine } from '../shared/agent'
import { ghAuthStatus, ghVersion } from '../adapters/gh'
import {
  branches,
  defaultBranch,
  initSubmodule,
  originHead,
  remoteUrl,
  repoRoot,
  submoduleBranch,
  submoduleList,
  submodulePaths,
} from '../adapters/git'
import { canonicalPath, pathKey, sha256 } from '../adapters/store'
import { remoteRepo } from '../core/delivery'
import { MIN_GH_VERSION, ghAuthActive, ghTooOld, ghVersionReason } from '../core/pr'
import { projectId } from '../core/records'
import { submoduleDefaultBranch } from '../core/submodule'
import type { ProjectState } from '../shared/project'
import type { CheckItem, ProjectInspection, RepoChoiceView } from '../shared/views'

export interface ProjectEnv {
  /** 앱 기본 엔진. 기존 호출자는 Claude다. */
  engine?: AgentEngine
  env: NodeJS.ProcessEnv
  /** gh 실행 파일. 기본은 PATH의 gh */
  ghBin: string
  /** 이미 등록한 프로젝트 */
  registered: readonly ProjectState[]
}

const folderName = (p: string) => path.basename(p) || p

/** 등록 점검 표 (시나리오 0-2, D67, D106). 기본 브랜치 제안도 함께 돌려준다 (시나리오 0-3) */
export async function inspectProject(dir: string, o: ProjectEnv): Promise<ProjectInspection> {
  return (await inspect(dir, o)).view
}

/** gh의 점검 (D67, D198): gh auth status와 gh --version. project.json에는 둘을 따로 적는다 */
export interface GhCheck {
  auth: boolean
  version: string | null
}

/**
 * gh 점검 표의 줄 (시나리오 0-2, D198). 로그인되어 있고 최소 버전 이상이어야 통과다. 로그인은 PR을 만들 레포의
 * 호스트(origin 주소, D67)의 활성 계정만 본다. origin이 없거나 GitHub 레포 주소로 읽을 수 없으면 모든 호스트를 본다
 */
export async function checkGh(
  bin: string,
  env: NodeJS.ProcessEnv,
  origin: string | null,
): Promise<{ check: GhCheck; item: CheckItem }> {
  // PR 생성(ghRepo)과 같은 규칙으로 읽은 호스트다
  const host = origin ? (remoteRepo(origin)?.host ?? null) : null
  const version = await ghVersion(bin, env)
  const auth = await ghAuthStatus(bin, env, { host, active: ghAuthActive(version) })
  const old = ghTooOld(version)
  const where = host ? `${host}, ` : ''
  const item: CheckItem = {
    id: 'gh',
    label: `origin 호스트에서 gh auth status가 성공하고 gh가 ${MIN_GH_VERSION} 이상인가`,
    ok: auth.ok && !old,
    blocking: false,
    detail: !auth.ok
      ? `${host ? `${host}: ` : ''}${auth.detail}. [PR 생성]을 쓸 수 없습니다`
      : old && version
        ? `${ghVersionReason(version)}. gh를 올리기 전에는 [PR 생성]을 쓸 수 없습니다`
        : `로그인됨 (${where}gh ${version ?? '버전 모름'})`,
  }
  return { check: { auth: auth.ok, version }, item }
}

async function inspect(
  dir: string,
  o: ProjectEnv,
): Promise<{ view: ProjectInspection; gh: GhCheck }> {
  const env = o.env
  const picked = canonicalPath(dir)
  const root = await repoRoot(picked, { env })
  const isRoot = root !== null && pathKey(root) === pathKey(picked)
  const checks: CheckItem[] = [
    {
      id: 'git_root',
      label: 'git 레포의 루트인가',
      ok: isRoot,
      blocking: true,
      detail: isRoot
        ? '레포 루트'
        : root
          ? `레포의 하위 폴더입니다. 레포 루트(${root})를 고르세요`
          : 'git 레포가 아닙니다',
    },
  ]

  const engine = o.engine ?? 'claude'
  try {
    const driver = agentRuntime(engine)
    const bin = driver.find(env)
    const auth = bin ? await driver.authStatus(bin, env) : null
    checks.push({
      id: engine,
      label:
        engine === 'claude'
          ? 'claude auth status가 성공하는가'
          : `${driver.label}에 로그인되어 있는가`,
      ok: auth?.ok === true,
      blocking: true,
      detail: !bin
        ? driver.installGuide
        : auth?.ok
          ? `로그인됨 (${bin})`
          : `로그인되지 않음 (${bin}): ${auth?.detail ?? ''}. 터미널에서 ${engine}를 실행해 로그인하세요`,
    })
  } catch (e) {
    checks.push({
      id: engine,
      label: `${engine}를 실행할 수 있는가`,
      ok: false,
      blocking: true,
      detail: e instanceof Error ? e.message : String(e),
    })
  }

  const repo = root ?? picked
  const dup = o.registered.find((p) => pathKey(p.repo_path) === pathKey(repo))
  checks.push({
    id: 'duplicate',
    label: '같은 경로가 이미 등록되었나',
    ok: !dup,
    blocking: true,
    detail: dup ? `이미 등록됨 (${dup.project_id})` : '처음 등록',
  })

  const originUrl = root ? await remoteUrl(root, 'origin', { env }) : null
  const origin = originUrl !== null
  checks.push({
    id: 'origin',
    label: 'origin 원격이 있는가',
    ok: origin,
    blocking: false,
    detail: origin ? '있음' : '없음. [push]와 [PR 생성]을 쓸 수 없습니다',
  })

  const gh = await checkGh(o.ghBin, env, originUrl)
  checks.push(gh.item)

  // 서브모듈은 막지 않고 relay가 다루지 않는 것을 알린다. 서브모듈이 없으면 줄도 없다 (D382). context.md와 정리와
  // 같은 기준(.gitmodules에 있고 index에서 gitlink인 것)으로 본다 (D384)
  const submodules = root ? await submodulePaths(root, { env }).catch(() => []) : []
  if (submodules.length > 0) {
    checks.push({
      id: 'submodules',
      label: '서브모듈이 없는가',
      ok: false,
      blocking: false,
      detail:
        '서브모듈이 있습니다. 메인 레포의 Work는 worktree에 서브모듈을 받지 않고, 서브모듈 안의 변경을 커밋·전달·되감기하지 않습니다. [Work 정리]는 서브모듈 안의 작업도 함께 지웁니다. 서브모듈을 고치려면 새 Work의 대상에서 그 서브모듈을 고릅니다',
    })
  }

  return {
    view: {
      path: repo,
      name: folderName(repo),
      checks,
      defaultBranch: root ? await defaultBranch(root, { env }) : null,
      canRegister: checks.every((c) => c.ok || !c.blocking),
    },
    gh: gh.check,
  }
}

export type Registration = { ok: true; project: ProjectState } | { ok: false; error: string }

/** 점검을 다시 하고, 막는 항목이 없으면 project.json의 내용을 만든다 (시나리오 0-4) */
export async function prepareProject(
  dir: string,
  branch: string,
  at: string,
  o: ProjectEnv,
): Promise<Registration> {
  const { view: inspection, gh } = await inspect(dir, o)
  const failed = inspection.checks.find((c) => c.blocking && !c.ok)
  if (failed) return { ok: false, error: `${failed.label}: ${failed.detail}` }
  const name = branch.trim() || inspection.defaultBranch
  if (!name) return { ok: false, error: '기본 브랜치를 입력하세요' }
  const repo = inspection.path
  const { local, remote } = await branches(repo, { env: o.env })
  if (!local.includes(name) && !remote.includes(name)) {
    return { ok: false, error: `레포에 없는 브랜치입니다: ${name}` }
  }
  const check = (id: string) => inspection.checks.find((c) => c.id === id)?.ok === true
  return {
    ok: true,
    project: {
      schema_version: 1,
      project_id: projectId(folderName(repo), sha256(pathKey(repo))),
      repo_path: repo,
      default_branch: name,
      created_at: at,
      checks: { origin: check('origin'), gh: gh.auth, gh_version: gh.version, checked_at: at },
    },
  }
}

/**
 * 서브모듈 프로젝트를 만든다 (D413). 메인 프로젝트의 서브모듈 하나(`.gitmodules`에 있고 index에서 gitlink인 것)를
 * 대상으로 하고, 레포 경로는 메인 체크아웃의 그 서브모듈 폴더다. 메인 체크아웃에 받아 두지 않았으면 받는다. 등록 점검은
 * origin과 gh만 다시 한다(엔진 로그인은 메인과 같다). 기본 브랜치는 submoduleDefaultBranch로 고른다
 */
export async function prepareSubmoduleProject(
  main: ProjectState,
  subPath: string,
  at: string,
  o: ProjectEnv,
): Promise<Registration> {
  const env = o.env
  if (main.parent) return { ok: false, error: '서브모듈 안의 서브모듈은 대상으로 고를 수 없습니다' }
  const entry = (await submoduleList(main.repo_path, { env })).find((e) => e.path === subPath)
  if (!entry) return { ok: false, error: `서브모듈이 아닙니다: ${subPath}` }
  const repo = path.join(main.repo_path, ...subPath.split('/'))
  if (!entry.initialized) {
    try {
      await initSubmodule(main.repo_path, subPath, { env })
    } catch (e) {
      return {
        ok: false,
        error: `서브모듈 ${subPath}을 받지 못했습니다. 터미널에서 git submodule update --init -- ${subPath}로 받은 뒤 다시 고르세요. ${String(e)}`,
      }
    }
  }
  const root = await repoRoot(repo, { env })
  if (!root || pathKey(root) !== pathKey(repo)) {
    return { ok: false, error: `서브모듈 폴더를 git 레포로 읽지 못했습니다: ${repo}` }
  }
  const id = projectId(folderName(repo), sha256(pathKey(repo)))
  const dup = o.registered.find(
    (p) => p.project_id === id || pathKey(p.repo_path) === pathKey(repo),
  )
  if (dup && dup.parent?.project_id !== main.project_id) {
    return { ok: false, error: `이 폴더는 따로 등록된 프로젝트입니다 (${dup.project_id})` }
  }
  const originUrl = await remoteUrl(repo, 'origin', { env })
  const gh = (await checkGh(o.ghBin, env, originUrl)).check
  const { local, remote } = await branches(repo, { env })
  // 이미 있는 서브모듈 프로젝트는 그 기본 브랜치를 그대로 둔다
  const branch =
    dup?.default_branch ??
    submoduleDefaultBranch({
      remoteHead: await originHead(repo, { env }),
      configured: await submoduleBranch(main.repo_path, entry.name, { env }),
      remote,
      local,
    })
  if (!branch) return { ok: false, error: `서브모듈 ${subPath}에서 브랜치를 찾지 못했습니다` }
  return {
    ok: true,
    project: {
      ...(dup ?? {}),
      schema_version: 1,
      project_id: id,
      repo_path: repo,
      default_branch: branch,
      created_at: dup?.created_at ?? at,
      checks: { origin: originUrl !== null, gh: gh.auth, gh_version: gh.version, checked_at: at },
      parent: { project_id: main.project_id, path: subPath, name: entry.name },
    },
  }
}

/**
 * 묶음 Work의 레포 표에서 고른 서브모듈 (D472): 메인 체크아웃에 받지 않았으면 받고(D413과 같음), 기준 브랜치의 기본값과
 * 목록, origin이 있는지 읽는다. 기본 브랜치는 서브모듈 프로젝트와 같은 차례로 고른다 (D413)
 */
export async function inspectRepoChoice(
  main: ProjectState,
  subPath: string,
  o: Pick<ProjectEnv, 'env'>,
): Promise<{ ok: true; view: RepoChoiceView } | { ok: false; error: string }> {
  const env = o.env
  if (main.parent) return { ok: false, error: '서브모듈 안의 서브모듈은 고를 수 없습니다' }
  const entry = (await submoduleList(main.repo_path, { env })).find((e) => e.path === subPath)
  if (!entry) return { ok: false, error: `서브모듈이 아닙니다: ${subPath}` }
  const repo = path.join(main.repo_path, ...subPath.split('/'))
  if (!entry.initialized) {
    try {
      await initSubmodule(main.repo_path, subPath, { env })
    } catch (e) {
      return {
        ok: false,
        error: `서브모듈 ${subPath}을 받지 못했습니다. 터미널에서 git submodule update --init -- ${subPath}로 받은 뒤 다시 고르세요. ${String(e)}`,
      }
    }
  }
  const root = await repoRoot(repo, { env })
  if (!root || pathKey(root) !== pathKey(repo)) {
    return { ok: false, error: `서브모듈 폴더를 git 레포로 읽지 못했습니다: ${repo}` }
  }
  const { local, remote } = await branches(repo, { env })
  const branch = submoduleDefaultBranch({
    remoteHead: await originHead(repo, { env }),
    configured: await submoduleBranch(main.repo_path, entry.name, { env }),
    remote,
    local,
  })
  if (!branch) return { ok: false, error: `서브모듈 ${subPath}에서 브랜치를 찾지 못했습니다` }
  const rest = [...new Set([...local, ...remote])].filter((b) => b !== branch).sort()
  return {
    ok: true,
    view: {
      name: entry.name,
      path: subPath,
      defaultBranch: branch,
      branches: [branch, ...rest],
      origin: (await remoteUrl(repo, 'origin', { env })) !== null,
    },
  }
}

/** 레포 하나의 origin과 gh 점검 (D67, D477). 묶음 Work의 서브모듈마다 전달 버튼을 정한다 */
export async function repoChecks(
  repo: string,
  bin: string,
  env: NodeJS.ProcessEnv,
  at: string,
): Promise<ProjectState['checks']> {
  const origin = await remoteUrl(repo, 'origin', { env })
  const gh = (await checkGh(bin, env, origin)).check
  return { origin: origin !== null, gh: gh.auth, gh_version: gh.version, checked_at: at }
}
