// [실제] 시험 레포 두 개 (8.4). 작은 Node 레포에 버그 하나와 의존성 없는 node:test 시험이 있다.
// 경로는 의도 승인 때 시험 도구가 고른 size로 정한다(D90). 요청도 그 경로에 맞게 둔다:
// M은 재현 방법과 수정 위치를 모르는 요청, S는 재현 방법이 있고 수정 위치가 한 곳인 요청이다 (D63).

const packageJson = (name: string) =>
  `${JSON.stringify({ name, private: true, type: 'module', scripts: { test: 'node --test' } }, null, 2)}\n`

export interface RealCase {
  name: 'M' | 'S'
  repo: string
  files: Record<string, string>
  request: string
}

/** M 경로: 리더보드가 두 자리 이상 점수에서 틀린다 (숫자를 글자로 정렬) */
export const M_CASE: RealCase = {
  name: 'M',
  repo: 'leaderboard',
  files: {
    'package.json': packageJson('leaderboard'),
    'src/rank.js': [
      '// 점수 목록에서 높은 순으로 n개',
      'export function topScores(scores, n) {',
      '  return [...scores].sort().reverse().slice(0, n)',
      '}',
      '',
    ].join('\n'),
    'src/leaderboard.js': [
      "import { topScores } from './rank.js'",
      '',
      '// 선수 목록에서 점수가 높은 n명의 이름',
      'export function leaderboard(players, n) {',
      '  const top = topScores(',
      '    players.map((p) => p.score),',
      '    n,',
      '  )',
      '  return top.map((score) => players.find((p) => p.score === score).name)',
      '}',
      '',
    ].join('\n'),
    'test/leaderboard.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { leaderboard } from '../src/leaderboard.js'",
      '',
      "test('상위 두 명', () => {",
      '  const players = [',
      "    { name: 'a', score: 3 },",
      "    { name: 'b', score: 7 },",
      "    { name: 'c', score: 5 },",
      '  ]',
      "  assert.deepStrictEqual(leaderboard(players, 2), ['b', 'c'])",
      '})',
      '',
    ].join('\n'),
  },
  request: [
    '리더보드 상위 목록이 가끔 틀리게 나온다. 점수가 가장 높은 선수가 목록에서 빠질 때가 있다.',
    '어떤 경우에 그런지는 아직 모르겠다. 레포의 테스트는 통과한다.',
    '',
  ].join('\n'),
}

/** S 경로: slugify가 첫 공백만 바꾼다 */
export const S_CASE: RealCase = {
  name: 'S',
  repo: 'slug',
  files: {
    'package.json': packageJson('slug'),
    'src/slug.js': [
      '// 제목을 URL 조각으로',
      'export function slugify(title) {',
      "  return title.trim().toLowerCase().replace(' ', '-')",
      '}',
      '',
    ].join('\n'),
    'test/slug.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { slugify } from '../src/slug.js'",
      '',
      "test('한 단어', () => assert.strictEqual(slugify('Hello'), 'hello'))",
      '',
    ].join('\n'),
  },
  request: [
    "slugify('Hello Big World')가 'hello-big world'를 돌려준다. 기대: 'hello-big-world'.",
    '',
    "재현: node -e \"import('./src/slug.js').then((m) => console.log(m.slugify('Hello Big World')))\"",
    '',
    '공백을 하나만 바꾸는 것 같다 (src/slug.js).',
    '',
  ].join('\n'),
}
