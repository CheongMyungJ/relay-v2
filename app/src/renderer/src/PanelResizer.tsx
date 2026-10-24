// 오른쪽 패널의 왼쪽 가장자리 손잡이 (D469). 끌거나 화살표 키로 너비를 바꾸고, 두 번 누르면 기본 너비로 돌아간다.
// 패널은 스크롤되므로 손잡이는 패널 안이 아니라 같은 grid 칸에 겹쳐 둔다(styles.css의 `.panel-resizer`).
// 끄는 동안은 `.layout`의 `--panel-drag`만 바꿔 App을 다시 그리지 않고, 놓을 때 한 번 정한다.
import { useEffect, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { PANEL_MIN, PANEL_STEP, clampPanelWidth, panelMax } from './panelWidth'

/** 이만큼 움직여야 끌기로 본다. 두 번 누를 때의 떨림으로 기본 너비가 px 값으로 굳지 않게 한다 */
const DRAG_THRESHOLD = 3

export function PanelResizer({
  panel,
  onResize,
  onReset,
}: {
  /** 지금 그려진 너비를 재는 패널. 부모가 `.layout`이다 */
  panel: RefObject<HTMLElement | null>
  /** 지금 쪽(보통 또는 넓음)의 너비를 정한다 */
  onResize: (width: number) => void
  onReset: () => void
}) {
  // 끌기 시작 때의 onResize를 잡아 두어, 끄는 사이에 승인 대기가 되거나 끝나도 시작한 쪽의 너비로 정한다
  const drag = useRef<{
    x: number
    width: number
    last: number | null
    commit: (width: number) => void
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  // 보조 기술에 알릴 그려진 너비와 상한. 기본 너비는 CSS가 정하므로 재어 둔다
  const [now, setNow] = useState<number | null>(null)
  const [max, setMax] = useState(() => panelMax(window.innerWidth))

  useEffect(() => {
    const el = panel.current
    if (!el) return
    const measure = () => {
      setNow(Math.round(el.getBoundingClientRect().width))
      setMax(panelMax(window.innerWidth))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [panel])

  const current = () => panel.current?.getBoundingClientRect().width ?? now ?? PANEL_MIN

  return (
    <div
      className={`panel-resizer${dragging ? ' dragging' : ''}`}
      role="separator"
      aria-orientation="vertical"
      aria-label="오른쪽 패널 너비"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={max}
      aria-valuenow={now ?? undefined}
      tabIndex={0}
      title="끌어서 너비 조절, 두 번 누르면 원래 너비"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { x: e.clientX, width: current(), last: null, commit: onResize }
        setDragging(true)
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d) return
        // 패널은 오른쪽에 있어 왼쪽으로 끌면 넓어진다
        const dx = d.x - e.clientX
        if (d.last === null && Math.abs(dx) < DRAG_THRESHOLD) return
        d.last = clampPanelWidth(d.width + dx, window.innerWidth)
        panel.current?.parentElement?.style.setProperty('--panel-drag', `${d.last}px`)
      }}
      // 놓거나 취소하면 잡은 포인터를 놓아 이 이벤트가 한 번 온다
      onLostPointerCapture={() => {
        const d = drag.current
        drag.current = null
        setDragging(false)
        // 정한 너비를 먼저 그려야 끄던 너비를 지울 때 한 장면 동안 옛 너비로 돌아가지 않는다
        if (d?.last != null) flushSync(() => d.commit(d.last as number))
        panel.current?.parentElement?.style.removeProperty('--panel-drag')
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
