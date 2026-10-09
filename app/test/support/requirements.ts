// 요구사항 추출 run의 가짜 결과 ([흐름]과 [스모크]가 같이 쓴다). REPO_FILES의 src/avg.js를 본 survey와 command 렌즈 trace다.
// trace의 checklist는 렌즈 카드의 열쇠 목록을 받는다(skills/extract/load.mjs의 loadChecklist).
export const code = (p: string, line: number, quote: string) => ({
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
