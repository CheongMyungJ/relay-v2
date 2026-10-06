// 사이드바의 업데이트 버튼 (I121). 버튼이 보일 글과 누르면 할 일, 사람이 확인을 누른 뒤 설치 확인 창을 열지를 정한다.
import type { UpdateState } from '../../shared/api'

export interface UpdateView {
  /** 아이콘 옆에 보일 짧은 상태. 없으면 아이콘만 보인다 */
  text: string | null
  /** 마우스를 올리면 보일 설명. 버튼의 이름으로도 쓴다 */
  title: string
  /** 상태 색: good(최신), hot(설치 준비, 사람이 할 일), bad(실패), busy(확인·받는 중) */
  tone: 'good' | 'hot' | 'bad' | 'busy' | null
  /** 누르면: check(지금 확인), install(설치 확인 창, 직접 설치면 설치 명령), none(아무것도 안 함) */
  action: 'check' | 'install' | 'none'
}

export function updateView(s: UpdateState): UpdateView {
  switch (s.kind) {
    case 'off':
      return {
        text: null,
        title:
          '이 설치본은 앱에서 업데이트하지 않습니다 (개발 앱, 릴리스가 아닌 빌드, 지원하지 않는 OS·설치 형식)',
        tone: null,
        action: 'none',
      }
    case 'idle':
      return { text: null, title: '업데이트 확인', tone: null, action: 'check' }
    case 'checking':
      return { text: '확인 중', title: '새 버전을 확인하는 중', tone: 'busy', action: 'none' }
    case 'latest':
      return {
        text: '최신',
        title: '최신 버전입니다. 누르면 다시 확인',
        tone: 'good',
        action: 'check',
      }
    case 'downloading':
      return {
        text: s.percent === null ? '받는 중' : `받는 중 ${s.percent}%`,
        title: `relay ${s.version}을 받는 중`,
        tone: 'busy',
        action: 'none',
      }
    case 'ready':
      return {
        text: '설치 준비됨',
        title: `relay ${s.version}을 받았습니다. 누르면 앱을 끝내고 설치합니다(확인을 먼저 받음)`,
        tone: 'hot',
        action: 'install',
      }
    case 'manual':
      return {
        text: '직접 설치',
        title: `relay ${s.version}을 받았습니다. 이 환경에서는 터미널에서 직접 설치합니다. 누르면 설치 명령을 보입니다`,
        tone: 'hot',
        action: 'install',
      }
    case 'error':
      return {
        text: '확인 실패',
        title: `업데이트 확인 실패: ${s.message}. 누르면 다시 확인`,
        tone: 'bad',
        action: 'check',
      }
  }
}

/**
 * 사람이 [업데이트]로 확인을 시작한 뒤의 상태 변화. 설치 준비가 끝나면 설치 확인 창을 연다(open).
 * 최신이거나 실패했거나 직접 설치해야 하면 기다리기를 그친다. 확인·받는 중이면 계속 기다린다
 */
export function afterCheck(waiting: boolean, s: UpdateState): { waiting: boolean; open: boolean } {
  if (!waiting) return { waiting: false, open: false }
  if (s.kind === 'ready') return { waiting: false, open: true }
  if (s.kind === 'checking' || s.kind === 'downloading' || s.kind === 'idle')
    return { waiting: true, open: false }
  return { waiting: false, open: false }
}
