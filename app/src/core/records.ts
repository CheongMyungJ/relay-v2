// 앱이 쓰는 파일의 모양과 id (5.1, 5.3, 5.4). 파일을 읽고 쓰는 것은 adapters/store가 한다.
import type { Decision, NodeName, Size } from '../shared/contracts'
import { normalizeText, parseFrontMatter } from './validate'

// ---------- 시각 ----------

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** 현지 시각과 오프셋을 담은 ISO 8601 (예: 2026-09-25T14:32:10+09:00). events.jsonl과 work.json에 쓴다 (5.5) */
export function localIso(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

const ISO_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

function isoParts(at: string): string[] {
  const m = ISO_PARTS.exec(at)
  if (!m) throw new Error(`시각 형식이 아님: ${at}`)
  return m.slice(1)
}

/** 2026-09-25T14:32:10+09:00 → 2026-09-25 14:32. 적힌 현지 시각을 그대로 쓴다 */
export function localMinute(at: string): string {
  const [y, mo, d, h, mi] = isoParts(at)
  return `${y}-${mo}-${d} ${h}:${mi}`
}

// ---------- id (5.1) ----------

/** work-id: w-YYYYMMDD-NNN. 날짜는 Work를 만든 현지 날짜다 (시나리오 1) */
export function workId(at: string, seq: number): string {
  const [y, mo, d] = isoParts(at)
  return `w-${y}${mo}${d}-${pad(seq, 3)}`
}

/** 이 날짜의 다음 work-id. taken은 이미 쓰인 id다(Work 디렉터리, relay/<work-id> 브랜치) */
export function nextWorkId(at: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  for (let seq = 1; ; seq++) {
    const id = workId(at, seq)
    if (!used.has(id)) return id
  }
}

/**
 * 권한 규칙의 경로는 gitignore 패턴이고, 설정 파일에 직접 쓴 규칙은 이스케이프되지 않는다
 * (Claude Code 문서 permissions). 이 문자가 경로에 있으면 deny 규칙이 맞지 않는다.
 */
const PATTERN_CHARS = /[[\]*?\\]/g

/**
 * project-id: <레포 폴더 이름>-<레포 절대 경로 해시 앞 6자> (5.1).
 * 폴더 이름의 패턴 문자는 _로 바꾼다. 해시는 원래 경로로 계산하므로 겹치지 않는다 (D111).
 */
export function projectId(folderName: string, pathHash: string): string {
  return `${folderName.replace(PATTERN_CHARS, '_')}-${pathHash.slice(0, 6)}`
}

// ---------- decisions.md (5.4) ----------

/** 승인 방식. 자동 승인은 M7에서 쓴다 */
export type ApprovalBy = 'human' | 'auto'

const APPROVAL_LABEL: Record<ApprovalBy, string> = { human: '사람 승인', auto: '자동 승인' }
const DECIDER_LABEL: Record<Decision['by'], string> = { human: '[사람]', ai: '[AI]' }

/** 결정을 읽지 못했을 때 남기는 줄 ([오류 무시하고 승인], D112) */
export const DECISIONS_UNREADABLE = 'handoff 머리글 오류로 결정을 읽지 못함'

export interface DecisionsEntry {
  taskId: string
  node: NodeName
  /** 승인 시각 (ISO 8601) */
  at: string
  by: ApprovalBy
  /** handoff의 decisions. null이면 머리글을 읽지 못했다 */
  decisions: readonly Decision[] | null
}

const oneLine = (s: string) => s.replace(/\s*\n\s*/g, ' ').trim()

/**
 * decisions.md에 더할 한 덩어리 (5.4).
 * 머리 줄은 task id, 노드, 승인 시각, 승인 방식이고, 항목은 `[사람]`/`[AI]` 뒤에 `what — why`다.
 */
export function decisionsBlock(e: DecisionsEntry): string {
  const head = `## ${e.taskId} ${e.node} — ${localMinute(e.at)} (${APPROVAL_LABEL[e.by]})`
  const body =
    e.decisions === null
      ? [DECISIONS_UNREADABLE]
      : e.decisions.length === 0
        ? ['없음']
        : e.decisions.map((d) => `- ${DECIDER_LABEL[d.by]} ${oneLine(d.what)} — ${oneLine(d.why)}`)
  return [head, ...body].join('\n') + '\n'
}

/** 기존 decisions.md 뒤에 덩어리를 빈 줄 하나로 띄워 붙인다 */
export function appendBlock(existing: string, block: string): string {
  const before = normalizeText(existing).trimEnd()
  return before ? `${before}\n\n${block}` : block
}

// ---------- intent.md (5.3) ----------

/** intent.md의 형식 버전 (5.3) */
export const INTENT_SCHEMA_VERSION = 1

/**
 * [의도 승인] 때 intent 초안으로 intent.md 확정본을 만든다 (5.3, D88).
 * 머리글은 앱이 붙이는 schema_version, version과 초안의 type, 사람이 고른 size다.
 * 초안의 다른 머리글 필드는 앱이 무시하므로 넣지 않는다 (D85). 본문은 초안 그대로다.
 */
export function confirmedIntent(draft: string, c: { version: number; size: Size }): string {
  const fm = parseFrontMatter(draft)
  if (!fm.ok) throw new Error(`intent 초안의 머리글을 읽을 수 없음: ${fm.error}`)
  const type = fm.data['type']
  if (typeof type !== 'string' || !type) throw new Error('intent 초안에 type이 없음')
  const header = [
    '---',
    `schema_version: ${INTENT_SCHEMA_VERSION}`,
    `version: ${c.version}`,
    `type: ${type}`,
    `size: ${c.size}`,
    '---',
  ]
  const body = fm.body.replace(/^\n+/, '').trimEnd()
  return `${[...header, body].join('\n')}\n`
}
