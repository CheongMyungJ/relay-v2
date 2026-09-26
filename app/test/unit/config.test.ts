import { describe, expect, it } from 'vitest'
import { applyConfigPatch, checkWorkSettings, normalizeConfig } from '../../src/core/config'
import { NODE_INFO, NODES } from '../../src/core/pipeline'
import { DEFAULT_CONFIG, SKILL_TITLES } from '../../src/shared/config'

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
    })
    expect(config).toEqual(DEFAULT_CONFIG)
    expect(warnings).toHaveLength(4)
    expect(warnings[0]).toContain('세션 상한: 1~20의 정수여야 함')
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

  it('자동 승인은 M7까지 설정 화면에서 바꾸지 않는다', () => {
    const r = applyConfigPatch(DEFAULT_CONFIG, { auto_approve: { fix: true } })
    expect(r).toEqual({ ok: false, error: '설정 화면에서 바꿀 수 없는 값: auto_approve' })
  })
})

describe('Work별 질문 방식 (D72)', () => {
  it('스킬마다 덮어쓰고, 뺀 스킬은 앱 설정을 따른다', () => {
    expect(checkWorkSettings({ question_mode: { evidence: 'confirm_each' } })).toEqual({
      ok: true,
      value: { question_mode: { evidence: 'confirm_each' } },
    })
    expect(checkWorkSettings({ question_mode: {} })).toEqual({ ok: true, value: {} })
    expect(checkWorkSettings({})).toEqual({ ok: true, value: {} })
  })

  it('모르는 값과 M7의 자동 승인은 받지 않는다', () => {
    expect(checkWorkSettings({ question_mode: { evidence: 'x' } }).ok).toBe(false)
    expect(checkWorkSettings({ auto_approve: { fix: true } }).ok).toBe(false)
    expect(checkWorkSettings('x').ok).toBe(false)
  })
})

describe('화면의 스킬 이름', () => {
  it('노드의 화면 이름(D109)과 같은 순서, 같은 이름이다', () => {
    expect(SKILL_TITLES).toEqual(NODES.map((n) => [NODE_INFO[n].skill, NODE_INFO[n].title]))
  })
})
