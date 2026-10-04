// 다시 알려 줌의 감사 (docs/knowledge-experiment/protocol.md 4절). 사람 역할의 자기 보고(told)는 빠뜨리거나 틀릴 수
// 있어, Work가 끝난 뒤 판정 모델이 그 Work에서 사람이 입력한 말만 읽고 "네가 아는 것"의 어느 항목 내용을 담았는지 가른다.
// PM1은 이 감사의 carry 항목 수(carriedToldAudit)를 쓴다.
import path from 'node:path'
import { ask } from './ai.mjs'
import { makeClaudeConfig } from './env.mjs'

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'integer', description: '항목 번호(1부터)' },
          quote: { type: 'string', description: '그 내용을 담은 사람의 말 일부' },
        },
        required: ['item', 'quote'],
      },
    },
  },
  required: ['items'],
}

/**
 * @param {object} o
 * @param {object[]} o.knowledge 그 Work에서 사람이 아는 것
 * @param {object[]} o.turns 그 Work의 차례 기록
 * @param {string} o.model 판정 모델
 * @param {string} o.workDir 임시 폴더
 * @returns {Promise<{ told: number[], costUsd: number } | null>} 입력이 없거나 항목이 없으면 null
 */
export async function auditTold({ knowledge, turns, model, workDir }) {
  const said = turns.flatMap((t) =>
    t.actions
      .filter(
        (a) => (a.do === 'type' || a.do === 'fill') && typeof a.text === 'string' && a.text.trim(),
      )
      .map((a) => a.text.trim()),
  )
  if (!knowledge.length) return null
  if (!said.length) return { told: [], costUsd: 0 }
  const prompt = [
    '사용성 평가에서 한 사람이 AI 에이전트에게 입력한 말의 목록과, 그 사람이 알고 있던 사실의 목록이 있다.',
    '사람의 말이 사실 목록의 어느 항목 내용을 에이전트에게 실제로 전했는지 골라라.',
    '- 항목의 핵심 내용(규칙, 숫자, 조건)을 말로 담았으면 고른다. 말투나 표현이 달라도 된다.',
    '- "네", "맞아요", "그렇게 해 주세요"처럼 내용 없이 동의만 한 것은 고르지 않는다.',
    '- 리포트에 이미 있는 증상이나 파일 이름만 말한 것은 고르지 않는다.',
    '- 확실하지 않으면 고르지 않는다.',
    '',
    '## 사람이 알고 있던 사실',
    ...knowledge.map((k, i) => `${i + 1}. ${k.text}`),
    '',
    '## 사람이 입력한 말 (차례대로)',
    ...said.map((s, i) => `(${i + 1}) ${s}`),
  ].join('\n')
  const r = await ask({
    prompt,
    system: '너는 평가 기록을 꼼꼼히 읽는 채점자다. 주어진 글만 근거로 고른다. 한국어로 답한다.',
    model,
    schema: SCHEMA,
    tools: [],
    cwd: workDir,
    configDir: makeClaudeConfig(path.join(workDir, 'cfg-told')),
    timeoutMs: 180_000,
  })
  const told = [
    ...new Set((r.data.items ?? []).map((x) => x.item).filter((i) => knowledge[i - 1])),
  ].sort((a, b) => a - b)
  return { told, costUsd: r.costUsd }
}
