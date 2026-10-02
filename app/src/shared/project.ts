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
  /** 레포 안 지식 폴더 (5.1.2, D305). 없으면 docs/knowledge/다 */
  knowledge_dir?: string
  /** 팀 공유 (5.1.2, D322). 없으면 켬이다 */
  knowledge_share?: boolean
}

/** 프로젝트 설정 화면에서 바꾸는 값 (5.1.2, D185, D305, D322) */
export interface ProjectSettings {
  allowed_bots: string[]
  merge_method: MergeMethod | null
  /** 없으면 지금 값을 둔다 */
  knowledge_dir?: string
  knowledge_share?: boolean
}
