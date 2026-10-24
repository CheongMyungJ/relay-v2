// 오른쪽 패널의 왼쪽 가장자리 손잡이 (D469). 끌거나 화살표 키로 너비를 바꾸고, 두 번 누르면 기본 너비로 돌아간다.
// 패널은 스크롤되므로 손잡이는 패널 안이 아니라 같은 grid 칸에 겹쳐 둔다(styles.css의 `.panel-resizer`).
import { useRef, useState, type RefObject } from 'react'
import { PANEL_MIN, PANEL_STEP, clampPanelWidth, panelMax } from './panelWidth'

export function PanelResizer({
  panel,
  width,
  onResize,
  onReset,
}: {
  /** 지금 그려진 너비를 재는 패널 */
  panel: RefObject<HTMLElement | null>
  /** 정한 너비. 기본 너비면 null */
  width: number | null
  onResize: (width: number) => void
  onReset: () => void
}) {
  const start = useRef<{ x: number; width: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // 기본 너비는 CSS가 정하므로 그려진 너비에서 시작한다
  const current = () => panel.current?.getBoundingClientRect().width ?? width ?? PANEL_MIN

  return (
    <div
      className={`panel-resizer${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="오른쪽 패널 너비"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={panelMax(window.innerWidth)}
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      title="끌어서 너비 조절, 두 번 누르면 원래 너비"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, width: current() }
        setDragging(true)
      }}
      onPointerMove={(e) => {
        const s = start.current
        // 패널은 오른쪽에 있어 왼쪽으로 끌면 넓어진다
        if (s) onResize(clampPanelWidth(s.width + s.x - e.clientX, window.innerWidth))
      }}
      onPointerUp={() => {
        start.current = null
        setDragging(false)
      }}
      onPointerCancel={() => {
        start.current = null
        setDragging(false)
      }}
      onLostPointerCapture={() => {
        start.current = null
        setDragging(false)
      }}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? PANEL_STEP : e.key === 'ArrowRight' ? -PANEL_STEP : 0
        if (step) {
          e.preventDefault()
          onResize(clampPanelWidth(current() + step, window.innerWidth))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          onReset()
        }
      }}
    />
  )
}
