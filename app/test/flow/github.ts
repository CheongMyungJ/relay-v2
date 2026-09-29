// 가짜 GitHub (docs/implementation.md 8.2). 가짜 gh가 읽는 prs.json과 github.json, PR 브랜치가 있는 로컬 bare 원격을
// 바꿔 relay 밖의 사람, 봇, CI를 흉내 낸다. 코멘트와 체크, 로그의 모양은 S7에서 본 것이다(docs/spikes.md S7, PR #14).
// [흐름]의 PR 진행 시험(pr.test.ts)이 쓰고, 공통 시나리오(pr-scenario.ts)의 PrWorld를 FakeWorld가 맡는다.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { git, writeFiles } from './repo'
import type { PrWorld } from './pr-scenario'

export interface FakePr {
  number: number
  url: string
  repo: string
  /** PR 브랜치가 있는 로컬 bare 원격 */
  remote: string | null
  head: string
  base: string
  state: 'open' | 'closed' | 'merged'
  head_oid: string | null
  base_oid: string | null
  merged_at?: string
  merged_method?: string
}

interface PrState {
  /** head 커밋별 statusCheckRollup (gh --json의 모양) */
  checks?: Record<string, object[]>
  reviews?: object[]
  inline?: object[]
  convo?: object[]
  mergeable?: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  merge_state?: string
  review_decision?: string
}

interface GithubFile {
  prs: Record<string, PrState>
  /** 작업 id별 gh run view --log-failed의 출력 */
  logs: Record<string, string>
  /** 실행이 끝나지 않아 로그를 줄 수 없는 작업 id → 실행 id */
  pending_logs: Record<string, number>
  /** 실행 id → 실행을 부른 이벤트 (gh api …/actions/runs/<실행>, D201) */
  runs?: Record<string, { event: string }>
  methods?: { merge?: boolean; squash?: boolean; rebase?: boolean }
  next_id?: number
}

/** 코멘트를 다는 사람. REST의 user와 author_association (S7 관찰 3) */
export type Who = 'owner' | 'outsider' | 'bot'

const USERS: Record<Who, { login: string; type: string; association: string }> = {
  owner: { login: 'relay-owner', type: 'User', association: 'OWNER' },
  outsider: { login: 'passer-by', type: 'User', association: 'NONE' },
  // 봇 코멘트 워크플로가 GITHUB_TOKEN으로 단 코멘트 (S7 관찰 3)
  bot: { login: 'github-actions[bot]', type: 'Bot', association: 'NONE' },
}

const stamp = (d = new Date()) => d.toISOString().replace(/\.\d+Z$/, 'Z')

/** 시험용 레포의 CI가 ci-fail 스위치로 실패할 때 찍는 말 (시험용 레포 .github/workflows/ci.yml) */
export const CI_FAIL_TEXT = 'ci-fail 파일이 있어 실패합니다 (시험용 스위치).'

/**
 * gh run view --log-failed의 출력 (S7 관찰 2): 줄마다 `<작업>\t<스텝>\t<시각> <줄>`이고, 색 제어 문자는 gh가 `^[`
 * 글자로 바꿔 쓴다. 끝의 두 줄이 실패의 까닭이다
 */
export function failedLog(job: string, step: string, lines: readonly string[]): string {
  const at = '2026-09-29T00:00:01.2345678Z'
  return `${lines.map((l) => `${job}\t${step}\t${at} ${l}`).join('\n')}\n`
}

const CI_LOG = failedLog('test', 'Run npm test', [
  '^[[36;1mif [ -f ci-fail ]; then^[[0m',
  `^[[36;1m  echo "::error::${CI_FAIL_TEXT}"^[[0m`,
  '^[[36;1m  exit 1^[[0m',
  '^[[36;1mfi^[[0m',
  '^[[36;1mnpm test^[[0m',
  'shell: /usr/bin/bash -e {0}',
  `##[error]${CI_FAIL_TEXT}`,
  '##[error]Process completed with exit code 1.',
])

export class FakeGitHub {
  private clones = 0

  /**
   * dir: 가짜 gh의 기록 폴더(FAKE_GH_RECORD). remote: PR 브랜치가 있는 로컬 bare 원격. scratch: relay 밖의 clone을 둘 폴더
   */
  constructor(
    readonly dir: string,
    readonly remote: string,
    private readonly scratch: string,
  ) {}

  // ---------- 파일 ----------

  prs(): FakePr[] {
    const file = path.join(this.dir, 'prs.json')
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as FakePr[]) : []
  }

  pr(n: number): FakePr {
    const pr = this.prs().find((p) => p.number === n)
    if (!pr) throw new Error(`가짜 GitHub에 PR #${n}이 없음`)
    return pr
  }

  private savePrs(prs: FakePr[]): void {
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(path.join(this.dir, 'prs.json'), JSON.stringify(prs, null, 2))
  }

  private updatePr(n: number, fn: (pr: FakePr) => void): void {
    const prs = this.prs()
    const pr = prs.find((p) => p.number === n)
    if (!pr) throw new Error(`가짜 GitHub에 PR #${n}이 없음`)
    fn(pr)
    this.savePrs(prs)
  }

  read(): GithubFile {
    const file = path.join(this.dir, 'github.json')
    const g = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<GithubFile>)
      : {}
    return { prs: {}, logs: {}, pending_logs: {}, ...g }
  }

  private update(fn: (g: GithubFile) => void): void {
    const g = this.read()
    fn(g)
    fs.mkdirSync(this.dir, { recursive: true })
    fs.writeFileSync(path.join(this.dir, 'github.json'), JSON.stringify(g, null, 2))
  }

  private state(g: GithubFile, n: number): PrState {
    const key = String(n)
    g.prs[key] ??= {}
    return g.prs[key]
  }

  /** 코멘트, 실행, 작업의 id. REST의 id처럼 겹치지 않는 수다 */
  private nextId(g: GithubFile): number {
    const id = g.next_id ?? 1001
    g.next_id = id + 1
    return id
  }

  private prBase(n: number): string {
    return this.pr(n).url.replace(/\/pull\/\d+$/, '')
  }

  // ---------- 코멘트 (S7 관찰 3) ----------

  /** PR 대화 코멘트 (REST issues/<n>/comments) */
  convo(n: number, body: string, by: Who = 'owner'): number {
    let id = 0
    this.update((g) => {
      id = this.nextId(g)
      const u = USERS[by]
      const s = this.state(g, n)
      s.convo = [
        ...(s.convo ?? []),
        {
          id,
          user: { login: u.login, type: u.type },
          author_association: u.association,
          body,
          html_url: `${this.prBase(n)}/pull/${n}#issuecomment-${id}`,
          created_at: stamp(),
          updated_at: stamp(),
        },
      ]
    })
    return id
  }

  /** 리뷰 (REST pulls/<n>/reviews). 인라인 코멘트만 단 리뷰와 스레드 답글은 본문이 비어 있다 (S7 관찰 3) */
  review(n: number, r: { body: string; state?: string; commit?: string; by?: Who }): number {
    let id = 0
    this.update((g) => {
      id = this.nextId(g)
      const u = USERS[r.by ?? 'owner']
      const s = this.state(g, n)
      s.reviews = [
        ...(s.reviews ?? []),
        {
          id,
          user: { login: u.login, type: u.type },
          author_association: u.association,
          body: r.body,
          state: r.state ?? 'COMMENTED',
          html_url: `${this.prBase(n)}/pull/${n}#pullrequestreview-${id}`,
          submitted_at: stamp(),
          commit_id: r.commit ?? this.pr(n).head_oid,
        },
      ]
    })
    return id
  }

  /** 인라인 코멘트 (REST pulls/<n>/comments). reply_to면 그 스레드의 답글이다 */
  inline(
    n: number,
    c: { body: string; path: string; line: number; reply_to?: number; review?: number; by?: Who },
  ): number {
    let id = 0
    this.update((g) => {
      id = this.nextId(g)
      const u = USERS[c.by ?? 'owner']
      const s = this.state(g, n)
      s.inline = [
        ...(s.inline ?? []),
        {
          id,
          user: { login: u.login, type: u.type },
          author_association: u.association,
          body: c.body,
          path: c.path,
          line: c.line,
          original_line: c.line,
          ...(c.reply_to ? { in_reply_to_id: c.reply_to } : {}),
          pull_request_review_id: c.review ?? null,
          html_url: `${this.prBase(n)}/pull/${n}#discussion_r${id}`,
          created_at: stamp(),
          updated_at: stamp(),
        },
      ]
    })
    return id
  }

  /** 코멘트를 고친다. id는 그대로이고 본문과 updated_at만 바뀐다 (S7 관찰 3) */
  edit(n: number, kind: 'convo' | 'inline' | 'reviews', id: number, body: string): void {
    this.update((g) => {
      const list = (this.state(g, n)[kind] ?? []) as Record<string, unknown>[]
      const c = list.find((x) => x['id'] === id)
      if (!c) throw new Error(`코멘트 ${kind}:${id}가 없음`)
      c['body'] = body
      c['updated_at'] = stamp(new Date(Date.now() + 1000))
    })
  }

  /** 코멘트를 지운다 */
  remove(n: number, kind: 'convo' | 'inline' | 'reviews', id: number): void {
    this.update((g) => {
      const s = this.state(g, n)
      s[kind] = ((s[kind] ?? []) as Record<string, unknown>[]).filter((x) => x['id'] !== id)
    })
  }

  // ---------- 체크와 로그 (S7 관찰 2) ----------

  /** head의 statusCheckRollup을 정한다 */
  setChecks(n: number, head: string, checks: object[]): void {
    this.update((g) => {
      const s = this.state(g, n)
      s.checks = { ...(s.checks ?? {}), [head]: checks }
    })
  }

  /**
   * Actions 체크 하나 (gh --json의 CheckRun 모양). 링크 …/actions/runs/<실행>/job/<작업>에서 앱이 실행과 작업을 읽는다.
   * 실행은 새로 만들고 event(기본 pull_request)로 돈 것으로 둔다. run을 주면 그 실행의 작업이다(다시 실행, 같은 실행의
   * 다른 작업)
   */
  checkRun(
    n: number,
    c: {
      name?: string
      workflow?: string
      status?: string
      conclusion?: string | null
      log?: string
      pending?: boolean
      event?: string
      run?: number
      startedAt?: string
    },
  ): object {
    let run = 0
    let job = 0
    this.update((g) => {
      run = c.run ?? this.nextId(g)
      job = this.nextId(g)
      g.runs ??= {}
      if (c.event !== undefined || !g.runs[String(run)]) {
        g.runs[String(run)] = { event: c.event ?? 'pull_request' }
      }
      if (c.log !== undefined) g.logs[String(job)] = c.log
      if (c.pending) g.pending_logs[String(job)] = run
    })
    const status = c.status ?? 'COMPLETED'
    return {
      __typename: 'CheckRun',
      name: c.name ?? 'test',
      workflowName: c.workflow ?? 'ci',
      status,
      conclusion: status === 'COMPLETED' ? (c.conclusion ?? 'SUCCESS') : '',
      startedAt: c.startedAt ?? stamp(),
      completedAt: status === 'COMPLETED' ? stamp() : '0001-01-01T00:00:00Z',
      detailsUrl: `${this.prBase(n)}/actions/runs/${run}/job/${job}`,
    }
  }

  /** 실행이 끝나 로그를 줄 수 있다 */
  logReady(job: number, log: string): void {
    this.update((g) => {
      g.pending_logs = Object.fromEntries(
        Object.entries(g.pending_logs).filter(([k]) => k !== String(job)),
      )
      g.logs[String(job)] = log
    })
  }

  /**
   * 시험용 레포의 CI를 흉내 낸다: head에 ci-fail 파일이 있으면 실패하고 실패 로그를 남긴다. 어느 쪽인지 돌려준다
   */
  runCi(n: number, head: string): 'pass' | 'fail' {
    const failing = this.hasFile(head, 'ci-fail')
    this.setChecks(n, head, [
      this.checkRun(
        n,
        failing ? { conclusion: 'FAILURE', log: CI_LOG } : { conclusion: 'SUCCESS' },
      ),
    ])
    return failing ? 'fail' : 'pass'
  }

  private hasFile(commit: string, file: string): boolean {
    try {
      execFileSync('git', ['-C', this.remote, 'cat-file', '-e', `${commit}:${file}`], {
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  }

  // ---------- 상태 ----------

  setMergeable(n: number, mergeable: PrState['mergeable'], mergeState?: string): void {
    this.update((g) => {
      const s = this.state(g, n)
      s.mergeable = mergeable
      if (mergeState) s.merge_state = mergeState
      else delete s.merge_state
    })
  }

  /** 기준 브랜치와 PR 브랜치를 git merge-tree로 병합해 보고 mergeable을 정한다 (GitHub가 계산하는 것의 흉내) */
  syncMergeable(n: number): void {
    const pr = this.pr(n)
    let conflict = false
    try {
      execFileSync(
        'git',
        [
          '-C',
          this.remote,
          'merge-tree',
          '--write-tree',
          `refs/heads/${pr.base}`,
          `refs/heads/${pr.head}`,
        ],
        { stdio: 'ignore' },
      )
    } catch {
      conflict = true
    }
    this.setMergeable(n, conflict ? 'CONFLICTING' : 'MERGEABLE')
  }

  setMethods(methods: GithubFile['methods']): void {
    this.update((g) => {
      if (methods) g.methods = methods
      else delete g.methods
    })
  }

  /** relay 밖에서 PR을 닫는다 */
  close(n: number): void {
    this.updatePr(n, (p) => {
      p.state = 'closed'
    })
  }

  reopen(n: number): void {
    this.updatePr(n, (p) => {
      p.state = 'open'
    })
  }

  /** relay 밖에서 머지한다 (웹이나 gh) */
  mergeOutside(n: number, method = 'squash'): void {
    this.updatePr(n, (p) => {
      p.state = 'merged'
      p.merged_at = stamp()
      p.merged_method = method
    })
  }

  // ---------- 원격 브랜치 (웹 편집과 다른 clone) ----------

  /** 원격 브랜치의 커밋. 없으면 null */
  headOf(branch: string): string | null {
    try {
      return git(this.remote, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)
    } catch {
      return null
    }
  }

  private clone(branch: string): string {
    const dir = path.join(this.scratch, `outside-${++this.clones}`)
    git(this.scratch, 'clone', '-q', '-b', branch, this.remote, dir)
    git(dir, 'config', 'user.email', 'outside@example.com')
    git(dir, 'config', 'user.name', 'outside')
    git(dir, 'config', 'commit.gpgsign', 'false')
    return dir
  }

  /** relay 밖에서 브랜치에 커밋한다 (웹 편집의 흉내). 값이 null인 파일은 지운다. 새 커밋을 돌려준다 */
  commit(branch: string, files: Record<string, string | null>, message: string): string {
    const dir = this.clone(branch)
    for (const [name, text] of Object.entries(files)) {
      if (text === null) git(dir, 'rm', '-q', name)
      else writeFiles(dir, { [name]: text })
    }
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', message)
    git(dir, 'push', '-q', 'origin', branch)
    return git(dir, 'rev-parse', 'HEAD')
  }

  /** 다른 clone에서 기준 브랜치를 PR 브랜치에 병합하고, 충돌은 resolved의 내용으로 풀어 push한다 */
  mergeBase(
    branch: string,
    base: string,
    resolved: Record<string, string>,
    message: string,
  ): string {
    const dir = this.clone(branch)
    try {
      git(dir, 'merge', '-q', '--no-ff', '-m', message, `origin/${base}`)
    } catch {
      writeFiles(dir, resolved)
      git(dir, 'add', '-A')
      git(dir, 'commit', '-q', '--no-edit')
    }
    git(dir, 'push', '-q', 'origin', branch)
    return git(dir, 'rev-parse', 'HEAD')
  }
}

// ---------- 공통 시나리오의 가짜 세계 ----------

/** 가짜 시험 레포 (시험용 레포 relay-v2-test의 모양을 줄인 것): 장바구니 합계와 시험 */
export const CART_FILES: Record<string, string> = {
  'package.json': `${JSON.stringify({ name: 'cart', private: true, type: 'module', scripts: { test: 'node --test' } }, null, 2)}\n`,
  'src/cart.mjs':
    '/**\n * 합계\n * @param {{ price: number, qty: number }[]} items\n */\nexport function total(items) {\n  return items.reduce((sum, item) => sum + item.price * item.qty, 0);\n}\n',
  'test/cart.test.mjs':
    "import { test } from 'node:test';\nimport assert from 'node:assert';\nimport { total } from '../src/cart.mjs';\n\ntest('합계', () => assert.strictEqual(total([{ price: 2, qty: 3 }]), 6));\n",
}

/**
 * 가짜 gh와 로컬 bare 원격의 세계 (PrWorld). CI는 runCi를 부를 때 끝나고, 기준 브랜치나 PR 브랜치가 바뀌면 mergeable을
 * 다시 계산한다
 */
export class FakeWorld implements PrWorld {
  readonly kind = 'fake'
  readonly base = 'main'
  readonly bot = 'github-actions'
  readonly pollMs = 50
  readonly waitMs = 10_000
  readonly ciWaitMs = 10_000

  constructor(readonly gh: FakeGitHub) {}

  file(name: string): string {
    const text = CART_FILES[name]
    if (text === undefined) throw new Error(`시험 레포에 없는 파일: ${name}`)
    return text
  }

  async runCi(pr: number, head: string): Promise<void> {
    this.gh.runCi(pr, head)
  }

  async convo(pr: number, body: string): Promise<void> {
    this.gh.convo(pr, body)
  }

  async review(
    pr: number,
    head: string,
    r: { body: string; path: string; line: number; comment: string },
  ): Promise<void> {
    const id = this.gh.review(pr, { body: r.body, commit: head })
    this.gh.inline(pr, { body: r.comment, path: r.path, line: r.line, review: id })
  }

  async botConvo(pr: number, body: string): Promise<void> {
    this.gh.convo(pr, body, 'bot')
  }

  async commit(
    branch: string,
    files: Record<string, string | null>,
    message: string,
  ): Promise<string> {
    const sha = this.gh.commit(branch, files, message)
    this.syncAll()
    return sha
  }

  async mergeBase(
    branch: string,
    resolved: Record<string, string>,
    message: string,
  ): Promise<string> {
    const sha = this.gh.mergeBase(branch, this.base, resolved, message)
    this.syncAll()
    return sha
  }

  async close(pr: number): Promise<void> {
    this.gh.close(pr)
  }

  async reopen(pr: number): Promise<void> {
    this.gh.reopen(pr)
  }

  async merge(pr: number): Promise<void> {
    this.gh.mergeOutside(pr)
  }

  async branchTip(branch: string): Promise<string | null> {
    return this.gh.headOf(branch)
  }

  /** 열린 PR의 mergeable을 다시 계산한다 */
  private syncAll(): void {
    for (const p of this.gh.prs()) if (p.state === 'open') this.gh.syncMergeable(p.number)
  }
}
