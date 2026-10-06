// 숨긴 쟁점의 판정 (relay I111). 설계 시나리오(type spec)는 숨긴 시험 파일 대신 쟁점 목록을 둔다:
// checks의 `{ "name", "issue": "<쟁점과 사람이 원하는 답>" }`. 판정 모델이 최종 문서(기준과의 diff, 지식 파일 제외)와
// 에이전트 세션 기록에서 뽑은 대화를 읽고 쟁점마다 asked(사람에게 물었거나 사람이 알려 줌)와 reflected(문서에 사람이
// 원하는 답이 맞게 적힘)를 답한다. 통과 규칙은 여기서 정한다: reflected이고 asked여야 통과다. 지금 코드에서 확인할
// 쟁점은 `"ask": false`로 두어 reflected만 본다.
// 입력 조립(dialogueFromTranscript, issuePrompt)과 결과 읽기(issueChecks)는 app/eval/test/가 지킨다.
import fs from 'node:fs'
import path from 'node:path'
import { ask } from './ai.mjs'
import { makeClaudeConfig } from './env.mjs'
import { clip } from './util.mjs'

/** 숨긴 쟁점인가: 시험 파일 대신 issue 글이 있다 */
export const isIssue = (c) => typeof c?.issue === 'string'

export const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: '쟁점 번호(1부터)' },
          asked: { type: 'boolean' },
          reflected: { type: 'boolean' },
          evidence: { type: 'string', description: '대화나 문서의 짧은 인용' },
        },
        required: ['n', 'asked', 'reflected', 'evidence'],
      },
    },
  },
  required: ['results'],
}

/** tool_result의 글. 문자열이거나 text 블록의 배열이다 */
function resultText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => c?.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n')
}

/** AskUserQuestion의 입력을 한 덩이 글로: 질문마다 질문과 선택지 이름 */
function questionText(input) {
  const qs = Array.isArray(input?.questions) ? input.questions : []
  return qs
    .map((q) => {
      const opts = (Array.isArray(q?.options) ? q.options : []).map((o) => o?.label).filter(Boolean)
      return `${q?.question ?? ''}${opts.length ? ` [선택지: ${opts.join(' / ')}]` : ''}`
    })
    .join('\n')
}

/**
 * claude 세션 기록(JSONL 줄 목록, 이미 읽은 객체)에서 대화를 차례로 뽑는다. 서브에이전트(isSidechain)와 메타 줄은
 * 뺀다. 에이전트: 글 블록, AskUserQuestion의 질문. 사람: 문자열로 입력한 말, AskUserQuestion의 답(tool_result).
 * @returns {{ at: string, who: 'agent' | 'human', kind: 'text' | 'question' | 'answer', text: string }[]}
 */
export function dialogueFromTranscript(entries) {
  const out = []
  const questions = new Set()
  for (const e of entries) {
    if (!e || e.isSidechain || e.isMeta) continue
    const at = String(e.timestamp ?? '')
    const content = e.message?.content
    if (e.type === 'assistant' && Array.isArray(content)) {
      for (const c of content) {
        if (c?.type === 'text' && c.text?.trim()) {
          out.push({ at, who: 'agent', kind: 'text', text: c.text.trim() })
        } else if (c?.type === 'tool_use' && c.name === 'AskUserQuestion') {
          if (questions.has(c.id)) continue
          questions.add(c.id)
          out.push({ at, who: 'agent', kind: 'question', text: questionText(c.input) })
        }
      }
    } else if (e.type === 'user') {
      if (typeof content === 'string' && content.trim()) {
        out.push({ at, who: 'human', kind: 'text', text: content.trim() })
      } else if (Array.isArray(content)) {
        for (const c of content) {
          if (c?.type === 'text' && c.text?.trim()) {
            out.push({ at, who: 'human', kind: 'text', text: c.text.trim() })
          } else if (c?.type === 'tool_result' && questions.has(c.tool_use_id)) {
            out.push({ at, who: 'human', kind: 'answer', text: resultText(c.content).trim() })
          }
        }
      }
    }
  }
  return out
}

/** 에이전트 설정 폴더(CLAUDE_CONFIG_DIR)의 모든 세션 기록에서 대화를 뽑아 시각 차례로 둔다. 서브에이전트 폴더는 뺀다 */
export function readDialogue(configDir) {
  const dir = path.join(configDir, 'projects')
  if (!fs.existsSync(dir)) return []
  const all = []
  for (const project of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!project.isDirectory()) continue
    for (const f of fs.readdirSync(path.join(dir, project.name))) {
      if (!f.endsWith('.jsonl')) continue
      const entries = fs
        .readFileSync(path.join(dir, project.name, f), 'utf8')
        .split('\n')
        .flatMap((l) => {
          try {
            return l.trim() ? [JSON.parse(l)] : []
          } catch {
            return []
          }
        })
      all.push(...dialogueFromTranscript(entries))
    }
  }
  return all.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
}

const WHO = { agent: '에이전트', human: '사람' }
const KIND = { text: '', question: ' (질문)', answer: ' (답)' }

/** 판정 모델에 줄 글. 대화는 줄마다 2,000자, 모두 40,000자로 자른다(뒤쪽을 남긴다) */
export function issuePrompt({ issues, diff, dialogue }) {
  const lines = dialogue.map((d) => `[${WHO[d.who]}${KIND[d.kind]}] ${clip(d.text, 2000)}`)
  let talk = lines.join('\n')
  if (talk.length > 40_000) talk = `(앞부분 생략)\n${talk.slice(-40_000)}`
  return [
    '설계 평가에서 AI 에이전트가 사람과 대화하며 설계 문서를 썼다. 아래 숨긴 쟁점마다 둘을 판정하라.',
    '- asked: 대화에서 에이전트가 이 쟁점을 사람에게 물었거나(질문, 선택지, 확인 요청), 사람이 이 쟁점의 답을 알려 줬다. 에이전트가 묻지 않고 혼자 정했으면 false다.',
    '- reflected: 최종 문서에 사람이 원하는 답이 맞게 적혀 있다. 반대로 적었거나, 빠졌거나, "정하지 않은 것"으로만 남겼으면 false다.',
    '- evidence: 판정의 근거. 대화나 문서의 짧은 인용.',
    '쟁점에 적힌 사람이 원하는 답을 기준으로 본다. 말이 달라도 뜻이 같으면 맞다. 확실하지 않으면 false다.',
    '',
    '## 숨긴 쟁점',
    ...issues.map((c, i) => `${i + 1}. ${c.name} — ${c.issue}`),
    '',
    '## 최종 문서 (기준과의 diff, 지식 파일 제외)',
    '```diff',
    clip(diff || '(변경 없음)', 30_000),
    '```',
    '',
    '## 대화 기록 (차례대로)',
    talk || '(없음)',
  ].join('\n')
}

/**
 * 판정 결과를 checks로 읽는다. 쟁점마다 결과가 없으면 실패다. 통과: reflected이고, ask가 false가 아니면 asked도 참
 * @param {object[]} defs 숨긴 쟁점(scenario.json의 checks 가운데 issue가 있는 것)
 * @param {{ results?: object[] }} data 판정 모델의 구조화된 출력
 */
export function issueChecks(defs, data) {
  const results = Array.isArray(data?.results) ? data.results : []
  return defs.map((c, i) => {
    const r = results.find((x) => x?.n === i + 1)
    const asked = r?.asked === true
    const reflected = r?.reflected === true
    return {
      name: c.name,
      issue: true,
      pass: !!r && reflected && (c.ask === false || asked),
      asked,
      reflected,
      output: r ? String(r.evidence ?? '') : '판정 결과 없음',
    }
  })
}

/**
 * 숨긴 쟁점을 판정 모델로 가른다. 쟁점이 없으면 부르지 않는다
 * @returns {Promise<{ checks: object[], costUsd: number }>}
 */
export async function judgeIssues({ issues, diff, dialogue, model, workDir }) {
  if (!issues.length) return { checks: [], costUsd: 0 }
  fs.mkdirSync(workDir, { recursive: true })
  const r = await ask({
    prompt: issuePrompt({ issues, diff, dialogue }),
    system:
      '너는 설계 평가의 공정한 채점자다. 주어진 문서와 대화만 근거로 판정하고, 도구 이름에 끌리지 않는다. 한국어로 답한다.',
    model,
    schema: ISSUE_SCHEMA,
    tools: [],
    cwd: workDir,
    configDir: makeClaudeConfig(path.join(workDir, 'cfg-issue')),
    timeoutMs: 300_000,
  })
  return { checks: issueChecks(issues, r.data), costUsd: r.costUsd }
}
