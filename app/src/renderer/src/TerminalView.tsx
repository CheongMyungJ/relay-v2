import { useEffect, useRef } from 'react'
import type { AppInfo } from '../../shared/api'
import { ensureTerm, fitIfVisible } from './terminals'

interface Props {
  terminalKey: string
  info: AppInfo
  active: boolean
  /** 세션이 살아 있다. 끝난 task의 탭은 읽기 전용이다 */
  live: boolean
}

export function TerminalView({ terminalKey, info, active, live }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const entry = ensureTerm(terminalKey, info)
    if (!entry.term.element) entry.term.open(el)
    else if (entry.term.element.parentElement !== el) el.appendChild(entry.term.element)
    // 창 크기 변경 → xterm 크기 → onResize → PTY resize
    const ro = new ResizeObserver(() => fitIfVisible(entry, el))
    ro.observe(el)
    return () => ro.disconnect()
  }, [terminalKey, info])

  useEffect(() => {
    ensureTerm(terminalKey, info).term.options.disableStdin = !live
  }, [terminalKey, info, live])

  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    const entry = ensureTerm(terminalKey, info)
    fitIfVisible(entry, el)
    entry.term.focus()
  }, [terminalKey, info, active])

  return (
    <div ref={ref} className="terminal-host" hidden={!active} data-terminal-key={terminalKey} />
  )
}
