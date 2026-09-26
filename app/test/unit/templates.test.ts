// 스킬 템플릿에 값을 채운 예시가 앱 검사기를 통과하는지 본다 (I18, D87).
// 스킬 원문(skills/)과 앱 검사기(core/validate)가 어긋나면 여기서 실패한다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NODE_INFO, NODES } from '../../src/core/pipeline'
import { checkIntentDraft, checkTask, isValid } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { NodeName } from '../../src/shared/contracts'

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
const draftTemplate = codeBlocks(read('work-start/SKILL.md'), 'markdown').find((b) =>
  b.startsWith('---\n'),
)

describe('템플릿이 있다', () => {
  it('_common.md에 handoff 템플릿, work-start에 intent.draft.md 템플릿이 있다', () => {
    expect(handoffTemplate).toBeDefined()
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
    const draft = fill(draftTpl, 'size', 'M')

    /** 노드의 필수 산출물. intake는 채운 intent 초안, verify의 pr.md는 첫 줄이 제목이다 */
    function artifacts(node: NodeName): Record<string, string> {
      return Object.fromEntries(
        NODE_INFO[node].artifacts.map((a) => [
          a,
          a === 'intent.draft.md' ? draft : a === 'pr.md' ? '# PR 제목\n\n## 요약\n' : '',
        ]),
      )
    }

    it.each(NODES)('%s: handoff 템플릿에 status만 채운 예시가 유효하다', (node) => {
      const check = checkTask({
        node,
        size: 'M',
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
        node: 'rca',
        size: 'M',
        files: { 'handoff.md': blocked },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors).toEqual([])
      expect(check.status).toBe('blocked')
    })

    it('반례: 채우지 않은 handoff 템플릿은 status 오류다', () => {
      const check = checkTask({
        node: 'rca',
        size: 'M',
        files: { 'handoff.md': handoffTpl, 'rca.md': '' },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors.map((e) => e.field)).toEqual(['status'])
    })

    it('반례: blocked인데 blocked_reason을 비워 두면 오류다', () => {
      const check = checkTask({
        node: 'rca',
        size: 'M',
        files: { 'handoff.md': fill(handoffTpl, 'status', 'blocked') },
        config: DEFAULT_CONFIG,
      })
      expect(check.errors.map((e) => e.message)).toEqual([
        '`blocked_reason` 없음: `status: blocked`일 때 필수',
      ])
    })

    it('intent.draft.md 템플릿에 size만 채운 예시가 유효하다', () => {
      const r = checkIntentDraft(draft, { warnChars: DEFAULT_CONFIG.intent_warn_chars })
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
      expect(r.value).toEqual({ type: 'bugfix', size: 'M' })
    })

    it('반례: 채우지 않은 intent.draft.md 템플릿은 size 오류다', () => {
      const r = checkIntentDraft(draftTpl, { warnChars: DEFAULT_CONFIG.intent_warn_chars })
      expect(r.errors.map((e) => [e.part, e.field])).toEqual([['header', 'size']])
    })
  },
)
