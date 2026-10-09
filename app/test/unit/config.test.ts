import { describe, expect, it } from 'vitest'
import {
  AUTO_APPROVE_NODES,
  applyConfigPatch,
  checkProjectSettings,
  checkWorkSettings,
  mergeWorkSettings,
  normalizeConfig,
} from '../../src/core/config'
import { ALL_NODES, NODE_INFO, PIPELINES, RESPOND } from '../../src/core/pipeline'
import {
  AGENT_STEP_TITLES,
  AUTO_APPROVE_TITLES,
  DEFAULT_CONFIG,
  SKILL_TITLES,
} from '../../src/shared/config'
import { WORK_TYPES } from '../../src/shared/work'

describe('config.json 읽기 (5.1.1)', () => {
  it('없는 키는 기본값을 쓴다', () => {
    expect(normalizeConfig({})).toEqual({ config: DEFAULT_CONFIG, warnings: [] })
    const { config, warnings } = normalizeConfig({
      session_limit: 5,
      question_mode: { verify: 'confirm_each' },
      auto_approve: { fix: false, respond: true },
      pr_draft: true,
    })
    expect(warnings).toEqual([])
    expect(config).toEqual({
      ...DEFAULT_CONFIG,
      session_limit: 5,
      question_mode: { ...DEFAULT_CONFIG.question_mode, verify: 'confirm_each' },
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: false, respond: true },
      pr_draft: true,
    })
  })

  it('값이 틀린 키는 기본값을 쓰고 경고한다', () => {
    const { config, warnings } = normalizeConfig({
      session_limit: 0,
      format_error_bounce_max: 'two',
      question_mode: { verify: 'always' },
      pr_draft: 'yes',
      auto_approve_countdown_sec: 0,
      auto_approve: { verify: true },
    })
    expect(config).toEqual(DEFAULT_CONFIG)
    expect(warnings).toHaveLength(6)
    expect(warnings[0]).toContain('세션 상한: 1~20의 정수여야 함')
    expect(warnings).toContain(
      'config.json 자동 승인 카운트다운: 1~3600의 정수여야 함 (지금: 0). 기본값 15을 씀',
    )
    expect(warnings).toContain(
      'config.json 자동 승인: verify는 켤 수 없음 (의도 승인, 요구사항 추출, Work 완료는 늘 수동). 기본값을 씀',
    )
  })

  it('자동 승인의 기본값은 원인 분석과 수정, 구현, 계획과 리팩터링, 설계 문답, 실행이 켬이고 설계와 계획이 끔이다. 질문 방식 기본은 모두 초안 우선이고 설계 문답은 없다 (5.1.1, D214, D234, D249, D276, D315, D358, D367)', () => {
    expect(DEFAULT_CONFIG.auto_approve).toEqual({
      fix: true,
      design: false,
      implement: true,
      refactor: true,
      spec: true,
      execute: true,
      respond: false,
    })
    expect(DEFAULT_CONFIG.question_mode).toEqual({
      'work-start': 'draft_first',
      fix: 'draft_first',
      design: 'draft_first',
      implement: 'draft_first',
      refactor: 'draft_first',
      execute: 'draft_first',
      verify: 'draft_first',
      'pr-respond': 'draft_first',
    })
    const { config, warnings } = normalizeConfig({ question_mode: { verify: 'confirm_each' } })
    expect(warnings).toEqual([])
    expect(config.question_mode).toEqual({
      ...DEFAULT_CONFIG.question_mode,
      verify: 'confirm_each',
    })
  })

  it('없어진 단계(review, rca 등)와 스킬은 모르는 값으로 보고 기본값을 쓴다 (D227)', () => {
    const { config, warnings } = normalizeConfig({
      auto_approve: { fix: false, review: true },
      question_mode: { 'root-cause': 'confirm_each' },
    })
    expect(config).toEqual(DEFAULT_CONFIG)
    expect(warnings).toEqual([
      'config.json 질문 방식: 모르는 스킬 root-cause. 기본값을 씀',
      'config.json 자동 승인: 모르는 단계 review. 기본값을 씀',
    ])
  })

  it('객체가 아니면 기본값이다', () => {
    expect(normalizeConfig([1, 2]).config).toEqual(DEFAULT_CONFIG)
    expect(normalizeConfig(null).warnings).toHaveLength(1)
  })
})

describe('설정 화면 (D70)', () => {
  it('바꿀 수 있는 값을 적용한다. 질문 방식은 스킬마다 덮어쓴다', () => {
    const r = applyConfigPatch(DEFAULT_CONFIG, {
      session_limit: 2,
      question_mode: { fix: 'confirm_each' },
      format_error_bounce_max: 0,
      handoff_body_warn_chars: 2000,
      intent_warn_chars: 1000,
      pr_draft: true,
    })
    expect(r).toEqual({
      ok: true,
      value: {
        ...DEFAULT_CONFIG,
        session_limit: 2,
        question_mode: { ...DEFAULT_CONFIG.question_mode, fix: 'confirm_each' },
        format_error_bounce_max: 0,
        handoff_body_warn_chars: 2000,
        intent_warn_chars: 1000,
        pr_draft: true,
      },
    })
  })

  it('값이 틀리면 아무것도 바꾸지 않는다', () => {
    for (const patch of [
      { session_limit: 0 },
      { session_limit: 2.5 },
      { format_error_bounce_max: 9 },
      { question_mode: { fix: 'sometimes' } },
      { question_mode: { 'final-verify': 'draft_first' } },
      { question_mode: { unknown: 'draft_first' } },
      { pr_draft: 1 },
    ]) {
      expect(applyConfigPatch(DEFAULT_CONFIG, patch).ok).toBe(false)
    }
  })

  it('단계별 자동 승인과 카운트다운을 바꾼다. 자동 승인은 단계마다 덮어쓴다 (4.2, 4.3)', () => {
    const on = {
      ...DEFAULT_CONFIG,
      auto_approve: {
        fix: false,
        design: false,
        implement: true,
        refactor: true,
        spec: true,
        execute: true,
        respond: true,
      },
    }
    const r = applyConfigPatch(on, { auto_approve: { fix: true }, auto_approve_countdown_sec: 30 })
    expect(r).toEqual({
      ok: true,
      value: {
        ...on,
        auto_approve: {
          fix: true,
          design: false,
          implement: true,
          refactor: true,
          spec: true,
          execute: true,
          respond: true,
        },
        auto_approve_countdown_sec: 30,
      },
    })
    // 받은 값은 바꾸지 않는다
    expect(on.auto_approve.fix).toBe(false)
  })

  it('자동 승인을 켤 수 있는 단계가 아닌 노드는 모두 "켤 수 없음"으로 거절한다. 모르는 단계로 거절하지 않는다 (4.2)', () => {
    const manual = ALL_NODES.filter((n) => !(AUTO_APPROVE_NODES as readonly string[]).includes(n))
    // 요구사항 추출의 extract는 자동 승인을 켤 수 있는 단계로 두기로 했으나(결정 5) 판정하는 때를 정하지 않아 첫 구현은 수동이다
    expect(manual).toEqual(['intake', 'extract', 'verify'])
    for (const n of manual) {
      expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { [n]: true } }), n).toEqual({
        ok: false,
        error: `자동 승인: ${n}는 켤 수 없음 (의도 승인, 요구사항 추출, Work 완료는 늘 수동)`,
      })
    }
  })

  it('의도 승인과 Work 완료는 켤 수 없고 원인 분석과 수정은 켤 수 있다. 카운트다운은 1~3600초다 (4.2)', () => {
    expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { verify: true } })).toEqual({
      ok: false,
      error: '자동 승인: verify는 켤 수 없음 (의도 승인, 요구사항 추출, Work 완료는 늘 수동)',
    })
    expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { fix: false } })).toEqual({
      ok: true,
      value: { ...DEFAULT_CONFIG, auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: false } },
    })
    for (const patch of [
      { auto_approve: { intake: false } },
      { auto_approve: { verify: false } },
      { auto_approve: { deploy: true } },
      { auto_approve: { review: false } },
      { auto_approve: { rca: true } },
      { auto_approve: { fix: 'yes' } },
      { auto_approve: true },
      { auto_approve_countdown_sec: 0 },
      { auto_approve_countdown_sec: 3601 },
      { auto_approve_countdown_sec: 1.5 },
    ]) {
      expect(applyConfigPatch(DEFAULT_CONFIG, patch).ok, JSON.stringify(patch)).toBe(false)
    }
    for (const sec of [1, 3600]) {
      expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve_countdown_sec: sec }).ok).toBe(true)
    }
  })
})

describe('Work별 설정 (D72)', () => {
  it('스킬마다 질문 방식을, 단계마다 자동 승인을 덮어쓴다. 뺀 것은 앱 설정을 따른다', () => {
    expect(checkWorkSettings({ question_mode: { fix: 'confirm_each' } })).toEqual({
      ok: true,
      value: { question_mode: { fix: 'confirm_each' } },
    })
    expect(checkWorkSettings({ auto_approve: { fix: true, respond: false } })).toEqual({
      ok: true,
      value: { auto_approve: { fix: true, respond: false } },
    })
    // 빈 값은 그 키를 앱 설정으로 되돌린다는 뜻이라 남긴다
    expect(checkWorkSettings({ question_mode: {}, auto_approve: {} })).toEqual({
      ok: true,
      value: { question_mode: {}, auto_approve: {} },
    })
    expect(checkWorkSettings({})).toEqual({ ok: true, value: {} })
    // 리뷰와 검증은 질문 방식만 덮어쓴다. 자동 승인은 늘 수동이다 (D72, 4.2)
    expect(checkWorkSettings({ question_mode: { verify: 'confirm_each' } })).toEqual({
      ok: true,
      value: { question_mode: { verify: 'confirm_each' } },
    })
  })

  it('모르는 값과 켤 수 없는 단계는 받지 않는다', () => {
    expect(checkWorkSettings({ question_mode: { fix: 'x' } }).ok).toBe(false)
    expect(checkWorkSettings({ question_mode: { review: 'confirm_each' } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { review: true } })).toEqual({
      ok: false,
      error: '자동 승인: 모르는 단계 review',
    })
    expect(checkWorkSettings({ auto_approve: { verify: true } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { verify: true } })).toEqual({
      ok: false,
      error: '자동 승인: verify는 켤 수 없음 (의도 승인, 요구사항 추출, Work 완료는 늘 수동)',
    })
    expect(checkWorkSettings({ auto_approve: { intake: false } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { fix: 1 } }).ok).toBe(false)
    expect(checkWorkSettings({ session_limit: 2 }).ok).toBe(false)
    expect(checkWorkSettings('x').ok).toBe(false)
  })

  it('준 키만 바꾸고, 빈 값이면 그 키를 지워 앱 설정을 따른다', () => {
    const current = { question_mode: { fix: 'confirm_each' as const }, auto_approve: { fix: true } }
    expect(mergeWorkSettings(current, { auto_approve: { respond: true } })).toEqual({
      question_mode: { fix: 'confirm_each' },
      auto_approve: { respond: true },
    })
    expect(mergeWorkSettings(current, { question_mode: {} })).toEqual({
      auto_approve: { fix: true },
    })
    expect(mergeWorkSettings(current, { question_mode: {}, auto_approve: {} })).toEqual({})
    expect(mergeWorkSettings({}, {})).toEqual({})
    expect(current).toEqual({ question_mode: { fix: 'confirm_each' }, auto_approve: { fix: true } })
  })
})

describe('화면의 스킬 이름', () => {
  it('노드의 화면 이름(D109)과 같은 순서, 같은 이름이다. PR 대응은 파이프라인 뒤에 둔다. 설계 문답과 요구사항 추출(세션 없음, 결정 92)은 질문 방식이 없어 빠진다 (D187, D188, D358, I104)', () => {
    expect(SKILL_TITLES.map(([skill, title]) => [skill, title])).toEqual(
      [...ALL_NODES, RESPOND]
        .filter((n) => n !== 'spec' && n !== 'extract')
        .map((n) => [NODE_INFO[n].skill, NODE_INFO[n].title]),
    )
    expect(SKILL_TITLES).toEqual([
      ['work-start', '의도 정리', 'common'],
      ['fix', '원인 분석과 수정', 'bugfix'],
      ['design', '설계와 계획', 'feature'],
      ['implement', '구현', 'feature'],
      ['refactor', '계획과 리팩터링', 'refactor'],
      ['execute', '실행', 'general'],
      ['verify', '리뷰와 검증', 'common'],
      ['pr-respond', 'PR 대응', 'pr'],
    ])
  })

  it('묶음은 그 단계가 있는 파이프라인이다: 여러 유형에 있으면 공통, 한 유형에만 있으면 그 유형 (D256, D278, D318, D374)', () => {
    for (const n of ALL_NODES) {
      const types = WORK_TYPES.filter((t) => PIPELINES[t].includes(n))
      const group = types.length > 1 ? 'common' : types[0]
      const skill = SKILL_TITLES.find(([s]) => s === NODE_INFO[n].skill)
      if (n === 'spec' || n === 'extract') expect(skill, n).toBeUndefined()
      else expect(skill?.[2], n).toBe(group)
      const auto = AUTO_APPROVE_TITLES.find(([a]) => a === n)
      if (auto) expect(auto[2], n).toBe(group)
    }
  })

  it('자동 승인을 켤 수 있는 단계는 fix, design, implement, refactor, spec, execute와 PR 대응이고 이름은 노드의 화면 이름이다 (4.2, D109, D169, D234, D249, D276, D315, D367)', () => {
    expect(AUTO_APPROVE_NODES).toEqual([
      'fix',
      'design',
      'implement',
      'refactor',
      'spec',
      'execute',
      'respond',
    ])
    expect(AUTO_APPROVE_TITLES.map(([n, title]) => [n, title])).toEqual(
      AUTO_APPROVE_NODES.map((n) => [n, NODE_INFO[n].title]),
    )
  })

  it('저장된 config.json에 design, implement, refactor, spec, execute 키가 없으면 기본값을 쓴다 (D256, D278, D318, D367)', () => {
    const { config, warnings } = normalizeConfig({
      auto_approve: { fix: false, respond: true },
      question_mode: { fix: 'confirm_each' },
    })
    expect(warnings).toEqual([])
    expect(config.auto_approve).toEqual({
      fix: false,
      design: false,
      implement: true,
      refactor: true,
      spec: true,
      execute: true,
      respond: true,
    })
    expect(config.question_mode.design).toBe('draft_first')
    expect(config.question_mode.implement).toBe('draft_first')
    expect(config.question_mode.refactor).toBe('draft_first')
    expect(config.question_mode.execute).toBe('draft_first')
    expect(config.question_mode).not.toHaveProperty('spec')
  })

  it('질문 방식에 spec(설계 문답)은 없다: config.json의 question_mode.spec은 모르는 스킬로 거르고, 설정 화면과 Work 설정에서도 받지 않는다 (D358, I104)', () => {
    const { config, warnings } = normalizeConfig({ question_mode: { spec: 'draft_first' } })
    expect(warnings).toEqual(['config.json 질문 방식: 모르는 스킬 spec. 기본값을 씀'])
    expect(config.question_mode).toEqual(DEFAULT_CONFIG.question_mode)
    expect(applyConfigPatch(DEFAULT_CONFIG, { question_mode: { spec: 'confirm_each' } })).toEqual({
      ok: false,
      error: '질문 방식: 모르는 스킬 spec',
    })
    expect(checkWorkSettings({ question_mode: { spec: 'confirm_each' } }).ok).toBe(false)
    // 자동 승인은 켤 수 있다 (D367)
    expect(checkWorkSettings({ auto_approve: { spec: false } })).toEqual({
      ok: true,
      value: { auto_approve: { spec: false } },
    })
  })
})

describe('PR 진행의 설정 (D158, D185, 5.1.2)', () => {
  it('PR 읽기 주기는 기본 120초이고 30~3600초다', () => {
    expect(DEFAULT_CONFIG.pr_poll_interval_sec).toBe(120)
    expect(applyConfigPatch(DEFAULT_CONFIG, { pr_poll_interval_sec: 30 })).toMatchObject({
      ok: true,
      value: { pr_poll_interval_sec: 30 },
    })
    for (const v of [29, 3601, 1.5, '60']) {
      expect(applyConfigPatch(DEFAULT_CONFIG, { pr_poll_interval_sec: v }).ok, String(v)).toBe(
        false,
      )
    }
  })

  it('프로젝트 설정은 받을 봇 목록과 기본 머지 방식이다. 봇 이름은 앞뒤 공백을 떼고 겹치지 않게 둔다', () => {
    expect(
      checkProjectSettings({
        allowed_bots: [' github-actions ', 'github-actions', '', 'renovate[bot]'],
        merge_method: 'squash',
      }),
    ).toEqual({
      ok: true,
      value: { allowed_bots: ['github-actions', 'renovate[bot]'], merge_method: 'squash' },
    })
    expect(checkProjectSettings({ allowed_bots: [], merge_method: null })).toEqual({
      ok: true,
      value: { allowed_bots: [], merge_method: null },
    })
    for (const bad of [
      { allowed_bots: 'github-actions', merge_method: null },
      { allowed_bots: [1], merge_method: null },
      { allowed_bots: [], merge_method: 'fast-forward' },
      null,
    ]) {
      expect(checkProjectSettings(bad).ok, JSON.stringify(bad)).toBe(false)
    }
  })
})

describe('[단위] 지식 검토의 엔진과 모델 (D334)', () => {
  it('기본은 claude이고 모델은 비워 엔진의 기본(claude는 sonnet)을 쓴다', () => {
    expect(DEFAULT_CONFIG.knowledge_review_engine).toBe('claude')
    expect(DEFAULT_CONFIG.knowledge_review_model).toBe('')
    expect(normalizeConfig({}).config).toMatchObject({
      knowledge_review_engine: 'claude',
      knowledge_review_model: '',
    })
  })

  it('설정 화면에서 엔진과 모델을 바꾼다. 모르는 엔진과 띄어쓰기가 든 모델은 받지 않는다', () => {
    expect(
      applyConfigPatch(DEFAULT_CONFIG, {
        knowledge_review_engine: 'codex',
        knowledge_review_model: ' gpt-5-codex ',
      }),
    ).toMatchObject({
      ok: true,
      value: { knowledge_review_engine: 'codex', knowledge_review_model: 'gpt-5-codex' },
    })
    expect(applyConfigPatch(DEFAULT_CONFIG, { knowledge_review_engine: 'gpt' }).ok).toBe(false)
    expect(applyConfigPatch(DEFAULT_CONFIG, { knowledge_review_model: 'a b' }).ok).toBe(false)
    expect(applyConfigPatch(DEFAULT_CONFIG, { knowledge_review_model: '' })).toMatchObject({
      ok: true,
      value: { knowledge_review_model: '' },
    })
    const bad = normalizeConfig({ knowledge_review_engine: 1, knowledge_review_model: 'x\ny' })
    expect(bad.config).toMatchObject({
      knowledge_review_engine: 'claude',
      knowledge_review_model: '',
    })
    expect(bad.warnings).toHaveLength(2)
  })
})

describe('[단위] 화면 테마 (D335)', () => {
  it('기본은 시스템 설정 따름이다', () => {
    expect(DEFAULT_CONFIG.theme).toBe('system')
    expect(normalizeConfig({}).config.theme).toBe('system')
  })

  it('설정 화면에서 system, dark, light 중 하나로 바꾼다. 모르는 값은 받지 않고, 파일의 틀린 값은 기본값으로 읽는다', () => {
    for (const theme of ['system', 'dark', 'light'] as const) {
      expect(applyConfigPatch(DEFAULT_CONFIG, { theme })).toMatchObject({
        ok: true,
        value: { theme },
      })
    }
    expect(applyConfigPatch(DEFAULT_CONFIG, { theme: 'blue' }).ok).toBe(false)
    const bad = normalizeConfig({ theme: 'blue' })
    expect(bad.config.theme).toBe('system')
    expect(bad.warnings).toHaveLength(1)
  })
})

describe('[단위] 기본 모델·추론 수준과 단계별 실행 설정', () => {
  it('새 키가 없는 config.json은 모델·추론 수준이 비고(엔진 기본) 단계 설정이 없다 (F1, N1)', () => {
    expect(DEFAULT_CONFIG).toMatchObject({ agent_model: '', agent_effort: '', agent_steps: {} })
    expect(normalizeConfig({ agent_engine: 'codex' }).config).toMatchObject({
      agent_engine: 'codex',
      agent_model: '',
      agent_effort: '',
      agent_steps: {},
    })
  })

  it('단계 목록은 의도 정리부터 PR 대응까지 열 단계이고 이름은 노드의 화면 이름이다. 끝은 곁 세션이다 (F3, D391)', () => {
    expect(AGENT_STEP_TITLES.slice(0, -1).map(([skill, title]) => [skill, title])).toEqual(
      [...ALL_NODES, RESPOND].map((n) => [NODE_INFO[n].skill, NODE_INFO[n].title]),
    )
    expect(AGENT_STEP_TITLES.at(-1)).toEqual(['side', '곁 세션', 'common'])
    expect(AGENT_STEP_TITLES.map(([, title]) => title)).toEqual([
      '의도 정리',
      '원인 분석과 수정',
      '설계와 계획',
      '구현',
      '계획과 리팩터링',
      '설계 문답',
      '실행',
      '요구사항 추출',
      '리뷰와 검증',
      'PR 대응',
      '곁 세션',
    ])
  })

  it('곁 세션 줄도 다른 단계처럼 저장하고 검사한다 (D391)', () => {
    const r = applyConfigPatch(DEFAULT_CONFIG, {
      agent_steps: { side: { engine: 'codex' } },
    })
    expect(r).toMatchObject({ ok: true, value: { agent_steps: { side: { engine: 'codex' } } } })
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_steps: { side: { engine: 'gpt' } } })).toEqual({
      ok: false,
      error: '상세 설정(곁 세션): 엔진은 claude | codex 중 하나여야 함',
    })
  })

  it('곁 세션 안내는 기본으로 켜져 있고 끌 수 있다 (D392)', () => {
    expect(DEFAULT_CONFIG.side_notice).toBe(true)
    expect(applyConfigPatch(DEFAULT_CONFIG, { side_notice: false })).toMatchObject({
      ok: true,
      value: { side_notice: false },
    })
    expect(applyConfigPatch(DEFAULT_CONFIG, { side_notice: 'no' })).toEqual({
      ok: false,
      error: '곁 세션을 열 때 안내: true/false여야 함',
    })
  })

  it('저장한 값을 다시 읽으면 같은 값이다 (F5)', () => {
    const saved = {
      agent_engine: 'claude',
      agent_model: 'opus',
      agent_effort: 'high',
      agent_steps: {
        spec: { model: 'fable', effort: 'max' },
        implement: { engine: 'codex', model: 'gpt-6.1-sol', effort: 'ultra' },
        'pr-respond': { engine: 'codex' },
      },
    }
    const { config, warnings } = normalizeConfig(JSON.parse(JSON.stringify(saved)))
    expect(warnings).toEqual([])
    expect(config).toMatchObject(saved)
    expect(normalizeConfig(JSON.parse(JSON.stringify(config))).config).toEqual(config)
  })

  it('파일의 틀린 값은 그 값만 기본으로 되돌리고 경고한다 (F5)', () => {
    const { config, warnings } = normalizeConfig({
      agent_engine: 'claude',
      agent_model: 'gpt-6-sol',
      agent_effort: 'ultra',
      agent_steps: {
        design: { model: 'opus' },
        implement: { engine: 'codex', model: 'opus' },
        nope: { model: 'opus' },
      },
    })
    expect(config.agent_model).toBe('')
    expect(config.agent_effort).toBe('')
    expect(config.agent_steps).toEqual({ design: { model: 'opus' } })
    expect(warnings).toHaveLength(4)
  })

  it('설정 화면에서 기본 모델·추론 수준을 바꾼다. 엔진에 없는 모델, 모델이 받지 않는 수준은 거절한다 (F1, N2)', () => {
    expect(
      applyConfigPatch(DEFAULT_CONFIG, { agent_model: 'sonnet', agent_effort: 'xhigh' }),
    ).toMatchObject({ ok: true, value: { agent_model: 'sonnet', agent_effort: 'xhigh' } })
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_model: 'gpt-6-sol' }).ok).toBe(false)
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_model: 'haiku', agent_effort: 'low' }).ok).toBe(
      false,
    )
    expect(applyConfigPatch(DEFAULT_CONFIG, { agent_effort: 'ultra' }).ok).toBe(false)
    expect(
      applyConfigPatch(DEFAULT_CONFIG, {
        agent_engine: 'codex',
        agent_model: 'gpt-6-luna',
        agent_effort: 'max',
      }),
    ).toMatchObject({ ok: true, value: { agent_engine: 'codex', agent_model: 'gpt-6-luna' } })
    // 엔진만 바꿔 저장값의 모델이 새 엔진에 없으면 거절한다. 화면은 모델을 함께 되돌린다 (F11)
    const opus = { ...DEFAULT_CONFIG, agent_model: 'opus' }
    const r = applyConfigPatch(opus, { agent_engine: 'codex' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('opus')
  })

  it('한 단계를 바꾸면 다른 단계는 그대로이고, 빈 객체는 그 단계를 지운다 (F4)', () => {
    const current = {
      ...DEFAULT_CONFIG,
      agent_steps: {
        design: { model: 'opus', effort: 'high' },
        verify: { engine: 'codex' as const },
      },
    }
    const r = applyConfigPatch(current, {
      agent_steps: { implement: { engine: 'codex', model: 'gpt-6-sol', effort: 'low' } },
    })
    expect(r).toMatchObject({ ok: true })
    if (!r.ok) return
    expect(r.value.agent_steps).toEqual({
      design: { model: 'opus', effort: 'high' },
      verify: { engine: 'codex' },
      implement: { engine: 'codex', model: 'gpt-6-sol', effort: 'low' },
    })
    expect(current.agent_steps).not.toHaveProperty('implement')
    const removed = applyConfigPatch(r.value, { agent_steps: { verify: {} } })
    expect(removed.ok && removed.value.agent_steps).toEqual({
      design: { model: 'opus', effort: 'high' },
      implement: { engine: 'codex', model: 'gpt-6-sol', effort: 'low' },
    })
  })

  it('모르는 단계, 단계 엔진에 없는 모델, 받지 않는 수준은 거절하고 아무것도 바꾸지 않는다 (N2)', () => {
    const bad = [
      { agent_steps: { nope: { model: 'opus' } } },
      { agent_steps: { design: { engine: 'gpt' } } },
      { agent_steps: { design: { engine: 'codex', model: 'opus' } } },
      { agent_steps: { design: { model: 'haiku', effort: 'high' } } },
      { agent_steps: { design: { color: 'red' } } },
      { agent_steps: [] },
      { session_limit: 4, agent_steps: { design: { effort: 'ultra' } } },
      // 모델을 정하지 않은 단계는 물려받는 기본 모델(haiku)로 본다
      { agent_model: 'haiku', agent_steps: { design: { effort: 'high' } } },
    ]
    for (const patch of bad) {
      const r = applyConfigPatch(DEFAULT_CONFIG, patch)
      expect(r.ok, JSON.stringify(patch)).toBe(false)
    }
    expect(
      applyConfigPatch(DEFAULT_CONFIG, { agent_steps: { design: { model: 'opus' } } }).ok,
    ).toBe(true)
  })
})
