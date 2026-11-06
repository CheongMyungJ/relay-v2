#!/usr/bin/env node
// 장기 평가(sequence)에서 relay-v3 앱이 쓰는 gh. 앱의 [머지]로 Work의 결과가 기준 브랜치(main)에 들어가게(앱의 실적 장부가
// 머지를 보게) relay-v3의 가짜 gh(<RELAY3_APP>/test/support/fake-gh/gh.mjs, v2 녹화본의 모양을 따름)에 넘기고, `pr merge`만
// 실제 git 머지를 더한다: 평가 레포의 origin(로컬 bare 레포)을 임시로 clone해 PR의 head를 base에 머지 방식대로 넣고(squash는
// 커밋 하나, merge는 --no-ff, rebase는 head를 base 위로 옮겨 앞으로 감기), 가짜 gh가 머지를 받아들이면 origin의 base에
// push한다. 충돌하면 GitHub처럼 '머지할 수 없음'으로 실패한다. 새 칸을 지어내지 않는다(상태 파일과 출력은 relay-v3 가짜 gh의
// 것 그대로). 앱(RELAY_GH_BIN)과 세션(PATH 맨 앞의 gh, `gh pr create`)이 같은 상태 파일(FAKE_GH_STATE)을 쓴다.
//   환경: FAKE_GH_STATE(상태 파일), FAKE_GH_LOG(부른 기록), RELAY3_FAKE_GH(relay-v3 가짜 gh의 경로)
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isMain } from './util.mjs'

/** relay-v3 체크아웃의 가짜 gh */
export const relay3FakeGh = (relay3App) => path.join(relay3App, 'test/support/fake-gh/gh.mjs')

/**
 * 앱과 세션에 줄 gh: dir/bin/gh(이 파일을 부르는 작은 셸 스크립트)를 만들고 앱에 줄 환경 변수를 돌려준다. PATH는 앞에 둘
 * 폴더다(쪽의 env가 cleanEnv의 PATH 앞에 붙인다)
 * @returns {{ bin: string, pathDir: string, env: Record<string, string> }}
 */
export function fakeGhSetup(dir, relay3App) {
  const fake = relay3FakeGh(relay3App)
  if (!fs.existsSync(fake)) throw new Error(`relay-v3 가짜 gh가 없습니다: ${fake}`)
  const pathDir = path.join(dir, 'gh-bin')
  fs.mkdirSync(pathDir, { recursive: true })
  const bin = path.join(pathDir, 'gh')
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env bash\nexec "${process.execPath}" "${path.join(import.meta.dirname, 'fake-gh.mjs')}" "$@"\n`,
  )
  fs.chmodSync(bin, 0o755)
  const state = path.join(dir, 'fake-gh-state.json')
  if (!fs.existsSync(state)) fs.writeFileSync(state, `${JSON.stringify({ prs: [] }, null, 2)}\n`)
  return {
    bin,
    pathDir,
    env: {
      RELAY_GH_BIN: bin,
      FAKE_GH_STATE: state,
      FAKE_GH_LOG: path.join(dir, 'fake-gh.log'),
      RELAY3_FAKE_GH: fake,
    },
  }
}

const sh = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const tryGit = (cwd, ...args) =>
  spawnSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).status === 0

/** --name 값 또는 --name=값 */
function opt(argv, name) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) return argv[i + 1]
    if (argv[i].startsWith(`${name}=`)) return argv[i].slice(name.length + 1)
  }
  return undefined
}

/**
 * origin(remote)의 base에 PR의 head를 머지한 커밋을 임시 clone에 만든다. 충돌이면 null. 돌려준 work 폴더에서 push한다
 * @param {string} remote origin의 주소(로컬 bare 레포)
 * @param {{ number: number, title?: string, headRefName: string, baseRefName: string }} pr
 * @param {'merge' | 'squash' | 'rebase'} method
 */
export function prepareMerge(remote, pr, method) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-gh-merge-'))
  sh(work, 'clone', '-q', '--no-local', remote, 'r')
  const r = path.join(work, 'r')
  sh(r, 'config', 'user.email', 'noreply@github.test')
  sh(r, 'config', 'user.name', 'GitHub')
  sh(r, 'config', 'commit.gpgsign', 'false')
  sh(r, 'checkout', '-q', '-B', pr.baseRefName, `origin/${pr.baseRefName}`)
  const head = `origin/${pr.headRefName}`
  const title = `${pr.title || pr.headRefName} (#${pr.number})`
  let ok
  if (method === 'squash') {
    ok =
      tryGit(r, 'merge', '--squash', head) && tryGit(r, 'commit', '-q', '--no-verify', '-m', title)
  } else if (method === 'rebase') {
    ok =
      tryGit(r, 'checkout', '-q', '-B', 'fake-gh-rebase', head) &&
      tryGit(r, 'rebase', '-q', `origin/${pr.baseRefName}`) &&
      tryGit(r, 'checkout', '-q', pr.baseRefName) &&
      tryGit(r, 'merge', '--ff-only', '-q', 'fake-gh-rebase')
  } else {
    ok = tryGit(
      r,
      'merge',
      '--no-ff',
      '-q',
      '-m',
      `Merge pull request #${pr.number} from ${pr.headRefName}\n\n${title}`,
      head,
    )
  }
  if (!ok) {
    fs.rmSync(work, { recursive: true, force: true })
    return null
  }
  return { work, repo: r, base: pr.baseRefName }
}

function delegate(argv) {
  const r = spawnSync(process.execPath, [process.env.RELAY3_FAKE_GH, ...argv], {
    stdio: 'inherit',
    env: process.env,
  })
  return r.status ?? 1
}

function main() {
  const argv = process.argv.slice(2)
  if (!process.env.RELAY3_FAKE_GH) {
    process.stderr.write('평가 gh: RELAY3_FAKE_GH가 없음\n')
    process.exit(1)
  }
  if (argv[0] !== 'pr' || argv[1] !== 'merge') process.exit(delegate(argv))
  const file = process.env.FAKE_GH_STATE
  const state = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
  const pr = (state.prs ?? []).find((p) => p.number === Number(argv[2]))
  const method = ['merge', 'squash', 'rebase'].find((m) => argv.includes(`--${m}`))
  // 열린 PR이 아니거나 방식이 없으면 가짜 gh가 GitHub처럼 답한다(머지할 것이 없다)
  if (!pr || (pr.state ?? 'OPEN') !== 'OPEN' || !method) process.exit(delegate(argv))
  let remote
  try {
    remote = sh(process.cwd(), 'config', '--get', 'remote.origin.url')
  } catch {
    process.stderr.write('평가 gh: origin이 없는 레포\n')
    process.exit(1)
  }
  const expected = opt(argv, '--match-head-commit')
  const merge = prepareMerge(remote, pr, method)
  if (!merge) {
    process.stderr.write(
      `X Pull request #${pr.number} is not mergeable: the merge commit cannot be cleanly created.\n`,
    )
    process.exit(1)
  }
  // head가 그사이 바뀌었으면 가짜 gh가 거절한다(--match-head-commit). 받아들였을 때만 push한다
  let code
  try {
    code = delegate(argv)
    if (code === 0) sh(merge.repo, 'push', '-q', 'origin', `HEAD:refs/heads/${merge.base}`)
  } catch (e) {
    process.stderr.write(`평가 gh: 머지를 origin에 push하지 못함 (${expected ?? ''}): ${e}\n`)
    code = 1
  } finally {
    fs.rmSync(merge.work, { recursive: true, force: true })
  }
  process.exit(code)
}

if (isMain(import.meta.url)) main()
