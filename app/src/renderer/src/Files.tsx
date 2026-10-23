// Work의 [파일] 탭 (D464~D468): worktree의 파일 트리와 연 파일. 마크다운은 [보기]로 그리고, 글 파일은 고쳐 저장한다.
// 트리는 폴더를 펼칠 때 그 폴더만 읽는다. 탭을 다시 열거나 [새로 고침]을 누르면 펼친 폴더와 연 파일(고치지 않았으면)을
// 다시 읽는다. 다른 탭이나 Work로 옮겨도 고치던 글이 남도록 Work마다 한 번 만들어 숨겨 둔다.
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'
import type { FileEntryView, FileReadResult } from '../../shared/views'
import { call } from './commands'
import { Markdown } from './Markdown'

type Dir = { entries: FileEntryView[]; more: number } | { error: string }

interface Opened {
  path: string
  file: FileReadResult
  /** 고치는 글. 연 글과 같으면 고치지 않은 것이다 */
  draft: string
  view: 'preview' | 'edit'
}

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

const isMarkdown = (file: string) => /\.(md|markdown|mdx)$/i.test(file)

const isDirty = (o: Opened | null) =>
  o?.file.ok === true && o.file.kind === 'text' && o.draft !== o.file.text

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FilesView({ workKey, active }: { workKey: string; active: boolean }) {
  const [dirs, setDirs] = useState<Record<string, Dir>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['']))
  const [opened, setOpened] = useState<Opened | null>(null)
  // 고친 글이 있어 확인을 기다리는, 다음에 열 파일
  const [pending, setPending] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 마지막으로 연 파일의 차례. 늦게 온 앞 응답이 나중에 고른 파일을 덮지 않게 한다
  const openSeq = useRef(0)

  const loadDir = async (rel: string) => {
    const r = await call(() => window.relay.workFiles(workKey, rel))
    const dir: Dir = r.ok ? { entries: r.entries, more: r.more } : { error: r.error }
    setDirs((m) => ({ ...m, [rel]: dir }))
  }

  const openFile = async (rel: string) => {
    const seq = ++openSeq.current
    const file = await call(() => window.relay.readWorkFile(workKey, rel))
    if (seq !== openSeq.current) return
    setPending(null)
    setConflict(false)
    setError(null)
    setOpened({
      path: rel,
      file,
      draft: file.ok && file.kind === 'text' ? file.text : '',
      view: isMarkdown(rel) ? 'preview' : 'edit',
    })
  }

  /** 펼친 폴더와, 고치지 않았으면 연 파일을 다시 읽는다 */
  const refresh = async () => {
    const file = opened
    await Promise.all([...expanded].map((rel) => loadDir(rel)))
    if (!file || isDirty(file)) return
    const again = await call(() => window.relay.readWorkFile(workKey, file.path))
    // 읽는 사이에 다른 파일을 열었거나, 고치기 시작했거나, 저장했으면(file이 바뀜) 두고 본다
    setOpened((cur) =>
      cur?.path !== file.path || cur.file !== file.file || isDirty(cur)
        ? cur
        : { ...cur, file: again, draft: again.ok && again.kind === 'text' ? again.text : '' },
    )
  }

  // 탭을 열 때마다 다시 읽는다: 에이전트가 그동안 파일을 고쳤을 수 있다. 그리는 중이 아니라 다음 차례에 읽는다
  const onShown = useEffectEvent(() => void refresh())
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(onShown, 0)
    return () => clearTimeout(timer)
  }, [active])

  const toggle = (rel: string) => {
    if (expanded.has(rel)) {
      // 접은 폴더 아래에 펼쳐 둔 폴더도 접는다: [새로 고침]이 보이지 않는 폴더를 읽지 않게
      setExpanded((s) => new Set([...s].filter((d) => d !== rel && !d.startsWith(`${rel}/`))))
      return
    }
    setExpanded((s) => new Set(s).add(rel))
    void loadDir(rel)
  }

  const pick = (rel: string) => {
    if (opened?.path === rel) return
    if (isDirty(opened)) setPending(rel)
    else void openFile(rel)
  }

  const save = async (force: boolean) => {
    // 고친 것이 없으면 쓰지 않는다: 줄 끝이 섞인 파일을 바꾸거나 거짓 충돌을 알리지 않게
    if (!opened || !opened.file.ok || opened.file.kind !== 'text' || busy || !isDirty(opened))
      return
    const { path: rel, draft } = opened
    const hash = force ? null : opened.file.hash
    setBusy(true)
    const r = await call(() => window.relay.saveWorkFile(workKey, rel, draft, hash))
    setBusy(false)
    if (!r.ok) {
      setConflict('conflict' in r && r.conflict === true)
      setError(r.error)
      return
    }
    setConflict(false)
    setError(null)
    setOpened((cur) =>
      cur?.path === rel
        ? { ...cur, file: { ok: true, kind: 'text', text: draft, hash: r.hash } }
        : cur,
    )
  }

  const renderDir = (rel: string, depth: number): ReactNode => {
    const dir = dirs[rel]
    if (!dir) return null
    if ('error' in dir) {
      return (
        <div className="file-row error" style={{ paddingLeft: 8 + depth * 14 }}>
          {dir.error}
        </div>
      )
    }
    return (
      <>
        {dir.entries.map((e) => {
          const path = join(rel, e.name)
          const isOpen = e.kind === 'dir' && expanded.has(path)
          return (
            <div key={e.name} role="none">
              <div
                role="treeitem"
                aria-label={e.name}
                tabIndex={e.kind === 'other' ? -1 : 0}
                aria-expanded={e.kind === 'dir' ? isOpen : undefined}
                aria-selected={opened?.path === path}
                aria-disabled={e.kind === 'other' || undefined}
                className={`file-row ${e.kind}`}
                style={{ paddingLeft: 8 + depth * 14 }}
                title={
                  e.kind === 'other' ? `${path}: worktree 밖을 가리키거나 열 수 없는 항목` : path
                }
                onClick={() => {
                  if (e.kind === 'dir') toggle(path)
                  else if (e.kind === 'file') pick(path)
                }}
                onKeyDown={(k) => {
                  if (k.key !== 'Enter' && k.key !== ' ') return
                  k.preventDefault()
                  if (e.kind === 'dir') toggle(path)
                  else if (e.kind === 'file') pick(path)
                }}
              >
                <span className="twisty" aria-hidden="true">
                  {e.kind === 'dir' ? (isOpen ? '▾' : '▸') : ''}
                </span>
                <span className="file-name">{e.name}</span>
              </div>
              {isOpen ? <div role="group">{renderDir(path, depth + 1)}</div> : null}
            </div>
          )
        })}
        {dir.more > 0 ? (
          <div className="file-row dim" style={{ paddingLeft: 8 + depth * 14 }}>
            … {dir.more}개 더 있음
          </div>
        ) : null}
      </>
    )
  }

  const dirty = isDirty(opened)
  const file = opened?.file
  const text = file?.ok === true && file.kind === 'text'

  return (
    <div className="file-browser" hidden={!active}>
      <div className="file-tree">
        <div className="file-tree-head">
          <span>worktree</span>
          <button
            className="link"
            onClick={() => void refresh()}
            title="펼친 폴더와 연 파일을 다시 읽기"
          >
            새로 고침
          </button>
        </div>
        <div role="tree" aria-label="파일">
          {renderDir('', 0)}
        </div>
      </div>
      <div
        className="file-pane"
        onKeyDown={(e) => {
          // Ctrl+S (macOS Cmd+S)로 저장한다. 한글 자판에서는 key가 'ㄴ'이라 자리(code)로도 본다
          const s = e.code === 'KeyS' || e.key.toLowerCase() === 's'
          if ((e.ctrlKey || e.metaKey) && !e.altKey && s) {
            e.preventDefault()
            void save(false)
          }
        }}
      >
        {opened ? (
          <div className="file-head">
            <span className="file-path" title={opened.path}>
              {opened.path}
            </span>
            {dirty ? <span className="file-dirty">저장하지 않음</span> : null}
            {text && isMarkdown(opened.path) ? (
              <div className="file-mode" role="tablist" aria-label="보기 방식">
                {(
                  [
                    ['preview', '보기'],
                    ['edit', '편집'],
                  ] as const
                ).map(([id, name]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={opened.view === id}
                    className={opened.view === id ? 'active' : ''}
                    onClick={() => setOpened((cur) => (cur ? { ...cur, view: id } : cur))}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            {text ? (
              <button
                className="primary"
                disabled={!dirty || busy}
                onClick={() => void save(false)}
              >
                저장
              </button>
            ) : null}
          </div>
        ) : null}
        {pending ? (
          <div className="file-banner" role="alert">
            <span>저장하지 않은 변경이 있습니다.</span>
            <button onClick={() => void openFile(pending)}>버리고 열기</button>
            <button onClick={() => setPending(null)}>취소</button>
          </div>
        ) : conflict && opened ? (
          <div className="file-banner" role="alert">
            <span>연 뒤에 파일이 바뀌었습니다 (에이전트가 고쳤을 수 있음).</span>
            <button onClick={() => void openFile(opened.path)}>다시 읽기 (내 변경 버림)</button>
            <button className="danger" onClick={() => void save(true)}>
              덮어쓰기
            </button>
          </div>
        ) : error ? (
          <div className="file-banner error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="file-body">
          {!opened || !file ? (
            <div className="file-note">왼쪽에서 파일을 고르세요</div>
          ) : !file.ok ? (
            <div className="file-note error">{file.error}</div>
          ) : file.kind === 'binary' ? (
            <div className="file-note">글 파일이 아니라 열지 않습니다 ({sizeLabel(file.size)})</div>
          ) : file.kind === 'large' ? (
            <div className="file-note">1 MB가 넘어 열지 않습니다 ({sizeLabel(file.size)})</div>
          ) : opened.view === 'preview' ? (
            <div className="file-preview">
              <Markdown text={opened.draft} />
            </div>
          ) : (
            <textarea
              className="file-edit"
              aria-label={`${opened.path} 편집`}
              spellCheck={false}
              value={opened.draft}
              onChange={(e) => {
                const draft = e.target.value
                setOpened((cur) => (cur ? { ...cur, draft } : cur))
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
