// [실제] 실제 claude로 M 경로와 S 경로가 끝까지 간다 (docs/implementation.md I29, 8.4).
// 수동 워크플로 app-claude에서만 돈다(RELAY_REAL_CLAUDE=1). Claude 사용량이 든다.
// [흐름]과 같은 도구(harness, drive)를 쓰고 claude 실행 파일만 실제 claude로 바꾼다 (8.1).
// 모델과 effort는 앱이 PTY에 넘기는 환경 변수(ANTHROPIC_MODEL, CLAUDE_CODE_EFFORT_LEVEL)로 정한다.
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다.
// 형식 오류가 끝까지 남으면 [오류 무시하고 승인]을 쓰고 센다(0이어야 함). 결과는 test-results/claude/에 남긴다.
// RELAY_REAL_CLAUDE=dry면 가짜 claude로 같은 도구를 돌려 도구 자체를 확인한다 (사용량 없음).
// RELAY_REAL_CASES로 돌릴 경우를 고른다(예: "S resume"). 비우면 전부(M, S, resume.test.ts의 resume).
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../flow/driver'
import { APP, FAKE_CLAUDE, harness, makeRepo, register, settle } from '../flow/harness'
import { scenario } from '../flow/scenarios'
import { M_CASE, S_CASE, type RealCase } from './repos'
import { ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const chosen = [M_CASE, S_CASE].filter((c) => cases.length === 0 || cases.includes(c.name))
const enabled = (mode === '1' || dry) && chosen.length > 0
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
/** handoff 없이 턴이 끝났을 때 사람이 보내는 말 */
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

interface CaseResult {
  name: string
  result: DriveResult
  claudeVersion: string | null
  dialogs: string[]
}

const results: CaseResult[] = []

async function runCase(c: RealCase): Promise<CaseResult> {
  const started = Date.now()
  try {
    return await runCaseOnce(c)
  } catch (e) {
    return {
      name: c.name,
      result: {
        status: 'failed',
        reason: e instanceof Error ? e.message : String(e),
        tasks: [],
        ms: Date.now() - started,
      },
      claudeVersion: null,
      dialogs: [],
    }
  }
}

async function runCaseOnce(c: RealCase): Promise<CaseResult> {
  const ui = new ScreenUi()
  // CLAUDE_BIN이 없으면 앱이 설치 위치에서 찾는다 (D106)
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: scenario(c.name) }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null },
  )
  const dir = path.join(OUT, c.name)
  let workDir: string | null = null
  try {
    const { repo } = makeRepo(h.root, c.repo, c.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: c.request,
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
    workDir = path.join(h.home, 'projects', projectId, 'works', created.workKey.split('/')[1] ?? '')
    const result = await drive(h.relay, ui, created.workKey, {
      size: c.name,
      force: true,
      nudge: NUDGE,
      maxNudges: 2,
      stepTimeoutMs: TASK_TIMEOUT_MS,
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
    })
    await settle(h, created.workKey)
    const work = JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
    return {
      name: c.name,
      result,
      claudeVersion: work.tasks[0]?.claude_version ?? null,
      dialogs: ui.dialogs.map((d) => `${d.name}: ${d.action}`),
    }
  } finally {
    // Work 디렉터리(context.md, handoff, 산출물, pty.log, work.json 등)를 결과로 남긴다
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
    }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    await h.close()
  }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(): string {
  const env = process.env
  const lines = [
    '# relay [실제] 결과',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- Claude Code 버전: ${results.find((r) => r.claudeVersion)?.claudeVersion ?? '알 수 없음'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    '',
  ]
  for (const r of results) {
    const status = { completed: 'Work 완료', stopped: '멈춤', failed: '실패' }[r.result.status]
    lines.push(
      `## ${r.name} 경로: ${status} (${seconds(r.result.ms)})`,
      '',
      ...(r.result.reason ? [`- 이유: ${r.result.reason}`, ''] : []),
      '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
      '|---|---|---|---|---|---|',
      ...r.result.tasks.map(
        (t) =>
          `| ${t.label} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
      ),
      '',
      ...(r.dialogs.length ? [`- 첫 실행 창: ${r.dialogs.join(', ')}`, ''] : []),
    )
  }
  return lines.join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 끝까지 (I29, 8.4)', () => {
  afterAll(() => {
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary()
    fs.writeFileSync(path.join(OUT, 'summary.md'), text)
    fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2))
    console.log(text)
  })

  for (const c of chosen) {
    it(`${c.name} 경로`, async () => {
      const r = await runCase(c)
      results.push(r)
      expect(r.result.reason).toBeNull()
      expect(r.result.status).toBe('completed')
      // [오류 무시하고 승인]을 쓴 횟수는 0이어야 한다 (8.4)
      expect(r.result.tasks.filter((t) => t.forced)).toEqual([])
    })
  }
})
