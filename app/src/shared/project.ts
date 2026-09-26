// project.json의 모양 (5.1). 파일에 쓰는 모양이라 키는 snake_case다.

/** 등록 점검 중 경고만 하는 항목의 결과 (D67). 실패하면 해당 전달 버튼을 비활성화한다 (M5) */
export interface ProjectChecks {
  /** origin 원격이 있는가. 없으면 [push]와 [PR 생성]을 비활성화한다 */
  origin: boolean
  /** gh auth status가 성공하는가. 실패하면 [PR 생성]만 비활성화한다 */
  gh: boolean
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
}
