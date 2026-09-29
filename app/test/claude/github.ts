// [실제] PR 진행(M9)의 GitHub 쪽 (docs/implementation.md 8.4의 "PR 진행", I48, I49). 시험용 레포(RELAY_TEST_GH_REPO)에
// gh와 git으로 relay 밖의 사람, 봇, CI를 한다. 공통 시나리오(test/flow/pr-scenario.ts)의 PrWorld를 RealWorld가 맡는다.
// 인증은 GH_TOKEN(러너에서는 RELAY_TEST_GH_TOKEN secret)이고, git은 gh의 자격 증명을 쓴다(시험 도구와 앱의 git에만
// 환경 변수로 준다). 명령의 모양은 S7과 같다(spikes/s7-github.mjs). 토큰은 어디에도 찍지 않는다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { PrComment, PrWorld } from '../flow/pr-scenario'

/** gh는 묻지 않고 새 버전 안내를 끈다 (3절 "gh 환경 변수") */
const GH_ENV = { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' }

/** git push와 fetch가 gh의 자격 증명을 쓰게 한다. 사용자 설정의 다른 자격 증명 도우미는 끈다 (S7과 같음) */
export const GIT_ENV: Record<string, string> = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'credential.helper',
  GIT_CONFIG_VALUE_0: '',
  GIT_CONFIG_KEY_1: 'credential.helper',
  GIT_CONFIG_VALUE_1: '!gh auth git-credential',
}

/** 결과와 로그에 토큰 모양이 남지 않게 가린다 */
export function redact(text: string): string {
  return text.replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g, '[가림]')
}

export class CommandError extends Error {}

interface Result {
  code: number
  stdout: string
  stderr: string
}

function exec(
  cmd: string,
  args: readonly string[],
  o: { cwd?: string; input?: string; env?: Record<string, string> } = {},
): Result {
  const r = spawnSync(cmd, args, {
    cwd: o.cwd,
    input: o.input,
    encoding: 'utf8',
    env: { ...process.env, ...o.env },
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  return {
    code: r.status ?? -1,
    stdout: (r.stdout ?? '').trim(),
    stderr: `${(r.stderr ?? '').trim()}${r.error ? `\n${r.error.message}` : ''}`,
  }
}

const show = (r: Result) =>
  redact(`종료 코드 ${r.code}\n${r.stdout}${r.stderr ? `\n[stderr] ${r.stderr}` : ''}`)

function ok(r: Result, what: string): string {
  if (r.code !== 0) throw new CommandError(`${what}: ${show(r)}`)
  return r.stdout
}

export const gh = (args: readonly string[], o: { cwd?: string; input?: string } = {}) =>
  exec('gh', args, { ...o, env: GH_ENV })

export const git = (cwd: string, ...args: string[]) =>
  ok(exec('git', args, { cwd, env: GIT_ENV }), `git ${args.join(' ')}`)

export const ghJson = <T>(args: readonly string[]): T =>
  JSON.parse(ok(gh(args), `gh ${args.slice(0, 3).join(' ')}`) || 'null') as T

/** REST 호출. 본문은 표준 입력의 JSON이다 */
function api(method: string, endpoint: string, body?: unknown): Result {
  const args = ['api', '-X', method, endpoint]
  if (body !== undefined) args.push('--input', '-')
  return gh(args, body === undefined ? {} : { input: JSON.stringify(body) })
}

const apiJson = <T>(method: string, endpoint: string, body?: unknown): T =>
  JSON.parse(ok(api(method, endpoint, body), `${method} ${endpoint}`) || 'null') as T

/** 모든 쪽을 읽은 목록 (--paginate --slurp) */
export function list<T>(endpoint: string): T[] {
  const pages = JSON.parse(
    ok(gh(['api', '--paginate', '--slurp', endpoint]), `GET ${endpoint}`) || '[]',
  ) as T[][]
  return pages.flat()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** fn이 값을 줄 때까지 부른다. 명령 실패(CommandError)는 다시 시도한다(502 따위). 한도를 넘으면 마지막 오류와 함께 던진다 */
export async function waitFor<T>(
  what: string,
  fn: () => T | null | undefined | Promise<T | null | undefined>,
  timeoutMs: number,
  intervalMs = 5000,
): Promise<T> {
  const end = Date.now() + timeoutMs
  let last: Error | null = null
  for (;;) {
    try {
      const v = await fn()
      if (v) return v
    } catch (e) {
      if (!(e instanceof CommandError)) throw e
      last = e
    }
    if (Date.now() > end) {
      throw new Error(`기다리다 시간 초과: ${what}${last ? `\n마지막 오류: ${last.message}` : ''}`)
    }
    await sleep(intervalMs)
  }
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const enc = encodeURIComponent

interface CheckRun {
  __typename: string
  status?: string
}

/** 시험(run)의 id: 초까지의 시각과 임의의 6자. 기준 브랜치 이름 m9/<run>/base와 정리할 범위가 된다 */
export function newRunId(): string {
  const t = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
  return `${t}-${Math.random().toString(16).slice(2, 8)}`
}

/** 시험용 레포를 clone한다. 메인 체크아웃이 되어 앱에 프로젝트로 등록한다 */
export function cloneRepo(repo: string, dir: string, branch: string): string {
  git(path.dirname(dir), 'clone', '-q', '-b', branch, `https://github.com/${repo}.git`, dir)
  git(dir, 'config', 'user.name', 'relay-m9')
  git(dir, 'config', 'user.email', 'relay-m9@example.com')
  git(dir, 'config', 'commit.gpgsign', 'false')
  return dir
}

/** 실제 GitHub의 세계 (PrWorld) */
export class RealWorld implements PrWorld {
  readonly kind = 'real'
  readonly bot = 'github-actions'
  readonly pollMs = 5000
  readonly waitMs = 180_000
  readonly ciWaitMs = 600_000
  private clones = 0

  /**
   * repo: owner/name. base: 이 시험의 임시 기준 브랜치(I48). clone: 앱에 등록한 메인 체크아웃. scratch: relay 밖의 clone을
   * 둘 폴더
   */
  constructor(
    readonly repo: string,
    readonly base: string,
    private readonly clone: string,
    private readonly scratch: string,
  ) {}

  file(name: string): string {
    return fs.readFileSync(path.join(this.clone, name), 'utf8')
  }

  /** head의 Actions 체크가 모두 끝날 때까지 기다린다 (S7의 waitChecks) */
  async runCi(pr: number, head: string): Promise<void> {
    await waitFor(
      `${head.slice(0, 8)}의 CI`,
      () => {
        const v = ghJson<{ headRefOid: string; statusCheckRollup: CheckRun[] | null }>([
          'pr',
          'view',
          String(pr),
          '--repo',
          this.repo,
          '--json',
          'headRefOid,statusCheckRollup',
        ])
        if (v.headRefOid !== head) return null
        const runs = (v.statusCheckRollup ?? []).filter((c) => c.__typename === 'CheckRun')
        return runs.length > 0 && runs.every((c) => c.status === 'COMPLETED')
      },
      this.ciWaitMs,
    )
  }

  async convo(pr: number, body: string): Promise<void> {
    apiJson('POST', `repos/${this.repo}/issues/${pr}/comments`, { body })
  }

  /** 소유자의 리뷰: 본문과 인라인 코멘트 하나 (S7 절차 3과 같음). 자기 PR이라 COMMENT만 된다 */
  async review(
    pr: number,
    head: string,
    r: { body: string; path: string; line: number; comment: string },
  ): Promise<void> {
    apiJson('POST', `repos/${this.repo}/pulls/${pr}/reviews`, {
      commit_id: head,
      event: 'COMMENT',
      body: r.body,
      comments: [{ path: r.path, line: r.line, side: 'RIGHT', body: r.comment }],
    })
  }

  /** 시험용 레포의 봇 코멘트 워크플로를 돌려 github-actions[bot]의 대화 코멘트를 단다 (S7의 dispatchBot) */
  async botConvo(pr: number, body: string): Promise<void> {
    const since = new Date(Date.now() - 10_000).toISOString()
    const res = gh([
      'workflow',
      'run',
      'bot-comment.yml',
      '--repo',
      this.repo,
      '-f',
      `pr=${pr}`,
      '-f',
      'kind=conversation',
      '-f',
      `body=${body}`,
    ])
    ok(res, '봇 코멘트 워크플로')
    const found = /\/actions\/runs\/(\d+)/.exec(res.stdout)?.[1]
    const id =
      found ??
      (await waitFor(
        '봇 코멘트 실행 찾기',
        () =>
          ghJson<{ databaseId: number; createdAt: string }[]>([
            'run',
            'list',
            '--repo',
            this.repo,
            '--workflow',
            'bot-comment.yml',
            '--event',
            'workflow_dispatch',
            '--limit',
            '10',
            '--json',
            'databaseId,createdAt',
          ])
            .filter((x) => x.createdAt >= since)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
            ?.databaseId.toString(),
        60_000,
        3000,
      ))
    const done = await waitFor(
      '봇 코멘트 실행',
      () => {
        const v = ghJson<{ status: string; conclusion: string }>([
          'run',
          'view',
          id,
          '--repo',
          this.repo,
          '--json',
          'status,conclusion',
        ])
        return v.status === 'completed' ? v : null
      },
      300_000,
    )
    if (done.conclusion !== 'success') throw new Error(`봇 코멘트 실행 ${id}: ${done.conclusion}`)
  }

  /** relay 밖에서 브랜치에 커밋한다: contents API(웹 편집과 같음). 파일마다 커밋 하나다 */
  async commit(
    branch: string,
    files: Record<string, string | null>,
    message: string,
  ): Promise<string> {
    let sha = ''
    for (const [name, text] of Object.entries(files)) {
      const at = `repos/${this.repo}/contents/${name.split('/').map(enc).join('/')}`
      const cur = api('GET', `${at}?ref=${enc(branch)}`)
      const blob = cur.code === 0 ? (JSON.parse(cur.stdout) as { sha: string }).sha : undefined
      const r =
        text === null
          ? apiJson<{ commit: { sha: string } }>('DELETE', at, { message, sha: blob, branch })
          : apiJson<{ commit: { sha: string } }>('PUT', at, {
              message,
              content: b64(text),
              branch,
              ...(blob ? { sha: blob } : {}),
            })
      sha = r.commit.sha
    }
    return sha
  }

  /** 다른 clone에서 기준 브랜치를 PR 브랜치에 병합하고, 충돌은 resolved로 풀어 push한다 */
  async mergeBase(
    branch: string,
    resolved: Record<string, string>,
    message: string,
  ): Promise<string> {
    const dir = cloneRepo(this.repo, path.join(this.scratch, `outside-${++this.clones}`), branch)
    git(dir, 'fetch', '-q', 'origin', this.base)
    const merged = exec('git', ['merge', '--no-ff', '-m', message, `origin/${this.base}`], {
      cwd: dir,
      env: GIT_ENV,
    })
    if (merged.code !== 0) {
      for (const [name, text] of Object.entries(resolved)) {
        fs.writeFileSync(path.join(dir, name), text)
      }
      git(dir, 'add', '-A')
      git(dir, 'commit', '-q', '--no-edit')
    }
    git(dir, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`)
    return git(dir, 'rev-parse', 'HEAD')
  }

  async close(pr: number): Promise<void> {
    ok(gh(['pr', 'close', String(pr), '--repo', this.repo]), 'gh pr close')
  }

  async reopen(pr: number): Promise<void> {
    ok(gh(['pr', 'reopen', String(pr), '--repo', this.repo]), 'gh pr reopen')
  }

  /** relay 밖에서 gh로 머지한다. 다시 연 직후는 GitHub가 머지 가능 여부를 계산하는 중일 수 있어 다시 시도한다 */
  async merge(pr: number): Promise<void> {
    const allowed = ghJson<Record<string, boolean>>([
      'repo',
      'view',
      this.repo,
      '--json',
      'mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed',
    ])
    const method = allowed['mergeCommitAllowed']
      ? 'merge'
      : allowed['squashMergeAllowed']
        ? 'squash'
        : 'rebase'
    await waitFor(
      `PR #${pr}을 밖에서 머지`,
      () => {
        ok(gh(['pr', 'merge', String(pr), '--repo', this.repo, `--${method}`]), 'gh pr merge')
        return true
      },
      120_000,
    )
  }

  async branchTip(branch: string): Promise<string | null> {
    const out = git(this.clone, 'ls-remote', '--heads', 'origin', `refs/heads/${branch}`)
    return out ? (out.split(/\s+/)[0] ?? null) : null
  }

  async comments(pr: number): Promise<PrComment[]> {
    const rows = (
      kind: 'inline' | 'convo',
      xs: { id: number; body?: string | null; in_reply_to_id?: number }[],
    ): PrComment[] =>
      xs.map((c) => ({ kind, id: c.id, body: c.body ?? '', reply_to: c.in_reply_to_id ?? null }))
    return [
      ...rows('inline', list(`repos/${this.repo}/pulls/${pr}/comments?per_page=100`)),
      ...rows('convo', list(`repos/${this.repo}/issues/${pr}/comments?per_page=100`)),
    ]
  }

  /** 실행의 run_attempt가 2 이상이 될 때까지 기다린다 (REST "Get a workflow run") */
  async rerunSeen(_pr: number, run: number): Promise<boolean> {
    await waitFor(
      `실행 ${run}의 다시 실행`,
      () =>
        (apiJson<{ run_attempt?: number }>('GET', `repos/${this.repo}/actions/runs/${run}`)
          .run_attempt ?? 0) >= 2,
      120_000,
    )
    return true
  }
}

// ---------- 정리 ----------

interface PrRow {
  number: number
  state: string
  headRefName: string
  baseRefName: string
}

const PREFIX = 'm9/'

/** 원격에 그 이름의 브랜치가 있다 (REST git/ref/heads/<브랜치>는 없으면 404) */
function refExists(repo: string, branch: string): boolean {
  return (
    api('GET', `repos/${repo}/git/ref/heads/${branch.split('/').map(enc).join('/')}`).code === 0
  )
}

/** 남은 m9/ 기준 브랜치 */
export function leftoverBases(repo: string): string[] {
  return list<{ ref: string }>(`repos/${repo}/git/matching-refs/heads/${PREFIX}`).map((x) =>
    x.ref.replace(/^refs\/heads\//, ''),
  )
}

export interface CleanupReport {
  closed: number[]
  deleted: string[]
  failed: string[]
  leftBranches: string[]
  leftPrs: number[]
}

/**
 * 시험이 만든 것을 치운다. run이 있으면 그 시험의 기준 브랜치 m9/<run>/base에 연 PR과 그 head 브랜치, 기준 브랜치를,
 * 없으면(pr-cleanup) m9/ 아래 모든 기준 브랜치와 그 PR을 치운다. heads는 더 지울 브랜치다(만든 Work의 브랜치).
 * 열린 PR은 닫고, 기준 브랜치는 마지막에 지운다. 남은 것을 다시 읽어 알린다
 */
export function cleanup(
  repo: string,
  run: string | null,
  heads: readonly string[] = [],
): CleanupReport {
  const prefix = run ? `${PREFIX}${run}/` : PREFIX
  const prs = ghJson<PrRow[]>([
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--limit',
    '200',
    '--json',
    'number,state,headRefName,baseRefName',
  ]).filter((p) => p.baseRefName.startsWith(prefix))
  const closed: number[] = []
  for (const p of prs.filter((x) => x.state === 'OPEN')) {
    if (
      gh([
        'pr',
        'close',
        String(p.number),
        '--repo',
        repo,
        '--comment',
        'relay M9 시험을 마쳐 닫습니다.',
      ]).code === 0
    ) {
      closed.push(p.number)
    }
  }
  const bases = leftoverBases(repo).filter((b) => b.startsWith(prefix))
  const branches = [...new Set([...prs.map((p) => p.headRefName), ...heads])].filter(
    (b) => !b.startsWith(PREFIX),
  )
  const deleted: string[] = []
  const failed: string[] = []
  for (const b of [...branches, ...bases]) {
    const r = api('DELETE', `repos/${repo}/git/refs/heads/${b.split('/').map(enc).join('/')}`)
    if (r.code === 0) deleted.push(b)
    else if (!/Reference does not exist|HTTP 422|HTTP 404/.test(r.stderr))
      failed.push(`${b}: ${show(r)}`)
  }
  const leftBranches = [
    ...leftoverBases(repo).filter((b) => b.startsWith(prefix)),
    ...branches.filter((b) => refExists(repo, b)),
  ]
  const leftPrs = ghJson<PrRow[]>([
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--limit',
    '200',
    '--json',
    'number,state,headRefName,baseRefName',
  ])
    .filter((p) => p.baseRefName.startsWith(prefix))
    .map((p) => p.number)
  return { closed, deleted, failed, leftBranches, leftPrs }
}
