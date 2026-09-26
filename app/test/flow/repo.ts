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
