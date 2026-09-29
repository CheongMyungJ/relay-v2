// [실제] PR 진행과 대응 (docs/implementation.md M9, M10, 8.4의 "PR 진행", I43, I48, I49, I53).
// 가짜 claude와 실제 gh로 돈다. 시험용 레포(RELAY_TEST_GH_REPO)를 clone해 main에서 임시 기준 브랜치 m9/<run>/base를
// 만들고(I48), [흐름]과 같은 공통 시나리오(test/flow/pr-scenario.ts의 runPrScenario, 이어서 PR 대응의
// runRespondScenario)를 돈다. 앱은 같고 GitHub 쪽만 실제다: 대응은 push, 답글 게시와 보이지 않는 표시, 다시 실행을 실제
// GitHub에서 본다(I53. 실제 claude의 대응과 답글 초안은 test/claude/respond.test.ts). Claude 인증은 필요 없고 시험용
// 레포의 토큰(GH_TOKEN)만 쓴다. 레포의 main은 건드리지 않는다.
// RELAY_REAL_GH=1이고 RELAY_REAL_CASES에 pr이나 pr-cleanup이 있을 때만 돈다(app-claude 워크플로의 Linux 작업 pr, I49).
// 끝나면(실패해도) 이 시험의 PR을 닫고 브랜치를 지운다. pr-cleanup은 남은 m9/ 기준 브랜치와 그 PR, head 브랜치를 모두
// 치운다. 앞 시험이 남긴 기준 브랜치가 있으면 pr을 돌리지 않는다. 결과는 test-results/claude/pr.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP, FAKE_CLAUDE, harness, register } from '../flow/harness'
import {
  describePr,
  runPrScenario,
  runRespondScenario,
  type PrContext,
} from '../flow/pr-scenario'
import {
  GIT_ENV,
  cleanup,
  cloneRepo,
  gh,
  git,
  leftoverBases,
  newRunId,
  redact,
  RealWorld,
  type CleanupReport,
} from './github'

const REPO = process.env['RELAY_TEST_GH_REPO'] ?? ''
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const PR_CASES = ['pr', 'pr-cleanup']
const enabled = process.env['RELAY_REAL_GH'] === '1' && cases.some((c) => PR_CASES.includes(c))
const OUT = path.join(APP, 'test-results', 'claude')
/** app-claude의 pr 작업 제한(60분)보다 짧게 둔다. 넘으면 finally의 정리와 결과 저장이 돈다 */
const TIMEOUT_MS = 50 * 60 * 1000

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function header(title: string): string[] {
  const env = process.env
  return [
    `# ${title}`,
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- gh: ${gh(['--version']).stdout.split('\n')[0] ?? '알 수 없음'}`,
  ]
}

function cleanupLines(r: CleanupReport | null, error: unknown = null): string[] {
  if (!r) return ['## 정리', '', `- 정리하지 못함: ${redact(String(error))}`, '']
  const none = (xs: readonly unknown[]) => (xs.length ? xs.join(', ') : '없음')
  return [
    '## 정리',
    '',
    `- 닫은 PR: ${none(r.closed.map((n) => `#${n}`))}`,
    `- 지운 브랜치: ${none(r.deleted)}`,
    `- 남은 브랜치: ${none(r.leftBranches)}`,
    `- 남은 열린 PR: ${none(r.leftPrs.map((n) => `#${n}`))}`,
    ...(r.failed.length ? [`- 지우지 못함: ${r.failed.join(' / ')}`] : []),
    '',
  ]
}

/** 결과 파일을 쓰고 작업 로그에도 찍는다(결과물을 받지 못하는 곳에서도 읽게) */
function save(name: string, lines: readonly string[]): void {
  const text = redact(lines.join('\n'))
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, name), text)
  console.log(`----- ${name} -----\n${text}\n----- ${name} 끝 -----`)
}

describe.runIf(enabled)('[실제] PR 진행 (M9, 실제 gh와 시험용 레포)', () => {
  it.runIf(cases.includes('pr-cleanup'))(
    'pr-cleanup: 남은 m9/ 기준 브랜치와 그 PR, head 브랜치를 치운다',
    () => {
      if (!REPO) throw new Error('RELAY_TEST_GH_REPO가 없음')
      let report: CleanupReport | null = null
      let error: unknown = null
      try {
        report = cleanup(REPO, null)
      } catch (e) {
        error = e
      }
      save('pr-cleanup.md', [
        ...header('relay [실제] PR 진행 정리 (pr-cleanup)'),
        '',
        ...cleanupLines(report, error),
      ])
      if (error) throw error
      expect(report?.failed).toEqual([])
      expect(report?.leftBranches).toEqual([])
      expect(report?.leftPrs).toEqual([])
    },
    10 * 60 * 1000,
  )

  it.runIf(cases.includes('pr'))(
    'pr: 읽기, 거르기, 제외와 relay 밖의 수정, 충돌, 머지, 밖에서 닫힘·다시 열림·머지, 대응 (8.4의 PR 진행 1~7)',
    async () => {
      if (!REPO) throw new Error('RELAY_TEST_GH_REPO가 없음')
      const others = cases.filter((c) => !PR_CASES.includes(c))
      if (others.length)
        throw new Error(`pr, pr-cleanup은 다른 경우(${others.join(' ')})와 섞지 않는다`)
      const left = leftoverBases(REPO)
      if (left.length) {
        throw new Error(
          `앞 시험이 남긴 기준 브랜치가 있음: ${left.join(', ')}. cases에 pr-cleanup을 먼저 돌리세요`,
        )
      }
      const run = newRunId()
      const base = `m9/${run}/base`
      const notes: string[] = []
      const started = Date.now()
      // 가짜 claude와 실제 gh. git은 gh의 자격 증명으로 push한다
      const h = await harness({ claudeBin: FAKE_CLAUDE, ghBin: 'gh', env: GIT_ENV })
      let ctx: PrContext | null = null
      let error: unknown = null
      let report: CleanupReport | null = null
      try {
        const clone = cloneRepo(REPO, path.join(h.root, 'repo'), 'main')
        git(clone, 'push', '-q', 'origin', `HEAD:refs/heads/${base}`)
        const scratch = path.join(h.root, 'outside')
        fs.mkdirSync(scratch)
        const world = new RealWorld(REPO, base, clone, scratch)
        const projectId = await register(h, clone, 'main')
        ctx = { h, world, projectId, repo: clone, note: (l) => notes.push(l), created: [] }
        await runPrScenario(ctx)
        await runRespondScenario(ctx)
      } catch (e) {
        error = e
      } finally {
        let cleanError: unknown = null
        try {
          report = cleanup(REPO, run, ctx?.created.map((c) => c.branch) ?? [])
        } catch (e) {
          cleanError = e
        }
        const panels = [...h.ui.works.values()].map(
          (w) => `- ${w.workId} ${w.statusLabel}: ${describePr(w.pr)}`,
        )
        save('pr.md', [
          ...header('relay [실제] PR 진행과 대응 (M9, M10)'),
          `- 시험: ${run}, 기준 브랜치 ${base}, PR ${ctx?.created.map((c) => `#${c.pr ?? '?'}`).join(', ') || '없음'}`,
          `- 결과: ${error ? '실패' : '통과'} (${seconds(Date.now() - started)})`,
          ...(error ? [`- 오류: ${String(error instanceof Error ? error.message : error)}`] : []),
          '',
          '## 단계',
          '',
          ...(notes.length ? notes.map((n) => `- ${n}`) : ['- 없음']),
          '',
          '## 끝났을 때의 PR 패널',
          '',
          ...(panels.length ? panels : ['- 없음']),
          '',
          ...cleanupLines(report, cleanError),
          ...(error ? ['## 화면', '', '```', h.ui.dump(), '```', ''] : []),
        ])
        await h.close()
      }
      if (error) throw error
      expect(report?.failed).toEqual([])
      expect(report?.leftBranches).toEqual([])
      expect(report?.leftPrs).toEqual([])
    },
    TIMEOUT_MS,
  )
})
