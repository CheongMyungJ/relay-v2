// main의 조립 코드가 주입받는 바깥 (I26). Electron에서는 창과 OS 알림이고,
// 흐름 시험에서는 받은 것을 모으는 가짜다. 조립 코드는 Electron을 import하지 않는다.
import type { ProjectView, TerminalChunk, WorkView } from '../shared/views'

export interface UiPort {
  /** Work 스냅샷. 상태가 바뀔 때마다 보낸다 (I14) */
  work(view: WorkView): void
  /** 프로젝트 목록 */
  projects(views: ProjectView[]): void
  /** task 터미널 출력 */
  terminal(key: string, chunk: TerminalChunk): void
  /** OS 알림. M2는 이전 단계 추천으로 멈췄을 때만 알린다 (D23). 나머지 알림은 M3 (D81) */
  notify(n: { title: string; body: string }): void
}
