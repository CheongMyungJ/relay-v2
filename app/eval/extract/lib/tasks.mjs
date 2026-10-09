// 과제 하나의 run 입력(패킷, 기록 목록, 결과 스키마 칸의 키). survey·trace는 손으로 쓴 패킷(packets/<과제>.md)의 자리표시를
// 채우고, integrate·review·summarize는 시나리오의 손으로 쓴 기록(records/<과제>.json)으로 앱과 같은 skills/extract/packets.mjs가
// run 때 패킷을 만든다(AI 결정 109, 127). 그래서 평가에서 잰 패킷의 꼴이 제품의 꼴과 같다.
//
// 기록 파일 = packets.mjs 머리말의 기록(record) + intent(글). integrate는 since(지난 integrate 뒤의 run id, 없으면 모두 새것),
// review는 batch(검토할 주장 id, 차례대로)를 더 둔다.
import fs from 'node:fs'
import path from 'node:path'
import { loadPerspectives } from '../../../../skills/extract/load.mjs'
import {
  packetIds,
  recordListing,
  renderIntegratePacket,
  renderReviewPacket,
  renderSummarizePacket,
} from '../../../../skills/extract/packets.mjs'

/** 앱이 만든 기록을 입력으로 받는 종류(AI 결정 107). 나머지(survey, trace)는 손으로 쓴 패킷이다 */
export const RECORD_KINDS = ['integrate', 'review', 'summarize']

/** 손으로 쓴 패킷의 자리표시({repo}, {base}, {scratch})를 채운다 */
export function renderPacket(template, vars) {
  return template.replace(/\{(repo|base|scratch)\}/g, (_, k) => vars[k])
}

/** 시나리오의 기록 파일(과제의 record) */
export function readRecord(scenarioDir, task) {
  if (!task.record) throw new Error(`${task.id}: ${task.kind} 과제에 record가 없음`)
  return JSON.parse(fs.readFileSync(path.join(scenarioDir, task.record), 'utf8'))
}

/** 기록 파일을 패킷 렌더러의 기록과 과제 입력(intent, since, batch)으로 */
export function splitRecord(file) {
  const { intent, since, batch, ...record } = file
  return { record, intent: intent ?? '', since: since ?? undefined, batch: batch ?? [] }
}

/** review 묶음의 주장(batch 차례) */
export function batchClaims(record, batch) {
  return batch.map((id) => {
    const c = (record.claims ?? []).find((x) => x.id === id)
    if (!c) throw new Error(`review batch의 ${id}가 기록에 없음`)
    return c
  })
}

/** review 결과 스키마의 칸 키: 질문은 answers, 서술은 verdicts(결정 36의 꼴) */
export function reviewMore(items) {
  return {
    answers: items.filter((i) => i.kind !== 'statement').map((i) => i.key),
    verdicts: items.filter((i) => i.kind === 'statement').map((i) => i.key),
  }
}

/**
 * 과제 하나의 run 입력. vars는 하네스가 run마다 쓰는 값이다(레포·기준 커밋·scratch·마감 분, integrate는 기록 목록의 절대 경로)
 * @param {string} scenarioDir
 * @param {{ id: string, kind: string, packet?: string, record?: string }} task
 * @param {{ repo: string, base: string, scratch: string, soft: number, hard: number, listing?: string | null }} vars
 * @returns {{ packet: string, listing: string | null, items: object[] | null, more: object, record: object | null }}
 */
export function renderTask(scenarioDir, task, vars) {
  if (!RECORD_KINDS.includes(task.kind)) {
    const template = fs.readFileSync(path.join(scenarioDir, task.packet), 'utf8')
    return {
      packet: renderPacket(template, vars),
      listing: null,
      items: null,
      more: {},
      record: null,
    }
  }
  const { record, intent, since, batch } = splitRecord(readRecord(scenarioDir, task))
  const common = {
    repo: vars.repo,
    base: vars.base,
    scratch: vars.scratch,
    intent,
    soft: vars.soft,
    hard: vars.hard,
    record,
  }
  if (task.kind === 'integrate') {
    if (!vars.listing) throw new Error(`${task.id}: integrate에는 기록 목록의 경로가 있어야 한다`)
    return {
      packet: renderIntegratePacket({ ...common, listing: vars.listing, since }),
      listing: recordListing(record),
      items: null,
      more: { coverage: loadPerspectives() },
      record,
    }
  }
  if (task.kind === 'review') {
    const { packet, items } = renderReviewPacket({ ...common, claims: batchClaims(record, batch) })
    return { packet, listing: null, items, more: reviewMore(items), record }
  }
  return { packet: renderSummarizePacket(common), listing: null, items: null, more: {}, record }
}

/** 경로가 필요 없는 곳(쪽 이름, 시험)에서 쓰는 자리표시 값 */
export const PLACEHOLDER_VARS = {
  repo: '/run/repo',
  base: '0000000000000000000000000000000000000000',
  scratch: '/run/scratch',
  soft: 15,
  hard: 30,
  listing: '/run/listing.md',
}

/** 결과 스키마에 넣을 칸의 키(coverage, answers, verdicts). survey·trace는 없다. 패킷의 경로와 상관없다 */
export function taskMore(scenarioDir, task) {
  if (!RECORD_KINDS.includes(task.kind)) return {}
  return renderTask(scenarioDir, task, PLACEHOLDER_VARS).more
}

/** 결과가 가리킬 수 있는 전역 ID(규칙 global_refs의 ctx.ids): 패킷에 나온 것, integrate는 기록 목록의 것까지 */
export function knownIds(packet, listing) {
  return packetIds(`${packet}\n${listing ?? ''}`)
}

/** 주장의 전역 ID → 절 이름(규칙 link_shape의 ctx.sections) */
export function claimSections(record) {
  return Object.fromEntries((record?.claims ?? []).map((c) => [c.id, c.section]))
}
