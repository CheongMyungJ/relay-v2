// 사람 역할. claude -p 세션 하나가 한 실행 내내 같은 사람을 연기한다(--session-id로 시작하고 --resume으로 잇는다).
// 매 차례 화면을 받고 행동을 JSON으로 고른다. 끝나면 같은 세션에서 설문에 답한다.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { ask } from './ai.mjs'

const GUIDES = path.resolve(import.meta.dirname, '../guides')

const COMMON_ACTIONS = ['type', 'key', 'inspect_diff', 'wait', 'done', 'give_up']
const ARM_ACTIONS = {
  relay: ['click', 'fill', 'select', 'scroll', ...COMMON_ACTIONS],
  cli: ['new_terminal', 'switch', ...COMMON_ACTIONS],
}

function turnSchema(kind) {
  return {
    type: 'object',
    properties: {
      thought: { type: 'string', description: '지금 상황에 대한 짧은 생각 (한두 문장)' },
      friction: {
        type: 'integer',
        minimum: 0,
        maximum: 3,
        description: '0 매끄러움, 1 약간 번거로움, 2 헷갈리거나 번거로움, 3 막힘',
      },
      friction_note: { type: 'string', description: 'friction이 1 이상이면 무엇 때문인지' },
      actions: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object',
          properties: {
            do: { type: 'string', enum: ARM_ACTIONS[kind] },
            id: { type: 'integer' },
            text: { type: 'string' },
            value: { type: 'string' },
            key: { type: 'string' },
            enter: { type: 'boolean' },
            seconds: { type: 'integer' },
            terminal: { type: 'integer' },
            direction: { type: 'string', enum: ['up', 'down'] },
            summary: { type: 'string' },
            reason: { type: 'string' },
          },
          required: ['do'],
        },
      },
    },
    required: ['thought', 'friction', 'actions'],
  }
}

const SURVEY_SCHEMA = {
  type: 'object',
  properties: {
    effort: { type: 'integer', minimum: 1, maximum: 7 },
    clarity: { type: 'integer', minimum: 1, maximum: 7 },
    control: { type: 'integer', minimum: 1, maximum: 7 },
    confidence: { type: 'integer', minimum: 1, maximum: 7 },
    trust: { type: 'integer', minimum: 1, maximum: 7 },
    recovery: { type: ['integer', 'null'], minimum: 1, maximum: 7 },
    reuse: { type: 'integer', minimum: 1, maximum: 7 },
    best: { type: 'string' },
    worst: { type: 'string' },
    comment: { type: 'string' },
  },
  required: [
    'effort',
    'clarity',
    'control',
    'confidence',
    'trust',
    'recovery',
    'reuse',
    'best',
    'worst',
  ],
}

const ACTION_HELP = {
  relay: [
    '- click {id}: 요소를 누른다 (버튼, 탭, 체크박스, 라디오, 요약 펼치기)',
    '- fill {id, text}: 입력칸이나 글상자에 글을 쓴다 (원래 내용을 바꾼다)',
    '- select {id, value}: 선택 상자에서 값을 고른다',
    '- type {text, enter}: 지금 보이는 터미널(에이전트 세션)에 입력한다. enter 기본 true. 줄바꿈은 공백이 된다',
    '- key {key}: 키를 누른다 (Enter, Escape, ArrowUp, ArrowDown, Tab, Space, 숫자). 열린 대화상자가 없으면 터미널로 간다',
    '- scroll {direction}: 화면을 굴린다',
  ],
  cli: [
    '- type {text, enter}: 지금 터미널에 입력한다. enter 기본 true. 줄바꿈은 공백이 된다',
    '- key {key}: 키를 누른다 (Enter, Escape, ArrowUp, ArrowDown, Tab, Shift+Tab, Space, Backspace, Ctrl+C, 숫자나 글자 하나)',
    '- new_terminal: 같은 레포 폴더에서 새 터미널(셸)을 연다. 여기서 claude를 따로 띄울 수 있다',
    '- switch {terminal}: 입력할 터미널을 바꾼다 (번호)',
  ],
}

function systemPrompt(kind, scenario, guide) {
  const known = scenario.knowledge ?? []
  const lines = [
    '너는 사용성 평가에 참가한 소프트웨어 개발자다. 실제 사람처럼 도구를 써서 버그를 고친다. 너의 판단과 느낌이 평가 자료가 된다.',
    '',
    '## 규칙',
    '- 너는 화면에 보이는 것만 안다. 파일을 직접 읽거나 고치지 않는다. 바뀐 코드를 보고 싶으면 inspect_diff를 쓴다(에디터로 바뀐 코드를 훑어보는 것과 같다).',
    '- 코드를 고치는 일은 AI 에이전트(Claude Code)가 한다. 너는 요청하고, 질문에 답하고, 결과를 확인하고, 승인하거나 다시 해 달라고 한다.',
    '- "물으면 답함" 항목은 에이전트가 묻거나 흐름상 꼭 필요할 때만 말한다. 처음부터 다 쏟아내지 않는다. "처음부터 앎" 항목은 처음 요청에 넣어도 된다.',
    '- 실제 사람처럼 짧고 자연스럽게, 한국어로 입력한다.',
    '- 도구를 편들거나 깎아내리지 않는다. friction은 실제 사람이 느낄 만큼만 솔직하게 적는다. 헷갈렸거나 무엇을 할지 찾느라 시간을 썼으면 그대로 적는다.',
    '- 결과를 받아들이기(승인, 완료, 커밋) 전에 실제 개발자처럼 무엇이 바뀌었고 왜인지 확인한다. 화면에 근거가 모자라면 코드를 보거나(inspect_diff, 또는 도구가 보여 주는 변경 화면) 에이전트에게 묻는다.',
    '- 에이전트가 일하는 중이면 wait로 기다린다. 기다리는 동안에도 방향이 틀렸다고 보이면 끼어들어도 된다.',
    '- 끝의 기준을 채웠다고 판단하면 done {summary}. 가망이 없으면 give_up {reason}.',
    '- 한 차례에 행동을 1~5개 차례대로 고른다. 화면이 바뀔 행동(버튼 누르기 등) 뒤의 행동은 바뀐 화면을 보지 못한 채 하게 되니 조심한다.',
    '',
    '## 행동',
    ...ACTION_HELP[kind],
    '- inspect_diff: 지금까지 바뀐 코드(기준 커밋 대비)를 본다. 결과는 다음 차례에 보인다',
    '- wait {seconds}: 기다린다(기본 60초). 화면이 바뀌고 멈추면 더 일찍 깨운다',
    '- done {summary}, give_up {reason}',
    '',
    '## 끝의 기준',
    '버그가 고쳐졌다고 네가 납득하고, 고친 내용이 로컬 브랜치에 커밋된 상태. 원격 push나 PR은 하지 않는다(원격 저장소가 평가용이다).',
    '',
    '## 도구 설명서 (네가 미리 읽어 둔 것)',
    guide.trim(),
    '',
    '## 네 상황',
    '### 고칠 버그 (네가 받은 리포트나 네가 본 것)',
    ...(Array.isArray(scenario.report) ? scenario.report : [scenario.report]),
    '',
    '### 네가 아는 것',
    ...(known.length
      ? known.map((k) => `- [${k.share === 'upfront' ? '처음부터 앎' : '물으면 답함'}] ${k.text}`)
      : ['- (리포트 말고는 따로 아는 것이 없다)']),
    '',
    '### 네 선호',
    ...(scenario.preferences?.length ? scenario.preferences.map((p) => `- ${p}`) : ['- 없음']),
  ]
  return lines.join('\n')
}

export class Human {
  /**
   * @param {object} o
   * @param {'relay'|'cli'} o.kind
   * @param {object} o.scenario
   * @param {string} o.dir 사람 역할의 작업 폴더 (스크린샷이 여기 있다)
   * @param {string} o.configDir
   * @param {string} o.model
   * @param {string} o.effort
   * @param {boolean} o.vision 스크린샷을 보게 한다 (relay)
   */
  constructor(o) {
    this.o = o
    this.sessionId = crypto.randomUUID()
    this.started = false
    const guide = fs.readFileSync(path.join(GUIDES, `${o.kind}.md`), 'utf8')
    this.system = systemPrompt(o.kind, o.scenario, guide)
    this.costUsd = 0
    this.calls = 0
  }

  async call(prompt, schema, images) {
    const r = await ask({
      prompt,
      system: this.system,
      model: this.o.model,
      effort: this.o.effort,
      schema,
      tools: [],
      images,
      ...(this.started ? { resume: this.sessionId } : { sessionId: this.sessionId }),
      cwd: this.o.dir,
      configDir: this.o.configDir,
      timeoutMs: 240_000,
    })
    this.started = true
    this.costUsd += r.costUsd
    this.calls++
    return r
  }

  /** 한 차례. 화면(obs)과 알림을 주고 행동을 받는다 */
  async turn(obs) {
    const images = this.o.vision && obs.screen.screenshot ? [obs.screen.screenshot] : undefined
    const r = await this.call(
      renderObservation(this.o.kind, obs, this.o.vision),
      turnSchema(this.o.kind),
      images,
    )
    return { ...r.data, costUsd: r.costUsd, ms: r.ms }
  }

  async survey(ending) {
    const prompt = [
      `평가가 끝났다 (${ending}). 방금 쓴 도구로 이 버그를 고친 경험을 솔직하게 답하라. 도구를 편들지 않는다.`,
      '점수는 1~7이다.',
      '- effort: 들인 수고 (1 매우 적음 ~ 7 매우 많음)',
      '- clarity: 지금 무슨 일이 일어나는지, 내가 무엇을 해야 하는지 알기 쉬웠나 (7이 좋음)',
      '- control: 작업 방향을 내가 쥐고 있다고 느꼈나 (7이 좋음)',
      '- confidence: 결과가 맞다는 확신 (7이 좋음)',
      '- trust: 에이전트가 한 일을 믿을 만하게 보여 줬나 (7이 좋음)',
      '- recovery: 문제가 생겼을 때 되돌리거나 이어 가기 쉬웠나 (7이 좋음). 그런 일이 없었으면 null',
      '- reuse: 비슷한 버그에 이 도구를 다시 쓰고 싶나 (7이 좋음)',
      '- best, worst: 가장 좋았던 점과 가장 불편했던 점 (한두 문장)',
      '- comment: 덧붙일 말',
    ].join('\n')
    const r = await this.call(prompt, SURVEY_SCHEMA)
    return r.data
  }
}

function renderObservation(kind, obs, vision) {
  const lines = [`[차례 ${obs.turn} · 시작 뒤 ${obs.elapsed}]`]
  if (obs.notes?.length) lines.push('', '## 알림', ...obs.notes.map((n) => `- ${n}`))
  if (obs.results?.length)
    lines.push('', '## 직전 행동의 결과', ...obs.results.map((r) => `- ${r}`))
  if (obs.diff !== undefined)
    lines.push('', '## 바뀐 코드 (inspect_diff)', '```diff', obs.diff || '(바뀐 것 없음)', '```')
  if (kind === 'relay') {
    const s = obs.screen
    if (vision) lines.push('', '붙인 그림이 지금 화면이다. 노란 번호는 아래 요소 목록의 id다.')
    lines.push(
      '',
      '## 보이는 글자 (터미널 제외)',
      s.text,
      '',
      '## 터미널 (지금 보이는 에이전트 세션)',
      '```',
      s.terminal || '(터미널 없음)',
      '```',
      '',
      '## 누를 수 있는 요소',
      ...s.elements.map((e) => `[${e.id}] ${describeElement(e)}`),
    )
  } else {
    for (const t of obs.screen.terminals) {
      lines.push(
        '',
        `## 터미널 ${t.index}${t.active ? ' (입력 중)' : ''}${t.exited ? ' (닫힘)' : ''}`,
        '```',
        t.screen,
        '```',
      )
    }
  }
  lines.push('', '다음 행동을 고르라.')
  return lines.join('\n')
}

function describeElement(e) {
  const parts = [e.role, JSON.stringify(e.name)]
  if (e.value !== undefined && e.value !== '') parts.push(`값=${JSON.stringify(e.value)}`)
  if (e.options) parts.push(`선택지=${JSON.stringify(e.options)}`)
  if (e.checked !== undefined) parts.push(e.checked ? '켜짐' : '꺼짐')
  if (e.selected) parts.push('선택됨')
  if (e.disabled) parts.push('비활성')
  if (e.offscreen) parts.push('화면 밖')
  return parts.join(' ')
}
