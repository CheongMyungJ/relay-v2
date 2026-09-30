// 진행 표시 (D216): 작업 중인 task의 경과 시간과 마지막 동작. 시각은 main이 보내고 경과 시간은 렌더러가 센다.
// 시계만 따라 바뀌는 글자는 data-tick으로 둔다: 평가 도구는 화면이 멈췄는지 볼 때 이 글자를 뺀다 (docs/eval.md).
import { useEffect, useState } from 'react'
import type { ActivityView } from '../../shared/views'

/** 경과 시간: "8초", "1분 12초", "1시간 3분" */
function duration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `${sec}초`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 ${sec % 60}초`
  return `${Math.floor(min / 60)}시간 ${min % 60}분`
}

/** 끝난 뒤 지난 시간: "방금", "8초 전" */
function ago(ms: number): string {
  return ms < 1000 ? '방금' : `${duration(ms)} 전`
}

/**
 * "세션을 띄우는 중 12초", "1분 12초 · Bash(npm test) 실행 중 8초", "1분 12초 · 마지막 동작 Edit(src/avg.js) 8초 전".
 * 터미널은 읽지 않고 훅으로만 안다 (D2)
 */
export function Activity({ activity }: { activity: ActivityView }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const tool = activity.tool
  return (
    <span className="activity">
      {activity.turn ? null : '세션을 띄우는 중 '}
      <span data-tick="">{duration(now - activity.since)}</span>
      {tool && tool.endedAt === null ? (
        <>
          {` · ${tool.label} 실행 중 `}
          <span data-tick="">{duration(now - tool.startedAt)}</span>
        </>
      ) : tool && tool.endedAt !== null ? (
        <>
          {` · 마지막 동작 ${tool.label} `}
          <span data-tick="">{ago(now - tool.endedAt)}</span>
        </>
      ) : null}
    </span>
  )
}
