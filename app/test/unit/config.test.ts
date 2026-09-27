import { describe, expect, it } from 'vitest'
import {
  AUTO_APPROVE_NODES,
  applyConfigPatch,
  checkWorkSettings,
  mergeWorkSettings,
  normalizeConfig,
} from '../../src/core/config'
import { NODE_INFO, NODES } from '../../src/core/pipeline'
import { AUTO_APPROVE_TITLES, DEFAULT_CONFIG, SKILL_TITLES } from '../../src/shared/config'

describe('config.json 읽기 (5.1.1)', () => {
  it('없는 키는 기본값을 쓴다', () => {
    expect(normalizeConfig({})).toEqual({ config: DEFAULT_CONFIG, warnings: [] })
    const { config, warnings } = normalizeConfig({
      session_limit: 5,
      question_mode: { evidence: 'confirm_each' },
      auto_approve: { fix: true },
      pr_draft: true,
    })
    expect(warnings).toEqual([])
    expect(config).toEqual({
      ...DEFAULT_CONFIG,
      session_limit: 5,
      question_mode: { ...DEFAULT_CONFIG.question_mode, evidence: 'confirm_each' },
      auto_approve: { ...DEFAULT_CONFIG.auto_approve, fix: true },
      pr_draft: true,
    })
  })

  it('값이 틀린 키는 기본값을 쓰고 경고한다', () => {
    const { config, warnings } = normalizeConfig({
      session_limit: 0,
      format_error_bounce_max: 'two',
      question_mode: { evidence: 'always' },
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
      'config.json 자동 승인: verify는 켤 수 없음 (의도 승인과 Work 완료는 늘 수동). 기본값을 씀',
    )
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
      { question_mode: { 'root-cause': 'sometimes' } },
      { question_mode: { unknown: 'draft_first' } },
      { pr_draft: 1 },
    ]) {
      expect(applyConfigPatch(DEFAULT_CONFIG, patch).ok).toBe(false)
    }
  })

  it('단계별 자동 승인과 카운트다운을 바꾼다. 자동 승인은 단계마다 덮어쓴다 (4.2, 4.3)', () => {
    const on = { ...DEFAULT_CONFIG, auto_approve: { evidence: true, rca: false, fix: false } }
    const r = applyConfigPatch(on, { auto_approve: { fix: true }, auto_approve_countdown_sec: 30 })
    expect(r).toEqual({
      ok: true,
      value: {
        ...on,
        auto_approve: { evidence: true, rca: false, fix: true },
        auto_approve_countdown_sec: 30,
      },
    })
    // 받은 값은 바꾸지 않는다
    expect(on.auto_approve.fix).toBe(false)
  })

  it('의도 승인과 Work 완료는 켤 수 없다. 카운트다운은 1~3600초다 (4.2)', () => {
    expect(applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { verify: true } })).toEqual({
      ok: false,
      error: '자동 승인: verify는 켤 수 없음 (의도 승인과 Work 완료는 늘 수동)',
    })
    for (const patch of [
      { auto_approve: { intake: false } },
      { auto_approve: { deploy: true } },
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
    expect(checkWorkSettings({ question_mode: { evidence: 'confirm_each' } })).toEqual({
      ok: true,
      value: { question_mode: { evidence: 'confirm_each' } },
    })
    expect(checkWorkSettings({ auto_approve: { fix: true, rca: false } })).toEqual({
      ok: true,
      value: { auto_approve: { fix: true, rca: false } },
    })
    // 빈 값은 그 키를 앱 설정으로 되돌린다는 뜻이라 남긴다
    expect(checkWorkSettings({ question_mode: {}, auto_approve: {} })).toEqual({
      ok: true,
      value: { question_mode: {}, auto_approve: {} },
    })
    expect(checkWorkSettings({})).toEqual({ ok: true, value: {} })
  })

  it('모르는 값과 켤 수 없는 단계는 받지 않는다', () => {
    expect(checkWorkSettings({ question_mode: { evidence: 'x' } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { verify: true } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { intake: false } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { fix: 1 } }).ok).toBe(false)
    expect(checkWorkSettings({ session_limit: 2 }).ok).toBe(false)
    expect(checkWorkSettings('x').ok).toBe(false)
  })

  it('준 키만 바꾸고, 빈 값이면 그 키를 지워 앱 설정을 따른다', () => {
    const current = { question_mode: { fix: 'confirm_each' as const }, auto_approve: { fix: true } }
    expect(mergeWorkSettings(current, { auto_approve: { rca: true } })).toEqual({
      question_mode: { fix: 'confirm_each' },
      auto_approve: { rca: true },
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
  it('노드의 화면 이름(D109)과 같은 순서, 같은 이름이다', () => {
    expect(SKILL_TITLES).toEqual(NODES.map((n) => [NODE_INFO[n].skill, NODE_INFO[n].title]))
  })

  it('자동 승인을 켤 수 있는 단계는 evidence, rca, fix이고 이름은 노드의 화면 이름이다 (4.2, D109)', () => {
    expect(AUTO_APPROVE_NODES).toEqual(['evidence', 'rca', 'fix'])
    expect(AUTO_APPROVE_TITLES).toEqual(AUTO_APPROVE_NODES.map((n) => [n, NODE_INFO[n].title]))
  })
})
