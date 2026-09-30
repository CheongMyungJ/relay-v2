// [실제] 자동 대응 (docs/implementation.md M11, 8.4의 "자동 대응", I55). 실제 claude와 실제 gh를 합쳐 돈다.
// 시험용 레포(RELAY_TEST_GH_REPO)를 clone해 main에서 임시 기준 브랜치 m9/<run>/base를 만들고(I48), 파이프라인은 가짜
// claude로 지나 [PR 생성]까지 간다. 가짜 claude의 수정은 버그가 있는 src/m11.mjs와 그 버그로 실패하는 test/m11.test.mjs를
// 커밋해 PR의 CI(npm test)가 실제로 실패한다. PR이 생기면 claude 실행 파일을 실제 claude로 바꾼다(앱은 task를 띄울 때마다
// CLAUDE_BIN에서 찾는다). 실제 claude는 필요한 환경 변수만 받는다(env -i의 감싸개, 8.4): GitHub 토큰과 git 자격 증명
// 설정은 넘기지 않는다. 앱 설정은 대응 자동 시작과 PR 대응 자동 승인을 켜고 라운드 상한을 2로 둔다.
// 1. CI가 실패하면 앱이 읽어 CI 실패 항목을 받고 대응 task를 자동으로 시작한다(D154, D210). 실제 claude가 원인을 고쳐
//    커밋하고(테스트는 고치지 않음) 카운트다운 뒤 자동 승인으로 push한다(D169). 새 head의 CI가 통과한다.
// 2. 소유자가 대화 코멘트로 작은 수정(JSDoc 예시)을 요청하면 다음 라운드가 자동으로 시작하고, 실제 claude가 고쳐 커밋하고
//    답글 초안을 쓰고, 자동 승인으로 push하고 답글이 실제 PR에 게시된다(M10에서 미룬 "실제 claude의 답글이 실제
//    GitHub에 올라감", I53). 새 head의 CI가 통과한다.
//    라운드마다 카운트다운 동안 시험 도구가 이번 라운드의 커밋과 답글 초안에 비밀 값이나 비밀 모양이 없는지 보고, 있으면
//    [취소]하고 실패로 친다.
// 3. 소유자가 대화 코멘트를 또 달면 상한(2)에 닿아 자동 시작하지 않고 멈추고 알린다(D171, D184).
// 코멘트와 CI 로그는 시험이 정한 것만 쓴다(D154: 자동 시작은 외부 글을 사람 확인 없이 세션에 넣는다).
// RELAY_REAL_GH=1, RELAY_REAL_CLAUDE=1이고 RELAY_REAL_CASES에 pr-auto가 있을 때만 돈다(app-claude의 Linux 작업 pr).
// RELAY_REAL_CLAUDE=dry면 가짜 gh와 로컬 bare 원격, 감싸개를 거친 가짜 claude로 같은 시험 도구를 돌려 도구만 확인한다
// (GitHub와 Claude 사용량 없음. 가짜 CI는 ci-fail로 실패하므로 가짜 수정이 ci-fail도 커밋하고 대응이 지운다).
// 모델과 effort는 ANTHROPIC_MODEL, CLAUDE_CODE_EFFORT_LEVEL(없으면 sonnet, low)이다. 끝나면(실패해도) 이 시험의 PR을 닫고
// 브랜치를 지운다. 결과는 test-results/claude/pr-auto.md에 남긴다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { claudeAuthStatus, findClaude } from '../../src/adapters/claude'
import { taskDirName } from '../../src/core/machine'
import { HOOK_TOKEN_ENV } from '../../src/core/settings'
import { DEFAULT_CONFIG, type AppConfig } from '../../src/shared/config'
import type { TaskView } from '../../src/shared/views'
import { CART_FILES, FakeGitHub, FakeWorld } from '../flow/github'
import { APP, FAKE_CLAUDE, MANUAL, harness, makeRepo, register, settle } from '../flow/harness'
import {
  currentUntil,
  describePr,
  openPrWork,
  prClaude,
  refreshUntil,
  view,
  workEvents,
  workState,
  type PrContext,
  type PrWork,
  type PrWorld,
} from '../flow/pr-scenario'
import { handoff, type Step } from '../flow/scenarios'
import { sleep } from '../flow/ui'
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
import { ScreenUi, redact as redactScreen } from './screen'

const REPO = process.env['RELAY_TEST_GH_REPO'] ?? ''
const mode = process.env['RELAY_REAL_CLAUDE']
const dry = mode === 'dry'
const cases = (process.env['RELAY_REAL_CASES'] ?? '').split(/[\s,]+/).filter(Boolean)
const enabled =
  cases.includes('pr-auto') && (dry || (process.env['RELAY_REAL_GH'] === '1' && mode === '1'))
/** app-claude의 pr 작업이 맡는 경우 */
const JOB_CASES = ['pr', 'pr-cleanup', 'pr-auto']
const OUT = path.join(APP, 'test-results', 'claude')
/** app-claude의 pr 작업 제한(60분)보다 짧게 둔다. 넘으면 finally의 정리와 결과 저장이 돈다 */
const TIMEOUT_MS = 50 * 60 * 1000
const TASK_TIMEOUT_MS = 20 * 60 * 1000

/**
 * 대응 자동 시작, PR 대응 자동 승인, 라운드 상한 2. 카운트다운은 시험 도구가 커밋을 볼 수 있게 기본값(15초)으로 둔다.
 * PR 읽기 주기는 시험 도구가 [새로 고침]을 누르므로 기본값이다
 */
const CONFIG: Partial<AppConfig> = {
  respond_auto_start: true,
  respond_auto_round_max: 2,
  auto_approve: { ...MANUAL.auto_approve, respond: true },
  auto_approve_countdown_sec: 15,
}

const M11_FILE = 'src/m11.mjs'
const M11_TEST = 'test/m11.test.mjs'
/** 버그: 수량이 음수인 항목도 더한다 */
const M11_CODE = [
  '/**',
  ' * 수량의 합. 수량이 음수인 항목은 0으로 센다 (relay M11 시험).',
  ' * @param {{ qty: number }[]} items',
  ' * @returns {number}',
  ' */',
  'export function totalQty(items) {',
  '  return items.reduce((sum, item) => sum + item.qty, 0);',
  '}',
  '',
].join('\n')
const M11_TEST_CODE = [
  "import { test } from 'node:test';",
  "import assert from 'node:assert/strict';",
  "import { totalQty } from '../src/m11.mjs';",
  '',
  "test('수량을 더한다', () => {",
  '  assert.equal(totalQty([{ qty: 2 }, { qty: 3 }]), 5);',
  '});',
  '',
  "test('수량이 음수인 항목은 0으로 센다', () => {",
  '  assert.equal(totalQty([{ qty: 2 }, { qty: -1 }, { qty: 3 }]), 5);',
  '});',
  '',
].join('\n')
/** 고친 코드. dry의 가짜 대응이 커밋한다 */
const M11_FIXED = M11_CODE.replace('sum + item.qty', 'sum + Math.max(0, item.qty)')
/** 둘째 라운드의 소유자 코멘트: 작은 수정 요청 */
const ASK = 'relay M11 시험: totalQty의 JSDoc에 사용 예시(@example) 한 줄을 더해 주세요.'
/** dry의 가짜 claude: 수정이 ci-fail도 커밋하고, 첫 대응 task가 코드를 고치고 ci-fail을 지운다 */
const DRY_RESPOND: Step[] = [
  { do: 'prompt' },
  { do: 'git', args: ['rm', '-q', 'ci-fail'] },
  {
    do: 'commit',
    files: { [M11_FILE]: M11_FIXED },
    message: 'fix: 음수 수량은 0으로 센다 (relay M11 dry)',
  },
  { do: 'respond' },
  { do: 'write', file: 'handoff.md', text: handoff({ summary: 'CI 실패를 고쳤다.' }) },
  { do: 'stop' },
]
/** dry의 둘째 대응 task: JSDoc 예시를 더해 커밋하고 답글 초안을 쓴다 */
const DRY_ASK: Step[] = [
  { do: 'prompt' },
  {
    do: 'commit',
    files: {
      [M11_FILE]: M11_FIXED.replace(
        ' * @returns {number}',
        ' * @returns {number}\n * @example totalQty([{ qty: 2 }, { qty: -1 }]) // 2',
      ),
    },
    message: 'docs: totalQty 사용 예시 (relay M11 dry)',
  },
  { do: 'respond', text: '{id}: 사용 예시를 더했습니다.' },
  { do: 'write', file: 'handoff.md', text: handoff({ summary: '코멘트대로 예시를 더했다.' }) },
  { do: 'stop' },
]
/** 상한을 볼 소유자의 대화 코멘트 */
const COMMENT = 'relay M11 시험: 상한 확인용 코멘트입니다. 자동 대응이 상한에서 멈추는지 봅니다.'

/**
 * 실제 claude에 넘길 환경 변수 (8.4의 env -i): 실행, 프록시와 인증서, Claude 인증과 설정 폴더, 모델과 effort, 앱의 훅
 * 토큰. GitHub 토큰(GH_TOKEN 따위)과 git 자격 증명 설정(GIT_CONFIG_*)은 넘기지 않는다
 */
const CLAUDE_ENV = [
  'HOME',
  'PATH',
  'SHELL',
  'LC_ALL',
  'TMPDIR',
  'USER',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'CLAUDE_CODE_EFFORT_LEVEL',
  HOOK_TOKEN_ENV,
  // dry의 가짜 claude가 읽는다 (8.2)
  ...(dry ? ['FAKE_CLAUDE_SCENARIO', 'FAKE_CLAUDE_RECORD'] : []),
]
/** 커밋과 결과에 남으면 안 되는 비밀의 모양 */
const SECRET = /gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|sk-ant-[\w-]{10,}/
/** 이 작업이 가진 비밀 값. 값은 어디에도 찍지 않고 들어 있는지만 본다 */
const SECRET_VALUES = [
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'RELAY_TEST_GH_TOKEN',
]
  .map((k) => process.env[k] ?? '')
  .filter((v) => v.length >= 8)

const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'
/** 질문을 받으면 사람이 터미널로 보내는 답 */
const ANSWER = '추천하는 쪽으로 진행해 주세요.'
const HUMAN = new Set([
  'awaiting_approval',
  'asking',
  'input_needed',
  'idle',
  'blocked',
  'session_ended',
  'interrupted',
])

const seconds = (ms: number) => `${Math.round(ms / 1000)}초`

/** 결과에 비밀이 남지 않게 가린다: 이 작업의 비밀 값, 토큰 모양 */
function scrub(text: string): string {
  let out = text
  for (const v of SECRET_VALUES) out = out.split(v).join('[가림]')
  return redactScreen(redact(out))
}

/** 이번 라운드의 커밋에 비밀이 있는가. 있으면 무엇인지(값은 적지 않음) */
function leak(text: string): string | null {
  if (SECRET_VALUES.some((v) => text.includes(v))) return '이 작업의 비밀 값'
  return SECRET.test(text) ? '비밀 모양' : null
}

/**
 * 실제 claude를 필요한 환경 변수만으로 띄우는 감싸개 (8.4의 env -i). exec로 바꿔 앱이 적는 프로세스가 claude다. root면
 * IS_SANDBOX=1을 준다(--dangerously-skip-permissions)
 */
function claudeWrapper(dir: string, real: string): string {
  const file = path.join(dir, 'claude-env.sh')
  const quoted = `'${real.replace(/'/g, `'\\''`)}'`
  fs.writeFileSync(
    file,
    [
      '#!/usr/bin/env bash',
      '# relay [실제] pr-auto: 실제 claude에 필요한 환경 변수만 넘긴다 (docs/implementation.md 8.4)',
      `keep=(${CLAUDE_ENV.join(' ')})`,
      'vars=("TERM=${TERM:-xterm-256color}" "LANG=${LANG:-C.UTF-8}")',
      'for k in "${keep[@]}"; do',
      '  if [ -n "${!k+x}" ]; then vars+=("$k=${!k}"); fi',
      'done',
      'if [ "$(id -u)" = 0 ]; then vars+=(IS_SANDBOX=1); fi',
      `exec env -i "\${vars[@]}" ${quoted} "$@"`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
  return file
}

/** 감싸개가 넘기는 변수 이름. 실행 파일을 /usr/bin/env로 바꿔 돌려 본다. 값은 읽지 않는다 */
function passedNames(dir: string): string[] {
  const probeDir = path.join(dir, 'probe')
  fs.mkdirSync(probeDir, { recursive: true })
  const probe = claudeWrapper(probeDir, '/usr/bin/env')
  const out = execFileSync(probe, [], {
    encoding: 'utf8',
    env: { ...process.env, [HOOK_TOKEN_ENV]: 'probe' },
  })
  return out
    .split('\n')
    .map((l) => /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(l)?.[1])
    .filter((n): n is string => n !== undefined)
    .sort()
}

function header(title: string, claude: string): string[] {
  const env = process.env
  return [
    `# ${title}`,
    '',
    `- 날짜: ${new Date().toISOString()}`,
    `- 앱 커밋: ${env['GITHUB_SHA'] ?? '(로컬)'}`,
    `- OS: ${process.platform} ${env['ImageOS'] ?? ''} ${env['ImageVersion'] ?? ''}`.trimEnd(),
    `- gh: ${dry ? '가짜 gh' : gh(['--version']).stdout.split('\n')[0] || '알 수 없음'}`,
    `- claude: ${claude || '알 수 없음'}, 모델 ${env['ANTHROPIC_MODEL'] ?? 'sonnet'}, effort ${env['CLAUDE_CODE_EFFORT_LEVEL'] ?? 'low'}`,
  ]
}

function cleanupLines(r: CleanupReport | null, error: unknown = null): string[] {
  if (!r) return ['## 정리', '', `- 정리하지 못함: ${scrub(String(error))}`, '']
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

interface AutoOutcome {
  /** published(자동 승인해 push와 게시를 마침), held(자동 승인하지 않음), guarded(비밀이 있어 [취소]), 그 밖은 멈춘 상태 */
  status: string
  detail: string | null
  countdown: boolean
  questions: string[]
  nudges: number
  ms: number
}

/**
 * 자동 시작한 대응 task를 지켜본다. 사람 역할은 첫 실행 창을 수락하고, 질문에는 Esc 뒤 ANSWER로 답하고, handoff 없이
 * 턴이 끝나면 두 번까지 재촉한다. 카운트다운이 시작되면 커밋을 보고(guard), 자동 승인과 push·게시가 끝나기를 기다린다
 */
async function driveAuto(
  ctx: PrContext,
  ui: ScreenUi,
  w: PrWork,
  taskId: string,
  guard: () => string | null,
): Promise<AutoOutcome> {
  const started = Date.now()
  const questions: string[] = []
  let nudges = 0
  let countdown = false
  const find = () => view(ctx, w).tasks.find((t) => t.id === taskId)
  const done = (status: string, detail: string | null = null): AutoOutcome => ({
    status,
    detail,
    countdown,
    questions,
    nudges,
    ms: Date.now() - started,
  })
  /** 처리 줄이 빈 뒤의 기록으로 가른다 */
  const settled = async (): Promise<AutoOutcome | null> => {
    await settle(ctx.h, w.key)
    const t = workState(w).tasks.find((x) => x.id === taskId)
    if (t?.status === 'approved' && t.respond?.published_at) return done('published')
    if (t?.respond?.failure) {
      return done('failed', `${t.respond.failure.stage}: ${t.respond.failure.error}`)
    }
    if (t?.auto_hold) return done('held', t.auto_hold.reasons.join(', '))
    return null
  }
  for (;;) {
    const t: TaskView = await ui.until(
      () => {
        const x = find()
        return x && (x.countdown || HUMAN.has(x.status)) ? x : null
      },
      `${taskId}: 카운트다운이나 사람이 할 일`,
      TASK_TIMEOUT_MS,
      () => {
        const x = find()
        return x ? ui.handleDialogs(ctx.h.relay, x.terminal) : undefined
      },
    )
    if (t.countdown) {
      countdown = true
      const found = guard()
      if (found) {
        await ctx.h.relay.cancelCountdown(w.key, taskId)
        return done('guarded', found)
      }
      // 카운트다운이 끝나면 자동 승인하고 push와 게시를 처리 줄에서 한다
      await ui.until(() => !find()?.countdown, `${taskId}: 카운트다운 끝`, 120_000)
      const r = await settled()
      if (r) return r
      continue
    }
    if (t.status === 'awaiting_approval') {
      const r = await settled()
      return r ?? done('awaiting_approval', '카운트다운 없이 승인 대기')
    }
    if (t.status === 'asking' || t.status === 'input_needed') {
      questions.push(scrub(ui.screen(t.terminal)))
      ctx.h.relay.terminalWrite(t.terminal, '\x1b')
      await sleep(1500)
      ctx.h.relay.terminalWrite(t.terminal, ANSWER)
      await sleep(300)
      ctx.h.relay.terminalWrite(t.terminal, '\r')
      await ui
        .until(() => (find()?.status !== t.status ? true : null), '답한 뒤', 60_000)
        .catch(() => undefined)
      continue
    }
    if (t.status === 'idle' && nudges < 2) {
      nudges++
      ctx.h.relay.terminalWrite(t.terminal, NUDGE)
      await sleep(300)
      ctx.h.relay.terminalWrite(t.terminal, '\r')
      await ui
        .until(() => (find()?.status !== 'idle' ? true : null), '재촉 뒤', 60_000)
        .catch(() => undefined)
      continue
    }
    return done(t.status)
  }
}

describe.runIf(enabled)('[실제] 자동 대응 (M11, 실제 claude와 실제 gh)', () => {
  it(
    'pr-auto: CI 실패와 코멘트로 자동 시작 → 실제 claude의 수정과 답글 → 자동 승인 push와 게시 → CI 통과, 상한에서 멈추고 알림 (I55)',
    async () => {
      if (!REPO && !dry) throw new Error('RELAY_TEST_GH_REPO가 없음')
      const others = cases.filter((c) => !JOB_CASES.includes(c))
      if (others.length) {
        throw new Error(
          `pr-auto는 app-claude의 pr 작업이 돈다. 다른 경우(${others.join(' ')})와 섞지 않는다`,
        )
      }
      const left = dry ? [] : leftoverBases(REPO)
      if (left.length) {
        throw new Error(
          `앞 시험이 남긴 기준 브랜치가 있음: ${left.join(', ')}. cases에 pr-cleanup을 먼저 돌리세요`,
        )
      }
      const real = dry
        ? FAKE_CLAUDE
        : (process.env['RELAY_CLAUDE_BIN'] ??
          findClaude({ env: { ...process.env, CLAUDE_BIN: '' } }))
      if (!real) throw new Error('실제 claude를 찾지 못함')
      const run = newRunId()
      const base = `m9/${run}/base`
      const notes: string[] = []
      const lines: string[] = []
      const summaries: string[] = []
      const started = Date.now()
      const ui = new ScreenUi()
      // 파이프라인은 가짜 claude와 실제 gh. git은 gh의 자격 증명으로 push한다. dry는 가짜 gh다
      const h = await harness(
        dry
          ? { ui, claudeBin: FAKE_CLAUDE, config: CONFIG }
          : { ui, claudeBin: FAKE_CLAUDE, ghBin: 'gh', env: GIT_ENV, config: CONFIG },
      )
      let ctx: PrContext | null = null
      let error: unknown = null
      let report: CleanupReport | null = null
      let version = ''
      try {
        const wrapper = claudeWrapper(h.root, real)
        version = execFileSync(wrapper, ['--version'], { encoding: 'utf8' }).trim()
        const names = passedNames(h.root)
        lines.push(`- 실제 claude에 넘긴 환경 변수: ${names.join(', ')}`)
        // 넘긴 것은 모두 고른 변수다: GitHub 토큰과 git 자격 증명 설정은 없다
        expect(
          names.filter((n) => !['TERM', 'LANG', 'IS_SANDBOX', ...CLAUDE_ENV].includes(n)),
        ).toEqual([])
        const auth = await claudeAuthStatus(wrapper)
        if (!auth.ok) throw new Error('실제 claude가 로그인되어 있지 않음 (claude auth status)')

        const scratch = path.join(h.root, 'outside')
        fs.mkdirSync(scratch)
        let clone: string
        let world: PrWorld
        if (dry) {
          const made = makeRepo(h.root, 'cart', CART_FILES)
          clone = made.repo
          world = new FakeWorld(new FakeGitHub(path.join(h.root, 'record'), made.remote, scratch))
        } else {
          clone = cloneRepo(REPO, path.join(h.root, 'repo'), 'main')
          git(clone, 'push', '-q', 'origin', `HEAD:refs/heads/${base}`)
          world = new RealWorld(REPO, base, clone, scratch)
        }
        const projectId = await register(h, clone, 'main')
        ctx = { h, world, projectId, repo: clone, note: (l) => notes.push(l), created: [] }
        const c = ctx

        // ---------- 파이프라인(가짜 claude)으로 [PR 생성] ----------
        const fix = { [M11_FILE]: M11_CODE, [M11_TEST]: M11_TEST_CODE }
        const claude = prClaude(
          dry ? { ...fix, 'ci-fail': 'relay M11 dry\n' } : fix,
          'relay M11 시험: 자동 대응',
        )
        const w = await openPrWork(
          c,
          dry
            ? { ...claude, tasks: { ...claude.tasks, 'pr-respond': DRY_RESPOND, 't-06': DRY_ASK } }
            : claude,
          'relay M11 시험 (자동 대응): 수량의 합 totalQty를 더한다',
        )
        const head1 = workState(w).pr?.head ?? ''
        c.note(`PR #${w.pr}, head ${head1.slice(0, 8)} (버그가 있는 ${M11_FILE}과 ${M11_TEST})`)
        // 대응 task부터 실제 claude다
        h.env['CLAUDE_BIN'] = wrapper
        h.env['ANTHROPIC_MODEL'] = process.env['ANTHROPIC_MODEL'] ?? 'sonnet'
        h.env['CLAUDE_CODE_EFFORT_LEVEL'] = process.env['CLAUDE_CODE_EFFORT_LEVEL'] ?? 'low'

        // ---------- 1. CI 실패 → 자동 시작 ----------
        await world.runCi(w.pr, head1)
        // 실행이 끝난 직후에는 실패 로그를 아직 받지 못할 수 있다 (S7 관찰 2)
        if (!dry) await sleep(15_000)
        const failed = await refreshUntil(
          c,
          w,
          (p) => p.ci === 'fail' && p.items.some((i) => i.kind === 'ci'),
          'CI 실패 항목',
          world.ciWaitMs,
        )
        const ci = failed.items.find((i) => i.kind === 'ci')
        c.note(
          `CI 실패 항목 ${ci?.id ?? '?'}, 로그 ${ci?.text ? `${ci.text.split('\n').length}줄` : '없음'}`,
        )
        // ---------- 자동 라운드 하나: 대응 task를 지켜보고 기록하고 판정한다 ----------
        const autoRound = async (round: number, from: string, known: readonly string[]) => {
          const task = await currentUntil(
            c,
            w,
            (t) => t.node === 'respond' && !known.includes(t.id),
            `라운드 ${round}에 자동으로 시작한 대응 task`,
          )
          expect(task.band).toContain('이유: 자동 대응')
          await settle(h, w.key)
          const seq = workState(w).tasks.find((t) => t.id === task.id)?.seq ?? 0
          const replies = path.join(
            w.dir,
            'tasks',
            taskDirName({ seq, node: 'respond' }),
            'replies.md',
          )
          // 자동 승인이 push하고 게시하기 전에 이번 라운드의 커밋과 답글 초안을 본다
          const guard = () =>
            leak(
              [
                git(w.tree, 'diff', `${from}..HEAD`),
                git(w.tree, 'log', '--format=%B', `${from}..HEAD`),
                fs.existsSync(replies) ? fs.readFileSync(replies, 'utf8') : '',
              ].join('\n'),
            )
          const out = await driveAuto(c, ui, w, task.id, guard)
          c.note(
            `라운드 ${round} 대응 task ${task.id}: ${out.status}${out.detail ? ` (${out.detail})` : ''}, ${seconds(out.ms)}, 카운트다운 ${out.countdown ? '있음' : '없음'}, 질문 ${out.questions.length}번, 재촉 ${out.nudges}번`,
          )
          const record = workState(w).tasks.find((t) => t.id === task.id)
          const review = await h.relay.review(w.key, task.id)
          const head = git(w.tree, 'rev-parse', 'HEAD')
          const changed =
            head === from ? [] : git(w.tree, 'diff', '--name-only', `${from}..${head}`).split('\n')
          const remote = await world.branchTip(w.branch)
          lines.push(
            `- 라운드 ${round} 대응 task ${task.id}: ${out.status}${out.detail ? ` (${scrub(out.detail)})` : ''}, 승인 ${record?.approved_by ?? '없음'}, 형식 오류 ${review?.errors.length ?? '?'}개, 사람 손 없이 이어진 라운드 ${workState(w).pr?.auto_rounds ?? 0}`,
            `  - 커밋: ${from.slice(0, 8)} → ${head.slice(0, 8)} (${head === from ? '없음' : `${git(w.tree, 'rev-list', '--count', `${from}..${head}`)}개`}), 바뀐 파일 ${changed.join(', ') || '없음'}`,
            `  - 원격 PR 브랜치: ${remote?.slice(0, 8) ?? '없음'}`,
          )
          summaries.push(
            `## 라운드 ${round} (${task.id})`,
            '',
            '### 질문 (사람에게 물은 화면)',
            '',
            ...(out.questions.length
              ? out.questions.map((q) => ['```', q, '```'].join('\n'))
              : ['없음']),
            '',
            '### 항목별 결과 (response.md)',
            '',
            scrub(review?.respond?.results ?? '없음'),
            '',
            '### handoff 요약',
            '',
            scrub(review?.summary ?? '없음'),
            '',
            '### 커밋',
            '',
            '```',
            scrub(
              head === from ? '없음' : git(w.tree, 'log', '--format=%h %s', `${from}..${head}`),
            ),
            '```',
            '',
          )
          expect(out.status).toBe('published')
          expect(record).toMatchObject({ reason: 'auto_respond', approved_by: 'auto' })
          expect(workState(w).pr?.auto_rounds).toBe(round)
          expect(head).not.toBe(from)
          expect(changed).not.toContain(M11_TEST)
          expect(remote).toBe(head)
          expect(h.ui.notices.map((n) => n.body)).toContain(
            `PR #${w.pr}: 자동 대응 시작 — 라운드 ${round}, 새 항목 1개`,
          )
          expect(
            workEvents(w).find((e) => e.type === 'task.approved' && e.task_id === task.id)?.payload,
          ).toEqual({ by: 'auto' })
          return { task, head }
        }
        /** 새 head의 CI가 끝나기를 기다려 읽는다 */
        const ciAfter = async (round: number, head: string) => {
          await world.runCi(w.pr, head)
          const p = await refreshUntil(
            c,
            w,
            (x) => x.head === head && (x.ci === 'pass' || x.ci === 'fail'),
            `라운드 ${round} 뒤의 CI`,
            world.ciWaitMs,
          )
          c.note(`라운드 ${round} 뒤 head ${head.slice(0, 8)}의 CI: ${p.ci}`)
          return p
        }

        // ---------- 1. CI 실패로 자동 시작한 라운드 ----------
        const r1 = await autoRound(1, head1, [])
        let counted = ''
        try {
          counted = execFileSync(
            process.execPath,
            [
              '--input-type=module',
              '-e',
              `import('./${M11_FILE}').then((m) => console.log(m.totalQty([{ qty: 2 }, { qty: -1 }, { qty: 3 }])))`,
            ],
            { cwd: w.tree, encoding: 'utf8' },
          ).trim()
        } catch (e) {
          counted = `오류: ${String(e).split('\n')[0]}`
        }
        lines.push(`  - totalQty([2, -1, 3]) = ${counted}`)
        expect(counted).toBe('5')
        const after1 = await ciAfter(1, r1.head)
        expect(after1.ci).toBe('pass')
        expect(after1.items.find((i) => i.id === ci?.id)?.status).toBe('done')

        // ---------- 2. 소유자의 코멘트로 자동 시작한 라운드: 답글이 실제 PR에 게시된다 ----------
        await world.convo(w.pr, ASK)
        await refreshUntil(
          c,
          w,
          (p) => p.items.some((i) => i.kind === 'convo'),
          '소유자의 수정 요청 코멘트',
        )
        const r2 = await autoRound(2, r1.head, [r1.task.id])
        const posted = (await world.comments(w.pr)).filter((x) => x.body.includes('<!-- relay:'))
        const doc = fs.readFileSync(path.join(w.tree, M11_FILE), 'utf8')
        lines.push(
          `  - 게시한 답글: ${posted.length}개 (${posted.map((x) => `${x.kind}:${x.id}`).join(', ') || '없음'})`,
          `  - ${M11_FILE}의 @example: ${doc.includes('@example') ? '있음' : '없음'}`,
        )
        summaries.push(
          '### 게시한 답글 (실제 PR)',
          '',
          ...(posted.length
            ? posted.map((x) => ['```', scrub(x.body), '```'].join('\n'))
            : ['없음']),
          '',
        )
        expect(posted).toHaveLength(1)
        expect(posted[0]?.kind).toBe('convo')
        expect(posted[0]?.body).toMatch(/^> @\S+의 대화 코멘트에 대한 답글: https?:\/\//)
        expect(posted[0]?.body).toContain(DEFAULT_CONFIG.reply_signature)
        expect(leak(posted[0]?.body ?? '')).toBeNull()
        expect(doc).toContain('@example')
        const after2 = await ciAfter(2, r2.head)
        expect(after2.ci).toBe('pass')
        expect(after2.items.find((i) => i.kind === 'convo')?.status).toBe('done')

        // ---------- 3. 상한: 새 코멘트로는 시작하지 않고 멈추고 알린다 ----------
        await world.convo(w.pr, COMMENT)
        const paused = await refreshUntil(
          c,
          w,
          (_p, v) => v.badge.kind === 'auto_paused',
          '자동 대응 멈춤',
        )
        await settle(h, w.key)
        const convo = paused.items.find((i) => i.kind === 'convo' && i.status === 'new')
        const events = workEvents(w).filter((e) => e.type === 'pr.auto_paused')
        const notice = h.ui.notices.find((n) => n.body.includes('자동 대응 멈춤'))?.body ?? ''
        c.note(`상한: ${convo?.id ?? '?'}로 멈춤, 알림 "${notice}"`)
        expect(events.map((e) => e.payload)).toEqual([
          { reason: 'round_limit', rounds: 2, max: 2, items: [convo?.id] },
        ])
        expect(notice).toBe(
          `PR #${w.pr}: 자동 대응 멈춤 — 사람 손 없이 이어진 라운드가 상한(2)에 닿음. 새 항목 1개는 [대응 시작]으로 대응하세요 (누르면 다시 셈)`,
        )
        expect(paused.auto.paused).toBe(true)
        expect(workState(w).tasks.filter((t) => t.node === 'respond')).toHaveLength(2)
      } catch (e) {
        error = e
      } finally {
        let cleanError: unknown = null
        try {
          if (!dry) report = cleanup(REPO, run, ctx?.created.map((x) => x.branch) ?? [])
        } catch (e) {
          cleanError = e
        }
        const panels = [...h.ui.works.values()].map(
          (x) => `- ${x.workId} ${x.statusLabel}, 배지 ${x.badge.kind}: ${describePr(x.pr)}`,
        )
        const text = scrub(
          [
            ...header(
              `relay [실제] 자동 대응 (M11, ${dry ? 'dry: 가짜 claude와 가짜 gh' : '실제 claude와 실제 gh'})`,
              version,
            ),
            `- 시험: ${run}, 기준 브랜치 ${dry ? 'main (로컬 bare 원격)' : base}, PR ${ctx?.created.map((x) => `#${x.pr ?? '?'}`).join(', ') || '없음'}`,
            `- 결과: ${error ? '실패' : '통과'} (${seconds(Date.now() - started)})`,
            ...(error ? [`- 오류: ${String(error instanceof Error ? error.message : error)}`] : []),
            ...lines,
            '',
            ...summaries,
            '## 단계',
            '',
            ...(notes.length ? notes.map((n) => `- ${n}`) : ['- 없음']),
            '',
            '## 알림',
            '',
            ...(h.ui.notices.length ? h.ui.notices.map((n) => `- ${n.body}`) : ['- 없음']),
            '',
            '## 끝났을 때의 PR 패널',
            '',
            ...(panels.length ? panels : ['- 없음']),
            '',
            ...(dry ? [] : cleanupLines(report, cleanError)),
            ...(error ? ['## 화면', '', '```', ui.dump(), '```', ''] : []),
          ].join('\n'),
        )
        fs.mkdirSync(OUT, { recursive: true })
        fs.writeFileSync(path.join(OUT, 'pr-auto.md'), text)
        console.log(`----- pr-auto.md -----\n${text}\n----- pr-auto.md 끝 -----`)
        await h.close()
      }
      if (error) throw error
      if (dry) return
      expect(report?.failed).toEqual([])
      expect(report?.leftBranches).toEqual([])
      expect(report?.leftPrs).toEqual([])
    },
    TIMEOUT_MS,
  )
})
