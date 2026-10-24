// 오른쪽 패널의 너비 (D469). 승인 대기와 PR 진행에서 넓어지는 것(D79)은 그대로 두고, 보통일 때와 넓을 때의 너비를
// 따로 사람이 끌어 정한다. 정하지 않은 쪽은 CSS의 기본 너비다.

/** 보통(`normal`)과 넓은(`wide`) 패널의 너비(px). null이면 기본 너비다 */
export interface PanelWidths {
  normal: number | null
  wide: number | null
}

export type PanelMode = keyof PanelWidths

/** 사이드바 너비 (styles.css의 `.layout`) */
export const SIDEBAR_WIDTH = 260
/** 패널이 이보다 좁아지지 않는다 */
export const PANEL_MIN = 280
/** 가운데(터미널)가 이만큼은 남는다 */
export const CENTER_MIN = 400
/** 키보드 화살표 한 번에 바뀌는 너비 */
export const PANEL_STEP = 24

/** 창 너비에서 패널이 가질 수 있는 가장 큰 너비. 창이 아주 좁으면 PANEL_MIN이다 */
export function panelMax(viewport: number): number {
  return Math.max(PANEL_MIN, viewport - SIDEBAR_WIDTH - CENTER_MIN)
}

export function clampPanelWidth(width: number, viewport: number): number {
  return Math.round(Math.min(panelMax(viewport), Math.max(PANEL_MIN, width)))
}

/**
 * 정한 너비의 grid 열. 창을 줄이면 CSS가 가운데를 남기도록 줄이고, 다시 늘리면 정한 너비로 돌아간다.
 * 정한 너비가 없으면 null이라 styles.css의 `.layout`과 `.layout.wide`를 쓴다
 */
export function panelColumns(width: number | null): string | null {
  if (width === null) return null
  const max = `calc(100vw - ${SIDEBAR_WIDTH + CENTER_MIN}px)`
  return `${SIDEBAR_WIDTH}px minmax(0, 1fr) clamp(${PANEL_MIN}px, ${width}px, ${max})`
}

const STORAGE_KEY = 'relay.panel.width'

function width(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= PANEL_MIN
    ? Math.round(raw)
    : null
}

/** 정한 너비를 읽는다. 저장소를 쓸 수 없거나 값이 깨졌으면 기본 너비다 */
export function loadPanelWidths(): PanelWidths {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    return { normal: width(o['normal']), wide: width(o['wide']) }
  } catch {
    return { normal: null, wide: null }
  }
}

export function savePanelWidths(widths: PanelWidths): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
  } catch {
    // 저장하지 못하면 이번 실행에서만 쓴다
  }
}
