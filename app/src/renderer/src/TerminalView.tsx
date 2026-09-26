import { useEffect, useRef } from 'react'
import type { StartResult } from '../../shared/api'
import { fitIfVisible, getTerm } from './terminals'

interface Props {
  id: string
  active: boolean
  onStart: (id: string, result: StartResult) => void
}

export function TerminalView({ id, active, onStart }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const entry = getTerm(id)
    if (!el || !entry) return
    if (!entry.term.element) entry.term.open(el)
    else if (entry.term.element.parentElement !== el) el.appendChild(entry.term.element)

    // 창 크기 변경 → xterm 크기 → onResize → PTY resize
    const ro = new ResizeObserver(() => fitIfVisible(entry, el))
    ro.observe(el)

    // 붙인 뒤 크기를 맞추고 나서 시작해야 claude가 처음부터 맞는 크기로 그린다.
    if (!entry.started) {
      entry.started = true
      fitIfVisible(entry, el)
      void window.relay.terminal
        .start(id, entry.term.cols, entry.term.rows)
        .then((r) => onStart(id, r))
    }
    return () => ro.disconnect()
  }, [id, onStart])

  useEffect(() => {
    const el = ref.current
    const entry = getTerm(id)
    if (!active || !el || !entry) return
    fitIfVisible(entry, el)
    entry.term.focus()
  }, [id, active])

  return <div ref={ref} className="terminal-host" hidden={!active} data-terminal-id={id} />
}
