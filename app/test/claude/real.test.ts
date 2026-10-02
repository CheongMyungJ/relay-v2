// [실제] 실제 claude로 M 요청과 S 요청이 intake → fix → verify를 지나 끝까지 간다 (docs/implementation.md I29, 8.4).
// RELAY_REAL_CLAUDE=1일 때만 수동으로 돈다(app-claude 워크플로나 Linux 세션, 8.4). Claude 사용량이 든다.
// [흐름]과 같은 도구(harness, drive)를 쓰고 claude 실행 파일만 실제 claude로 바꾼다 (8.1).
// 모델과 effort는 앱이 PTY에 넘기는 환경 변수(ANTHROPIC_MODEL, CLAUDE_CODE_EFFORT_LEVEL)로 정한다.
// 사람 역할: 첫 실행 창은 수락하고(I17), 질문에는 첫 선택지(추천)로 답하고, 승인 대기가 되면 승인한다.
// 리뷰와 검증(M8)이 반영할 지적을 물으면 첫 선택지로 답하고, 고른 지적만 고쳐 커밋했는지 본다(review.ts, D229).
// 형식 오류가 끝까지 남으면 [오류 무시하고 승인]을 쓰고 센다(0이어야 함). 결과는 test-results/claude/에 남긴다.
// RELAY_REAL_CLAUDE=dry면 가짜 claude로 같은 도구를 돌려 도구 자체를 확인한다 (사용량 없음).
// RELAY_REAL_CASES로 돌릴 경우를 고른다(예: "S resume"). 비우면 전부(M, S, resume.test.ts의 resume,
// rewind.test.ts의 rewind-intake와 rewind-fix, deliver.test.ts의 deliver, restart.test.ts의 restart,
// auto.test.ts의 auto, feature.test.ts의 feature, refactor.test.ts의 refactor). knowledge.test.ts의 knowledge(Work 둘)는
// 사용량이 커서 전부에 들지 않고 적어야 돈다 (I83).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { taskDirName } from '../../src/core/machine'
import type { WorkState } from '../../src/shared/work'
import { drive, type DriveResult } from '../flow/driver'
import { APP, FAKE_CLAUDE, git, harness, makeRepo, register, settle } from '../flow/harness'
import { scenario, verifyApplied } from '../flow/scenarios'
import { M_CASE, S_CASE, type RealCase } from './repos'
import { judgeReview, questionTexts, transcriptQuestions, type ReviewCheck } from './review'
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
  /** 리뷰와 검증(M8)의 리뷰 판정. verify를 승인하지 못했으면 null */
  review: ReviewCheck | null
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
      review: null,
    }
  }
}

async function runCaseOnce(c: RealCase): Promise<CaseResult> {
  const ui = new ScreenUi()
  // CLAUDE_BIN이 없으면 앱이 설치 위치에서 찾는다 (D106)
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: scenario({ verify: verifyApplied() }) }
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
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
    const workId = created.workKey.split('/')[1] ?? ''
    workDir = path.join(h.home, 'projects', projectId, 'works', workId)
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', workId)
    // verify를 승인하는 때의 HEAD. 리뷰 판정은 verify가 만든 커밋만 센다 (승인 뒤 전달 등의 커밋은 뺀다)
    let verifyHead: string | null = null
    const result = await drive(h.relay, ui, created.workKey, {
      force: true,
      nudge: NUDGE,
      maxNudges: 2,
      stepTimeoutMs: TASK_TIMEOUT_MS,
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
      beforeApprove: (task) => {
        if (task.node === 'verify') verifyHead = git(tree, 'rev-parse', 'HEAD')
      },
    })
    await settle(h, created.workKey)
    const work = JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
    return {
      name: c.name,
      result,
      claudeVersion: work.tasks[0]?.claude_version ?? null,
      dialogs: ui.dialogs.map((d) => `${d.name}: ${d.action}`),
      review: reviewOf(work, workDir, tree, verifyHead, (sessionId) =>
        dry ? fakeQuestions(h.records(), sessionId) : transcriptQuestions(CONFIG_DIR, sessionId),
      ),
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

/** 실제 claude의 설정 폴더. 세션 기록(질문)을 여기서 읽는다 */
const CONFIG_DIR = process.env['CLAUDE_CONFIG_DIR'] ?? path.join(os.homedir(), '.claude')

/** 가짜 claude(dry)가 이 세션에서 보낸 AskUserQuestion의 질문들. 가짜 claude의 기록에서 읽는다 */
function fakeQuestions(records: Record<string, unknown>[], sessionId: string): string[] {
  return records.flatMap((r) => {
    const body = r['body'] as { tool_name?: string; tool_input?: unknown; session_id?: string }
    return r['type'] === 'hook' &&
      r['event'] === 'PreToolUse' &&
      body.tool_name === 'AskUserQuestion' &&
      body.session_id === sessionId
      ? questionTexts(body.tool_input)
      : []
  })
}

/**
 * 리뷰의 판정 (5.6.6, D229): 승인된 verify의 verification.md(리뷰 지적)와 handoff, verify가 물은 질문, verify의 커밋과
 * 바뀐 파일. 커밋은 verify의 시작 커밋부터 verify를 승인하는 때의 HEAD까지다
 */
function reviewOf(
  work: WorkState,
  workDir: string,
  tree: string,
  head: string | null,
  questions: (sessionId: string) => string[],
): ReviewCheck | null {
  const task = work.tasks.findLast((t) => t.node === 'verify' && t.status === 'approved')
  if (!task?.start_commit || !head) return null
  const dir = path.join(workDir, 'tasks', taskDirName(task))
  const readIn = (name: string) => {
    const file = path.join(dir, name)
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  }
  const lines = (text: string) => text.split('\n').filter(Boolean)
  const log = (from: string, to: string) => lines(git(tree, 'log', '--format=%s', `${from}..${to}`))
  return judgeReview({
    reviewMd: readIn('verification.md'),
    handoff: readIn('handoff.md'),
    questions: task.session ? questions(task.session.id) : [],
    commits: log(task.start_commit, head),
    files: lines(git(tree, 'diff', '--name-only', `${task.start_commit}..${head}`)),
  })
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
    const status = {
      completed: 'Work 완료',
      stopped: '멈춤',
      paused: '멈춤(시험 도구)',
      failed: '실패',
    }[r.result.status]
    lines.push(
      `## ${r.name} 요청: ${status} (${seconds(r.result.ms)})`,
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
      ...reviewLines(r.review),
    )
  }
  return lines.join('\n')
}

/** 리뷰와 검증(M8)의 리뷰 결과: 지적, 물은 질문, 반영, 커밋, 바뀐 파일, 사람 결정, 판정 */
function reviewLines(r: ReviewCheck | null): string[] {
  if (!r) return ['### 리뷰', '', '- 리뷰와 검증을 승인하지 못함', '']
  const quote = (text: string | null) => (text ?? '(절 없음)').split('\n').map((l) => `  > ${l}`)
  return [
    '### 리뷰 (M8, D229)',
    '',
    `- 판정: ${r.problems.length ? `어긋남 — ${r.problems.join('; ')}` : '통과'}`,
    `- 물은 질문: ${r.questions.length ? r.questions.map((q) => q.replace(/\s*\n\s*/g, ' ')).join(' | ') : '없음'}`,
    '- 지적:',
    ...(r.findings.length ? r.findings.map((f) => `  - ${f}`) : ['  - 없음']),
    '- 반영 절:',
    ...quote(r.applied),
    '- 반영하지 않은 지적 절:',
    ...quote(r.notApplied),
    `- verify의 커밋: ${r.commits.length ? r.commits.join(' / ') : '없음'}`,
    `- 바뀐 파일: ${r.files.length ? r.files.join(', ') : '없음'}`,
    `- 사람 결정(by: human): ${r.humanDecisions.length ? r.humanDecisions.join(' / ') : '없음'}`,
    '',
  ]
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
    it(`${c.name} 요청`, async () => {
      const r = await runCase(c)
      results.push(r)
      expect(r.result.reason).toBeNull()
      expect(r.result.status).toBe('completed')
      // [오류 무시하고 승인]을 쓴 횟수는 0이어야 한다 (8.4)
      expect(r.result.tasks.filter((t) => t.forced)).toEqual([])
      // verify는 반영할 지적을 묻고 고른 지적만 고쳐 커밋하며, 나머지는 반영하지 않은 지적으로 남긴다 (D229)
      expect(r.review?.problems).toEqual([])
    })
  }
})
