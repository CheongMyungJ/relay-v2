// 사이드바 아래 [설정] 오른쪽의 업데이트 버튼 (I121). 누르면 새 버전을 바로 확인하고 받으며, 설치 준비가 끝나면
// 앱을 끝내고 설치한다는 확인을 받는다. 취소하면 그대로 쓰고, 받아 둔 버전은 앱을 끝낼 때 설치된다(I95).
import { useEffect, useRef, useState } from 'react'
import type { UpdateState } from '../../shared/api'
import { ConfirmDialog } from './dialogs'
import { afterCheck, updateView } from './update'

export function UpdateButton() {
  const [state, setState] = useState<UpdateState>({ kind: 'off' })
  const [confirming, setConfirming] = useState(false)
  // 사람이 눌러 시작한 확인이 끝나기를 기다리는 중
  const waiting = useRef(false)

  useEffect(() => {
    const off = window.relay.onUpdate(setState)
    void window.relay.updateState().then(setState)
    return off
  }, [])

  useEffect(() => {
    const next = afterCheck(waiting.current, state)
    waiting.current = next.waiting
    if (next.open) setConfirming(true)
  }, [state])

  const view = updateView(state)
  const onClick = () => {
    if (view.action === 'check') {
      waiting.current = true
      void window.relay.checkUpdate()
    } else if (view.action === 'install') {
      if (state.kind === 'ready') setConfirming(true)
      else void window.relay.installUpdate()
    }
  }

  return (
    <>
      <button
        className={`update-button${view.tone ? ` u-${view.tone}` : ''}`}
        title={view.title}
        aria-label={`업데이트: ${view.title}`}
        disabled={view.action === 'none'}
        onClick={onClick}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8 2.5v7.5M4.5 6.5 8 10l3.5-3.5M3 13h10" />
        </svg>
        {view.text ? <span className="update-text">{view.text}</span> : null}
      </button>
      {confirming && state.kind === 'ready' ? (
        <ConfirmDialog
          title="업데이트 설치"
          confirm="종료하고 설치"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            void window.relay.installUpdate()
          }}
        >
          <p>relay {state.version}을 받았습니다.</p>
          <p>
            설치하려면 앱을 끝내야 합니다. 실행 중인 세션이 있으면 한 번 더 묻고, 세션은
            &quot;중단됨&quot;으로 남아 다음 실행 때 [재개]할 수 있습니다. 설치가 끝나면 새 버전으로
            다시 켜집니다.
          </p>
          <p className="dim">취소하면 그대로 쓸 수 있고, 받아 둔 버전은 앱을 끝낼 때 설치됩니다.</p>
        </ConfirmDialog>
      ) : null}
    </>
  )
}
