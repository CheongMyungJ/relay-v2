// 3단 레이아웃의 빈 화면 (D79): 사이드바 / 터미널 탭과 액션 바 / 오른쪽 패널.
export function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="placeholder">프로젝트와 Work 목록</div>
      </aside>
      <main className="center">
        <div className="tabs" />
        <div className="terminal">
          <div className="placeholder">터미널</div>
        </div>
        <div className="action-bar" />
      </main>
      <aside className="panel">
        <div className="placeholder">handoff 상태와 산출물</div>
      </aside>
    </div>
  )
}
