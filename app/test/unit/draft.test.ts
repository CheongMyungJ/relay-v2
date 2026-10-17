// [단위] Work 초안 (D404, I135): 만든 곳과 상관없는 Markdown 파일의 머리와 본문, 형식 오류.
import { describe, expect, it } from 'vitest'
import { DRAFT_MAX_BYTES, isDraftFile, parseDraft } from '../../src/core/draft'

const PROJECTS = ['shop-a1b2c3', 'api-0f0f0f']

const draft = (head: string[], body: string) => ['---', ...head, '---', body].join('\n')

describe('Work 초안 읽기 (D404)', () => {
  it('머리의 project, type, base와 본문(요청)을 읽는다', () => {
    expect(
      parseDraft(
        draft(
          ['project: shop-a1b2c3', 'type: feature', 'base: develop'],
          '\n쿠폰 적용\n\n자세히\n',
        ),
        PROJECTS,
      ),
    ).toEqual({
      project: 'shop-a1b2c3',
      type: 'feature',
      base: 'develop',
      request: '쿠폰 적용\n\n자세히',
      errors: [],
    })
  })

  it('base는 선택이다. 모르는 키는 무시하고 따옴표와 CRLF, BOM을 받는다', () => {
    const text = `﻿${draft(['project: "api-0f0f0f"', "type: 'bugfix'", 'title: 무시'], '고칠 것')}`
    expect(parseDraft(text.replace(/\n/g, '\r\n'), PROJECTS)).toEqual({
      project: 'api-0f0f0f',
      type: 'bugfix',
      base: null,
      request: '고칠 것',
      errors: [],
    })
  })

  it('형식 오류는 모으고 맞는 칸은 그대로 둔다: 모르는 프로젝트, 모르는 유형, 빈 요청', () => {
    expect(parseDraft(draft(['project: gone-000000', 'type: bugfix'], '요청'), PROJECTS)).toEqual({
      project: null,
      type: 'bugfix',
      base: null,
      request: '요청',
      errors: ['모르는 프로젝트: gone-000000'],
    })
    expect(parseDraft(draft(['project: shop-a1b2c3', 'type: hotfix'], '  \n'), PROJECTS)).toEqual({
      project: 'shop-a1b2c3',
      type: null,
      base: null,
      request: '',
      errors: [
        '모르는 유형: hotfix (bugfix | feature | refactor | spec | general 중 하나)',
        '요청(본문)이 비어 있음',
      ],
    })
    expect(parseDraft(draft([], '요청'), PROJECTS).errors).toEqual([
      'project(프로젝트 id)가 없음',
      'type(bugfix | feature | refactor | spec | general)이 없음',
    ])
  })

  it('머리가 없거나 닫히지 않으면 오류이고 글 전체를 요청으로 둔다', () => {
    expect(parseDraft('그냥 요청\n둘째 줄', PROJECTS)).toEqual({
      project: null,
      type: null,
      base: null,
      request: '그냥 요청\n둘째 줄',
      errors: ['머리(--- 사이의 project, type)가 없음'],
    })
    expect(parseDraft('---\nproject: shop-a1b2c3\n요청', PROJECTS).errors).toEqual([
      '머리(--- 사이의 project, type)가 없음',
    ])
  })

  it('64KB를 넘으면 형식 오류다 (I135)', () => {
    const big = draft(['project: shop-a1b2c3', 'type: bugfix'], '가'.repeat(DRAFT_MAX_BYTES / 3))
    expect(parseDraft(big, PROJECTS)).toEqual({
      project: null,
      type: null,
      base: null,
      request: '',
      errors: ['파일이 64KB를 넘음'],
    })
  })

  it('초안 파일은 숨김 파일이 아닌 *.md다', () => {
    expect(isDraftFile('coupon.md')).toBe(true)
    expect(isDraftFile('Coupon.MD')).toBe(true)
    expect(isDraftFile('notes.txt')).toBe(false)
    expect(isDraftFile('.draft.md')).toBe(false)
    expect(isDraftFile('../session.json')).toBe(false)
    expect(isDraftFile('a/b.md')).toBe(false)
  })
})
