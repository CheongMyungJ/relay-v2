// Work의 [파일] 탭 (D464~D468, D490~D492): worktree의 파일 트리와 연 파일의 탭. 마크다운은 [보기]로 그리고, 글 파일은
// 고쳐 저장한다. 트리는 Work가 더하거나 고치거나 지운 파일을 표시하고, 지운 파일도 그 자리에 보인다.
// 트리는 폴더를 펼칠 때 그 폴더만 읽는다. 탭을 다시 열거나 [새로 고침]을 누르면 펼친 폴더, 바뀐 파일, 연 파일(고치지
// 않았으면)을 다시 읽는다. 다른 탭이나 Work로 옮겨도 고치던 글이 남도록 Work마다 한 번 만들어 숨겨 둔다.
import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react'
import type { FileChangeView, FileEntryView, FileReadResult } from '../../shared/views'
import { call } from './commands'
import {
  afterClose,
  baseName,
  changeMarks,
  parentDirs,
  tabHints,
  withDeleted,
  type ChangeStatus,
} from './fileTree'
import { Markdown } from './Markdown'

type Dir = { entries: FileEntryView[]; more: number } | { error: string }

interface Opened {
  path: string
  file: FileReadResult
  /** 고치는 글. 연 글과 같으면 고치지 않은 것이다 */
  draft: string
  view: 'preview' | 'edit'
  /** 저장하려 했더니 연 뒤 파일이 바뀌었다 */
  conflict: boolean
  error: string | null
}

const join = (dir: string, name: string) => (dir ? `${dir}/${name}` : name)

const isMarkdown = (file: string) => /\.(md|markdown|mdx)$/i.test(file)

const isDirty = (o: Opened | undefined) =>
  o?.file.ok === true && o.file.kind === 'text' && o.draft !== o.file.text

const textOf = (file: FileReadResult) => (file.ok && file.kind === 'text' ? file.text : '')

const STATUS_NAME: Record<ChangeStatus, string> = { A: '더함', M: '고침', D: '지움' }

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ---------- 터미널에서 연 파일 (D491) ----------

/** 아직 [파일] 탭을 그리지 않은 Work에 온 열기. 그 Work의 FilesView가 처음 그려질 때 연다 */
const pendingOpens = new Map<string, string>()
const openers = new Map<string, (rel: string) => void>()

/** Work의 [파일] 탭에서 파일을 연다. 트리에서 그 자리를 펼쳐 보인다 */
export function openInFiles(workKey: string, rel: string): void {
  const open = openers.get(workKey)
  if (open) open(rel)
  else pendingOpens.set(workKey, rel)
}

export function FilesView({ workKey, active }: { workKey: string; active: boolean }) {
  const [dirs, setDirs] = useState<Record<string, Dir>>({})
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(['']))
  const [changes, setChanges] = useState<FileChangeView[]>([])
  const marks = useMemo(() => changeMarks(changes), [changes])
  // 트리를 그릴 때마다(글자를 칠 때마다) 지운 것만 훑도록 미리 거른다
  const deletions = useMemo(() => changes.filter((c) => c.status === 'D'), [changes])
  const [changesError, setChangesError] = useState<string | null>(null)
  const [tabs, setTabs] = useState<Opened[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  // 고친 글이 있어 닫기 확인을 기다리는 탭
  const [closing, setClosing] = useState<string | null>(null)
  // 저장 중인 탭. 다른 탭의 저장은 막지 않는다
  const [saving, setSaving] = useState<ReadonlySet<string>>(() => new Set())
  // 마지막으로 고른 탭의 차례. 늦게 온 앞 열기 응답이 나중에 고른 탭을 가리지 않게 한다
  const openSeq = useRef(0)
  // 마지막으로 부른 바뀐 파일 읽기의 차례. 늦게 온 앞 응답이 새 표시를 덮지 않게 한다
  const changesSeq = useRef(0)
  const treeRef = useRef<HTMLDivElement>(null)

  const opened = tabs.find((t) => t.path === current)

  const loadDir = async (rel: string) => {
    const r = await call(() => window.relay.workFiles(workKey, rel))
    const dir: Dir = r.ok ? { entries: r.entries, more: r.more } : { error: r.error }
    setDirs((m) => ({ ...m, [rel]: dir }))
  }

  const loadChanges = async () => {
    const seq = ++changesSeq.current
    const r = await call(() => window.relay.workFileChanges(workKey))
    if (seq !== changesSeq.current) return
    // 읽지 못하면 낡은 표시를 남기지 않는다
    setChangesError(r.ok ? null : r.error)
    setChanges(r.ok ? r.changes : [])
  }

  const patch = (rel: string, f: (t: Opened) => Opened) =>
    setTabs((ts) => ts.map((t) => (t.path === rel ? f(t) : t)))

  /** 탭을 고른다. 아직 읽고 있는 앞의 열기는 다 읽어도 이 탭을 가리지 않는다 */
  const select = (rel: string | null) => {
    ++openSeq.current
    setCurrent(rel)
  }

  /** 파일을 탭으로 연다. 이미 연 파일이면 그 탭을 고른다 */
  const openFile = async (rel: string) => {
    setClosing(null)
    if (tabs.some((t) => t.path === rel)) {
      select(rel)
      return
    }
    const seq = ++openSeq.current
    const file = await call(() => window.relay.readWorkFile(workKey, rel))
    const tab: Opened = {
      path: rel,
      file,
      draft: textOf(file),
      view: isMarkdown(rel) ? 'preview' : 'edit',
      conflict: false,
      error: null,
    }
    // 읽는 사이에 같은 파일을 또 열었으면 먼저 연 탭을 둔다
    setTabs((ts) => (ts.some((t) => t.path === rel) ? ts : [...ts, tab]))
    if (seq === openSeq.current) setCurrent(rel)
  }

  /** 탭의 파일을 다시 읽는다. 고친 글은 버린다. 읽는 사이에 더 고쳤거나 저장했으면 두고 본다 */
  const reload = async (rel: string) => {
    const before = tabs.find((t) => t.path === rel)
    if (!before) return
    const file = await call(() => window.relay.readWorkFile(workKey, rel))
    patch(rel, (t) =>
      t.draft !== before.draft || t.file !== before.file
        ? t
        : { ...t, file, draft: textOf(file), conflict: false, error: null },
    )
  }

  const closeTab = (rel: string, force: boolean) => {
    if (!force && isDirty(tabs.find((t) => t.path === rel))) {
      select(rel)
      setClosing(rel)
      return
    }
    setClosing(null)
    select(
      afterClose(
        tabs.map((t) => t.path),
        current,
        rel,
      ),
    )
    setTabs((ts) => ts.filter((t) => t.path !== rel))
  }

  /** 펼친 폴더, 바뀐 파일과, 고치지 않은 탭의 파일을 다시 읽는다 */
  const refresh = async () => {
    await Promise.all([
      ...[...expanded].map((rel) => loadDir(rel)),
      loadChanges(),
      ...tabs
        .filter((t) => !isDirty(t))
        .map(async (t) => {
          const again = await call(() => window.relay.readWorkFile(workKey, t.path))
          // 읽는 사이에 고치기 시작했거나 저장했으면(file이 바뀜) 두고 본다
          setTabs((ts) =>
            ts.map((c) =>
              c.path !== t.path || c.file !== t.file || isDirty(c)
                ? c
                : { ...c, file: again, draft: textOf(again) },
            ),
          )
        }),
    ])
  }

  /** 터미널에서 연 파일 (D491): 담은 폴더를 펼치고 탭으로 열어 트리에서 보이게 한다 */
  const reveal = async (rel: string) => {
    const parents = parentDirs(rel)
    const missing = parents.filter((d) => !expanded.has(d))
    setExpanded((s) => new Set([...s, ...parents]))
    await Promise.all([...missing.map((d) => loadDir(d)), openFile(rel)])
    requestAnimationFrame(() => {
      const row = treeRef.current?.querySelector(`[data-path="${CSS.escape(rel)}"]`)
      row?.scrollIntoView({ block: 'nearest' })
    })
  }

  // 탭을 열 때마다 다시 읽는다: 에이전트가 그동안 파일을 고쳤을 수 있다. 그리는 중이 아니라 다음 차례에 읽는다
  const onShown = useEffectEvent(() => void refresh())
  useEffect(() => {
    if (!active) return
    const timer = setTimeout(onShown, 0)
    return () => clearTimeout(timer)
  }, [active])

  // 터미널에서 이 Work의 파일을 열면 받는다. 그리기 전에 온 것은 그린 뒤에 연다
  const onOpen = useEffectEvent((rel: string) => void reveal(rel))
  useEffect(() => {
    const open = (rel: string) => onOpen(rel)
    openers.set(workKey, open)
    const rel = pendingOpens.get(workKey)
    pendingOpens.delete(workKey)
    const timer = rel === undefined ? undefined : setTimeout(() => open(rel), 0)
    return () => {
      clearTimeout(timer)
      if (openers.get(workKey) === open) openers.delete(workKey)
    }
  }, [workKey])

  const toggle = (rel: string, deleted: boolean) => {
    if (expanded.has(rel)) {
      // 접은 폴더 아래에 펼쳐 둔 폴더도 접는다: [새로 고침]이 보이지 않는 폴더를 읽지 않게
      setExpanded((s) => new Set([...s].filter((d) => d !== rel && !d.startsWith(`${rel}/`))))
      return
    }
    setExpanded((s) => new Set(s).add(rel))
    // 지운 폴더는 디스크에 없다. 아래는 바뀐 파일 목록으로 그린다
    if (!deleted) void loadDir(rel)
  }

  const save = async (force: boolean) => {
    // 고친 것이 없으면 쓰지 않는다: 줄 끝이 섞인 파일을 바꾸거나 거짓 충돌을 알리지 않게
    if (!opened || !opened.file.ok || opened.file.kind !== 'text' || !isDirty(opened)) return
    const { path: rel, draft } = opened
    if (saving.has(rel)) return
    const hash = force ? null : opened.file.hash
    setSaving((s) => new Set(s).add(rel))
    const r = await call(() => window.relay.saveWorkFile(workKey, rel, draft, hash))
    setSaving((s) => new Set([...s].filter((p) => p !== rel)))
    if (!r.ok) {
      patch(rel, (t) => ({
        ...t,
        conflict: 'conflict' in r && r.conflict === true,
        error: r.error,
      }))
      return
    }
    patch(rel, (t) => ({
      ...t,
      file: { ok: true, kind: 'text', text: draft, hash: r.hash },
      conflict: false,
      error: null,
    }))
    void loadChanges()
  }

  const renderDir = (rel: string, depth: number, deleted: boolean): ReactNode => {
    const dir = deleted ? { entries: [], more: 0 } : dirs[rel]
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
        {withDeleted(rel, dir.entries, deletions).map((e) => {
          const path = join(rel, e.name)
          const isOpen = e.kind === 'dir' && expanded.has(path)
          // 서브모듈 자리(gitlink)는 폴더지만 그 자체가 바뀐 파일로 온다
          const status =
            e.kind === 'dir'
              ? (marks.dirs.get(path) ?? marks.files.get(path))
              : marks.files.get(path)
          const gone = e.deleted === true
          const openable = e.kind === 'dir' || (e.kind === 'file' && !gone)
          const title =
            e.kind === 'other'
              ? `${path}: worktree 밖을 가리키거나 열 수 없는 항목`
              : gone
                ? `${path}: Work가 지움`
                : status && e.kind === 'file'
                  ? `${path}: Work가 ${STATUS_NAME[status]}`
                  : status
                    ? `${path}: 아래에 바뀐 파일이 있음`
                    : path
          const activate = () => {
            if (e.kind === 'dir') toggle(path, gone)
            else if (openable) void openFile(path)
          }
          return (
            <div key={e.name} role="none">
              <div
                role="treeitem"
                aria-label={e.name}
                tabIndex={openable ? 0 : -1}
                aria-expanded={e.kind === 'dir' ? isOpen : undefined}
                aria-selected={current === path}
                aria-disabled={!openable || undefined}
                data-path={path}
                className={`file-row ${e.kind}${gone ? ' deleted' : ''}${status ? ` changed-${status}` : ''}`}
                style={{ paddingLeft: 8 + depth * 14 }}
                title={title}
                onClick={activate}
                onKeyDown={(k) => {
                  if (k.key !== 'Enter' && k.key !== ' ') return
                  k.preventDefault()
                  activate()
                }}
              >
                <span className="twisty" aria-hidden="true">
                  {e.kind === 'dir' ? (isOpen ? '▾' : '▸') : ''}
                </span>
                <span className="file-name">{e.name}</span>
                {status ? (
                  <span
                    className="file-mark"
                    aria-label={e.kind === 'file' ? STATUS_NAME[status] : '바뀐 파일 있음'}
                  >
                    {e.kind === 'file' ? status : '●'}
                  </span>
                ) : null}
              </div>
              {isOpen ? <div role="group">{renderDir(path, depth + 1, gone)}</div> : null}
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
  const hints = tabHints(tabs.map((t) => t.path))

  return (
    <div className="file-browser" hidden={!active}>
      <div className="file-tree" ref={treeRef}>
        <div className="file-tree-head">
          <span>
            worktree
            {changes.length > 0 ? (
              <span
                className="file-count"
                title="Work가 기준 커밋 뒤에 더하거나 고치거나 지운 파일"
              >
                {' '}
                · 바뀐 파일 {changes.length}
              </span>
            ) : null}
          </span>
          <button
            className="link"
            onClick={() => void refresh()}
            title="펼친 폴더, 바뀐 파일, 연 파일을 다시 읽기"
          >
            새로 고침
          </button>
        </div>
        {changesError ? (
          <div className="file-row error">바뀐 파일을 읽지 못함: {changesError}</div>
        ) : null}
        <div role="tree" aria-label="파일">
          {renderDir('', 0, false)}
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
        {tabs.length > 0 ? (
          <div className="file-tabs" role="tablist" aria-label="연 파일">
            {tabs.map((t, i) => {
              const status = marks.files.get(t.path)
              return (
                <div
                  key={t.path}
                  className={`file-tab${t.path === current ? ' active' : ''}${status ? ` changed-${status}` : ''}`}
                  title={t.path}
                  onAuxClick={(e) => {
                    // 가운데 단추로 닫는다
                    if (e.button !== 1) return
                    e.preventDefault()
                    closeTab(t.path, false)
                  }}
                >
                  <button
                    role="tab"
                    aria-selected={t.path === current}
                    className="file-tab-name"
                    onClick={() => {
                      setClosing(null)
                      select(t.path)
                    }}
                  >
                    {baseName(t.path)}
                    {hints[i] ? <span className="file-tab-hint">{hints[i]}</span> : null}
                  </button>
                  {isDirty(t) ? (
                    <span className="file-tab-dirty" aria-label="저장하지 않음">
                      ●
                    </span>
                  ) : null}
                  <button
                    className="file-tab-close"
                    aria-label={`${t.path} 닫기`}
                    title="닫기"
                    onClick={() => closeTab(t.path, false)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}
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
                    onClick={() => patch(opened.path, (t) => ({ ...t, view: id }))}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
            {text ? (
              <button
                className="primary"
                disabled={!dirty || saving.has(opened.path)}
                onClick={() => void save(false)}
              >
                저장
              </button>
            ) : null}
          </div>
        ) : null}
        {opened && closing === opened.path ? (
          <div className="file-banner" role="alert">
            <span>저장하지 않은 변경이 있습니다.</span>
            <button onClick={() => closeTab(opened.path, true)}>버리고 닫기</button>
            <button onClick={() => setClosing(null)}>취소</button>
          </div>
        ) : opened?.conflict ? (
          <div className="file-banner" role="alert">
            <span>연 뒤에 파일이 바뀌었습니다 (에이전트가 고쳤을 수 있음).</span>
            <button onClick={() => void reload(opened.path)}>다시 읽기 (내 변경 버림)</button>
            <button className="danger" onClick={() => void save(true)}>
              덮어쓰기
            </button>
          </div>
        ) : opened?.error ? (
          <div className="file-banner error" role="alert">
            {opened.error}
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
              key={opened.path}
              className="file-edit"
              aria-label={`${opened.path} 편집`}
              spellCheck={false}
              value={opened.draft}
              onChange={(e) => {
                const draft = e.target.value
                patch(opened.path, (t) => ({ ...t, draft }))
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
