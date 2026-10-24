// [단위] 오른쪽 패널 너비 (D469): 끌어 정한 너비의 범위, grid 열, 저장과 읽기
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CENTER_MIN,
  PANEL_MIN,
  SIDEBAR_WIDTH,
  clampPanelWidth,
  loadPanelWidths,
  panelColumns,
  panelMax,
  savePanelWidths,
} from '../../src/renderer/src/panelWidth'

describe('패널 너비의 범위', () => {
  it('가운데가 CENTER_MIN만큼 남도록 줄이고 PANEL_MIN보다 좁히지 않는다', () => {
    expect(panelMax(1600)).toBe(1600 - SIDEBAR_WIDTH - CENTER_MIN)
    expect(clampPanelWidth(500, 1600)).toBe(500)
    expect(clampPanelWidth(5000, 1600)).toBe(panelMax(1600))
    expect(clampPanelWidth(10, 1600)).toBe(PANEL_MIN)
    expect(clampPanelWidth(500.6, 1600)).toBe(501)
  })

  it('창이 아주 좁으면 PANEL_MIN이다', () => {
    expect(panelMax(700)).toBe(PANEL_MIN)
    expect(clampPanelWidth(600, 700)).toBe(PANEL_MIN)
  })

  it('정한 너비는 grid 열이 되고 창이 좁아지면 CSS가 줄인다. 정하지 않았으면 기본 열이다', () => {
    expect(panelColumns(null)).toBeNull()
    expect(panelColumns(520)).toBe(
      `${SIDEBAR_WIDTH}px minmax(0, 1fr) clamp(${PANEL_MIN}px, 520px, calc(100vw - ${SIDEBAR_WIDTH + CENTER_MIN}px))`,
    )
  })
})

/** 브라우저 저장소 대신 Map을 쓴다. [단위] 시험은 node에서 돌아 localStorage가 없다 */
function fakeStorage(): Map<string, string> {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
  })
  return data
}

describe('패널 너비 저장', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('보통과 넓은 너비를 따로 저장하고 다시 읽는다', () => {
    fakeStorage()
    expect(loadPanelWidths()).toEqual({ normal: null, wide: null })
    savePanelWidths({ normal: 420, wide: null })
    expect(loadPanelWidths()).toEqual({ normal: 420, wide: null })
    savePanelWidths({ normal: 420, wide: 760 })
    expect(loadPanelWidths()).toEqual({ normal: 420, wide: 760 })
  })

  it('깨진 값과 PANEL_MIN보다 좁은 값은 기본 너비로 읽는다', () => {
    const data = fakeStorage()
    data.set('relay.panel.width', '{')
    expect(loadPanelWidths()).toEqual({ normal: null, wide: null })
    data.set('relay.panel.width', JSON.stringify({ normal: '500', wide: 10 }))
    expect(loadPanelWidths()).toEqual({ normal: null, wide: null })
    data.set('relay.panel.width', 'null')
    expect(loadPanelWidths()).toEqual({ normal: null, wide: null })
  })

  it('저장소를 쓸 수 없으면 기본 너비이고 저장은 조용히 넘어간다', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    })
    expect(loadPanelWidths()).toEqual({ normal: null, wide: null })
    expect(() => savePanelWidths({ normal: 400, wide: null })).not.toThrow()
  })
})
