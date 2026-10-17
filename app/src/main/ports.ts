// main의 조립 코드가 주입받는 바깥 (I26). Electron에서는 창과 OS 알림이고,
// 흐름 시험에서는 받은 것을 모으는 가짜다. 조립 코드는 Electron을 import하지 않는다.
import type {
  ActivityUpdate,
  ProjectView,
  SessionView,
  TerminalChunk,
  WorkView,
} from '../shared/views'

export interface UiPort {
  /** Work 스냅샷. 상태가 바뀔 때마다 보낸다 (I14) */
  work(view: WorkView): void
  /** Work 기록을 지웠다 (D407, D408). 그 Work의 스냅샷은 더 오지 않는다 */
  workRemoved(workKey: string): void
  /**
   * 도구 훅으로 바뀐 진행 표시 (D216). 도구를 쓸 때마다 오므로 스냅샷(과 승인 화면을 다시 읽기)을 부르지 않고 따로
   * 보낸다
   */
  activity(update: ActivityUpdate): void
  /** 프로젝트 목록 */
  projects(views: ProjectView[]): void
  /** 기본 세션 목록 (D405). 세션 하나가 바뀌어도 목록 전체를 보낸다 */
  sessions(views: SessionView[]): void
  /** task, 보조 세션, 기본 세션의 터미널 출력 */
  terminal(key: string, chunk: TerminalChunk): void
  /**
   * OS 알림 (D81): 사람이 움직여야 하는 상태로 바뀌었거나 대기열에서 자동으로 시작했다.
   * 사람이 그 Work를 보고 있으면 보내지 않는다. 보고 있는지는 받는 쪽(창)이 가린다.
   */
  notify(n: Notice): void
}

export interface Notice {
  /** 알림을 누르면 고를 Work */
  workKey: string
  title: string
  body: string
}
