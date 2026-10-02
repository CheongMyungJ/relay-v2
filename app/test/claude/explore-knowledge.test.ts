// [탐색] 실제 claude로 지식 관리의 여러 시나리오를 돌려 기록만 남긴다 (합격 판정 없음).
// 시나리오마다 레포, 미리 넣을 지식(팀은 레포에 커밋, 공유 대기·나만은 앱 저장소), Work 사이의 코드 변경, Work마다의 요청과
// 거르기 선택을 정한다. task마다 `참고 지식`, 지식 후보·피드백, Work 완료 화면의 지식 칸, 앱 저장소를 남긴다. 질문은 Work
// 사본의 tasks/*/pty.log에 있다. RELAY_EXPLORE=<시나리오 id,...>로 고른다. 결과는 test-results/explore/<id>/ (docs/knowledge-explore.md).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'vitest'
import { renderEntry } from '../../src/core/knowledge'
import { taskDirName } from '../../src/core/machine'
import { checkHandoff, handoffV2, sectionText } from '../../src/core/validate'
import {
  defaultCandidateChoice,
  type KnowledgeChoices,
  type KnowledgeEntry,
  type KnowledgeReview,
} from '../../src/shared/knowledge'
import type { WorkState } from '../../src/shared/work'
import { drive } from '../flow/driver'
import {
  APP,
  git,
  harness,
  makeRepo,
  register,
  settle,
  writeFiles,
  type Harness,
} from '../flow/harness'
import { ScreenUi } from './screen'
import {
  EXPLORE_SCENARIOS,
  type ExploreScenario,
  type ExploreWork,
  type Seed,
} from './explore-scenarios'

const picked = (process.env['RELAY_EXPLORE'] ?? '').split(/[\s,]+/).filter(Boolean)
const OUT = path.join(APP, 'test-results', 'explore')
const TASK_TIMEOUT_MS = 25 * 60 * 1000
const NUDGE = '스킬의 절차를 계속해 주세요. 마치면 종료 절차대로 handoff를 쓰고 턴을 끝내 주세요.'

const KEEP = [
  'HOME',
  'PATH',
  'SHELL',
  'USER',
  'LOGNAME',
  'TMPDIR',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'no_proxy',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'REQUESTS_CA_BUNDLE',
  'CLAUDE_CONFIG_DIR',
  'ANTHROPIC_MODEL',
  'CLAUDE_CODE_EFFORT_LEVEL',
  'RELAY_HOOK_TOKEN',
]

/** 실제 claude를 필요한 환경 변수만으로 띄우는 감싸개 (8.4의 env -i) */
function wrapper(dir: string): string {
  const real = execFileSync('bash', ['-lc', 'command -v claude']).toString().trim()
  const config = path.join(dir, 'claude-config')
  fs.mkdirSync(config, { recursive: true })
  fs.writeFileSync(
    path.join(config, '.claude.json'),
    JSON.stringify({ hasCompletedOnboarding: true }),
  )
  fs.writeFileSync(
    path.join(config, 'settings.json'),
    JSON.stringify({ promptSuggestionEnabled: false }),
  )
  const file = path.join(dir, 'claude-env.sh')
  fs.writeFileSync(
    file,
    [
      '#!/usr/bin/env bash',
      `export CLAUDE_CONFIG_DIR='${config}'`,
      `export ANTHROPIC_MODEL="\${EXPLORE_MODEL:-sonnet}"`,
      `export CLAUDE_CODE_EFFORT_LEVEL="\${EXPLORE_EFFORT:-medium}"`,
      `keep=(${KEEP.join(' ')})`,
      'vars=("TERM=xterm-256color" "LANG=${LANG:-C.UTF-8}" DISABLE_AUTOUPDATER=1 CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION=false)',
      'for k in "${keep[@]}"; do',
      '  if [ -n "${!k+x}" ]; then vars+=("$k=${!k}"); fi',
      'done',
      'if [ "$(id -u)" = 0 ]; then vars+=(IS_SANDBOX=1); fi',
      `exec env -i "\${vars[@]}" '${real}' "$@"`,
      '',
    ].join('\n'),
    { mode: 0o755 },
  )
  return file
}

/** 팀 지식을 레포에 커밋한다. 해시는 그 커밋 전 HEAD의 blob/tree로 채운다 */
function seedTeam(repo: string, entries: readonly KnowledgeEntry[]): void {
  const withHash = entries.map((e) => {
    const hashes: Record<string, string> = { ...e.hashes }
    for (const p of e.paths) {
      if (hashes[p]) continue
      const file = p.includes(':') ? p.slice(0, p.indexOf(':')) : p
      try {
        const line = git(repo, 'ls-tree', 'HEAD', '--', file.replace(/\/$/, ''))
        const h = line.split(/\s+/)[2]
        if (h) hashes[p] = h
      } catch {
        // 없는 경로는 해시 없이 둔다
      }
    }
    return { ...e, hashes }
  })
  writeFiles(
    repo,
    Object.fromEntries(
      withHash.map((e) => [`docs/knowledge/${e.kind}/${e.id}.md`, renderEntry(e)]),
    ),
  )
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'seed knowledge')
}

function seedStore(
  store: string,
  scope: 'pending' | 'mine',
  entries: readonly KnowledgeEntry[],
): void {
  for (const e of entries) {
    const file = path.join(store, scope, e.kind, `${e.id}.md`)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, renderEntry(e))
  }
}

function applySeed(repo: string, store: string, seed: Seed | undefined): void {
  if (!seed) return
  if (seed.team?.length) seedTeam(repo, seed.team)
  if (seed.pending?.length) seedStore(store, 'pending', seed.pending)
  if (seed.mine?.length) seedStore(store, 'mine', seed.mine)
}

function storeDump(store: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const scope of ['pending', 'mine']) {
    const dir = path.join(store, scope)
    if (!fs.existsSync(dir)) continue
    for (const f of fs.readdirSync(dir, { recursive: true }).map(String)) {
      if (f.endsWith('.md')) out[`${scope}/${f}`] = fs.readFileSync(path.join(dir, f), 'utf8')
    }
  }
  return out
}

interface TaskLog {
  id: string
  node: string
  status: string
  /** context.md의 `참고 지식` */
  knowledge: string | null
  candidates: unknown[]
  feedback: unknown[]
  decisions: unknown[]
}

interface WorkLog {
  name: string
  request: string
  status: string
  reason: string | null
  ms: number
  tasks: TaskLog[]
  intent: string | null
  review: KnowledgeReview | null
  defaults: { key: string; adopt: boolean; why: string }[]
  store: Record<string, string>
}

async function runWork(
  h: Harness,
  ui: ScreenUi,
  projectId: string,
  w: ExploreWork,
  outDir: string,
): Promise<WorkLog> {
  const created = await h.relay.createWork(projectId, {
    request: w.request,
    type: w.type ?? 'bugfix',
    baseBranch: 'main',
    baseLocation: 'local',
  })
  if (!created.ok) throw new Error(`Work 생성 실패: ${created.error}`)
  const key = created.workKey
  const workDir = path.join(h.home, 'projects', projectId, 'works', key.split('/')[1] ?? '')
  const tick = async (task: { status: string; terminal: string }) => {
    if (task.status !== 'asking') await ui.handleDialogs(h.relay, task.terminal)
  }
  const common = { force: true, nudge: NUDGE, maxNudges: 2, stepTimeoutMs: TASK_TIMEOUT_MS, tick }
  const first = await drive(h.relay, ui, key, {
    ...common,
    pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
  })
  let review: KnowledgeReview | null = null
  const defaults: WorkLog['defaults'] = []
  let status = first.status as string
  let reason = first.reason
  let ms = first.ms
  if (first.status === 'paused') {
    await settle(h, key)
    const verify = ui.works.get(key)?.current ?? ''
    const r = await h.relay.review(key, verify)
    review = r?.completion?.knowledge ?? null
    for (const c of review?.candidates ?? []) {
      const d = defaultCandidateChoice(c, review?.share ?? true)
      defaults.push({
        key: c.key,
        adopt: d.adopt,
        why: c.unrefined
          ? '다듬지 않은 사람 결정'
          : c.sameDecisionAs
            ? `같은 결정(${c.sameDecisionAs})`
            : c.similarTo
              ? `비슷한 후보(${c.similarTo})`
              : d.replace
                ? `대체 ${d.replace}`
                : '',
      })
    }
    const choices: KnowledgeChoices | undefined = w.choices?.(review)
    const ok = await h.relay.approve(key, verify, choices ? { knowledge: choices } : {})
    if (!ok.ok) {
      status = 'failed'
      reason = `verify 승인 실패: ${JSON.stringify(ok)}`
    } else {
      const rest = await drive(h.relay, ui, key, common)
      status = rest.status
      reason = rest.reason
      ms += rest.ms
    }
  }
  await settle(h, key)
  const work = JSON.parse(fs.readFileSync(path.join(workDir, 'work.json'), 'utf8')) as WorkState
  const tasks: TaskLog[] = []
  for (const t of work.tasks) {
    const dir = path.join(workDir, 'tasks', taskDirName(t))
    const ctx = path.join(dir, 'context.md')
    const log: TaskLog = {
      id: t.id,
      node: t.node,
      status: t.status,
      knowledge: fs.existsSync(ctx) ? sectionText(fs.readFileSync(ctx, 'utf8'), '참고 지식') : null,
      candidates: [],
      feedback: [],
      decisions: [],
    }
    const file = path.join(dir, 'handoff.md')
    if (fs.existsSync(file)) {
      const check = checkHandoff(fs.readFileSync(file, 'utf8'), {
        node: t.node,
        type: work.type ?? 'bugfix',
        warnChars: 100_000,
        formatVersion: t.format_version,
      })
      const v2 = handoffV2(check.header, check.version)
      log.candidates = v2?.knowledge_candidates ?? []
      log.feedback = v2?.knowledge_feedback ?? []
      log.decisions = check.header?.decisions ?? []
    }
    tasks.push(log)
  }
  const intent = path.join(workDir, 'intent.md')
  const store = path.join(h.home, 'projects', projectId, 'knowledge')
  const dest = path.join(outDir, w.name)
  fs.rmSync(dest, { recursive: true, force: true })
  fs.cpSync(workDir, dest, { recursive: true })
  return {
    name: w.name,
    request: w.request,
    status,
    reason,
    ms,
    tasks,
    intent: fs.existsSync(intent) ? fs.readFileSync(intent, 'utf8') : null,
    review,
    defaults,
    store: storeDump(store),
  }
}

async function runScenario(s: ExploreScenario): Promise<void> {
  const outDir = path.join(OUT, s.id)
  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-explore-'))
  const ui = new ScreenUi()
  const h = await harness({
    ui,
    claudeBin: wrapper(tmp),
    ...(s.config ? { config: s.config } : {}),
  })
  const logs: WorkLog[] = []
  const write = () => fs.writeFileSync(path.join(outDir, 'log.json'), JSON.stringify(logs, null, 2))
  try {
    const { repo } = makeRepo(h.root, s.id, s.files)
    const projectId = await register(h, repo)
    const store = path.join(h.home, 'projects', projectId, 'knowledge')
    applySeed(repo, store, s.seed)
    for (const [i, w] of s.works.entries()) {
      if (w.before) {
        w.before(repo)
        git(repo, 'add', '-A')
        git(repo, 'commit', '-q', '-m', `before ${w.name}`)
      }
      console.log(`[탐색 ${s.id}] ${i + 1}/${s.works.length} ${w.name} 시작`)
      const log = await runWork(h, ui, projectId, w, outDir)
      logs.push(log)
      write()
      console.log(
        `[탐색 ${s.id}] ${w.name} 끝: ${log.status} ${log.reason ?? ''} ${Math.round(log.ms / 1000)}초`,
      )
      if (log.status !== 'completed') break
    }
  } finally {
    write()
    fs.writeFileSync(path.join(outDir, 'ui.txt'), ui.dump())
    await h.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

describe.runIf(picked.length > 0)('[탐색] 지식 관리 시나리오', () => {
  for (const id of picked) {
    const s = EXPLORE_SCENARIOS.find((x) => x.id === id)
    it(`시나리오 ${id}`, async () => {
      if (!s) throw new Error(`없는 시나리오: ${id}`)
      await runScenario(s)
    })
  }
})
