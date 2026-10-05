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
//   대화 코멘트), `api --hostname H repos/O/R/actions/runs/<실행>[?…]`(실행의 event, D201),
//   `run view --job <작업> --repo R --log-failed`, `pr merge <n> --repo R --<방식> --match-head-commit <head>`,
//   `repo view R --json mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed`.
//   PR의 상태(열림, 닫힘, 머지됨)는 prs.json에, 체크와 코멘트, mergeable, 실패 로그, 허용 머지 방식은 같은 폴더의
//   github.json에 둔다. 시험이 test/flow/github.ts로 바꾼다. head 커밋은 PR 브랜치에서 매번 읽는다.
//   S7에서 본 모양: 체크가 없는 head는 빈 statusCheckRollup, 머지 성공은 TTY가 아니라 출력이 없음, head가 다르면
//   "Head branch was modified", 실행이 끝나기 전의 로그 요청은 "still in progress", baseRefOid는 PR 브랜치에 push해야 바뀜.
// - PR 대응(M10): `api --hostname H -X POST repos/O/R/pulls/<n>/comments/<id>/replies --input -`(스레드 첫 코멘트에 답글.
//   본문은 표준 입력의 JSON. 답글을 달면 본문이 빈 리뷰가 하나 생긴다, S7 관찰 3), `api --hostname H -X POST
//   repos/O/R/issues/<n>/comments --input -`(대화 코멘트), `run rerun <실행> --repo R --failed`(다시 실행한 실행을
//   github.json의 reruns에 남긴다). 게시한 코멘트는 앱의 사람(relay-owner, OWNER)이 단 것이다. 없는 코멘트에 답하면
//   HTTP 404다. github.json의 post_faults는 POST마다 앞에서 하나씩 꺼내 쓴다: error는 게시하지 않고 HTTP 502로, posted는
//   게시한 뒤 HTTP 502로 끝난다(게시하고도 오류를 돌려준 요청, D194). 그 밖(ok)은 그대로 게시한다.
// - FAKE_GH_FAIL=list|create|view|api|event|log|merge|post|rerun(쉼표로 여럿)면 그 명령이 종료 코드 1로 실패한다. api는
//   REST 요청 모두, event는 실행 읽기만, post는 POST만이다. merge는 새 커밋이 생긴 직후 GitHub가 준 "Pull Request is not
//   mergeable"이다(M9 [실제]). rerun은 gh가 403에 쓰는 "run <id> cannot be rerun; …"이다(3절).
// - 이슈 기록(M19): `label list --repo R --search S --json name`, `label create <이름> --repo R`(이미 있으면 실패), `issue create --repo R --title T --body-file F [--label L]`
//   (라벨이 없으면 "could not add label"), `issue comment <n> --repo R --body-file F`(코멘트 주소 #issuecomment-<id>를 찍음),
//   `issue close <n> --repo R --reason …`(이미 닫혔으면 알리고 성공), `issue list --repo R --author @me --state all --json url,body,labels`(이슈는 모두 앱의 사람이 만든 것),
//   `issue view <n> --repo R --json comments`. 라벨과 이슈는 FAKE_GH_RECORD/issues.json에 둔다. 그 faults는 이슈 만들기와
//   코멘트마다 앞에서 하나씩 꺼낸다: error는 하지 않고 실패, posted는 한 뒤 실패. FAKE_GH_FAIL의 issue는 issue 명령 모두,
//   label은 라벨 만들기(권한 없음)다.
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

/** 다른 gh 호출이나 시험이 반쯤 쓴 파일을 읽지 않게 임시 파일에 쓰고 이름을 바꾼다 */
function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2))
  fs.renameSync(tmp, file)
}

function savePrs(prs) {
  const file = prsFile()
  if (file) writeJson(file, prs)
}

/** github.json: PR마다 체크, 코멘트, mergeable 따위. 시험이 쓴다 */
function loadGithub() {
  const file = recordDir ? path.join(recordDir, 'github.json') : null
  const g = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  return { prs: {}, logs: {}, pending_logs: {}, ...g }
}

function saveGithub(g) {
  if (recordDir) writeJson(path.join(recordDir, 'github.json'), g)
}

/** 코멘트와 리뷰의 id. 시험 도구(test/flow/github.ts)와 같은 수를 쓴다 */
function nextId(g) {
  const id = g.next_id ?? 1001
  g.next_id = id + 1
  return id
}

/** gh api가 HTTP 오류를 받았을 때 (cli/cli pkg/cmd/api/api.go, 3절): 본문은 표준 출력, 요약은 stderr */
function httpFail(status, message) {
  process.stdout.write(`${JSON.stringify({ message, status: String(status) })}\n`)
  process.stderr.write(`gh: ${message} (HTTP ${status})\n`)
  process.exit(1)
}

/** 앱의 사람: PR을 만든 사람이다. 앱이 게시한 답글의 작성자다 */
const ME = { login: 'relay-owner', type: 'User', association: 'OWNER' }

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

if (cmd === 'api' && opt('-X') === 'POST') {
  const target = argv[argv.indexOf('-X') + 2] ?? ''
  const input = argv.includes('--input') && opt('--input') === '-' ? fs.readFileSync(0, 'utf8') : ''
  record({ type: 'api post', input })
  if (failing('post')) httpFail(502, 'Bad Gateway')
  const host = opt('--hostname') ?? 'github.com'
  const m =
    /^repos\/([^/]+)\/([^/]+)\/(?:pulls\/(\d+)\/comments\/(\d+)\/replies|issues\/(\d+)\/comments)$/.exec(
      target,
    )
  if (!m) fail(`가짜 gh: 모르는 POST ${argv.join(' ')}`)
  const [, owner, name, pullNum, top, issueNum] = m
  const n = Number(pullNum ?? issueNum)
  const pr = findPr(loadPrs(), `${host}/${owner}/${name}`, n)
  if (!pr) httpFail(404, 'Not Found')
  let body
  try {
    body = JSON.parse(input).body
  } catch {
    httpFail(400, 'Problems parsing JSON')
  }
  if (typeof body !== 'string' || !body) httpFail(422, 'Validation Failed')
  const g = loadGithub()
  const fault = (g.post_faults ?? []).shift() ?? 'ok'
  if (fault === 'error') {
    saveGithub(g)
    httpFail(502, 'Bad Gateway')
  }
  const s = (g.prs[String(n)] ??= {})
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  const who = { user: { login: ME.login, type: ME.type }, author_association: ME.association }
  let created
  if (top) {
    const parent = (s.inline ?? []).find((c) => c.id === Number(top))
    if (!parent) {
      saveGithub(g)
      httpFail(404, 'Not Found')
    }
    // REST는 스레드 첫 코멘트에만 답글을 받는다 (3절). 앱은 답글의 답글을 보내지 않는다
    if (parent.in_reply_to_id) fail(`가짜 gh: 답글(${top})에는 답글을 달지 않음`)
    // 인라인 스레드에 답글을 달면 본문이 빈 리뷰가 하나 더 생긴다 (S7 관찰 3)
    const review = nextId(g)
    s.reviews = [
      ...(s.reviews ?? []),
      {
        id: review,
        ...who,
        body: '',
        state: 'COMMENTED',
        html_url: `${pr.url}#pullrequestreview-${review}`,
        submitted_at: at,
        commit_id: pr.head_oid,
      },
    ]
    const id = nextId(g)
    created = {
      id,
      ...who,
      body,
      path: parent.path,
      line: parent.line,
      original_line: parent.original_line ?? parent.line,
      in_reply_to_id: parent.id,
      pull_request_review_id: review,
      html_url: `${pr.url}#discussion_r${id}`,
      created_at: at,
      updated_at: at,
    }
    s.inline = [...(s.inline ?? []), created]
  } else {
    const id = nextId(g)
    created = {
      id,
      ...who,
      body,
      html_url: `${pr.url}#issuecomment-${id}`,
      created_at: at,
      updated_at: at,
    }
    s.convo = [...(s.convo ?? []), created]
  }
  saveGithub(g)
  // 게시하고도 오류를 돌려준 요청 (D194): 게시는 됐고 gh는 실패로 끝난다
  if (fault === 'posted') httpFail(502, 'Bad Gateway')
  process.stdout.write(`${JSON.stringify(created)}\n`)
  process.exit(0)
}

if (cmd === 'run' && sub === 'rerun') {
  record({ type: 'run rerun' })
  const run = argv[2]
  if (!run || !argv.includes('--failed')) fail(`가짜 gh: 모르는 run rerun ${argv.join(' ')}`)
  const g = loadGithub()
  if (!(g.runs ?? {})[run]) {
    fail(
      `failed to get run: HTTP 404: Not Found (https://api.github.com/repos/actions/runs/${run})`,
    )
  }
  if (failing('rerun')) fail(`run ${run} cannot be rerun; This workflow run cannot be retried`)
  g.reruns = [...(g.reruns ?? []), Number(run)]
  saveGithub(g)
  // TTY가 아니면 성공 문구를 쓰지 않는다 (cli/cli pkg/cmd/run/rerun/rerun.go, 3절)
  process.exit(0)
}

if (cmd === 'api') {
  const target = argv[argv.length - 1] ?? ''
  // Actions 실행 하나 (REST "Get a workflow run"의 모양에서 앱이 읽는 것만, D201)
  const runPath = /^repos\/[^/]+\/[^/]+\/actions\/runs\/(\d+)(?:\?.*)?$/.exec(target)
  record({ type: runPath ? 'api run' : 'api' })
  if (failing('api') || (runPath && failing('event'))) fail('HTTP 502: Bad Gateway (가짜 gh)')
  if (runPath) {
    const found = (loadGithub().runs ?? {})[runPath[1]]
    if (!found) fail('gh: Not Found (HTTP 404)')
    process.stdout.write(`${JSON.stringify({ id: Number(runPath[1]), event: found.event })}\n`)
    process.exit(0)
  }
  const host = opt('--hostname') ?? 'github.com'
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
  // 새 커밋이 생긴 직후 GitHub가 준 거절 (M9 [실제], app-claude 실행 #2)
  if (failing('merge')) fail('GraphQL: Pull Request is not mergeable (mergePullRequest)')
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

// ---------- 이슈 기록 (M19, I99, I101) ----------

/** issues.json: 레포마다의 라벨과 이슈(코멘트 포함). faults는 이슈 만들기·코멘트마다 앞에서 하나씩 꺼내 쓴다 */
function issuesFile() {
  return recordDir ? path.join(recordDir, 'issues.json') : null
}

function loadIssues() {
  const file = issuesFile()
  const v = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  return { labels: {}, issues: [], faults: [], next_comment: 5001, ...v }
}

function saveIssues(v) {
  const file = issuesFile()
  if (file) writeJson(file, v)
}

/** --repo가 GitHub 주소면 그 레포의 이슈 주소, 로컬 경로면 github.test/local/<레포 이름>의 주소 (prUrl과 같은 꼴) */
function issueUrl(repo, number) {
  return prUrl(repo, number).replace(/\/pull\/\d+$/, `/issues/${number}`)
}

function findIssue(v, repo, number) {
  const issue = v.issues.find((i) => i.repo === repo && i.number === number)
  if (!issue)
    fail(
      `GraphQL: Could not resolve to an issue or pull request with the number of ${number}. (repository.issue)`,
    )
  return issue
}

/** 다음 결함: error는 하지 않고 실패, posted는 한 뒤 실패(결과를 모르는 요청, D349) */
function nextFault(v) {
  const f = v.faults.shift() ?? 'ok'
  saveIssues(v)
  return f
}

if (cmd === 'label' && sub === 'list') {
  record({ type: 'label list' })
  if (failing('issue')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const search = opt('--search') ?? ''
  const names = (loadIssues().labels[opt('--repo')] ?? []).filter((n) => n.includes(search))
  process.stdout.write(`${JSON.stringify(names.map((name) => ({ name })))}\n`)
  process.exit(0)
}

if (cmd === 'label' && sub === 'create') {
  record({ type: 'label create' })
  const repo = opt('--repo')
  const name = argv[2]
  if (failing('label')) fail('HTTP 403: Must have admin rights to Repository. (가짜 gh)')
  const v = loadIssues()
  const labels = v.labels[repo] ?? []
  if (labels.includes(name)) {
    fail(
      `label with name "${name}" already exists; use \`--force\` to update its color and description`,
    )
  }
  v.labels[repo] = [...labels, name]
  saveIssues(v)
  process.exit(0)
}

if (cmd === 'issue' && sub === 'create') {
  const bodyFile = opt('--body-file')
  const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : undefined
  record({ type: 'issue create', body })
  if (failing('issue')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const repo = opt('--repo')
  const title = opt('--title')
  const label = opt('--label')
  if (!repo || !title || body === undefined) fail('must provide `--title` and `--body` (가짜 gh)')
  const v = loadIssues()
  if (label && !(v.labels[repo] ?? []).includes(label))
    fail(`could not add label: '${label}' not found`)
  const fault = nextFault(v)
  if (fault === 'error') fail('HTTP 502: Bad Gateway (가짜 gh)')
  const number = v.issues.filter((i) => i.repo === repo).length + 1
  const issue = {
    number,
    url: issueUrl(repo, number),
    repo,
    title,
    body,
    labels: label ? [label] : [],
    state: 'open',
    comments: [],
  }
  v.issues.push(issue)
  saveIssues(v)
  if (fault === 'posted') fail('HTTP 502: Bad Gateway (가짜 gh)')
  process.stdout.write(`${issue.url}\n`)
  process.exit(0)
}

if (cmd === 'issue' && sub === 'comment') {
  const bodyFile = opt('--body-file')
  const body = bodyFile ? fs.readFileSync(bodyFile, 'utf8') : undefined
  record({ type: 'issue comment', body })
  if (failing('issue')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const repo = opt('--repo')
  if (body === undefined) fail('가짜 gh: 본문이 없음')
  const v = loadIssues()
  const issue = findIssue(v, repo, Number(argv[2]))
  const fault = nextFault(v)
  if (fault === 'error') fail('HTTP 502: Bad Gateway (가짜 gh)')
  const id = v.next_comment
  v.next_comment = id + 1
  const url = `${issue.url}#issuecomment-${id}`
  issue.comments.push({ id, url, body })
  saveIssues(v)
  if (fault === 'posted') fail('HTTP 502: Bad Gateway (가짜 gh)')
  process.stdout.write(`${url}\n`)
  process.exit(0)
}

if (cmd === 'issue' && sub === 'close') {
  record({ type: 'issue close' })
  if (failing('issue')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const v = loadIssues()
  const issue = findIssue(v, opt('--repo'), Number(argv[2]))
  if (issue.state === 'closed') {
    process.stderr.write(`! Issue #${issue.number} (${issue.title}) is already closed\n`)
    process.exit(0)
  }
  issue.state = 'closed'
  issue.state_reason = opt('--reason')
  saveIssues(v)
  process.exit(0)
}

if (cmd === 'issue' && sub === 'list') {
  record({ type: 'issue list' })
  if (failing('issue')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const repo = opt('--repo')
  const limit = Number(opt('--limit') ?? 30)
  const list = loadIssues()
    .issues.filter((i) => i.repo === repo)
    .sort((a, b) => b.number - a.number)
    .slice(0, limit)
    .map((i) => ({ url: i.url, body: i.body, labels: i.labels.map((name) => ({ name })) }))
  process.stdout.write(`${JSON.stringify(list)}\n`)
  process.exit(0)
}

if (cmd === 'issue' && sub === 'view') {
  record({ type: 'issue view' })
  if (failing('issue')) fail('HTTP 502: Bad Gateway (가짜 gh)')
  const issue = findIssue(loadIssues(), opt('--repo'), Number(argv[2]))
  const comments = issue.comments.map((c) => ({ url: c.url, body: c.body }))
  process.stdout.write(`${JSON.stringify({ comments })}\n`)
  process.exit(0)
}

process.stderr.write(`가짜 gh: 모르는 명령 ${argv.join(' ')}\n`)
process.exit(2)
