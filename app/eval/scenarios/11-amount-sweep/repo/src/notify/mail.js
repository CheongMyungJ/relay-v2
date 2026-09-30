import { label } from '../i18n/labels.js'

// 정기 리포트를 메일로 보낼 때의 본문. 보내기는 운영 쪽 스크립트가 한다
const MAX_ATTACH_BYTES = 5 * 1024 * 1024

export function subjectFor(report, period) {
  const name = label(report)
  if (!period) return `[원장] ${name}`
  if (period.quarter) return `[원장] ${period.year}년 ${period.quarter}분기 ${name}`
  if (period.from && period.to) return `[원장] ${name} (${period.from} ~ ${period.to})`
  return `[원장] ${name}`
}

export function composeMail({ to, report, period, body, attachments = [] }) {
  if (!to || !to.length) throw new Error('받는 사람이 없음')
  const list = Array.isArray(to) ? to : [to]
  for (const addr of list) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) throw new Error(`메일 주소가 이상함: ${addr}`)
  }
  let size = 0
  for (const a of attachments) size += Buffer.byteLength(a.content ?? '')
  if (size > MAX_ATTACH_BYTES) throw new Error(`첨부가 너무 큼: ${size} bytes`)
  return {
    to: list,
    subject: subjectFor(report, period),
    text: [body.trimEnd(), '', '-- ', '이 메일은 원장 리포트 일정에 따라 자동으로 보냈습니다.'].join('\n'),
    attachments: attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType ?? guessType(a.filename),
      content: a.content,
    })),
  }
}

function guessType(filename) {
  if (/\.csv$/i.test(filename)) return 'text/csv; charset=utf-8'
  if (/\.json$/i.test(filename)) return 'application/json'
  return 'text/plain; charset=utf-8'
}
