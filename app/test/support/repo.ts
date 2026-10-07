// 시험용 레포와 로컬 bare 원격 (I17). [흐름], [어댑터], [스모크], [실제]가 함께 쓴다.
// 앱 코드를 import하지 않는다 ([스모크]는 설치한 앱을 따로 띄운다).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** 파일 여러 개를 쓴다 */
export function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [name, text] of Object.entries(files)) {
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, text)
  }
}

export interface Repo {
  /** 레포(메인 체크아웃) */
  repo: string
  /** origin으로 둔 로컬 bare 레포 */
  remote: string
}

/** 시험용 레포와 로컬 bare 원격을 만든다. 출처: spikes/lib/util.mjs makeFixture (I17) */
export function makeRepo(root: string, name: string, files: Record<string, string>): Repo {
  const repo = path.join(root, name)
  const remote = path.join(root, `${name}.git`)
  fs.mkdirSync(repo, { recursive: true })
  git(root, 'init', '--bare', '-b', 'main', remote)
  git(repo, 'init', '-b', 'main')
  git(repo, 'config', 'user.email', 'relay-test@example.com')
  git(repo, 'config', 'user.name', 'relay test')
  git(repo, 'config', 'commit.gpgsign', 'false')
  writeFiles(repo, files)
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'init')
  git(repo, 'remote', 'add', 'origin', remote)
  git(repo, 'push', '-q', '-u', 'origin', 'main')
  return { repo, remote }
}

/** 로컬 경로의 서브모듈을 받게 한다. git 2.38.1부터 file 전송은 기본으로 막혀 있다 */
const FILE_PROTOCOL = ['-c', 'protocol.file.allow=always']

/**
 * 서브모듈로 쓸 레포를 source에 만들고 repo의 dir에 서브모듈로 더해 커밋한다 (D382). repo는 메인 체크아웃이나
 * worktree다. 더한 서브모듈은 체크아웃된 채다
 */
export function addSubmodule(
  repo: string,
  source: string,
  dir: string,
  files: Record<string, string>,
): void {
  fs.mkdirSync(source, { recursive: true })
  git(source, 'init', '-b', 'main')
  git(source, 'config', 'user.email', 'relay-test@example.com')
  git(source, 'config', 'user.name', 'relay test')
  git(source, 'config', 'commit.gpgsign', 'false')
  writeFiles(source, files)
  git(source, 'add', '-A')
  git(source, 'commit', '-q', '-m', 'init')
  git(repo, ...FILE_PROTOCOL, 'submodule', 'add', '-q', source, dir)
  git(repo, 'commit', '-q', '-m', `서브모듈 ${dir}`)
}

/** worktree의 서브모듈을 체크아웃하고, 그 안에서 커밋할 수 있게 사용자 설정을 둔다 (D382) */
export function checkoutSubmodules(tree: string): void {
  git(tree, ...FILE_PROTOCOL, 'submodule', 'update', '--init', '-q')
  git(
    tree,
    'submodule',
    'foreach',
    '-q',
    'git config user.email relay-test@example.com && git config user.name "relay test" && git config commit.gpgsign false',
  )
}
