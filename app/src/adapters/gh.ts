// gh CLI (I12). 등록 점검(D67, D198)과 전달의 PR(시나리오 7-4), PR 진행의 읽기와 머지(시나리오 10)를 한다.
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { ghVersionOf } from '../core/pr'
import { describeFailure, run } from './exec'

export class GhError extends Error {}

export interface GhStatus {
  ok: boolean
  detail: string
}

/** gh auth status가 성공하는가 (D67). gh가 없으면 실패다 */
export async function ghAuthStatus(bin = 'gh', env?: NodeJS.ProcessEnv): Promise<GhStatus> {
  const r = await run(bin, ['auth', 'status'], { env, timeoutMs: 30_000 })
  if (r.code === 0) return { ok: true, detail: '로그인됨' }
  if (r.code === null && r.error?.includes('ENOENT')) {
    return { ok: false, detail: 'gh가 설치되어 있지 않음' }
  }
  return { ok: false, detail: describeFailure(r) }
}

/** 앱에는 터미널이 없으므로 묻지 않게 하고 업데이트 안내를 끈다 (gh help environment) */
function ghEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  return { ...(env ?? process.env), GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' }
}

export interface GhRepoOptions {
  /**
   * PR을 둘 레포: origin의 [HOST/]OWNER/REPO(core/delivery ghRepo). gh는 원격이 여럿이고 기본 레포를 정하지
   * 않았으면 upstream, github, origin 차례로 고르므로(gh 소스 context/remote.go) --repo로 준다
   */
  repo: string
  /** gh를 실행할 폴더: 메인 체크아웃 */
  cwd: string
  env?: NodeJS.ProcessEnv
}

export interface OpenPullRequest {
  url: string
  number: number
  isDraft: boolean
  baseRefName: string
}

/** head 브랜치의 열린 PR (gh pr list --head --state open --json). 없으면 null (7-4) */
export async function ghOpenPr(
  bin: string,
  o: GhRepoOptions & { head: string },
): Promise<OpenPullRequest | null> {
  const r = await run(
    bin,
    [
      'pr',
      'list',
      '--repo',
      o.repo,
      '--head',
      o.head,
      '--state',
      'open',
      '--json',
      'url,number,isDraft,baseRefName',
      '--limit',
      '1',
    ],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh pr list 실패: ${describeFailure(r)}`)
  let list: unknown
  try {
    list = JSON.parse(r.stdout || '[]')
  } catch {
    throw new GhError(`gh pr list의 출력을 읽지 못함: ${r.stdout.slice(0, 200)}`)
  }
  const first: unknown = Array.isArray(list) ? list[0] : undefined
  if (!first || typeof first !== 'object') return null
  const pr = first as Record<string, unknown>
  if (typeof pr['url'] !== 'string') return null
  return {
    url: pr['url'],
    number: typeof pr['number'] === 'number' ? pr['number'] : 0,
    isDraft: pr['isDraft'] === true,
    baseRefName: typeof pr['baseRefName'] === 'string' ? pr['baseRefName'] : '',
  }
}

export interface CreatePrOptions extends GhRepoOptions {
  base: string
  head: string
  title: string
  body: string
  /** draft PR (D71) */
  draft: boolean
}

/**
 * PR을 만든다 (gh pr create). --head를 주면 gh는 브랜치를 push하지 않는다(앱이 먼저 push한다). 본문은
 * 명령줄 길이와 인용을 피하려고 임시 파일(--body-file)로 준다. 성공하면 gh가 표준 출력에 찍는 PR 주소를
 * 돌려준다 (gh 소스 pkg/cmd/pr/create).
 */
export async function ghCreatePr(bin: string, o: CreatePrOptions): Promise<string> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-pr-'))
  const bodyFile = path.join(dir, 'body.md')
  try {
    await fsp.writeFile(bodyFile, o.body, 'utf8')
    const r = await run(
      bin,
      [
        'pr',
        'create',
        '--repo',
        o.repo,
        '--base',
        o.base,
        '--head',
        o.head,
        '--title',
        o.title,
        '--body-file',
        bodyFile,
        ...(o.draft ? ['--draft'] : []),
      ],
      { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 120_000 },
    )
    if (r.code !== 0) throw new GhError(`gh pr create 실패: ${describeFailure(r)}`)
    const url = r.stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//.test(l))
      .pop()
    if (!url) throw new GhError(`gh pr create가 PR 주소를 찍지 않음: ${r.stdout.slice(0, 200)}`)
    return url
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

// ---------- PR 진행 (시나리오 10). 명령은 S7에서 확인한 것이다 (docs/spikes.md S7, PR #14) ----------

/**
 * gh --version의 버전 (D198). 등록 점검, 다시 점검(D118)과 PR 진행을 시작할 때 부른다. gh가 없거나 읽지 못하면 null
 */
export async function ghVersion(bin = 'gh', env?: NodeJS.ProcessEnv): Promise<string | null> {
  const r = await run(bin, ['--version'], { env: ghEnv(env), timeoutMs: 30_000 })
  return r.code === 0 ? ghVersionOf(r.stdout) : null
}

/** PR 하나 (core/pr prLocation, I50) */
export interface GhPrOptions {
  /** gh --repo에 줄 HOST/OWNER/REPO */
  repo: string
  number: number
  /** gh를 실행할 폴더: 메인 체크아웃 */
  cwd: string
  env?: NodeJS.ProcessEnv
}

/** 한 번 읽기에서 PR 상태와 체크를 읽는 필드 (PR #14, S7 관찰 2). 모두 gh 2.48.0에 있다 (3절) */
const PR_VIEW_FIELDS = [
  'number',
  'url',
  'state',
  'isDraft',
  'headRefName',
  'headRefOid',
  'baseRefName',
  'mergeable',
  'mergeStateStatus',
  'reviewDecision',
  'statusCheckRollup',
  'mergedAt',
  'mergeCommit',
] as const

function parseJson(what: string, out: string): unknown {
  try {
    return JSON.parse(out)
  } catch {
    throw new GhError(`${what}의 출력을 읽지 못함: ${out.slice(0, 200)}`)
  }
}

/** PR의 상태, head, 머지 가능 여부, 리뷰 상태, 체크 (gh pr view --json, GraphQL 한 번, S7 관찰 2, 9) */
export async function ghPrView(
  bin: string,
  o: GhPrOptions,
  fields: readonly string[] = PR_VIEW_FIELDS,
): Promise<Record<string, unknown>> {
  const r = await run(
    bin,
    ['pr', 'view', String(o.number), '--repo', o.repo, '--json', fields.join(',')],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh pr view 실패: ${describeFailure(r)}`)
  const v = parseJson('gh pr view', r.stdout)
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new GhError(`gh pr view의 출력이 객체가 아님: ${r.stdout.slice(0, 200)}`)
  }
  return v as Record<string, unknown>
}

/**
 * REST 목록 하나를 모든 쪽까지 읽는다: gh api --hostname <host> --paginate --slurp <경로> (S7 관찰 3, 9).
 * --slurp는 쪽마다의 JSON 배열을 한 배열로 싸므로(3절) 한 번 편다. 호스트는 --hostname으로만 준다(I50)
 */
export async function ghApiList(
  bin: string,
  o: { host: string; path: string; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<unknown[]> {
  const r = await run(bin, ['api', '--hostname', o.host, '--paginate', '--slurp', o.path], {
    cwd: o.cwd,
    env: ghEnv(o.env),
    timeoutMs: 60_000,
  })
  if (r.code !== 0) throw new GhError(`gh api ${o.path} 실패: ${describeFailure(r)}`)
  const pages = parseJson(`gh api ${o.path}`, r.stdout)
  if (!Array.isArray(pages)) throw new GhError(`gh api ${o.path}의 출력이 배열이 아님`)
  return pages.flatMap((p: unknown) => (Array.isArray(p) ? (p as unknown[]) : [p]))
}

/**
 * REST 객체 하나를 읽는다: gh api --hostname <host> <경로>. Actions 실행의 이벤트를 읽을 때 쓴다(D201, REST "Get a workflow
 * run", 3절). 호스트는 --hostname으로만 준다(I50)
 */
export async function ghApi(
  bin: string,
  o: { host: string; path: string; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<Record<string, unknown>> {
  const r = await run(bin, ['api', '--hostname', o.host, o.path], {
    cwd: o.cwd,
    env: ghEnv(o.env),
    timeoutMs: 60_000,
  })
  if (r.code !== 0) throw new GhError(`gh api ${o.path} 실패: ${describeFailure(r)}`)
  const v = parseJson(`gh api ${o.path}`, r.stdout)
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new GhError(`gh api ${o.path}의 출력이 객체가 아님: ${r.stdout.slice(0, 200)}`)
  }
  return v as Record<string, unknown>
}

export type FailedLog = { ok: true; text: string } | { ok: false; pending: boolean; error: string }

/**
 * 실패한 스텝의 로그: gh run view --job <작업> --repo <레포> --log-failed (S7 관찰 2). 실행(run) 전체가 끝나야 로그를
 * 준다(3절). 끝나지 않았으면 pending이다. 줄의 모양은 `<작업>\t<스텝>\t<시각> <줄>`이고 core/pr failedLogTail이 다듬는다
 */
export async function ghFailedLog(
  bin: string,
  o: { repo: string; job: number; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<FailedLog> {
  const r = await run(
    bin,
    ['run', 'view', '--job', String(o.job), '--repo', o.repo, '--log-failed'],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 120_000 },
  )
  if (r.code === 0) return { ok: true, text: r.stdout }
  const detail = describeFailure(r)
  return { ok: false, pending: /still in progress/.test(`${r.stderr}\n${r.stdout}`), error: detail }
}

/** 레포가 허용하는 머지 방식 (D177): gh repo view --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed (S7 관찰 6) */
export async function ghMergeSettings(
  bin: string,
  o: { repo: string; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<unknown> {
  const r = await run(
    bin,
    ['repo', 'view', o.repo, '--json', 'mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed'],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh repo view 실패: ${describeFailure(r)}`)
  return parseJson('gh repo view', r.stdout)
}

export type MergeResult = { ok: true } | { ok: false; error: string; headMoved: boolean }

/**
 * 머지 (D176, D177): gh pr merge <n> --repo <레포> --<방식> --match-head-commit <head> (S7 관찰 6). head가 지금 PR의
 * head가 아니면 GitHub가 "Head branch was modified"로 거절한다. --delete-branch는 쓰지 않는다(--repo 없이 쓰면 다른
 * worktree를 지움, S7). TTY가 아니면 성공해도 출력이 없으므로 종료 코드로 보고, 머지됐는지는 부른 쪽이 다시 읽어 본다
 */
export async function ghMerge(
  bin: string,
  o: GhPrOptions & { method: 'merge' | 'squash' | 'rebase'; head: string },
): Promise<MergeResult> {
  const r = await run(
    bin,
    [
      'pr',
      'merge',
      String(o.number),
      '--repo',
      o.repo,
      `--${o.method}`,
      '--match-head-commit',
      o.head,
    ],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 120_000 },
  )
  if (r.code === 0) return { ok: true }
  const error = describeFailure(r)
  return {
    ok: false,
    error,
    headMoved: /Head branch was modified/.test(`${r.stderr}\n${r.stdout}`),
  }
}

// ---------- PR 대응 (시나리오 10-6, 10-7). 명령은 docs/implementation.md M10의 "gh와 git으로 하는 일"이다 ----------

/** gh api가 HTTP 오류로 끝났을 때 stderr의 "gh: <메시지> (HTTP <코드>)"에서 읽은 코드 (3절). 없으면 null */
export function httpStatusOf(stderr: string): number | null {
  const m = /\(HTTP (\d{3})\)/.exec(stderr)
  return m ? Number(m[1]) : null
}

export class GhApiError extends GhError {
  constructor(
    message: string,
    /** HTTP 응답 코드. 응답이 없었거나(연결 끊김, 시간 초과) 읽지 못했으면 null이다: GitHub가 받았는지 모른다 (D194) */
    readonly status: number | null,
  ) {
    super(message)
  }
}

/**
 * REST 요청 하나를 보낸다: gh api --hostname <host> -X POST <경로> --input - (3절). 본문은 JSON으로 표준 입력에 준다: 명령줄
 * 길이와 인용을 피하고 답글 본문이 로그나 프로세스 목록에 남지 않는다. 응답 객체를 돌려준다. 실패하면 GhApiError이고,
 * 응답 코드가 없으면 게시됐는지 모르는 요청이다 (D194)
 */
export async function ghApiPost(
  bin: string,
  o: { host: string; path: string; body: unknown; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<Record<string, unknown>> {
  const r = await run(bin, ['api', '--hostname', o.host, '-X', 'POST', o.path, '--input', '-'], {
    cwd: o.cwd,
    env: ghEnv(o.env),
    timeoutMs: 60_000,
    input: JSON.stringify(o.body),
  })
  if (r.code !== 0) {
    throw new GhApiError(
      `gh api -X POST ${o.path} 실패: ${describeFailure(r)}`,
      httpStatusOf(r.stderr),
    )
  }
  const v = parseJson(`gh api -X POST ${o.path}`, r.stdout)
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    throw new GhApiError(
      `gh api -X POST ${o.path}의 출력이 객체가 아님: ${r.stdout.slice(0, 200)}`,
      null,
    )
  }
  return v as Record<string, unknown>
}

export type RerunResult = { ok: true } | { ok: false; error: string }

/**
 * Actions 실행의 실패한 작업을 다시 돌린다 (D175, D203): gh run rerun <실행> --repo <레포> --failed (3절, S7 관찰 5). gh는
 * 실행을 읽은 뒤 rerun-failed-jobs를 보낸다. 성공 문구는 TTY일 때만 쓰므로 종료 코드로 본다
 */
export async function ghRerunFailed(
  bin: string,
  o: { repo: string; run: number; cwd: string; env?: NodeJS.ProcessEnv },
): Promise<RerunResult> {
  const r = await run(bin, ['run', 'rerun', String(o.run), '--repo', o.repo, '--failed'], {
    cwd: o.cwd,
    env: ghEnv(o.env),
    timeoutMs: 60_000,
  })
  return r.code === 0 ? { ok: true } : { ok: false, error: describeFailure(r) }
}

// ---------- 이슈 기록 (설계 3.7, I99). 레포는 PR 만들기와 같은 origin의 --repo다 ----------

/** 본문을 임시 파일로 넘긴다(--body-file): 명령줄 길이와 인용을 피한다 */
async function withBodyFile<T>(body: string, fn: (file: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'relay-issue-'))
  const file = path.join(dir, 'body.md')
  try {
    await fsp.writeFile(file, body, 'utf8')
    return await fn(file)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

/** 찍힌 출력에서 마지막 주소 줄 */
function lastUrl(stdout: string): string | null {
  return (
    stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//.test(l))
      .pop() ?? null
  )
}

/**
 * 라벨을 만든다 (D348): gh label create <이름> --repo --color --description. 이미 있거나 권한이 없으면 실패하고, 부른 쪽은
 * 실패를 넘긴다(D349). 만들었으면 true
 */
export async function ghLabelCreate(
  bin: string,
  o: GhRepoOptions & { name: string; color: string; description: string },
): Promise<boolean> {
  const r = await run(
    bin,
    [
      'label',
      'create',
      o.name,
      '--repo',
      o.repo,
      '--color',
      o.color,
      '--description',
      o.description,
    ],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  return r.code === 0
}

/**
 * 이슈를 만든다 (D336): gh issue create --repo --title --body-file [--label]. 성공하면 gh가 찍는 이슈 주소를 돌려준다
 * (gh 소스 pkg/cmd/issue/create)
 */
export async function ghIssueCreate(
  bin: string,
  o: GhRepoOptions & { title: string; body: string; label: string | null },
): Promise<string> {
  return withBodyFile(o.body, async (file) => {
    const r = await run(
      bin,
      [
        'issue',
        'create',
        '--repo',
        o.repo,
        '--title',
        o.title,
        '--body-file',
        file,
        ...(o.label ? ['--label', o.label] : []),
      ],
      { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 120_000 },
    )
    if (r.code !== 0) throw new GhError(`gh issue create 실패: ${describeFailure(r)}`)
    const url = lastUrl(r.stdout)
    if (!url)
      throw new GhError(`gh issue create가 이슈 주소를 찍지 않음: ${r.stdout.slice(0, 200)}`)
    return url
  })
}

/**
 * 이슈에 코멘트를 단다 (D339, D341, D347): gh issue comment <n> --repo --body-file. 성공하면 gh가 찍는 코멘트 주소
 * (…#issuecomment-<id>)를 돌려준다 (gh 소스 pkg/cmd/issue/comment)
 */
export async function ghIssueComment(
  bin: string,
  o: GhRepoOptions & { number: number; body: string },
): Promise<string> {
  return withBodyFile(o.body, async (file) => {
    const r = await run(
      bin,
      ['issue', 'comment', String(o.number), '--repo', o.repo, '--body-file', file],
      { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 120_000 },
    )
    if (r.code !== 0) throw new GhError(`gh issue comment 실패: ${describeFailure(r)}`)
    const url = lastUrl(r.stdout)
    if (!url)
      throw new GhError(`gh issue comment가 코멘트 주소를 찍지 않음: ${r.stdout.slice(0, 200)}`)
    return url
  })
}

/**
 * 이슈를 닫는다 (D346): gh issue close <n> --repo --reason "completed"|"not planned". 이미 닫혔으면 gh는 알리기만 하고
 * 성공한다 (gh 소스 pkg/cmd/issue/close, I100)
 */
export async function ghIssueClose(
  bin: string,
  o: GhRepoOptions & { number: number; reason: 'completed' | 'not_planned' },
): Promise<void> {
  const r = await run(
    bin,
    [
      'issue',
      'close',
      String(o.number),
      '--repo',
      o.repo,
      '--reason',
      o.reason === 'completed' ? 'completed' : 'not planned',
    ],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh issue close 실패: ${describeFailure(r)}`)
}

/** 원격의 이슈나 코멘트 하나: 주소와 본문 */
export interface GhIssueText {
  url: string
  body: string
}

/**
 * 최근 이슈의 주소와 본문 (D349): gh issue list --repo --state all --json url,body --limit <n>. 게시 결과를 모르는 이슈
 * 만들기를 표시로 찾는다
 */
export async function ghIssueList(
  bin: string,
  o: GhRepoOptions & { limit?: number },
): Promise<GhIssueText[]> {
  const r = await run(
    bin,
    [
      'issue',
      'list',
      '--repo',
      o.repo,
      '--state',
      'all',
      '--json',
      'url,body',
      '--limit',
      String(o.limit ?? 100),
    ],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh issue list 실패: ${describeFailure(r)}`)
  return texts(parseJson('gh issue list', r.stdout || '[]'))
}

/**
 * 이슈의 코멘트 (D349): gh issue view <n> --repo --json comments(gh가 모든 쪽을 읽는다). 게시 결과를 모르는 코멘트를 표시로 찾는다
 */
export async function ghIssueComments(
  bin: string,
  o: GhRepoOptions & { number: number },
): Promise<GhIssueText[]> {
  const r = await run(
    bin,
    ['issue', 'view', String(o.number), '--repo', o.repo, '--json', 'comments'],
    { cwd: o.cwd, env: ghEnv(o.env), timeoutMs: 60_000 },
  )
  if (r.code !== 0) throw new GhError(`gh issue view 실패: ${describeFailure(r)}`)
  const v = parseJson('gh issue view', r.stdout)
  const comments = v && typeof v === 'object' ? (v as Record<string, unknown>)['comments'] : null
  return texts(comments)
}

function texts(list: unknown): GhIssueText[] {
  if (!Array.isArray(list)) return []
  return list.flatMap((x: unknown) => {
    if (!x || typeof x !== 'object') return []
    const r = x as Record<string, unknown>
    return typeof r['url'] === 'string' && typeof r['body'] === 'string'
      ? [{ url: r['url'], body: r['body'] }]
      : []
  })
}
