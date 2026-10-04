// 스킬 템플릿에 값을 채운 예시가 앱 검사기를 통과하는지 본다 (I18, D87).
// 스킬 원문(skills/)과 앱 검사기(core/validate)가 어긋나면 여기서 실패한다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_NODES, NODE_INFO, PIPELINES } from '../../src/core/pipeline'
import { checkIntentDraft, checkTask, isValid } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { NodeName } from '../../src/shared/contracts'
import { WORK_TYPES, type WorkType } from '../../src/shared/work'
import { selectType } from '../../src/adapters/claude'

const SKILLS = path.resolve(__dirname, '../../../skills')
const read = (p: string) => fs.readFileSync(path.join(SKILLS, p), 'utf8').replace(/\r\n/g, '\n')

function codeBlocks(text: string, lang: string): string[] {
  return [...text.matchAll(new RegExp('^```' + lang + '\\n([\\s\\S]*?)^```', 'gm'))].map(
    (m) => m[1] ?? '',
  )
}

/** 템플릿의 "field:  # 주석" 줄에 값을 넣는다 */
function fill(template: string, field: string, value: string): string {
  const re = new RegExp(`^${field}:[ \\t]*(#.*)?$`, 'm')
  expect(template, `템플릿에 ${field}: 줄이 있다`).toMatch(re)
  return template.replace(
    re,
    (_m, comment?: string) => `${field}: ${value}${comment ? `   ${comment}` : ''}`,
  )
}

const handoffTemplate = codeBlocks(read('_common.md'), 'yaml').find((b) => b.includes('status:'))
/** 값을 채운 handoff 예시 (D221) */
const filledHandoff = codeBlocks(read('_common.md'), 'yaml').find(
  (b) => b !== handoffTemplate && b.includes('status: awaiting_approval'),
)
/** 유형마다 조립한 work-start의 intent 초안 템플릿 (D279) */
const draftTemplateOf = (type: WorkType) =>
  codeBlocks(selectType(read('work-start/SKILL.md'), type), 'markdown').find((b) =>
    b.startsWith('## 목표\n'),
  )
const draftTemplate = draftTemplateOf('bugfix')

describe('스킬 원본이 있다 (5.6.3)', () => {
  it('노드마다 skills/<스킬>/SKILL.md가 있다. design, implement, refactor, execute를 포함한다 (D232, D258, D302)', () => {
    for (const n of [...ALL_NODES, 'respond' as const]) {
      const skill = NODE_INFO[n].skill
      expect(fs.existsSync(path.join(SKILLS, skill, 'SKILL.md')), skill).toBe(true)
    }
  })
})

describe('템플릿이 있다', () => {
  it('_common.md에 handoff 템플릿과 값을 채운 예시, work-start에 intent.draft.md 템플릿이 있다', () => {
    expect(handoffTemplate).toBeDefined()
    expect(filledHandoff).toBeDefined()
    expect(draftTemplate).toBeDefined()
  })
})

describe.runIf(handoffTemplate && draftTemplate)(
  '템플릿 예시가 앱 검사기를 통과한다 (I18, D87)',
  () => {
    const handoffTpl = handoffTemplate ?? ''
    const draftTpl = draftTemplate ?? ''
    const awaiting = fill(handoffTpl, 'status', 'awaiting_approval')
    const blocked = fill(
      fill(handoffTpl, 'status', 'blocked'),
      'blocked_reason',
      '재현에 필요한 운영 로그가 없음',
    )
    // intent 초안 템플릿에는 머리글이 없다 (D236)
    const draft = draftTpl

    /** 노드의 필수 산출물. intake는 채운 intent 초안, verify의 pr.md는 첫 줄이 제목이다 */
    function artifacts(node: NodeName): Record<string, string> {
      return Object.fromEntries(
        NODE_INFO[node].artifacts.map((a) => [
          a,
          a === 'intent.draft.md' ? draft : a === 'pr.md' ? '# PR 제목\n\n## 요약\n' : '',
        ]),
      )
    }

    it.each(ALL_NODES)('%s: handoff 템플릿에 status만 채운 예시가 유효하다', (node) => {
      const check = checkTask({
        node,
        // 노드가 있는 첫 유형 (I90)
        type: WORK_TYPES.find((t) => PIPELINES[t].includes(node)) ?? 'bugfix',
        files: { 'handoff.md': awaiting, ...artifacts(node) },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors).toEqual([])
      // 템플릿의 필드가 스키마의 필드와 같아 정의되지 않은 필드 경고도 없다
      expect(check.warnings).toEqual([])
      expect(isValid(check)).toBe(true)
      expect(check.status).toBe('awaiting_approval')
    })

    it('blocked와 blocked_reason을 채운 예시가 유효하다 (D96)', () => {
      const check = checkTask({
        node: 'fix',
        type: 'bugfix',
        files: { 'handoff.md': blocked },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors).toEqual([])
      expect(check.status).toBe('blocked')
    })

    it('값을 채운 handoff 예시가 유효하다. 큰따옴표 안의 ": "와 백틱은 글로 읽힌다 (D221)', () => {
      const check = checkTask({
        node: 'fix',
        type: 'bugfix',
        files: { 'handoff.md': filledHandoff ?? '', ...artifacts('fix') },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors).toEqual([])
      expect(check.warnings).toEqual([])
      expect(check.status).toBe('awaiting_approval')
      expect(check.handoffHeader?.decisions).toEqual([
        { what: '빈 배열의 평균은 0으로 한다', why: '요청의 완료조건: `avg([])`는 0', by: 'human' },
      ])
    })

    it('반례: 예시의 글 값을 따옴표 없이 쓰면 ": "가 든 글을 YAML이 다르게 읽어 형식 오류다 (D221)', () => {
      const bare = (filledHandoff ?? '').replace(
        'why: "요청의 완료조건: `avg([])`는 0"',
        'why: 요청의 완료조건: `avg([])`는 0',
      )
      expect(bare).not.toBe(filledHandoff)
      const check = checkTask({
        node: 'fix',
        type: 'bugfix',
        files: { 'handoff.md': bare, ...artifacts('fix') },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors.length).toBeGreaterThan(0)
      expect(isValid(check)).toBe(false)
    })

    it('반례: 큰따옴표 안의 역슬래시는 이스케이프라, Windows 경로를 그대로 쓰면 형식 오류이거나 다른 글자가 된다 (D221)', () => {
      /** 예시의 첫 결정의 what 줄을 바꿔 검사한다 */
      const withWhat = (what: string) =>
        checkTask({
          node: 'fix',
          type: 'bugfix',
          files: {
            'handoff.md': (filledHandoff ?? '').replace(
              'what: "빈 배열의 평균은 0으로 한다"',
              `what: ${what}`,
            ),
            ...artifacts('fix'),
          },
          config: DEFAULT_CONFIG,
        })
      const what = (check: ReturnType<typeof checkTask>) =>
        check.handoffHeader?.decisions?.[0]?.what
      // \c는 잘못된 이스케이프라 형식 오류다
      expect(withWhat('"src\\components\\App.tsx 수정"').errors.length).toBeGreaterThan(0)
      // \t와 \f는 오류 없이 TAB과 폼 피드 문자가 된다
      expect(what(withWhat('"app\\test\\flow 폴더"'))).toBe('app\u0009est\u000clow 폴더')
      // 규칙대로 경로는 /로, 역슬래시는 \\로 쓰면 글자 그대로다
      expect(what(withWhat('"src/components/App.tsx 수정"'))).toBe('src/components/App.tsx 수정')
      expect(what(withWhat('"app\\\\test 폴더"'))).toBe('app\\test 폴더')
    })

    it('반례: 채우지 않은 handoff 템플릿은 status 오류다', () => {
      const check = checkTask({
        node: 'fix',
        type: 'bugfix',
        files: { 'handoff.md': handoffTpl, 'fix.md': '' },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors.map((e) => e.field)).toEqual(['status'])
    })

    it('반례: blocked인데 blocked_reason을 비워 두면 오류다', () => {
      const check = checkTask({
        node: 'fix',
        type: 'bugfix',
        files: { 'handoff.md': fill(handoffTpl, 'status', 'blocked') },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors.map((e) => e.message)).toEqual([
        '`blocked_reason` 없음: `status: blocked`일 때 필수',
      ])
    })

    it.each(WORK_TYPES)(
      '%s: intent.draft.md 템플릿이 그대로 유효하다. 머리글이 없다 (D236, I58, D279)',
      (type) => {
        const tpl = draftTemplateOf(type) ?? ''
        // 일반은 완료조건 줄마다 확인 방법이 있어야 한다 (D305, I86)
        const r = checkIntentDraft(tpl, { warnChars: DEFAULT_CONFIG.intent_warn_chars, type })
        expect(r.errors).toEqual([])
        expect(r.warnings).toEqual([])
        expect(tpl).not.toMatch(/^---$/m)
        expect(tpl).not.toMatch(/^(type|size):/m)
        expect(tpl).not.toContain('<!--')
      },
    )
  },
)
