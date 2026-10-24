// project.json의 모양 (5.1). 파일에 쓰는 모양이라 키는 snake_case다.
import type { MergeMethod } from './work'

/** 등록 점검 중 경고만 하는 항목의 결과 (D67). 실패하면 해당 전달 버튼을 비활성화한다 (M5) */
export interface ProjectChecks {
  /** origin 원격이 있는가. 없으면 [push]와 [PR 생성]을 비활성화한다 */
  origin: boolean
  /** gh auth status가 성공하는가. 실패하면 [PR 생성]만 비활성화한다 */
  gh: boolean
  /**
   * gh --version의 버전 (D198). 최소 버전보다 낮으면 [PR 생성]을 비활성화한다. 읽지 못했거나 M9 전에 점검한
   * project.json이면 없다(모름: 막지 않는다)
   */
  gh_version?: string | null
  checked_at: string
}

export interface ProjectState {
  schema_version: 1
  /** <레포 폴더 이름>-<레포 절대 경로 해시 앞 6자> (5.1, D111) */
  project_id: string
  /** 레포 루트의 절대 경로 */
  repo_path: string
  /** Work 생성 화면의 기준 브랜치 기본값 (시나리오 0-3) */
  default_branch: string
  created_at: string
  checks: ProjectChecks
  /**
   * 코멘트를 대응할 거리로 받을 봇의 이름 (5.1.2, D161). 웹 화면에 보이는 이름으로 적고 `[bot]`을 붙여 적어도 같게
   * 본다 (D197). 없으면 빈 목록이다
   */
  allowed_bots?: string[]
  /** 머지 창의 기본 선택 (5.1.2, D177). 없거나 null이면 레포가 허용하는 첫 방식이다 */
  merge_method?: MergeMethod | null
  /** 이슈 기록 (설계 3.7, D337, D345). 없으면 켜짐이다. 바꾸면 다음에 만드는 Work부터 따른다 (I96) */
  issue_log?: boolean
  /**
   * 작업 브랜치 이름 규칙 (D426). 자리는 {work-id}, {date}, {seq}, {type}, {slug}다. 없으면 relay/{work-id}다. 앱이 끝에 임의의
   * 4자를 붙인다 (D427). 바꾸면 다음에 만드는 Work부터 따른다
   */
  branch_rule?: string
  /**
   * 서브모듈 프로젝트 (D413): 메인 프로젝트의 서브모듈 하나를 대상으로 한 프로젝트다. repo_path는 메인 체크아웃의 그
   * 서브모듈 폴더다. 새 Work 대화상자에서 서브모듈을 처음 고를 때 앱이 만든다. 메인 프로젝트면 없다
   */
  parent?: SubmoduleParent
  /**
   * 서브모듈 경로마다의 설정 (D483). 묶음 Work의 그 서브모듈 PR 카드에 쓴다. 없는 키는 위의 메인 값을 쓴다. 서브모듈 프로젝트에
   * 두던 설정의 자리다
   */
  submodules?: Record<string, SubmoduleSettings>
}

/** 서브모듈 PR 카드의 설정 (D483): 받을 봇(D161)과 머지 창의 기본 방식(D177). 없으면 메인 프로젝트의 값이다 */
export interface SubmoduleSettings {
  allowed_bots?: string[]
  merge_method?: MergeMethod
}

/** 서브모듈 프로젝트의 메인 프로젝트와 그 안의 자리 (D413) */
export interface SubmoduleParent {
  project_id: string
  /** 메인 레포 안의 서브모듈 경로 (`.gitmodules`의 path, `/`로 나눔) */
  path: string
  /** `.gitmodules`의 서브모듈 이름. git 설정(`submodule.<이름>.*`)과 저장소 폴더(`modules/<이름>`)의 이름이다 */
  name: string
}

/** 프로젝트 설정 화면에서 바꾸는 값 (5.1.2, D185) */
export interface ProjectSettings {
  allowed_bots: string[]
  merge_method: MergeMethod | null
  /** 이슈 기록 (D337). 없으면 바꾸지 않는다 */
  issue_log?: boolean
  /** 작업 브랜치 이름 규칙 (D426). 없으면 바꾸지 않는다. 빈 문자열이면 지운다(기본 규칙) */
  branch_rule?: string
  /** 서브모듈마다의 설정 (D483). 없으면 바꾸지 않는다. 있으면 통째로 바꾼다 */
  submodules?: Record<string, SubmoduleSettings>
}

/** 규칙이 없을 때의 작업 브랜치 규칙 (D426). 예전 Work의 브랜치 이름(relay/<work-id>)과 같은 모양이다 */
export const DEFAULT_BRANCH_RULE = 'relay/{work-id}'

/**
 * 레포의 PR 설정 (D483): 메인(빈 경로)은 프로젝트의 값이고, 서브모듈은 그 경로의 칸을 쓰되 없는 키는 메인의 값이다
 */
export function repoSettings(
  project: Pick<ProjectState, 'allowed_bots' | 'merge_method' | 'submodules'>,
  path: string,
): { allowedBots: string[]; mergeMethod: MergeMethod | null } {
  const own = path ? project.submodules?.[path] : undefined
  return {
    allowedBots: own?.allowed_bots ?? project.allowed_bots ?? [],
    mergeMethod: own?.merge_method ?? project.merge_method ?? null,
  }
}

/** 이슈 기록이 켜져 있는가 (D337): 없으면 켜짐이다 */
export function issueLogOn(project: Pick<ProjectState, 'issue_log'>): boolean {
  return project.issue_log !== false
}

/** 프로젝트의 화면 이름: 레포 폴더 이름. 사이드바, 새 Work 대화상자, 기본 세션의 안내가 같이 쓴다 */
export function projectName(project: Pick<ProjectState, 'repo_path' | 'parent'>): string {
  // 서브모듈 프로젝트는 메인 레포 안의 경로다 (D413)
  if (project.parent) return project.parent.path
  const trimmed = project.repo_path.replace(/[\\/]+$/, '')
  return trimmed.replace(/^.*[\\/]/, '') || project.repo_path
}
