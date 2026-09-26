// 프로젝트 등록 (시나리오 0). 레포를 점검하고(D67) project.json을 만든다.
// git 레포 루트, claude 로그인, 중복 등록은 실패하면 막고, origin과 gh는 경고만 한다.
import path from 'node:path'
import { findClaude, claudeAuthStatus } from '../adapters/claude'
import { ghAuthStatus } from '../adapters/gh'
import { branches, defaultBranch, hasRemote, repoRoot } from '../adapters/git'
import { canonicalPath, pathKey, sha256 } from '../adapters/store'
import { projectId } from '../core/records'
import type { ProjectState } from '../shared/project'
import type { CheckItem, ProjectInspection } from '../shared/views'

/** claude를 못 찾았을 때의 설치 안내 (D106) */
export const CLAUDE_INSTALL_GUIDE =
  'claude 실행 파일을 찾지 못했습니다. Claude Code를 설치하세요' +
  ' (PowerShell: irm https://claude.ai/install.ps1 | iex, 안내: https://code.claude.com/docs/en/setup).' +
  ' 다른 위치에 설치했다면 CLAUDE_BIN 환경 변수로 경로를 알려 주세요.'

export interface ProjectEnv {
  env: NodeJS.ProcessEnv
  /** gh 실행 파일. 기본은 PATH의 gh */
  ghBin: string
  /** 이미 등록한 프로젝트 */
  registered: readonly ProjectState[]
}

const folderName = (p: string) => path.basename(p) || p

/** 등록 점검 표 (시나리오 0-2, D67, D106). 기본 브랜치 제안도 함께 돌려준다 (시나리오 0-3) */
export async function inspectProject(dir: string, o: ProjectEnv): Promise<ProjectInspection> {
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

  const bin = findClaude({ env })
  const auth = bin ? await claudeAuthStatus(bin, env) : null
  checks.push({
    id: 'claude',
    label: 'claude auth status가 성공하는가',
    ok: auth?.ok === true,
    blocking: true,
    detail: !bin
      ? CLAUDE_INSTALL_GUIDE
      : auth?.ok
        ? `로그인됨 (${bin})`
        : `로그인되지 않음 (${bin}): ${auth?.detail ?? ''}. 터미널에서 claude를 실행해 로그인하세요`,
  })

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

  const gh = await ghAuthStatus(o.ghBin, env)
  checks.push({
    id: 'gh',
    label: 'gh auth status가 성공하는가',
    ok: gh.ok,
    blocking: false,
    detail: gh.ok ? '로그인됨' : `${gh.detail}. [PR 생성]을 쓸 수 없습니다`,
  })

  return {
    path: repo,
    name: folderName(repo),
    checks,
    defaultBranch: root ? await defaultBranch(root, { env }) : null,
    canRegister: checks.every((c) => c.ok || !c.blocking),
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
  const inspection = await inspectProject(dir, o)
  const failed = inspection.checks.find((c) => c.blocking && !c.ok)
  if (failed) return { ok: false, error: `${failed.label}: ${failed.detail}` }
  const name = branch.trim() || inspection.defaultBranch
  if (!name) return { ok: false, error: '기본 브랜치를 입력하세요' }
  const repo = inspection.path
  const { local, remote } = await branches(repo, { env: o.env })
  if (!local.includes(name) && !remote.includes(name)) {
    return { ok: false, error: `브랜치 ${name}가 레포에 없습니다` }
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
      checks: { origin: check('origin'), gh: check('gh'), checked_at: at },
    },
  }
}
