// [실제] 실제 claude로 전달과 정리 (docs/implementation.md M5, 8.4). 가짜 claude로는 볼 수 없는 것을 본다:
// - 실제 리뷰와 검증 스킬이 쓴 pr.md를 앱이 PR의 제목과 본문으로 읽는다 (D62)
// - 마무리 안내 문구가 [push]·[PR 생성]을 가리켜도 에이전트는 push하거나 PR을 만들지 않는다 (D17, D104)
// - 첫 프롬프트 없이 연 정리 세션([AI 세션 열기], 7-5)이 사람의 요청을 받아 일하고, 턴이 끝나면 Stop 훅이 온다
// S 요청 레포에서 리뷰와 검증이 승인 대기가 되면 사람 역할이 worktree에 커밋 안 된 메모를 남기고 [PR 생성]을
// 누른다. 커밋 안 된 변경의 선택지에서 [AI 세션 열기]로 정리 세션을 열어 메모를 지워 달라고 하고, 턴이 끝나
// git status가 깨끗해지면 [정리 끝 → push/PR 진행]을 누른다. 앱이 push하고 PR을 만들면 Work는 PR 진행이 된다(D152).
// [머지 없이 끝내기](D179)로 완료한 뒤 [Work 정리]로 worktree를 지운다.
// gh는 가짜 gh다(8.2): 시험 환경에 gh 로그인이 없다. 실제 GitHub PR은 [실기]에서 본다.
// RELAY_REAL_CLAUDE=1이면 실제 claude, dry면 가짜 claude로 도구만 확인한다. RELAY_REAL_CASES의 deliver로
// 고른다. 결과는 test-results/claude/deliver.md에 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { prText } from '../../src/core/delivery'
import { taskDirName } from '../../src/core/machine'
import type { Relay } from '../../src/main/relay'
import type { WorkView } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import { drive, type TaskOutcome } from '../support/driver'
import {
  APP,
  FAKE_CLAUDE,
  git,
  harness,
  makeRepo,
  register,
  settle,
  sleep,
} from '../support/harness'
import { scenario, type Scenario } from '../support/scenarios'
import { S_CASE } from './repos'
import { redact, ScreenUi } from './screen'

const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled = (mode === '1' || dry) && (cases.length === 0 || cases.includes('deliver'))
const OUT = path.join(APP, 'test-results', 'claude')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const CLEANUP_TIMEOUT_MS = 10 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'
/** 사람이 worktree에 남긴 메모 (7-5) */
const NOTE = 'notes.txt'
const REQUEST = `${NOTE}는 제가 남긴 메모입니다. 이 파일을 지우고 git status가 깨끗한지 확인해 주세요. 커밋과 push는 하지 않습니다.`
/** 입력란 아래 상태 줄. 입력을 받을 수 있는지 본다. 출처: spikes/lib/session.mjs READY_HINT */
const READY_HINT = /for agents|for shortcuts|shift\+tab to cycle/i

/** 가짜 claude의 시나리오 (dry): 기본 경로와, 정리 세션에서 사람의 요청대로 메모를 지운다 */
const DRY: Scenario = {
  tasks: scenario().tasks,
  cleanup: [
    { do: 'waitEnter' },
    { do: 'prompt' },
    { do: 'git', args: ['clean', '-f', '-q', '--', NOTE] },
    { do: 'stop' },
    { do: 'wait' },
  ],
}

interface Step {
  step: string
  ms: number
}

interface Result {
  ok: boolean
  error: string | null
  tasks: TaskOutcome[]
  steps: Step[]
  ms: number
  claudeVersion: string | null
  notes: string[]
}

let result: Result | null = null

/** git 명령이 성공하는가 (종료 코드 0) */
function gitOk(cwd: string, ...args: string[]): boolean {
  try {
    git(cwd, ...args)
    return true
  } catch {
    return false
  }
}

/** 입력란이 뜰 때까지 기다린 뒤 한 줄을 보낸다 (resume.test.ts와 같음) */
async function typeLine(relay: Relay, ui: ScreenUi, term: string, text: string): Promise<void> {
  if (!dry) {
    let quiet = { screen: '', at: Date.now() }
    await ui.until(
      () => {
        const scr = ui.screen(term)
        if (scr !== quiet.screen) quiet = { screen: scr, at: Date.now() }
        return READY_HINT.test(scr) && Date.now() - quiet.at > 1500
      },
      '정리 세션의 입력란',
      120_000,
      () => ui.handleDialogs(relay, term),
    )
  }
  relay.terminalWrite(term, text)
  await sleep(300)
  relay.terminalWrite(term, '\r')
}

async function run(): Promise<Result> {
  const ui = new ScreenUi()
  const h = await harness(
    dry
      ? { ui, claudeBin: FAKE_CLAUDE, scenario: DRY }
      : { ui, claudeBin: process.env['CLAUDE_BIN'] ?? null },
  )
  const started = Date.now()
  const dir = path.join(OUT, 'deliver')
  const tasks: TaskOutcome[] = []
  const steps: Step[] = []
  const notes: string[] = []
  let workDir: string | null = null
  let cleanupTerm: string | null = null
  let claudeVersion: string | null = null
  let error: string | null = null
  /** 한 단계를 하고 걸린 시간을 남긴다 */
  const timed = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
    const at = Date.now()
    try {
      return await fn()
    } finally {
      steps.push({ step, ms: Date.now() - at })
    }
  }
  try {
    const { repo, remote } = makeRepo(h.root, S_CASE.repo, S_CASE.files)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: S_CASE.request,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
    const key = created.workKey
    const workId = key.split('/')[1] ?? ''
    const branch = `relay/${workId}`
    workDir = path.join(h.home, 'projects', projectId, 'works', workId)
    const tree = path.join(h.home, 'projects', projectId, 'worktrees', workId)
    const load = () =>
      JSON.parse(fs.readFileSync(path.join(workDir ?? '', 'work.json'), 'utf8')) as WorkState
    const view = () => h.ui.works.get(key)
    const until = (pred: (w: WorkView) => boolean, label: string, timeoutMs = 60_000) =>
      ui.until(
        () => {
          const w = view()
          return w && pred(w) ? w : null
        },
        label,
        timeoutMs,
        () => (cleanupTerm ? ui.handleDialogs(h.relay, cleanupTerm) : undefined),
      )

    // 1. 리뷰와 검증이 승인 대기가 될 때까지
    const first = await drive(h.relay, ui, key, {
      force: true,
      nudge: NUDGE,
      maxNudges: 2,
      stepTimeoutMs: TASK_TIMEOUT_MS,
      tick: async (task) => {
        if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
      },
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    tasks.push(...first.tasks)
    if (first.status !== 'paused') throw new Error(`리뷰와 검증 전에 멈춤: ${first.reason ?? ''}`)
    await settle(h, key)
    const verify = load().tasks.at(-1)
    if (verify?.node !== 'verify') throw new Error('지금 task가 리뷰와 검증이 아님')
    claudeVersion = load().tasks[0]?.claude_version ?? null
    const verifyDir = path.join(workDir, 'tasks', taskDirName(verify))
    const context = fs.readFileSync(path.join(verifyDir, 'context.md'), 'utf8')
    const closing = /\[완료만\], \[push\], \[PR 생성\] 중 하나를/.test(context)
    notes.push(
      `리뷰와 검증의 마무리 안내 문구가 [완료만], [push], [PR 생성]을 가리킨다: ${closing ? '예' : '아니오'}`,
    )
    if (!closing) throw new Error('마무리 안내 문구에 전달 버튼이 없음')
    // 에이전트는 push하거나 PR을 만들지 않는다 (D17)
    const pushedByAgent = gitOk(remote, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)
    notes.push(
      `승인 전 원격에 Work 브랜치가 있다(에이전트가 push함): ${pushedByAgent ? '예' : '아니오'}`,
    )
    if (pushedByAgent) throw new Error('에이전트가 Work 브랜치를 push함')
    const pr = prText(fs.readFileSync(path.join(verifyDir, 'pr.md'), 'utf8'))
    if (!pr.ok) throw new Error(`pr.md를 읽지 못함: ${pr.error}`)
    notes.push(
      `pr.md 제목: ${pr.title}`,
      `pr.md 본문의 절: ${
        pr.body
          .split('\n')
          .filter((l) => l.startsWith('## '))
          .join(', ') || '없음'
      }`,
    )
    const fixed = git(tree, 'rev-parse', 'HEAD')

    // 2. 사람이 커밋 안 된 메모를 남기고 [PR 생성]을 누른다. 커밋 안 된 변경의 선택지가 온다 (7-5)
    fs.writeFileSync(path.join(tree, NOTE), '전달 전에 지울 메모\n')
    const blocked = await timed('[PR 생성]: 커밋 안 된 변경 확인', () =>
      h.relay.deliver(key, { choice: 'pr', uncommitted: null }),
    )
    const listed = blocked.ok ? [] : (blocked.uncommitted ?? [])
    notes.push(`커밋 안 된 변경: ${listed.join(', ') || '없음'}`)
    if (!listed.includes(`?? ${NOTE}`)) throw new Error('커밋 안 된 변경 목록에 메모가 없음')

    // 3. [AI 세션 열기]: 기록하지 않는 정리 세션에서 메모를 지워 달라고 한다
    const opened = await timed(
      '[AI 세션 열기]: verify 세션을 끝내고 정리 세션을 연다',
      async () => {
        const r = await h.relay.openCleanup(key, 'pr')
        if (!r.ok) throw new Error(`[AI 세션 열기] 실패: ${r.error}`)
        return until((w) => w.cleanup?.status === 'live', '정리 세션')
      },
    )
    cleanupTerm = opened.cleanup?.terminal ?? null
    if (!cleanupTerm) throw new Error('정리 세션의 터미널이 없음')
    const term = cleanupTerm
    await timed('정리 세션: 입력란이 뜰 때까지', () => typeLine(h.relay, ui, term, REQUEST))
    await timed('정리 세션: 요청부터 git status가 깨끗해질 때까지', () =>
      until((w) => w.cleanup?.clean === true, '깨끗해짐', CLEANUP_TIMEOUT_MS),
    )
    const head = git(tree, 'rev-parse', 'HEAD')
    notes.push(`정리 세션이 커밋하지 않았다: ${head === fixed ? '예' : '아니오'}`)
    if (fs.existsSync(path.join(tree, NOTE))) throw new Error('메모가 남아 있음')
    // 정리 세션은 task가 아니다
    if (load().tasks.length !== first.tasks.length) throw new Error('정리 세션이 task로 기록됨')

    // 4. [정리 끝 → push/PR 진행]: push하고 가짜 gh로 PR을 만든다. verify를 승인하고 Work는 PR 진행이 된다(D152)
    const done = await timed('[정리 끝 → push/PR 진행]: 세션 끝내기, push, PR', () =>
      h.relay.finishCleanup(key),
    )
    if (!done.ok) throw new Error(`전달 실패: ${done.error}`)
    await settle(h, key)
    const work = load()
    notes.push(`[PR 생성] 뒤 Work 상태: ${work.status}`)
    if (work.status !== 'pr') throw new Error(`Work가 PR 진행이 아님: ${work.status}`)
    const d = work.delivery
    notes.push(
      `전달: ${d?.choice ?? '없음'} ${d?.status ?? ''}, PR ${d?.pr_url ?? '없음'}, draft ${String(d?.draft)}`,
    )
    if (d?.choice !== 'pr' || d.status !== 'succeeded') throw new Error('PR 전달 기록이 없음')
    const tip = git(remote, 'rev-parse', `refs/heads/${branch}`)
    notes.push(`원격의 Work 브랜치가 worktree의 HEAD다: ${tip === head ? '예' : '아니오'}`)
    if (tip !== head) throw new Error('push한 커밋이 worktree의 HEAD가 아님')
    const create = h.ghRecords().filter((r) => r['type'] === 'pr create') as {
      args: string[]
      body?: string
    }[]
    const args = create[0]?.args ?? []
    const title = args[args.indexOf('--title') + 1]
    const sameText = create.length === 1 && title === pr.title && create[0]?.body === pr.body
    notes.push(`가짜 gh의 pr create가 pr.md의 제목과 본문을 받았다: ${sameText ? '예' : '아니오'}`)
    if (!sameText) throw new Error('PR 제목이나 본문이 pr.md와 다름')
    const approved = work.tasks.find((t) => t.id === verify.id)
    const decisions = fs.readFileSync(path.join(workDir, 'decisions.md'), 'utf8')
    notes.push(
      `리뷰와 검증: ${approved?.status ?? '없음'}, decisions.md에 ${verify.id}가 있다: ${decisions.includes(verify.id) ? '예' : '아니오'}`,
    )
    if (approved?.status !== 'approved' || !decisions.includes(verify.id)) {
      throw new Error('리뷰와 검증의 승인 기록이 없음')
    }

    // 5. [머지 없이 끝내기]로 Work를 완료한다(D179). 머지는 PR 시험(pr, pr-auto)이 본다
    const ended = await timed('[머지 없이 끝내기]', () => h.relay.prEnd(key))
    if (!ended.ok) throw new Error(`[머지 없이 끝내기] 실패: ${ended.error}`)
    await settle(h, key)
    if (load().status !== 'completed') throw new Error(`Work가 완료되지 않음: ${load().status}`)

    // 6. [Work 정리]: worktree를 지운다. 산출물은 남는다 (시나리오 8)
    const p = await timed('[Work 정리]: 요약', () => h.relay.cleanPreview(key))
    if (!p.ok) throw new Error(`정리 요약 실패: ${p.error}`)
    notes.push(
      `정리 요약: 커밋 안 된 변경 ${p.preview.uncommitted.length}개, 살아 있는 세션 ${p.preview.live}개, push됨 ${p.preview.branch.pushed ? '예' : '아니오'}, 확인할 것 ${p.preview.confirm.join(' / ') || '없음'}`,
    )
    const c = await timed('[Work 정리]: [정리]', () =>
      h.relay.clean(key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: p.preview.confirm.length > 0,
        expect: p.preview.expect,
      }),
    )
    if (!c.ok) throw new Error(`정리 실패: ${c.error}`)
    await settle(h, key)
    const archived = load()
    const kept = fs.existsSync(path.join(verifyDir, 'pr.md'))
    notes.push(
      `정리 뒤: ${archived.status}, worktree 없음 ${fs.existsSync(tree) ? '아니오' : '예'}, 산출물 남음 ${kept ? '예' : '아니오'}`,
    )
    if (archived.status !== 'archived' || fs.existsSync(tree) || !kept) {
      throw new Error('정리 결과가 다름')
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e)
  } finally {
    if (workDir && fs.existsSync(workDir)) {
      fs.rmSync(dir, { recursive: true, force: true })
      fs.cpSync(workDir, path.join(dir, 'work'), { recursive: true })
    }
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'ui.txt'), ui.dump())
    // 정리 세션은 기록하지 않으므로(7-5) 받은 터미널 출력을 결과로 남긴다
    if (cleanupTerm) {
      fs.writeFileSync(
        path.join(dir, 'cleanup-terminal.txt'),
        redact(ui.output.get(cleanupTerm) ?? ''),
      )
    }
    await h.close()
  }
  return {
    ok: error === null && !tasks.some((t) => t.forced),
    error,
    tasks,
    steps,
    ms: Date.now() - started,
    claudeVersion,
    notes,
  }
}

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

function summary(r: Result): string {
  const env = process.env
  return [
    '# relay [실제] 전달과 정리 결과',
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- Claude Code 버전: ${r.claudeVersion ?? '알 수 없음'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- 모델: ${env['ANTHROPIC_MODEL'] ?? '(기본)'}, effort: ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? '(기본)'}`,
    ...(dry ? ['- 가짜 claude로 돌린 도구 확인 (dry)'] : []),
    '',
    `## deliver: ${r.ok ? '통과' : '실패'} (${seconds(r.ms)})`,
    '',
    ...(r.error ? [`- 이유: ${r.error}`, ''] : []),
    '| task | 형식 오류 되돌림 | 오류 무시하고 승인 | 질문 답 | 재촉 | 걸린 시간 |',
    '|---|---|---|---|---|---|',
    ...r.tasks.map(
      (t) =>
        `| ${t.label} | ${t.bounces} | ${t.forced ? '씀' : '0'} | ${t.answers} | ${t.nudges} | ${seconds(t.ms)} |`,
    ),
    '',
    '| 단계 | 걸린 시간 |',
    '|---|---|',
    ...r.steps.map((s) => `| ${s.step} | ${seconds(s.ms)} |`),
    '',
    ...r.notes.map((n) => `- ${n}`),
    '',
  ].join('\n')
}

describe.runIf(enabled)('[실제] 실제 claude로 전달과 정리 (M5)', () => {
  afterAll(() => {
    if (!result) return
    fs.mkdirSync(OUT, { recursive: true })
    const text = summary(result)
    fs.writeFileSync(path.join(OUT, 'deliver.md'), text)
    console.log(text)
  })

  it('deliver', async () => {
    result = await run()
    expect(result.error).toBeNull()
    // [오류 무시하고 승인]을 쓴 횟수는 0이어야 한다 (8.4)
    expect(result.tasks.filter((t) => t.forced)).toEqual([])
  })
})
