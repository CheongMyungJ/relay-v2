// 로그를 내보낼 곳

import { formatJson, formatLine } from './format.js'

// 시험과 디버깅용: 기록을 메모리에 모은다
export function memorySink(limit = 1000) {
  const records = []
  const sink = (record) => {
    records.push(record)
    if (records.length > limit) records.shift()
  }
  sink.records = records
  sink.lines = () => records.map(formatLine)
  sink.clear = () => {
    records.length = 0
  }
  return sink
}

export function consoleSink(record) {
  const line = formatLine(record)
  if (record.level === 'error' || record.level === 'warn') console.error(line)
  else console.log(line)
}

export function nullSink() {}

// 여러 곳에 함께 내보낸다
export function teeSink(...sinks) {
  return (record) => {
    for (const s of sinks) s(record)
  }
}

// JSON 줄로 write(line)에 넘긴다(파일, 소켓 등)
export function jsonSink(write) {
  return (record) => write(formatJson(record) + '\n')
}
