// 프로젝트 등록 (시나리오 0). 레포를 점검하고(D67) project.json을 만든다.
// git 레포 루트, claude 로그인, 중복 등록은 실패하면 막고, origin과 gh(로그인과 버전, D198)는 경고만 한다.
import path from 'node:path'
import { agentRuntime, CLAUDE_INSTALL_GUIDE } from '../adapters/agent'
import type { AgentEngine } from '../shared/agent'
import { ghAuthStatus, ghVersion } from '../adapters/gh'
import { branches, defaultBranch, hasRemote, repoRoot } from '../adapters/git'
import { canonicalPath, pathKey, sha256 } from '../adapters/store'
import { MIN_GH_VERSION, ghTooOld, ghVersionReason } from '../core/pr'
import { projectId } from '../core/records'
import type { ProjectState } from '../shared/project'
import type { CheckItem, ProjectInspection } from '../shared/views'

/** claude를 못 찾았을 때의 설치 안내 (D106) */
export { CLAUDE_INSTALL_GUIDE }

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

/** gh 점검 표의 줄 (시나리오 0-2, D198). 로그인되어 있고 최소 버전 이상이어야 통과다 */
export async function checkGh(
  bin: string,
  env: NodeJS.ProcessEnv,
): Promise<{ check: GhCheck; item: CheckItem }> {
  const auth = await ghAuthStatus(bin, env)
  const version = await ghVersion(bin, env)
  const old = ghTooOld(version)
  const item: CheckItem = {
    id: 'gh',
    label: `gh auth status가 성공하고 gh가 ${MIN_GH_VERSION} 이상인가`,
    ok: auth.ok && !old,
    blocking: false,
    detail: !auth.ok
      ? `${auth.detail}. [PR 생성]을 쓸 수 없습니다`
      : old && version
        ? `${ghVersionReason(version)}. gh를 올리기 전에는 [PR 생성]을 쓸 수 없습니다`
        : `로그인됨 (gh ${version ?? '버전 모름'})`,
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

  const origin = root ? await hasRemote(root, 'origin', { env }) : false
  checks.push({
    id: 'origin',
    label: 'origin 원격이 있는가',
    ok: origin,
    blocking: false,
    detail: origin ? '있음' : '없음. [push]와 [PR 생성]을 쓸 수 없습니다',
  })

  const gh = await checkGh(o.ghBin, env)
  checks.push(gh.item)

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
