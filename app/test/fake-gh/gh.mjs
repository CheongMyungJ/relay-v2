#!/usr/bin/env node
// 가짜 gh (docs/implementation.md 8.2). 가짜 claude처럼 두고, 받은 인자를 파일에 남긴다.
// - `gh --version`: FAKE_GH_VERSION(기본 2.101.0)을 `gh version <버전> (<날짜>)` 꼴로 찍는다 (D198).
// - `gh auth status`: 등록 점검(D67)과 다시 점검(D118). FAKE_GH_AUTH가 fail이면 종료 코드 1이다.
// - `gh pr list --repo R --head H --state open --json … --limit 1`: 열린 PR을 JSON 배열로 찍는다(7-4).
//   이 가짜가 만든 PR은 FAKE_GH_RECORD/prs.json에 남아 같은 --repo와 --head면 찾는다.
//   FAKE_GH_OPEN_PR=<주소>면 어떤 head든 그 주소의 열린 PR이 있는 것으로 답한다.
// - `gh pr create --repo R --base B --head H --title T --body-file F [--draft]`: PR을 만들고 주소를 찍는다.
//   --repo가 로컬 레포 경로면 head 브랜치가 그 레포에 있어야 만든다(실제 gh는 API가 거부한다).
//   주소는 GitHub 모양이다: --repo가 GitHub 레포면 그 레포의 주소, 로컬 경로면 https://github.test/local/<레포 이름>/pull/<n>.
//   PR의 브랜치는 PR을 만든 레포(로컬 경로면 그것, 아니면 cwd의 origin push 주소)에서 읽는다.
// - PR 진행(M9, S7): `pr view <n> --repo R --json …`, `api --hostname H --paginate --slurp <목록>`(리뷰, 인라인 코멘트,
//   대화 코멘트), `run view --job <작업> --repo R --log-failed`, `pr merge <n> --repo R --<방식> --match-head-commit <head>`,
//   `repo view R --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`.
//   PR의 상태(열림, 닫힘, 머지됨)는 prs.json에, 체크와 코멘트, mergeable, 실패 로그, 허용 머지 방식은 같은 폴더의
//   github.json에 둔다. 시험이 test/flow/github.ts로 바꾼다. head 커밋은 PR 브랜치에서 매번 읽는다.
//   S7에서 본 모양: 체크가 없는 head는 빈 statusCheckRollup, 머지 성공은 TTY가 아니라 출력이 없음, head가 다르면
//   "Head branch was modified", 실행이 끝나기 전의 로그 요청은 "still in progress", baseRefOid는 PR 브랜치에 push해야 바뀜.
// - FAKE_GH_FAIL=list|create|view|api|log|merge(쉼표로 여럿)면 그 명령이 종료 코드 1로 실패한다.
// - FAKE_GH_RECORD 폴더가 있으면 명령마다 인자, cwd, --body-file의 내용을 fake-gh.jsonl에 한 줄씩 남긴다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const argv = process.argv.slice(2)
const env = process.env
const [cmd, sub] = argv

/** --name 값. 없으면 undefined */
function opt(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const failing = (name) => (env.FAKE_GH_FAIL ?? '').split(',').includes(name)

const recordDir = env.FAKE_GH_RECORD
function record(entry) {
  if (!recordDir) return
  fs.mkdirSync(recordDir, { recursive: true })
  fs.appendFileSync(
    path.join(recordDir, 'fake-gh.jsonl'),
    `${JSON.stringify({ args: argv, cwd: process.cwd(), ...entry })}\n`,
  )
}

function prsFile() {
  return recordDir ? path.join(recordDir, 'prs.json') : null
}

function loadPrs() {
  const file = prsFile()
  return file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
}

function savePrs(prs) {
  const file = prsFile()
  if (file) fs.writeFileSync(file, JSON.stringify(prs, null, 2))
}

/** github.json: PR마다 체크, 코멘트, mergeable 따위. 시험이 쓴다 */
function loadGithub() {
  const file = recordDir ? path.join(recordDir, 'github.json') : null
  const g = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  return { prs: {}, logs: {}, pending_logs: {}, ...g }
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim()
}

/** --repo가 GitHub 주소면 그 레포의 PR 주소, 로컬 경로면 github.test/local/<레포 이름>의 주소 */
function prUrl(repo, number) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repo ?? '')
  if (m) return `https://github.com/${m[1]}/${m[2]}/pull/${number}`
  const name = path.basename(repo ?? 'fake').replace(/\.git$/, '')
  return `https://github.test/local/${name}/pull/${number}`
}

/** PR 브랜치가 있는 레포(로컬 bare 원격) */
function remoteOf(repo) {
  if (repo && fs.existsSync(repo)) return repo
  try {
    const push = git(process.cwd(), 'remote', 'get-url', '--push', 'origin')
    return fs.existsSync(push) ? push : null
  } catch {
    return null
  }
}

/** --repo HOST/OWNER/REPO와 번호의 PR (PR 주소로 찾는다, I50) */
function findPr(prs, repo, number) {
  const want = `https://${repo}/pull/${number}`
  return prs.find((p) => p.url === want)
}

function branchOid(remote, branch) {
  if (!remote) return null
  try {
    return git(remote, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`)
  } catch {
    return null
  }
}

/** 지금 head 커밋. 브랜치를 지웠으면 마지막으로 본 것이다. baseRefOid는 head가 바뀔 때만 따라온다(S7 관찰 7) */
function refresh(pr) {
  const head = branchOid(pr.remote, pr.head)
  if (head && head !== pr.head_oid) {
    pr.head_oid = head
    pr.base_oid = branchOid(pr.remote, pr.base) ?? pr.base_oid
  }
  return pr
}

const STATE = { open: 'OPEN', closed: 'CLOSED', merged: 'MERGED' }

function prFields(pr, g) {
  const s = g.prs[String(pr.number)] ?? {}
  const mergeable = s.mergeable ?? 'MERGEABLE'
  const checks = (s.checks ?? {})[pr.head_oid] ?? []
  return {
    number: pr.number,
    url: pr.url,
    title: pr.title,
    state: STATE[pr.state] ?? 'OPEN',
    isDraft: pr.isDraft === true,
    headRefName: pr.head,
    headRefOid: pr.head_oid ?? '',
    baseRefName: pr.base,
    baseRefOid: pr.base_oid ?? '',
    mergeable,
    mergeStateStatus:
      s.merge_state ??
      (mergeable === 'CONFLICTING' ? 'DIRTY' : mergeable === 'UNKNOWN' ? 'UNKNOWN' : 'CLEAN'),
    reviewDecision: s.review_decision ?? '',
    statusCheckRollup: checks,
    mergedAt: pr.merged_at ?? null,
    mergeCommit: pr.merge_commit ? { oid: pr.merge_commit } : null,
  }
}

if (cmd === '--version') {
  record({ type: 'version' })
  const v = env.FAKE_GH_VERSION ?? '2.101.0'
  process.stdout.write(
    `gh version ${v} (2026-09-01)\nhttps://github.com/cli/cli/releases/tag/v${v}\n`,
  )
  process.exit(0)
}

if (cmd === 'auth' && sub === 'status') {
  const ok = env.FAKE_GH_AUTH !== 'fail'
  record({ type: 'auth' })
  process.stdout.write(
    ok ? 'Logged in to github.com (fake)\n' : 'You are not logged into any GitHub hosts.\n',
  )
  process.exit(ok ? 0 : 1)
}

if (cmd === 'pr' && sub === 'list') {
  record({ type: 'pr list' })
  if (failing('list')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const repo = opt('--repo')
  const head = opt('--head')
  const open = env.FAKE_GH_OPEN_PR
    ? [{ url: env.FAKE_GH_OPEN_PR, number: 7, isDraft: false, baseRefName: 'main', head }]
    : loadPrs().filter((p) => p.repo === repo && p.head === head && p.state === 'open')
  const fields = (opt('--json') ?? 'url').split(',')
  const rows = open.map((p) => Object.fromEntries(fields.map((f) => [f, p[f]])))
  process.stdout.write(`${JSON.stringify(rows)}\n`)
  process.exit(0)
}

if (cmd === 'pr' && sub === 'create') {
  const bodyFile = opt('--body-file')
  const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : undefined
  record({ type: 'pr create', body })
  if (failing('create')) fail('pull request create failed: HTTP 422 (가짜 gh)')
  const repo = opt('--repo')
  const head = opt('--head')
  const base = opt('--base')
  const title = opt('--title')
  if (!repo || !head || !base || !title || body === undefined) {
    fail('must provide `--title` and `--body` (가짜 gh)')
  }
  // 로컬 레포면 head 브랜치가 push되어 있어야 한다
  if (fs.existsSync(repo)) {
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${head}`], {
        cwd: repo,
        stdio: 'ignore',
      })
    } catch {
      fail(
        `pull request create failed: GraphQL: Head sha can't be blank, No commits between ${base} and ${head}, Head ref must be a branch (createPullRequest)`,
      )
    }
  }
  const prs = loadPrs()
  const number = prs.length + 1
  const remote = remoteOf(repo)
  const pr = {
    number,
    url: prUrl(repo, number),
    repo,
    remote,
    head,
    base,
    title,
    body,
    isDraft: argv.includes('--draft'),
    baseRefName: base,
    state: 'open',
    head_oid: branchOid(remote, head),
    base_oid: branchOid(remote, base),
  }
  savePrs([...prs, pr])
  process.stdout.write(`${pr.url}\n`)
  process.exit(0)
}

if (cmd === 'pr' && sub === 'view') {
  record({ type: 'pr view' })
  if (failing('view')) fail('GraphQL: API rate limit exceeded (가짜 gh)')
  const number = Number(argv[2])
  const repo = opt('--repo')
  const prs = loadPrs()
  const pr = findPr(prs, repo, number)
  if (!pr) {
    fail(
      `GraphQL: Could not resolve to a PullRequest with the number of ${number}. (repository.pullRequest)`,
    )
  }
  refresh(pr)
  savePrs(prs)
  const all = prFields(pr, loadGithub())
  const fields = (opt('--json') ?? 'url').split(',')
  process.stdout.write(`${JSON.stringify(Object.fromEntries(fields.map((f) => [f, all[f]])))}\n`)
  process.exit(0)
}

if (cmd === 'api') {
  record({ type: 'api' })
  if (failing('api')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const host = opt('--hostname') ?? 'github.com'
  const target = argv[argv.length - 1] ?? ''
  const m = /^repos\/([^/]+)\/([^/]+)\/(pulls|issues)\/(\d+)\/(reviews|comments)(?:\?(.*))?$/.exec(
    target,
  )
  if (!m || !argv.includes('--paginate') || !argv.includes('--slurp')) {
    fail(`가짜 gh: 모르는 api 요청 ${argv.join(' ')}`)
  }
  const [, owner, name, kind, num, list, query] = m
  const pr = findPr(loadPrs(), `${host}/${owner}/${name}`, Number(num))
  if (!pr) fail(`gh: Not Found (HTTP 404)`)
  const s = loadGithub().prs[String(pr.number)] ?? {}
  const items =
    kind === 'issues' ? (s.convo ?? []) : list === 'reviews' ? (s.reviews ?? []) : (s.inline ?? [])
  // --slurp는 쪽마다의 배열을 한 배열로 싼다 (3절)
  const per = Number(new URLSearchParams(query ?? '').get('per_page') ?? 30)
  const pages = []
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per))
  if (!pages.length) pages.push([])
  process.stdout.write(`${JSON.stringify(pages)}\n`)
  process.exit(0)
}

if (cmd === 'run' && sub === 'view') {
  record({ type: 'run view' })
  if (failing('log')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const job = opt('--job')
  if (!argv.includes('--log-failed') || !job) fail(`가짜 gh: 모르는 run view ${argv.join(' ')}`)
  const g = loadGithub()
  const pending = g.pending_logs[job]
  if (pending !== undefined) {
    fail(`run ${pending} is still in progress; logs will be available when it is complete`)
  }
  const log = g.logs[job]
  if (log === undefined) fail(`failed to get run log: HTTP 404: Not Found (가짜 gh)`)
  process.stdout.write(log)
  process.exit(0)
}

if (cmd === 'repo' && sub === 'view') {
  record({ type: 'repo view' })
  const methods = loadGithub().methods ?? {}
  const all = {
    mergeCommitAllowed: methods.merge ?? true,
    squashMergeAllowed: methods.squash ?? true,
    rebaseMergeAllowed: methods.rebase ?? true,
  }
  const fields = (opt('--json') ?? '').split(',')
  process.stdout.write(`${JSON.stringify(Object.fromEntries(fields.map((f) => [f, all[f]])))}\n`)
  process.exit(0)
}

if (cmd === 'pr' && sub === 'merge') {
  record({ type: 'pr merge' })
  const number = Number(argv[2])
  const repo = opt('--repo')
  const expected = opt('--match-head-commit')
  const method = ['merge', 'squash', 'rebase'].find((x) => argv.includes(`--${x}`))
  const prs = loadPrs()
  const pr = findPr(prs, repo, number)
  if (!pr) {
    fail(
      `GraphQL: Could not resolve to a PullRequest with the number of ${number}. (repository.pullRequest)`,
    )
  }
  refresh(pr)
  // 이미 머지된 PR은 gh가 아무것도 하지 않고 성공한다 (cli/cli pkg/cmd/pr/merge)
  if (pr.state === 'merged') process.exit(0)
  if (pr.state === 'closed') fail(`가짜 gh: 닫힌 PR #${number}은 머지하지 않음`)
  const g = loadGithub()
  // gh는 mergeStateStatus가 BLOCKED면 GitHub에 묻기 전에 멈춘다 (cli/cli pkg/cmd/pr/merge blockedReason)
  if ((g.prs[String(number)] ?? {}).merge_state === 'BLOCKED') {
    fail(
      `X Pull request ${repo.split('/').slice(-2).join('/')}#${number} is not mergeable: the base branch policy prohibits the merge.`,
    )
  }
  if (failing('merge')) fail('GraphQL: 머지할 수 없음 (가짜 gh)')
  if (!method) fail('가짜 gh: 머지 방식이 없음')
  const allowed = (g.methods ?? {})[method] ?? true
  if (!allowed) fail(`GraphQL: ${method} 머지를 허용하지 않는 레포 (가짜 gh)`)
  if (expected && expected !== pr.head_oid) {
    fail('GraphQL: Head branch was modified. Review and try the merge again. (mergePullRequest)')
  }
  pr.state = 'merged'
  pr.merged_at = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  pr.merged_method = method
  pr.merge_commit = pr.head_oid
  savePrs(prs)
  // TTY가 아니면 성공해도 아무것도 찍지 않는다 (S7 관찰 6)
  process.exit(0)
}

process.stderr.write(`가짜 gh: 모르는 명령 ${argv.join(' ')}\n`)
process.exit(2)
