// 마무리 단계와 독립 리뷰의 순수 함수 (5.6.14, D493~D500): 리뷰 요청의 형식 검사, 독립 리뷰의 브리프·결과 읽기·결과 글,
// code_review 설정, Work 완료 화면의 리뷰 표시
import { describe, expect, it } from 'vitest'
import { stringify } from 'yaml'
import {
  checkWorkSettings,
  codeReviewOn,
  mergeWorkSettings,
  normalizeConfig,
} from '../../src/core/config'
import {
  CHECK_SCHEMA,
  FIND_SCHEMA,
  checkPrompt,
  findPrompt,
  readCheck,
  readFind,
  reviewError,
  reviewMarkdown,
  reviewPart,
  reviewResumePrompt,
  sortFindings,
  type Candidate,
  type ReviewBrief,
} from '../../src/core/independent-review'
import { completionReview } from '../../src/core/review'
import { checkTask, reviewRequestSections } from '../../src/core/validate'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import type { NodeName } from '../../src/shared/contracts'
import type { WorkType } from '../../src/shared/work'

function handoff(status: string): string {
  const data = {
    status,
    blocked_reason: null,
    decisions: [],
    assumptions: [],
    rejected: [],
    open_questions: [],
    intent_deviation: null,
    risks: [],
  }
  return `---\n${stringify(data)}---\n## 요약\n고쳤다.\n\n## 다음 task가 알아야 할 것\n- 없음\n`
}

const VERDICTS =
  '## 완료조건 판정\n| 완료조건 | 판정 | 근거 |\n|---|---|---|\n| a | 통과 | npm test |\n'
const TESTS = '## 테스트 파일 변경\n없음\n'

function check(
  files: Record<string, string>,
  opts: { node?: NodeName; type?: WorkType; requested?: boolean | null } = {},
) {
  const requested = opts.requested === undefined ? false : opts.requested
  return checkTask({
    node: opts.node ?? 'fix',
    type: opts.type ?? 'bugfix',
    files,
    config: DEFAULT_CONFIG,
    ...(requested === null ? {} : { finishing: { requested } }),
  })
}
const errors = (r: { errors: { message: string }[] }) => r.errors.map((e) => e.message)

describe('리뷰 요청의 형식 검사 (D494, 5.2.1)', () => {
  it('리뷰 요청 때는 단계 산출물과 판정표·테스트 파일 변경 절만 본다. pr.md는 아직 없다', () => {
    const ok = check({
      'handoff.md': handoff('review_requested'),
      'fix.md': '',
      'verification.md': `${VERDICTS}\n${TESTS}`,
    })
    expect(errors(ok)).toEqual([])
    expect(ok.status).toBe('review_requested')
    expect(errors(check({ 'handoff.md': handoff('review_requested') }))).toEqual([
      '`fix.md` 없음: `status: review_requested`일 때 필수 산출물',
      '`verification.md` 없음: `status: review_requested`일 때 필수 산출물',
    ])
    expect(
      errors(
        check({
          'handoff.md': handoff('review_requested'),
          'fix.md': '',
          'verification.md': VERDICTS,
        }),
      ),
    ).toEqual(['`## 테스트 파일 변경` 절 없음: 리뷰 요청의 필수 절'])
  })

  it('설계 Work는 테스트 파일 변경 대신 문서 밖 파일 변경 절을 본다 (D374)', () => {
    expect(reviewRequestSections('spec')).toEqual(['완료조건 판정', '문서 밖 파일 변경'])
    const r = check(
      {
        'handoff.md': handoff('review_requested'),
        'spec.md': '',
        'verification.md': `${VERDICTS}\n## 문서 밖 파일 변경\n없음\n`,
      },
      { node: 'spec', type: 'spec' },
    )
    expect(errors(r)).toEqual([])
  })

  it('리뷰 요청은 마무리 단계에서 task마다 한 번이고, 리뷰를 요청하기 전에는 awaiting_approval로 마무리하지 않는다', () => {
    const files = { 'fix.md': '', 'verification.md': `${VERDICTS}\n${TESTS}`, 'pr.md': '# 제목\n' }
    expect(
      errors(check({ ...files, 'handoff.md': handoff('review_requested') }, { requested: true })),
    ).toEqual([
      '독립 리뷰는 이미 받음: 리뷰를 받은 뒤의 순서를 마치고 `status: awaiting_approval`로 마무리 (D494)',
    ])
    expect(errors(check({ ...files, 'handoff.md': handoff('awaiting_approval') }))).toEqual([
      '판정표를 쓰고 `status: review_requested`로 독립 리뷰를 먼저 요청해야 함 (D494)',
    ])
    expect(
      errors(
        check(
          { ...files, 'handoff.md': handoff('review_requested') },
          { node: 'intake', requested: null },
        ),
      ),
    ).toEqual(['`review_requested`는 Work의 마지막 작업 단계만 씀 (D494)'])
    // blocked는 언제든 된다
    expect(
      errors(
        check({
          'handoff.md': handoff('blocked').replace(
            'blocked_reason: null',
            'blocked_reason: "로그 없음"',
          ),
        }),
      ),
    ).toEqual([])
  })

  it('리뷰를 받은 뒤 마무리할 때는 단계 산출물과 verification.md, pr.md가 필수이고 pr.md 첫 줄을 본다 (D500)', () => {
    const r = check(
      { 'handoff.md': handoff('awaiting_approval'), 'fix.md': '' },
      { requested: true },
    )
    expect(errors(r)).toEqual([
      '`verification.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
      '`pr.md` 없음: `status: awaiting_approval`일 때 필수 산출물',
    ])
    const bad = check(
      {
        'handoff.md': handoff('awaiting_approval'),
        'fix.md': '',
        'verification.md': '',
        'pr.md': '제목 없음\n',
      },
      { requested: true },
    )
    expect(bad.errors.map((e) => e.file)).toEqual(['pr.md'])
  })

  it('옛 Work의 fix는 마무리 단계가 아니라 지금처럼 검사한다 (D501)', () => {
    expect(
      errors(
        check({ 'handoff.md': handoff('awaiting_approval'), 'fix.md': '' }, { requested: null }),
      ),
    ).toEqual([])
  })
})

const CANDIDATES: Candidate[] = [
  {
    file: 'src/a.ts',
    line: 3,
    severity: '권장',
    kind: '정리',
    summary: '중복',
    scenario: '같은 함수를 두 번 고친다',
  },
  {
    file: 'src/b.ts',
    line: 9,
    severity: '권장',
    kind: '정확성',
    summary: '빈 배열',
    scenario: '[]면 NaN',
  },
  {
    file: 'src/c.ts',
    line: 1,
    severity: '사소',
    kind: '정확성',
    summary: '틀린 말',
    scenario: '없음',
  },
]

describe('독립 리뷰의 결과 읽기 (D486, D487, D495)', () => {
  it('찾기: 모양이 틀린 후보는 버리고 줄은 0 이상의 정수다', () => {
    const r = readFind({
      candidates: [
        {
          file: 'src/a.ts',
          line: 3.7,
          severity: '차단',
          kind: '정확성',
          summary: ' 빈 값 ',
          scenario: 's',
        },
        { file: '', line: 1, severity: '차단', kind: '정확성', summary: 'x', scenario: '' },
        { file: 'b', line: 1, severity: '높음', kind: '정확성', summary: 'x', scenario: '' },
      ],
      later: [
        { place: 'src/old.ts', problem: '오래된 중복' },
        { place: '', problem: 'x' },
      ],
    })
    expect(r).toEqual({
      candidates: [
        {
          file: 'src/a.ts',
          line: 3,
          severity: '차단',
          kind: '정확성',
          summary: '빈 값',
          scenario: 's',
        },
      ],
      later: [{ place: 'src/old.ts', problem: '오래된 중복' }],
    })
    expect(readFind('not json')).toBeNull()
  })

  it('확인: 틀림은 빼고, 답하지 않은 후보는 가능성이 기본이며, 확인이 바꾼 심각도를 쓴다', () => {
    const r = readCheck(
      {
        candidates: [
          { number: 1, verdict: 'confirmed', severity: '차단', evidence: 'a.ts:3 인용' },
          { number: 3, verdict: 'refuted', severity: '사소', evidence: 'c.ts:1에서 막음' },
        ],
        objections: [
          {
            criterion: '`npm test`가 통과한다',
            problem: '옛 코드의 실행',
            evidence: 'npm test 결과',
          },
        ],
      },
      CANDIDATES,
    )
    expect(r?.findings.map((f) => [f.file, f.severity, f.check, f.evidence])).toEqual([
      ['src/a.ts', '차단', 'confirmed', 'a.ts:3 인용'],
      ['src/b.ts', '권장', 'plausible', ''],
    ])
    expect(r?.objections).toEqual([
      { criterion: '`npm test`가 통과한다', problem: '옛 코드의 실행', evidence: 'npm test 결과' },
    ])
    expect(readCheck(null, CANDIDATES)).toBeNull()
  })

  it('지적은 심각한 것부터, 같은 심각도 안에서는 정확성이 정리보다 앞이다 (D487)', () => {
    const plain = CANDIDATES.map((c) => ({ ...c, check: 'plausible' as const, evidence: '' }))
    expect(sortFindings(plain).map((f) => f.file)).toEqual(['src/b.ts', 'src/a.ts', 'src/c.ts'])
  })

  it('codex exec가 받게 모든 필드가 필수이고 정의하지 않은 필드를 막는다 (D334)', () => {
    for (const schema of [FIND_SCHEMA, CHECK_SCHEMA]) {
      expect(schema.additionalProperties).toBe(false)
      expect(schema.required).toEqual(Object.keys(schema.properties))
    }
    const item = FIND_SCHEMA.properties.candidates.items
    expect(item.required).toEqual(Object.keys(item.properties))
  })
})

describe('독립 리뷰의 브리프 (D495)', () => {
  const guide = '# Finder\n\n찾기 지침\n\n## What to review\n\n- 각도\n\n# Checker\n\n확인 지침\n'
  const brief: ReviewBrief = {
    type: 'custom',
    worktree: '/w/tree',
    intent: '## 목표\n고친다\n',
    contextPath: '/w/tasks/03-apply/context.md',
    artifacts: [{ title: '조사 (t-02)', path: '/w/tasks/02-survey/survey.md' }],
    diffs: [
      {
        repo: '',
        dir: '/w/tree',
        base: 'base0001',
        file: '/w/tasks/03-apply/independent-review/diff.patch',
        untracked: ['new.ts'],
      },
      {
        repo: 'lib',
        dir: '/w/tree/lib',
        base: 'lib0001',
        file: '/w/tasks/03-apply/independent-review/lib.patch',
        untracked: [],
      },
    ],
    reviewPoints: '- 로그를 남기는지 본다\n',
  }

  it('지침의 # Finder와 # Checker를 잘라 쓰고, 없으면 오류다', () => {
    expect(reviewPart(guide, 'Finder')).toBe('찾기 지침\n\n## What to review\n\n- 각도')
    expect(reviewPart(guide, 'Checker')).toBe('확인 지침')
    expect(() => reviewPart('# Finder\n', 'Checker')).toThrow('`# Checker`')
  })

  it('찾기 브리프: 지침, worktree, context.md·산출물 경로, intent, 레포마다 변경 파일과 새 파일, 유형의 리뷰 관점', () => {
    const p = findPrompt(reviewPart(guide, 'Finder'), brief)
    expect(p).toContain('찾기 지침')
    expect(p).toContain('`/w/tree`')
    expect(p).toContain('`/w/tasks/03-apply/context.md`')
    expect(p).toContain('조사 (t-02): `/w/tasks/02-survey/survey.md`')
    expect(p).toContain('고친다')
    expect(p).toContain(
      'from base commit `base0001`: diff file `/w/tasks/03-apply/independent-review/diff.patch`',
    )
    expect(p).toContain('New files not added to git: `new.ts`')
    expect(p).toContain('Submodule `lib`')
    expect(p).toContain("## This Work type's review points\n\n- 로그를 남기는지 본다")
    expect(findPrompt('x', { ...brief, reviewPoints: '' })).not.toContain('review points')
  })

  it('확인 브리프: 후보에 번호를 붙이고 판정표 파일을 넣는다. 후보가 없으면 판정표만 본다', () => {
    const p = checkPrompt('확인 지침', brief, CANDIDATES.slice(0, 1), {
      path: '/w/tasks/03-apply/verification.md',
      text: VERDICTS,
    })
    expect(p).toContain(
      '1. [권장, 정리] src/a.ts:3 — 중복\n   실패 시나리오: 같은 함수를 두 번 고친다',
    )
    expect(p).toContain('## The verdict table (`/w/tasks/03-apply/verification.md`)')
    expect(p).toContain('| a | 통과 | npm test |')
    expect(checkPrompt('x', brief, [], { path: 'v', text: '' })).toContain(
      'None. Check only the verdict table.',
    )
  })
})

describe('독립 리뷰의 결과 글 (D495, D497)', () => {
  const findings =
    readCheck({ candidates: [], objections: [] }, CANDIDATES.slice(1, 2))?.findings ?? []

  it('절은 코드 리뷰, 지적, 나중에 정리할 곳, 판정표 이의다', () => {
    const md = reviewMarkdown({
      codeReview: true,
      findError: null,
      checkError: null,
      findings,
      later: [{ place: 'src/old.ts', problem: '중복' }],
      objections: [{ criterion: 'a', problem: '근거가 옛 코드', evidence: 'run' }],
    })
    expect(md.match(/^## .+$/gm)).toEqual([
      '## 코드 리뷰',
      '## 지적',
      '## 나중에 정리할 곳',
      '## 판정표 이의',
    ])
    expect(md).toContain('1. [권장] src/b.ts:9 — 빈 배열 (가능성)\n   실패 시나리오: []면 NaN')
    expect(md).toContain('- src/old.ts — 중복')
    expect(md).toContain('- a — 근거가 옛 코드 (근거: run)')
  })

  it('코드 리뷰를 끄면 그렇다고 쓰고, 실패하면 까닭을 쓴다', () => {
    const empty = { findings: [], later: [], objections: [] }
    expect(
      reviewMarkdown({ ...empty, codeReview: false, findError: null, checkError: null }),
    ).toContain('끔 — 판정표만 확인했습니다')
    const failed = {
      ...empty,
      codeReview: true,
      findError: '시간 초과',
      checkError: '구조화된 출력 없음',
    }
    expect(reviewMarkdown(failed)).toContain('실패 — 시간 초과')
    expect(reviewMarkdown(failed)).toContain('확인 실패 — 구조화된 출력 없음')
    expect(reviewError(failed)).toBe('코드 리뷰: 시간 초과 / 확인: 구조화된 출력 없음')
    expect(
      reviewError({ ...empty, codeReview: true, findError: null, checkError: null }),
    ).toBeUndefined()
  })

  it('다시 연 세션의 첫 입력은 결과 파일 경로와 다시 요청하지 말라는 것이다 (D496)', () => {
    const p = reviewResumePrompt('/w/tasks/02-fix/independent-review.md')
    expect(p).toContain('/w/tasks/02-fix/independent-review.md')
    expect(p).toContain('리뷰를 다시 요청하지 마세요')
    expect(p).not.toContain('\n')
  })
})

describe('code_review 설정 (D497, 5.1.1)', () => {
  it('앱 설정 기본은 켬이고 Work 설정이 앞이다', () => {
    expect(DEFAULT_CONFIG.code_review).toBe(true)
    expect(codeReviewOn(DEFAULT_CONFIG, {})).toBe(true)
    expect(codeReviewOn(DEFAULT_CONFIG, { code_review: false })).toBe(false)
    expect(codeReviewOn({ code_review: false }, { code_review: true })).toBe(true)
  })

  it('config.json의 값을 읽고, 틀린 값은 경고하고 기본값을 쓴다', () => {
    expect(normalizeConfig({ code_review: false }).config.code_review).toBe(false)
    const bad = normalizeConfig({ code_review: 'no' })
    expect(bad.config.code_review).toBe(true)
    expect(bad.warnings.join('\n')).toContain('code_review: true/false')
  })

  it('Work 설정은 true/false/null이고 null이면 지워 앱 설정을 따른다 (D72)', () => {
    expect(checkWorkSettings({ code_review: false })).toEqual({
      ok: true,
      value: { code_review: false },
    })
    expect(checkWorkSettings({ code_review: 'x' }).ok).toBe(false)
    const off = mergeWorkSettings({}, { code_review: false })
    expect(off).toEqual({ code_review: false })
    expect(mergeWorkSettings(off, { code_review: null })).toEqual({})
    expect(mergeWorkSettings(off, {})).toEqual(off)
  })
})

describe('Work 완료 화면의 독립 리뷰 표시 (D495, D497)', () => {
  const v2 = { type: 'bugfix' as const, pipeline: 2 as const }
  it('끝난 리뷰는 ok·off·failed, 받지 않았으면 none, 옛 Work의 verify는 null이다', () => {
    const done = { requested_at: 'a', finished_at: 'b' }
    expect(completionReview(v2, { node: 'fix', review: { ...done, code_review: true } })).toEqual({
      state: 'ok',
    })
    expect(completionReview(v2, { node: 'fix', review: { ...done, code_review: false } })).toEqual({
      state: 'off',
    })
    expect(
      completionReview(v2, {
        node: 'fix',
        review: { ...done, code_review: true, error: '시간 초과' },
      }),
    ).toEqual({ state: 'failed', error: '시간 초과' })
    expect(completionReview(v2, { node: 'fix' })).toEqual({ state: 'none' })
    expect(completionReview({ type: 'bugfix' }, { node: 'verify' })).toBeNull()
  })
})
