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
import { AUTO_APPROVE_TITLES, DEFAULT_CONFIG, SKILL_TITLES } from '../../src/shared/config'

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
      'config.json 자동 승인: verify는 켤 수 없음 (의도 승인, Work 완료는 늘 수동). 기본값을 씀',
    )
  })

  it('자동 승인의 기본값은 원인 분석과 수정, 구현이 켬이고 설계와 계획이 끔이다. 질문 방식 기본은 모두 초안 우선이다 (5.1.1, D214, D234, D249)', () => {
    expect(DEFAULT_CONFIG.auto_approve).toEqual({
      fix: true,
      design: false,
      implement: true,
      respond: false,
    })
    expect(DEFAULT_CONFIG.question_mode).toEqual({
      'work-start': 'draft_first',
      fix: 'draft_first',
      design: 'draft_first',
      implement: 'draft_first',
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
      auto_approve: { fix: false, design: false, implement: true, respond: true },
    }
    const r = applyConfigPatch(on, { auto_approve: { fix: true }, auto_approve_countdown_sec: 30 })
    expect(r).toEqual({
      ok: true,
      value: {
        ...on,
        auto_approve: { fix: true, design: false, implement: true, respond: true },
        auto_approve_countdown_sec: 30,
      },
    })
    // 받은 값은 바꾸지 않는다
    expect(on.auto_approve.fix).toBe(false)
  })

  it('자동 승인을 켤 수 있는 단계가 아닌 노드는 모두 "켤 수 없음"으로 거절한다. 모르는 단계로 거절하지 않는다 (4.2)', () => {
    const manual = ALL_NODES.filter((n) => !(AUTO_APPROVE_NODES as readonly string[]).includes(n))
    expect(manual).toEqual(['intake', 'verify'])
    for (const n of manual) {
      expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { [n]: true } }), n).toEqual({
        ok: false,
        error: `자동 승인: ${n}는 켤 수 없음 (의도 승인, Work 완료는 늘 수동)`,
      })
    }
  })

  it('의도 승인과 Work 완료는 켤 수 없고 원인 분석과 수정은 켤 수 있다. 카운트다운은 1~3600초다 (4.2)', () => {
    expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { verify: true } })).toEqual({
      ok: false,
      error: '자동 승인: verify는 켤 수 없음 (의도 승인, Work 완료는 늘 수동)',
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
      error: '자동 승인: verify는 켤 수 없음 (의도 승인, Work 완료는 늘 수동)',
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
  it('노드의 화면 이름(D109)과 같은 순서, 같은 이름이다. PR 대응은 파이프라인 뒤에 둔다 (D187, D188)', () => {
    expect(SKILL_TITLES.map(([skill, title]) => [skill, title])).toEqual(
      [...ALL_NODES, RESPOND].map((n) => [NODE_INFO[n].skill, NODE_INFO[n].title]),
    )
    expect(SKILL_TITLES).toEqual([
      ['work-start', '의도 정리', 'common'],
      ['fix', '원인 분석과 수정', 'bugfix'],
      ['design', '설계와 계획', 'feature'],
      ['implement', '구현', 'feature'],
      ['verify', '리뷰와 검증', 'common'],
      ['pr-respond', 'PR 대응', 'pr'],
    ])
  })

  it('묶음은 그 단계가 있는 파이프라인이다: 두 유형에 있으면 공통, 한 유형에만 있으면 그 유형 (D256)', () => {
    for (const n of ALL_NODES) {
      const inBug = PIPELINES.bugfix.includes(n)
      const inFeature = PIPELINES.feature.includes(n)
      const group = inBug && inFeature ? 'common' : inBug ? 'bugfix' : 'feature'
      expect(SKILL_TITLES.find(([s]) => s === NODE_INFO[n].skill)?.[2], n).toBe(group)
      const auto = AUTO_APPROVE_TITLES.find(([a]) => a === n)
      if (auto) expect(auto[2], n).toBe(group)
    }
  })

  it('자동 승인을 켤 수 있는 단계는 fix, design, implement와 PR 대응이고 이름은 노드의 화면 이름이다 (4.2, D109, D169, D234, D249)', () => {
    expect(AUTO_APPROVE_NODES).toEqual(['fix', 'design', 'implement', 'respond'])
    expect(AUTO_APPROVE_TITLES.map(([n, title]) => [n, title])).toEqual(
      AUTO_APPROVE_NODES.map((n) => [n, NODE_INFO[n].title]),
    )
  })

  it('저장된 config.json에 design, implement 키가 없으면 기본값을 쓴다 (D256)', () => {
    const { config, warnings } = normalizeConfig({
      auto_approve: { fix: false, respond: true },
      question_mode: { fix: 'confirm_each' },
    })
    expect(warnings).toEqual([])
    expect(config.auto_approve).toEqual({
      fix: false,
      design: false,
      implement: true,
      respond: true,
    })
    expect(config.question_mode.design).toBe('draft_first')
    expect(config.question_mode.implement).toBe('draft_first')
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
