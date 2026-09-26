// 3단 레이아웃 (D79): 사이드바 / 터미널 탭과 액션 바 / 오른쪽 패널.
// M0에서는 가운데에 claude 터미널 탭만 있다. 사이드바와 오른쪽 패널은 M2에서 채운다.
import { useCallback, useEffect, useReducer, useState } from 'react'
import type { AppInfo, StartResult } from '../../shared/api'
import { TerminalView } from './TerminalView'
import { createTerm, disposeTerm } from './terminals'

type TabStatus =
  | { kind: 'starting' }
  | { kind: 'running'; pid: number }
  | { kind: 'exited'; code: number }
  | { kind: 'error'; message: string }

interface Tab {
  id: string
  cwd: string
  status: TabStatus
}

interface State {
  tabs: Tab[]
  activeId: string | null
}

type Action =
  | { type: 'add'; id: string; cwd: string }
  | { type: 'status'; id: string; status: TabStatus }
  | { type: 'remove'; id: string }
  | { type: 'activate'; id: string }

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'add':
      return {
        tabs: [...state.tabs, { id: a.id, cwd: a.cwd, status: { kind: 'starting' } }],
        activeId: a.id,
      }
    case 'status':
      return {
        ...state,
        tabs: state.tabs.map((t) => (t.id === a.id ? { ...t, status: a.status } : t)),
      }
    case 'remove': {
      const i = state.tabs.findIndex((t) => t.id === a.id)
      const tabs = state.tabs.filter((t) => t.id !== a.id)
      const activeId =
        state.activeId === a.id ? (tabs[Math.min(i, tabs.length - 1)]?.id ?? null) : state.activeId
      return { tabs, activeId }
    }
    case 'activate':
      return { ...state, activeId: a.id }
  }
}

function folderName(p: string): string {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

function statusText(s: TabStatus): string {
  switch (s.kind) {
    case 'starting':
      return '시작하는 중'
    case 'running':
      return `실행 중 (PID ${s.pid})`
    case 'exited':
      return `종료됨 (코드 ${s.code})`
    case 'error':
      return s.message
  }
}

export function App() {
  const [state, dispatch] = useReducer(reducer, { tabs: [], activeId: null })
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.relay.appInfo().then(setInfo)
  }, [])

  const openTab = useCallback(async () => {
    if (!info) return
    const cwd = await window.relay.terminal.pickFolder()
    if (!cwd) return
    const id = await window.relay.terminal.create(cwd)
    createTerm(id, info, (code) =>
      dispatch({ type: 'status', id, status: { kind: 'exited', code } }),
    )
    dispatch({ type: 'add', id, cwd })
  }, [info])

  const closeTab = useCallback(async (id: string) => {
    dispatch({ type: 'remove', id })
    disposeTerm(id)
    await window.relay.terminal.close(id)
  }, [])

  const onStart = useCallback((id: string, r: StartResult) => {
    dispatch({
      type: 'status',
      id,
      status: r.ok ? { kind: 'running', pid: r.pid } : { kind: 'error', message: r.error },
    })
  }, [])

  const active = state.tabs.find((t) => t.id === state.activeId)

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="placeholder">프로젝트와 Work 목록</div>
      </aside>
      <main className="center">
        <div className="tabs" role="tablist">
          {state.tabs.map((t) => (
            <div
              key={t.id}
              role="tab"
              aria-selected={t.id === state.activeId}
              className={`tab${t.id === state.activeId ? ' active' : ''}`}
              title={t.cwd}
              onClick={() => dispatch({ type: 'activate', id: t.id })}
            >
              <span className="tab-title">{folderName(t.cwd)}</span>
              <button
                className="tab-close"
                aria-label="탭 닫기"
                title="탭 닫기 (프로세스 트리 종료)"
                onClick={(e) => {
                  e.stopPropagation()
                  void closeTab(t.id)
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="tab-add"
            title="폴더를 골라 claude 실행"
            disabled={!info}
            onClick={() => void openTab()}
          >
            +
          </button>
        </div>
        <div className="band">
          {active ? (
            <>
              <span>claude · {active.cwd}</span>
              <span className={`band-status ${active.status.kind}`}>
                {statusText(active.status)}
              </span>
            </>
          ) : null}
        </div>
        <div className="terminal">
          {state.tabs.map((t) => (
            <TerminalView key={t.id} id={t.id} active={t.id === state.activeId} onStart={onStart} />
          ))}
          {state.tabs.length === 0 ? (
            <div className="empty">
              <button disabled={!info} onClick={() => void openTab()}>
                폴더를 골라 claude 실행
              </button>
            </div>
          ) : null}
        </div>
        <div className="action-bar" />
      </main>
      <aside className="panel">
        <div className="placeholder">handoff 상태와 산출물</div>
      </aside>
    </div>
  )
}
