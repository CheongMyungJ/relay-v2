// [단위] 설정 화면의 짜임 (D527~D531): 모든 설정이 한 구역에 한 번 있음, 찾기, 기본값과 다른 칸과 되돌리기, 단계별 진행
// 표의 줄, 진행 방식 묶음, Work 설정의 줄. 화면을 눌러 보는 것은 [스모크] agent-settings.spec.ts, app.spec.ts
import { describe, expect, it } from 'vitest'
import {
  AGENT_STEP_TITLES,
  AUTO_APPROVE_TITLES,
  DEFAULT_CONFIG,
  SKILL_TITLES,
  type AppConfig,
} from '../../src/shared/config'
import {
  SETTING_ENTRIES,
  STEP_ROWS,
  applyPreset,
  changedCounts,
  filtering,
  matches,
  presetOf,
  resetScalar,
  resetStep,
  scalarChanged,
  sectionViews,
  stepChanged,
  workStepRows,
  type StepRow,
} from '../../src/renderer/src/settingsView'

const config = (patch: Partial<AppConfig> = {}): AppConfig => ({
  ...structuredClone(DEFAULT_CONFIG),
  ...patch,
})
const row = (skill: string): StepRow => {
  const found = STEP_ROWS.find((r) => r.skill === skill)
  if (!found) throw new Error(`표에 ${skill} 줄이 없음`)
  return found
}
const none = { query: '', changedOnly: false }

describe('구역과 칸', () => {
  it('설정 화면이 저장하는 값은 모두 하나짜리 칸이나 단계별 진행 표에 한 번씩 있다', () => {
    const keys = SETTING_ENTRIES.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    const shown = new Set<string>([
      ...keys,
      'auto_approve',
      'question_mode',
      'agent_steps',
      'schema_version',
    ])
    expect(Object.keys(DEFAULT_CONFIG).filter((k) => !shown.has(k))).toEqual([])
  })

  it('표는 모든 단계와 곁 세션, 기본 세션을 차례대로 두고 자동 승인과 질문 방식을 빠짐없이 잇는다', () => {
    expect(STEP_ROWS.map((r) => r.skill)).toEqual(AGENT_STEP_TITLES.map(([s]) => s))
    expect(STEP_ROWS.flatMap((r) => (r.auto ? [r.auto] : [])).sort()).toEqual(
      AUTO_APPROVE_TITLES.map(([n]) => n).sort(),
    )
    expect(STEP_ROWS.flatMap((r) => (r.question ? [r.question] : [])).sort()).toEqual(
      SKILL_TITLES.map(([s]) => s).sort(),
    )
    // PR 대응은 스킬 pr-respond의 줄에 노드 respond의 자동 승인이 있다
    expect(row('pr-respond').auto).toBe('respond')
    // 고를 수 없는 칸은 까닭을 적는다
    expect(row('work-start').autoNote).toBe('늘 수동')
    expect(row('verify')).toMatchObject({ autoNote: '늘 수동', oldOnly: true })
    expect(row('spec').questionNote).toBe('늘 결정마다 확인')
    expect(row('side')).toMatchObject({ auto: null, question: null, autoNote: '—' })
  })

  it('화면에 보이는 이름과 설명에 결정 번호나 단계 id를 적지 않는다', () => {
    for (const e of SETTING_ENTRIES) expect(`${e.label} ${e.help}`).not.toMatch(/\b[DI]\d{2,3}\b/)
    for (const r of STEP_ROWS) expect(r.title).not.toMatch(/[a-z]/)
  })
})

describe('찾기와 바꾼 설정만 보기', () => {
  it('찾는 말의 낱말이 모두 들어 있으면 맞고, 띄어쓰기와 대소문자는 보지 않는다', () => {
    expect(matches('자동승인', '구현 자동 승인')).toBe(true)
    expect(matches('구현 승인', '구현 자동 승인')).toBe(true)
    expect(matches('구현 모델', '구현 자동 승인')).toBe(false)
    expect(matches('PR', 'draft pr로 만들기')).toBe(true)
  })

  it('걸러 보지 않으면 구역마다 그 구역의 칸을 모두 보이고, 표는 단계별 진행에만 있다', () => {
    const v = sectionViews(config(), none)
    expect(filtering(none)).toBe(false)
    expect(v.general.entries.map((e) => e.key)).toEqual([
      'theme',
      'session_limit',
      'session_dir',
      'side_notice',
    ])
    expect(v.steps.steps).toHaveLength(STEP_ROWS.length)
    expect(v.pr.steps).toEqual([])
  })

  it('찾기는 이름, 설명, 구역 이름에서 찾고 여러 구역을 가로지른다', () => {
    const v = sectionViews(config(), { query: '모델', changedOnly: false })
    expect(v.agent.entries.map((e) => e.key)).toEqual(['agent_model'])
    expect(v.advanced.entries.map((e) => e.key)).toEqual(['knowledge_review_model'])
    // 표의 줄은 고를 수 있는 것(엔진·모델)으로도 찾는다
    expect(v.steps.steps).toHaveLength(STEP_ROWS.length)
    const auto = sectionViews(config(), { query: '자동 승인', changedOnly: false })
    expect(auto.steps.steps.map((r) => r.skill)).toEqual(
      STEP_ROWS.filter((r) => r.auto).map((r) => r.skill),
    )
    expect(auto.steps.entries.map((e) => e.key)).toEqual(['auto_approve_countdown_sec'])
    // 구역 이름으로 찾으면 그 구역의 칸이 모두 나온다
    expect(
      sectionViews(config(), { query: '고급', changedOnly: false }).advanced.entries,
    ).toHaveLength(5)
  })

  it('바꾼 설정만 보기는 기본값과 다른 칸과 줄만 남기고, 구역마다 그 수를 센다', () => {
    const c = config({
      theme: 'dark',
      pr_draft: true,
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, design: true },
      agent_steps: { verify: { model: 'haiku' } },
    })
    const v = sectionViews(c, { query: '', changedOnly: true })
    expect(v.general.entries.map((e) => e.key)).toEqual(['theme'])
    expect(v.pr.entries.map((e) => e.key)).toEqual(['pr_draft'])
    expect(v.steps.steps.map((r) => r.skill)).toEqual(['design', 'verify'])
    expect(changedCounts(c)).toEqual({ general: 1, agent: 0, steps: 2, pr: 1, advanced: 0 })
    expect(changedCounts(config())).toEqual({ general: 0, agent: 0, steps: 0, pr: 0, advanced: 0 })
  })
})

describe('기본값으로 되돌리기', () => {
  it('하나짜리 칸은 기본값으로 돌아간다', () => {
    const c = config({ session_limit: 7 })
    expect(scalarChanged(c, 'session_limit')).toBe(true)
    expect(resetScalar(c, 'session_limit').session_limit).toBe(DEFAULT_CONFIG.session_limit)
  })

  it('기본 엔진을 되돌리면 엔진에 없는 모델과 추론 수준도 함께 맞춘다', () => {
    const c = config({ agent_engine: 'codex', agent_model: 'gpt-6.1-sol', agent_effort: 'ultra' })
    const back = resetScalar(c, 'agent_engine')
    expect(back.agent_engine).toBe('claude')
    expect(back.agent_model).toBe('')
    expect(back.agent_effort).toBe('')
  })

  it('표의 줄은 그 단계의 자동 승인, 질문 방식, 엔진·모델·추론 수준만 되돌린다', () => {
    const c = config({
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, implement: false, fix: false },
      question_mode: { ...DEFAULT_CONFIG.question_mode, implement: 'confirm_each' },
      agent_steps: { implement: { model: 'opus' }, design: { model: 'sonnet' } },
    })
    expect(stepChanged(c, row('implement'))).toBe(true)
    const back = resetStep(c, row('implement'))
    expect(stepChanged(back, row('implement'))).toBe(false)
    expect(back.auto_approve.fix).toBe(false)
    expect(back.agent_steps).toEqual({ design: { model: 'sonnet' } })
    // 엔진·모델만 바꾼 곁 세션 줄도 바꾼 줄이다
    expect(stepChanged(config({ agent_steps: { side: { effort: 'high' } } }), row('side'))).toBe(
      true,
    )
  })
})

describe('진행 방식 묶음 (D529)', () => {
  it('기본값은 기본 묶음이다', () => {
    expect(presetOf(config())).toBe('default')
  })

  it('꼼꼼히는 Work 단계의 자동 승인을 모두 끄고 결정마다 묻고, 맡기기는 모두 켜고 초안을 먼저 쓴다', () => {
    const careful = applyPreset(config(), 'careful')
    expect(presetOf(careful)).toBe('careful')
    expect(careful.auto_approve).toMatchObject({ fix: false, implement: false, spec: false })
    expect(careful.question_mode).toMatchObject({
      'work-start': 'confirm_each',
      fix: 'confirm_each',
    })
    const delegate = applyPreset(careful, 'delegate')
    expect(presetOf(delegate)).toBe('delegate')
    expect(delegate.auto_approve).toMatchObject({ design: true, implement: true, execute: true })
    expect(delegate.question_mode.verify).toBe('draft_first')
    expect(presetOf(applyPreset(delegate, 'default'))).toBe('default')
  })

  it('묶음은 PR 대응 줄을 바꾸지 않고, PR 대응을 바꿔도 묶음이 그대로다', () => {
    const c = config({
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, respond: true },
      question_mode: { ...DEFAULT_CONFIG.question_mode, 'pr-respond': 'confirm_each' },
    })
    expect(presetOf(c)).toBe('default')
    const careful = applyPreset(c, 'careful')
    expect(careful.auto_approve.respond).toBe(true)
    expect(careful.question_mode['pr-respond']).toBe('confirm_each')
    expect(applyPreset(config(), 'delegate').auto_approve.respond).toBe(false)
  })

  it('묶음과 다른 값을 한 칸이라도 고르면 직접 고름(null)이다', () => {
    const c = config({ question_mode: { ...DEFAULT_CONFIG.question_mode, fix: 'confirm_each' } })
    expect(presetOf(c)).toBeNull()
  })
})

describe('Work 설정의 줄', () => {
  it('고른 유형에서 보이는 단계 가운데 자동 승인이나 질문 방식이 있는 것만, 앱 설정과 같은 차례다', () => {
    expect(workStepRows('bugfix').map((r) => r.skill)).toEqual([
      'work-start',
      'fix',
      'verify',
      'pr-respond',
    ])
    expect(workStepRows('spec').map((r) => r.skill)).toEqual([
      'work-start',
      'spec',
      'verify',
      'pr-respond',
    ])
    // 커스텀 단계는 유형 정의에서 오므로 부르는 쪽이 넣는다
    expect(workStepRows('custom').map((r) => r.skill)).toEqual([
      'work-start',
      'verify',
      'pr-respond',
    ])
    // 유형을 고르기 전에는 모든 유형의 줄이다. 곁 세션과 기본 세션은 없다
    expect(workStepRows(null).map((r) => r.skill)).not.toContain('side')
    expect(workStepRows(null)).toHaveLength(9)
  })
})
