// 요구사항 추출 run의 가짜 결과 ([흐름]과 [스모크]가 같이 쓴다). REPO_FILES의 src/avg.js를 본 survey와 command 렌즈 trace다.
// trace의 checklist는 렌즈 카드의 열쇠 목록을 받는다(skills/extract/load.mjs의 loadChecklist).
export const code = (p: string, line: number, quote: string): Record<string, unknown> => ({
  kind: 'code',
  path: `{wt}/${p}`,
  start: line,
  end: line,
  quote,
  command: null,
})

export function extractSurvey(extra: Record<string, unknown> = {}) {
  return {
    outcome: 'done',
    outcome_reason: '빌드 설정과 진입점을 봤다',
    configs: [
      {
        key: 'c1',
        name: 'node',
        status: 'confirmed',
        select: 'npm test',
        build_command: null,
        anchors: [code('package.json', 5, '"test": "node --test"')],
      },
    ],
    inventory: [
      {
        key: 'i1',
        kind: 'other',
        name: 'avg',
        configs: ['all'],
        anchors: [code('src/avg.js', 1, 'export function avg(xs) {')],
        notes: '',
      },
    ],
    boundaries: [],
    units: [
      {
        key: 'k1',
        purpose: 'avg의 빈 배열 처리',
        lens: 'command',
        scope: 'src/avg.js avg',
        priority: 'high',
        depends_on: [],
        reason: '유일한 공개 함수',
      },
    ],
    not_found: [],
    unknowns: [],
    human_decisions: [],
    checkpoint: null,
    ...extra,
  }
}

export function extractTrace(checklist: string[]) {
  return {
    outcome: 'done',
    outcome_reason: '끝까지 따라갔다',
    observations: [
      {
        key: 'o1',
        text: '빈 배열이면 합 0을 길이 0으로 나눈다',
        configs: ['all'],
        anchors: [code('src/avg.js', 2, 'return xs.reduce((a, b) => a + b, 0) / xs.length')],
        inference: false,
      },
    ],
    quantities: [],
    requirements: [],
    constraints: [],
    impl_choices: [],
    unknowns: [],
    conflicts: [],
    absences: [],
    checklist: Object.fromEntries(
      checklist.map((id) => [id, { status: 'unknown', refs: [], searches: [] }]),
    ),
    followups: [],
    human_decisions: [],
    checkpoint: null,
  }
}

/** integrate run의 가짜 결과 (AI 결정 110, 111): 관점마다 "모름" 칸 하나. 연결과 단위는 넘겨 준 것 */
export function extractIntegrate(
  perspectives: string[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    outcome: 'done',
    outcome_reason: '기록 전체를 관점마다 봤다',
    links: [],
    coverage: Object.fromEntries(
      perspectives.map((p) => [
        p,
        [{ configs: ['all'], status: 'unknown', ids: [], units: [], searches: [], note: '' }],
      ]),
    ),
    units: [],
    unknowns: [],
    human_decisions: [],
    checkpoint: null,
    ...extra,
  }
}

/** review run의 가짜 결과 (AI 결정 112): 질문은 모든 구성에서 답하고 서술은 반박하지 못한다 */
export function extractReview(answers: string[], verdicts: string[]): Record<string, unknown> {
  const at = code('src/avg.js', 1, 'export function avg(xs) {')
  return {
    outcome: 'done',
    outcome_reason: '질문과 서술을 다시 봤다',
    answers: Object.fromEntries(
      answers.map((k) => [
        k,
        {
          status: 'answered',
          text: '모든 구성에 있다',
          values: [],
          configs: ['all'],
          anchors: [at],
          searches: [],
        },
      ]),
    ),
    verdicts: Object.fromEntries(
      verdicts.map((k) => [
        k,
        { verdict: 'not_refuted', attempts: ['다른 호출 경로를 찾았다'], anchors: [at], note: '' },
      ]),
    ),
    unknowns: [],
    checkpoint: null,
  }
}

/** summarize run의 가짜 결과 (AI 결정 113) */
export function extractSummarize(ids: string[] = ['u-0001']): Record<string, unknown> {
  return {
    overview: [{ text: '평균 계산 하나를 분석했다', ids }],
    handoff_summary: { text: '미확정은 없다', ids: [] },
    risks: [{ text: '빈 배열의 동작은 확인되지 않음', ids }],
  }
}

/**
 * 구성별 빌드 인덱스를 만들 작은 make 저장소 (AI 결정 118): 구성 lo와 hi. tick_isr는 lo에서만 강하게 정의되고, fan_isr는
 * 둘 다 weak 기본 정의가 있고 hi에서만 강한 정의가 있다. 빌드 폴더가 없어 실제 빌드는 실패한다(인덱스는 make -n -B로 만든다)
 */
export const BUILD_REPO_FILES: Record<string, string> = {
  Makefile: [
    'CFLAGS = -Iinc -Wall',
    'lo:',
    '\t$(CC) $(CFLAGS) -DBOARD_LO -c src/main.c -o out/main.o',
    '\t$(CC) $(CFLAGS) -DBOARD_LO -c src/tick.c -o out/tick.o',
    'hi:',
    '\t$(CC) $(CFLAGS) -DBOARD_HI -c src/main.c -o out/main.o',
    '\t$(CC) $(CFLAGS) -DBOARD_HI -c src/tick.c -o out/tick.o',
    '.PHONY: lo hi',
    '',
  ].join('\n'),
  'inc/board.h': '#define TICK_HZ 100\n',
  'src/tick.c': [
    '#include "board.h"',
    'int counter;',
    '#ifdef BOARD_LO',
    'void tick_isr(void) { counter += TICK_HZ; }',
    '#endif',
    '__attribute__((weak)) void fan_isr(void) {}',
    '',
  ].join('\n'),
  'src/main.c': [
    '#include "board.h"',
    '#ifdef BOARD_HI',
    'void fan_isr(void) { }',
    '#endif',
    'int main(void) { return 0; }',
    '',
  ].join('\n'),
}
