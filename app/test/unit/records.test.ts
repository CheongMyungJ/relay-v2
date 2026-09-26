import { describe, expect, it } from 'vitest'
import {
  DECISIONS_UNREADABLE,
  appendBlock,
  confirmedIntent,
  decisionsBlock,
  localIso,
  localMinute,
  nextWorkId,
  projectId,
  workId,
} from '../../src/core/records'
import { checkIntentDraft, parseFrontMatter } from '../../src/core/validate'

describe('시각', () => {
  it('현지 시각과 오프셋을 담은 ISO 8601로 쓴다 (5.5)', () => {
    const iso = localIso(new Date(2026, 8, 25, 14, 32, 10))
    expect(iso).toMatch(/^2026-09-25T14:32:10[+-]\d{2}:\d{2}$/)
    // 오프셋을 붙인 값이 같은 순간을 가리킨다
    expect(new Date(iso).getTime()).toBe(new Date(2026, 8, 25, 14, 32, 10).getTime())
  })

  it('decisions.md의 머리 줄은 적힌 현지 시각의 분까지다', () => {
    expect(localMinute('2026-09-25T14:32:10+09:00')).toBe('2026-09-25 14:32')
    expect(() => localMinute('어제')).toThrow()
  })
})

describe('work-id와 project-id (5.1)', () => {
  it('work-id는 w-YYYYMMDD-NNN이고 그날 쓰이지 않은 다음 번호다', () => {
    expect(workId('2026-09-26T10:00:00+09:00', 1)).toBe('w-20260926-001')
    expect(workId('2026-09-26T10:00:00+09:00', 12)).toBe('w-20260926-012')
    const at = '2026-09-26T23:59:00+09:00'
    expect(nextWorkId(at, [])).toBe('w-20260926-001')
    expect(nextWorkId(at, ['w-20260926-001', 'w-20260926-002', 'w-20260925-003'])).toBe(
      'w-20260926-003',
    )
    // 비어 있는 번호가 있으면 그 번호를 쓴다(예: 브랜치만 남은 번호는 taken에 들어 있다)
    expect(nextWorkId(at, ['w-20260926-002'])).toBe('w-20260926-001')
  })

  it('project-id는 <폴더 이름>-<해시 앞 6자>다', () => {
    expect(projectId('my-api', '3f9a1c0b77')).toBe('my-api-3f9a1c')
    expect(projectId('한글 레포 (2)', 'abcdef99')).toBe('한글 레포 (2)-abcdef')
  })

  it('폴더 이름의 권한 규칙 패턴 문자 [ ] * ? \\는 _로 바꾼다 (D111)', () => {
    expect(projectId('[2024-06] Reports', '123456')).toBe('_2024-06_ Reports-123456')
    expect(projectId('a*b?c\\d', '123456')).toBe('a_b_c_d-123456')
  })
})

describe('decisions.md (5.4)', () => {
  const at = '2026-09-25T14:32:10+09:00'

  it('머리 줄은 task id, 노드, 승인 시각, 승인 방식이고 항목은 [사람]/[AI] 뒤에 what — why다', () => {
    expect(
      decisionsBlock({
        taskId: 't-04',
        node: 'rca',
        at,
        by: 'human',
        decisions: [
          {
            what: '원인은 토큰 만료 시각 비교의 타임존 불일치',
            why: '재현 로그의 차이가 UTC/KST 9시간과 정확히 일치',
            by: 'ai',
          },
          { what: 'refresh 경로도 이번 수정 범위에 포함', why: '같은 비교 함수를 씀', by: 'human' },
        ],
      }),
    ).toBe(
      [
        '## t-04 rca — 2026-09-25 14:32 (사람 승인)',
        '- [AI] 원인은 토큰 만료 시각 비교의 타임존 불일치 — 재현 로그의 차이가 UTC/KST 9시간과 정확히 일치',
        '- [사람] refresh 경로도 이번 수정 범위에 포함 — 같은 비교 함수를 씀',
        '',
      ].join('\n'),
    )
  })

  it('결정이 없으면 "없음", 머리글을 읽지 못했으면 그렇게 적는다 (D112). 여러 줄은 한 줄로 편다', () => {
    const base = { taskId: 't-02', node: 'evidence' as const, at, by: 'human' as const }
    expect(decisionsBlock({ ...base, decisions: [] })).toBe(
      '## t-02 evidence — 2026-09-25 14:32 (사람 승인)\n없음\n',
    )
    expect(decisionsBlock({ ...base, decisions: null })).toBe(
      `## t-02 evidence — 2026-09-25 14:32 (사람 승인)\n${DECISIONS_UNREADABLE}\n`,
    )
    expect(
      decisionsBlock({ ...base, by: 'auto', decisions: [{ what: 'a\n  b', why: 'c', by: 'ai' }] }),
    ).toBe('## t-02 evidence — 2026-09-25 14:32 (자동 승인)\n- [AI] a b — c\n')
  })

  it('덩어리는 빈 줄 하나로 띄워 붙인다', () => {
    const a = '## t-01 intake — 2026-09-25 14:00 (사람 승인)\n없음\n'
    const b = '## t-02 evidence — 2026-09-25 14:32 (사람 승인)\n없음\n'
    expect(appendBlock('', a)).toBe(a)
    expect(appendBlock(`${a}\n\n\n`, b)).toBe(`${a}\n${b}`)
    expect(appendBlock(a.replace(/\n/g, '\r\n'), b)).toBe(`${a}\n${b}`)
  })
})

describe('intent.md 확정본 (5.3)', () => {
  const draft = [
    '---',
    'type: bugfix   # bugfix only',
    'size: M        # S | M | L',
    'extra: 무시됨',
    '---',
    '## 목표',
    'KST에서 토큰이 바로 만료되는 문제를 고친다.',
    '',
    '## 비목표',
    '- 없음',
    '',
    '## 원하는 결과',
    '만료 판정이 수명과 일치한다.',
    '',
    '## 완료조건',
    '- [ ] 재현 절차가 더 이상 실패하지 않는다',
    '',
  ].join('\n')

  it('앱이 schema_version과 version을 붙이고, 사람이 고른 size를 쓰고, 본문은 그대로 둔다 (D88)', () => {
    const text = confirmedIntent(draft, { version: 1, size: 'S' })
    expect(text).toBe(
      [
        '---',
        'schema_version: 1',
        'version: 1',
        'type: bugfix',
        'size: S',
        '---',
        '## 목표',
        'KST에서 토큰이 바로 만료되는 문제를 고친다.',
        '',
        '## 비목표',
        '- 없음',
        '',
        '## 원하는 결과',
        '만료 판정이 수명과 일치한다.',
        '',
        '## 완료조건',
        '- [ ] 재현 절차가 더 이상 실패하지 않는다',
        '',
      ].join('\n'),
    )
    const fm = parseFrontMatter(text)
    expect(fm.ok && fm.data).toEqual({ schema_version: 1, version: 1, type: 'bugfix', size: 'S' })
  })

  it('CRLF 초안도 LF로 쓴다. 확정본 본문은 초안 검사를 그대로 통과한다', () => {
    const text = confirmedIntent(draft.replace(/\n/g, '\r\n'), { version: 2, size: 'M' })
    expect(text).not.toContain('\r')
    expect(text).toContain('version: 2\n')
    // schema_version, version은 초안 스키마에 없는 필드라 경고만 나온다 (D85)
    expect(checkIntentDraft(text, { warnChars: 1500 }).errors).toEqual([])
  })

  it('머리글을 읽을 수 없거나 type이 없으면 만들지 않는다', () => {
    expect(() => confirmedIntent('## 목표\n', { version: 1, size: 'M' })).toThrow()
    expect(() =>
      confirmedIntent('---\nsize: M\n---\n## 목표\n', { version: 1, size: 'M' }),
    ).toThrow(/type/)
  })
})
