#!/usr/bin/env node
// 가짜 gh (docs/implementation.md 8.2). 가짜 claude처럼 두고, 받은 인자를 파일에 남긴다.
// - `gh auth status`: 등록 점검(D67)과 다시 점검(D118). FAKE_GH_AUTH가 fail이면 종료 코드 1이다.
// - `gh pr list --repo R --head H --state open --json … --limit 1`: 열린 PR을 JSON 배열로 찍는다(7-4).
//   이 가짜가 만든 PR은 FAKE_GH_RECORD/prs.json에 남아 같은 --repo와 --head면 찾는다.
//   FAKE_GH_OPEN_PR=<주소>면 어떤 head든 그 주소의 열린 PR이 있는 것으로 답한다.
// - `gh pr create --repo R --base B --head H --title T --body-file F [--draft]`: PR을 만들고 주소를 찍는다.
//   --repo가 로컬 레포 경로면 head 브랜치가 그 레포에 있어야 만든다(실제 gh는 API가 거부한다).
// - FAKE_GH_FAIL=list|create면 그 명령이 종료 코드 1로 실패한다.
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

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

/** --repo가 GitHub 주소면 그 레포의 PR 주소, 아니면 가짜 주소 */
function prUrl(repo, number) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(repo ?? '')
  return m
    ? `https://github.com/${m[1]}/${m[2]}/pull/${number}`
    : `https://github.test/fake/pull/${number}`
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
  if (env.FAKE_GH_FAIL === 'list') fail('HTTP 502: Bad Gateway (가짜 gh)')
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
  if (env.FAKE_GH_FAIL === 'create') fail('pull request create failed: HTTP 422 (가짜 gh)')
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
  const pr = {
    number,
    url: prUrl(repo, number),
    repo,
    head,
    base,
    title,
    body,
    isDraft: argv.includes('--draft'),
    baseRefName: base,
    state: 'open',
  }
  const file = prsFile()
  if (file) fs.writeFileSync(file, JSON.stringify([...prs, pr], null, 2))
  process.stdout.write(`${pr.url}\n`)
  process.exit(0)
}

process.stderr.write(`가짜 gh: 모르는 명령 ${argv.join(' ')}\n`)
process.exit(2)
