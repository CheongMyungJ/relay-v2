// 대화상자의 틀. 설정 화면처럼 칸이 많은 창은 className으로 크기를 바꾼다 (D527)
import { useEffect, useRef, type ReactNode } from 'react'

export function Modal({
  title,
  children,
  onClose,
  className,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  /** 창(.modal)에 더할 class */
  className?: string
}) {
  // top layer에 띄운다(showModal): 패널의 버튼 줄이나 터미널 레이어에 가려지지 않고, 뒤는 눌리지 않으며,
  // 포커스가 창 안으로 오고 Escape로 닫힌다. 닫힘은 브라우저의 close 하나로 받는다
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal-dialog"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        // 창 밖(::backdrop)을 누르면 닫는다
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={className ? `modal ${className}` : 'modal'}>
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  )
}
