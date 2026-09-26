// 산출물을 마크다운으로 보인다 (D83의 [산출물] 탭). 에이전트가 쓴 파일이라 HTML은 글자로 둔다.
// 링크는 창을 옮기지 않는다(main이 이동을 막는다).
import MarkdownIt from 'markdown-it'
import { useMemo } from 'react'

const md = new MarkdownIt({ html: false, linkify: false, breaks: false })

export function Markdown({ text }: { text: string }) {
  const html = useMemo(() => md.render(text), [text])
  return (
    <div
      className="markdown"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) e.preventDefault()
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** 변경(diff)을 줄마다 색으로 보인다. 줄이 너무 많으면 앞부분만 그린다 */
export function Diff({ text }: { text: string }) {
  const lines = useMemo(() => text.split('\n'), [text])
  if (!text.trim()) return <div className="empty-note">변경 없음</div>
  const shown = lines.slice(0, 5000)
  return (
    <pre className="diff">
      {shown.map((line, i) => (
        <div key={i} className={lineClass(line)}>
          {line || ' '}
        </div>
      ))}
      {lines.length > shown.length ? (
        <div className="diff-more">… {lines.length - shown.length}줄 더 있음</div>
      ) : null}
    </pre>
  )
}

function lineClass(line: string): string {
  if (line.startsWith('+++') || line.startsWith('---')) return 'd-file'
  if (line.startsWith('diff ') || line.startsWith('index ')) return 'd-file'
  if (line.startsWith('@@')) return 'd-hunk'
  if (line.startsWith('+')) return 'd-add'
  if (line.startsWith('-')) return 'd-del'
  return 'd-ctx'
}
