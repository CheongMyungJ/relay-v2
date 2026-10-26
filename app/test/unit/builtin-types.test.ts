// 유형 정의 (5.6.15, D506~D511): 기본 유형의 정의 표가 skills/types/와 같은지, 유형 설정과 그 설정이 가르는 앱 동작
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { BRANCH_TYPE, branchType, customBranchType } from '../../src/core/branch'
import {
  BUILTIN_TYPES,
  assemblyFlags,
  checkMethodOn,
  typeDefOf,
  typeTarget,
} from '../../src/core/builtin-types'
import { CUSTOM_QUESTION_LINE, buildContext, previousInputs } from '../../src/core/context'
import { parseBuiltinType } from '../../src/core/custom-type'
import { createWork } from '../../src/core/machine'
import { stageLead } from '../../src/core/review'
import { checkTask } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import { WORK_TYPES, type WorkCustomType, type WorkState } from '../../src/shared/work'

const SKILLS = path.resolve(__dirname, '../../../skills')

const CUSTOM: WorkCustomType = {
  id: 'doc-check',
  name: '문서 점검',
  description: '문서를 점검한다',
  request_hint: '',
  branch_prefix: 'docs',
  check_method: false,
  target: 'document',
  steps: [
    {
      id: 'check',
      title: '점검',
      sections: ['본 곳', '고친 곳'],
      lead: ['고친 곳'],
      question_mode: 'confirm_each',
      auto_approve: false,
      step_base: true,
    },
  ],
  source: 'global',
  hash: 'sha256:0',
}

/** 1판 커스텀 유형의 기록: 유형 설정이 없다 */
const OLD: WorkCustomType = {
  id: 'survey-apply',
  name: '조사 후 적용',
  description: '',
  steps: [{ id: 'survey', title: '조사', sections: [], auto_approve: false }],
  source: 'repo',
  hash: 'sha256:1',
}

describe('기본 유형의 정의 (D506)', () => {
  it('core의 표는 skills/types/<id>/type.json과 같다', () => {
    for (const id of WORK_TYPES) {
      const text = fs.readFileSync(path.join(SKILLS, 'types', id, 'type.json'), 'utf8')
      const r = parseBuiltinType(id, text)
      expect(r, id).toEqual({ ok: true, def: BUILTIN_TYPES[id] })
    }
  })

  it('기본 유형의 단계는 파이프라인의 노드이고, 설정은 지금 동작과 같다 (D509~D511)', () => {
    expect(WORK_TYPES.map((t) => BUILTIN_TYPES[t].steps.map((s) => s.id))).toEqual([
      ['fix'],
      ['design', 'implement'],
      ['refactor'],
      ['spec'],
      ['execute'],
    ])
    expect(WORK_TYPES.filter((t) => checkMethodOn({ type: t }))).toEqual(['general'])
    expect(WORK_TYPES.filter((t) => typeTarget({ type: t }) === 'document')).toEqual(['spec'])
    expect(BRANCH_TYPE).toEqual({
      bugfix: 'fix',
      feature: 'feat',
      refactor: 'refactor',
      spec: 'spec',
      general: 'chore',
      custom: 'custom',
    })
  })
})

describe('유형 설정 (D509~D511)', () => {
  it('기본 유형은 표, 커스텀은 복사한 기록이다. 설정이 없는 1판 기록은 확인 방법을 켠 코드 유형이다', () => {
    expect(typeDefOf({ type: 'bugfix' })).toBe(BUILTIN_TYPES.bugfix)
    expect(typeDefOf({ type: 'custom', custom_type: CUSTOM })).toBe(CUSTOM)
    expect(typeDefOf({ type: 'custom' })).toBeNull()
    expect(assemblyFlags({ type: 'bugfix' })).toEqual(['code', 'no-check-method', 'builtin'])
    expect(assemblyFlags({ type: 'spec' })).toEqual(['document', 'no-check-method', 'builtin'])
    expect(assemblyFlags({ type: 'general' })).toEqual(['code', 'check-method', 'builtin'])
    expect(assemblyFlags({ type: 'custom', custom_type: CUSTOM })).toEqual([
      'document',
      'no-check-method',
      'custom',
    ])
    expect(assemblyFlags({ type: 'custom', custom_type: OLD })).toEqual([
      'code',
      'check-method',
      'custom',
    ])
    expect(assemblyFlags({ type: 'custom' })).toEqual(['code', 'check-method', 'custom'])
  })

  it('작업 브랜치의 {type}은 정의의 브랜치 접두사, 비었으면 유형 id다 (D511)', () => {
    expect(customBranchType(CUSTOM)).toBe('docs')
    expect(customBranchType(OLD)).toBe('survey-apply')
    expect(branchType('custom', customBranchType(CUSTOM))).toBe('docs')
    expect(branchType('bugfix')).toBe('fix')
  })

  const handoff = [
    '---',
    'status: awaiting_approval',
    'blocked_reason:',
    'decisions: []',
    'assumptions: []',
    'rejected: []',
    'open_questions: []',
    'intent_deviation: null',
    'risks: []',
    'knowledge_candidates: []',
    '---',
    '## 요약',
    '요약',
    '## 다음 task가 알아야 할 것',
    '- 없음',
    '',
  ].join('\n')
  const draft =
    '## 목표\n목표\n## 비목표\n없음\n## 원하는 결과\n결과\n## 완료조건\n- [ ] 문서의 모순이 없다\n'
  const intake = (o: { checkMethod?: boolean }) =>
    checkTask({
      node: 'intake',
      type: 'custom',
      files: { 'handoff.md': handoff, 'intent.draft.md': draft },
      config: DEFAULT_CONFIG,
      ...o,
    }).errors.map((e) => e.message)

  it('확인 방법을 끈 커스텀 유형의 intent는 확인 방법 없이도 맞다. 설정을 주지 않으면 지금처럼 요구한다 (D509)', () => {
    expect(intake({ checkMethod: false })).toEqual([])
    expect(intake({}).join()).toContain('확인 방법')
  })

  it('문서 대상 유형은 리뷰를 요청할 때 문서 밖 파일 변경 절도 있어야 한다 (D510)', () => {
    const r = checkTask({
      node: 'custom',
      type: 'custom',
      target: 'document',
      files: {
        'handoff.md': handoff.replace('awaiting_approval', 'review_requested'),
        'check.md': '## 본 곳\n## 고친 곳\n',
        'verification.md': '## 완료조건 판정\n| a | 통과 | b |\n',
      },
      config: DEFAULT_CONFIG,
      customStep: { id: 'check', sections: ['본 곳', '고친 곳'] },
      finishing: { requested: false },
    })
    expect(r.errors.map((e) => e.message)).toEqual([
      '`## 문서 밖 파일 변경` 절 없음: 리뷰 요청의 필수 절',
    ])
  })

  it('승인 화면 [요약]은 정의의 lead 절만, 없으면 모든 절이다 (D511)', () => {
    const files = { 'check.md': '## 본 곳\n가\n## 고친 곳\n나\n' }
    expect(stageLead('custom', files, CUSTOM.steps[0])?.sections.map((s) => s.title)).toEqual([
      '고친 곳',
    ])
    const all = { ...CUSTOM.steps[0], lead: [] } as (typeof CUSTOM.steps)[number]
    expect(stageLead('custom', files, all)?.sections.map((s) => s.title)).toEqual([
      '본 곳',
      '고친 곳',
    ])
  })

  it('정의가 질문 방식을 정한 커스텀 단계는 그 질문 방식 줄이다 (D511)', () => {
    const created = createWork({
      type: 'custom',
      customType: CUSTOM,
      workId: 'w-20261026-001',
      baseBranch: 'main',
      baseCommit: 'b',
      at: '2026-10-26T10:00:00+09:00',
    })
    const work: WorkState = {
      ...created.work,
      tasks: [
        ...created.work.tasks,
        {
          ...created.work.tasks[0],
          id: 't-02',
          seq: 2,
          node: 'custom',
          step: 'check',
          step_title: '점검',
        } as WorkState['tasks'][number],
      ],
    }
    const task = work.tasks[1]
    if (!task) throw new Error('task 없음')
    const context = (w: WorkState) =>
      buildContext({
        work: w,
        task,
        config: DEFAULT_CONFIG,
        taskDir: '/t',
        draftsDir: '/d',
        projectId: 'p',
        request: { path: '/r', text: '요청' },
        intent: null,
        decisionLog: '',
        ...previousInputs([]),
      })
    expect(context(work)).toContain(
      '결정마다 확인 (`confirm_each`). 이 유형의 정의가 정한 질문 방식이다',
    )
    const fixed = {
      ...work,
      custom_type: { ...CUSTOM, steps: [{ ...CUSTOM.steps[0], question_mode: null }] },
    } as WorkState
    expect(context(fixed)).toContain(CUSTOM_QUESTION_LINE)
  })
})
