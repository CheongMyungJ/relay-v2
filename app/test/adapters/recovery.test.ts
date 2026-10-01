// [어댑터] 재시작과 복구 (시나리오 9, D76, D123, D124, I33): 앱 역할 프로세스를 강제 종료한 뒤 남은 프로세스를
// ID와 시작 시각으로 찾아 트리째 끝낸다(시작 시각이 다르면 건드리지 않음). 끊긴 되감기·전달·정리를 다시 할 때 쓰는
// git 동작, 앱 소유 파일의 해시와 work.json 비교, 잘린 pty.log 읽기를 실제 git과 파일로 본다.
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addWorktree,
  commitInfo,
  createBackup,
  deleteBranches,
  headCommit,
  pruneWorktrees,
  removeWorktree,
  stashAll,
  stashEntries,
  treeOf,
  worktreeTree,
} from '../../src/adapters/git'
import {
  isAlive,
  killOrphans,
  listProcesses,
  processStartTime,
  processTree,
  type ProcessInfo,
  type ProcessRecord,
} from '../../src/adapters/pty'
import { WorkFiles, fileHash } from '../../src/adapters/store'
import { createWork } from '../../src/core/machine'
import { lostStashes } from '../../src/core/recovery'
import { stashMessage } from '../../src/core/delivery'
import { backupMessage } from '../../src/core/rewind'
import { git, makeRepo, writeFiles } from '../flow/repo'

const isWin = process.platform === 'win32'
/** 프로세스 목록과 시작 시각을 읽는 OS (I20, I33) */
const listing = isWin || process.platform === 'linux'
const APP_ROLE = path.resolve(__dirname, '../fixtures/app-role.mjs')
const WORK_ID = 'w-20260927-001'
const BRANCH = `relay/${WORK_ID}`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let root: string
/** 시험이 띄운 자식 프로세스 */
const children: ChildProcess[] = []
/** 자식이 띄운 프로세스: ID와 시작 시각 */
const grandchildren: ProcessRecord[] = []

beforeEach(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-recovery-')))
})

afterEach(async () => {
  // 시험이 실패해도 띄운 프로세스를 남기지 않는다. ID만으로 끝내지 않는다: 이미 끝난 프로세스의 ID는 나란히 도는
  // 다른 시험 파일의 프로세스가 곧 다시 쓸 수 있다(Windows, A77). 자식은 핸들로, 손자는 ID와 시작 시각으로 끝낸다
  for (const child of children.splice(0)) child.kill('SIGKILL')
  await killOrphans(grandchildren.splice(0))
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

async function until<T>(
  pred: () => Promise<T | null | undefined | false> | T | null | undefined | false,
  label: string,
  ms = 30_000,
): Promise<T> {
  const end = Date.now() + ms
  for (;;) {
    const v = await pred()
    if (v) return v
    if (Date.now() > end) throw new Error(`시간 초과: ${label}`)
    await sleep(100)
  }
}

function exited(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once('exit', () => resolve())
  })
}

const names = (ps: readonly ProcessInfo[]) => ps.map((p) => `${p.Name}(${p.ProcessId})`)

describe('[어댑터] 고아 프로세스 (시나리오 9-1, D76, I33)', () => {
  it('트리는 루트부터이고, 부모보다 늦게 시작한 자식만 넣는다 (Win32_Process의 ParentProcessId)', () => {
    const list: ProcessInfo[] = [
      { ProcessId: 10, ParentProcessId: 1, Name: 'root', Created: '2026-09-27T10:00:00.000Z' },
      { ProcessId: 11, ParentProcessId: 10, Name: 'child', Created: '2026-09-27T10:00:01.000Z' },
      { ProcessId: 12, ParentProcessId: 11, Name: 'grand', Created: '2026-09-27T10:00:02.000Z' },
      // 루트보다 먼저 시작했다: 부모 ID가 재사용되기 전의 다른 프로세스를 가리킨다
      { ProcessId: 13, ParentProcessId: 10, Name: 'stale', Created: '2026-09-27T09:00:00.000Z' },
      { ProcessId: 14, ParentProcessId: 99, Name: 'other', Created: '2026-09-27T10:00:03.000Z' },
    ]
    expect(processTree(10, list).map((p) => p.Name)).toEqual(['root', 'child', 'grand'])
    expect(processTree(99, list)).toEqual([])
  })

  it.runIf(listing)('시작 시각은 목록의 시작 시각과 같은 모양이다', async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1 << 30)'], {
      stdio: 'ignore',
    })
    children.push(child)
    const started = await processStartTime(child.pid ?? 0)
    expect(started).toBeTruthy()
    const list = await listProcesses()
    expect(list.find((p) => p.ProcessId === child.pid)?.Created).toBe(started)
    expect(list.find((p) => p.ProcessId === process.pid)).toBeDefined()
  })

  it.runIf(listing)(
    '앱 역할 프로세스를 강제 종료한 뒤 남은 프로세스를 ID와 시작 시각으로 찾아 트리째 끝낸다. 시작 시각이 다르면 건드리지 않는다',
    async () => {
      const out = path.join(root, 'pids.json')
      const role = spawn(process.execPath, [APP_ROLE, out], { stdio: 'ignore' })
      children.push(role)
      const pids = await until(
        () =>
          fs.existsSync(out) &&
          (JSON.parse(fs.readFileSync(out, 'utf8')) as { pty: number; survivor: number }),
        '앱 역할 프로세스',
      )
      // 앱은 세션을 띄운 직후 프로세스 ID와 시작 시각을 기록한다 (D76)
      const records = [
        { pid: pids.pty, startedAt: (await processStartTime(pids.pty)) ?? '' },
        { pid: pids.survivor, startedAt: (await processStartTime(pids.survivor)) ?? '' },
      ]
      grandchildren.push(...records.filter((r) => r.startedAt))
      expect(records.every((r) => r.startedAt)).toBe(true)
      // survivor의 트리(tree.mjs와 그 자식)가 떠 있을 때까지 기다린다
      const before = await until(async () => {
        const list = await listProcesses()
        return processTree(pids.survivor, list).length >= 2 ? list : null
      }, '트리')
      const trees = [...processTree(pids.pty, before), ...processTree(pids.survivor, before)]
      console.log('기록한 트리', names(trees).join(', '))

      // 앱 역할 프로세스만 강제 종료한다(트리 종료 아님). 앱 충돌과 같다
      role.kill('SIGKILL')
      await exited(role)
      await sleep(3000)
      const afterCrash = await listProcesses()
      console.log(
        '앱 역할을 끝낸 뒤 남은 것',
        names(trees.filter((p) => isAlive(p.ProcessId, p.Created, afterCrash))).join(', ') ||
          '없음',
      )

      // 시작 시각이 다르면 다른 프로그램이 ID를 재사용한 것이라 건드리지 않는다
      const wrong = { pid: pids.survivor, startedAt: '2000-01-01T00:00:00.0000000+00:00' }
      expect(await killOrphans([wrong])).toEqual([])
      expect(isAlive(pids.survivor, records[1]?.startedAt, await listProcesses())).toBe(true)

      // ID와 시작 시각이 같으면 트리째 끝낸다
      const killed = await killOrphans(records)
      expect(killed).toContainEqual(records[1])
      const left = await listProcesses()
      expect(names(trees.filter((p) => isAlive(p.ProcessId, p.Created, left)))).toEqual([])
    },
    90_000,
  )
})

describe('[어댑터] 끊긴 되감기와 전달의 git (D123)', () => {
  let repo: string
  let tree: string

  beforeEach(async () => {
    repo = makeRepo(root, 'sample', {
      '.gitignore': 'node_modules/\n',
      'src/avg.js': 'export const avg = () => NaN\n',
    }).repo
    tree = path.join(root, 'worktree')
    await addWorktree(repo, tree, BRANCH, git(repo, 'rev-parse', 'HEAD'))
  })

  it('작업 트리의 tree는 커밋 안 된 변경을 담은 백업 커밋의 tree와 같다. 깨끗하면 HEAD의 tree다 (D116)', async () => {
    const head = await headCommit(tree)
    expect(await worktreeTree(tree)).toBe(await treeOf(tree, head))
    writeFiles(tree, {
      'src/avg.js': 'export const avg = () => 0\n',
      'notes.txt': '메모\n',
      'node_modules/pkg/index.js': 'keep\n',
    })
    git(tree, 'add', 'notes.txt')
    const staged = git(tree, 'diff', '--cached', '--name-only')
    const backup = await createBackup(tree, `${BRANCH}-discarded-1`, {
      uncommitted: true,
      message: backupMessage(WORK_ID),
    })
    expect(await worktreeTree(tree)).toBe(await treeOf(tree, backup))
    // 진짜 index는 그대로다
    expect(git(tree, 'diff', '--cached', '--name-only')).toBe(staged)
    expect(await commitInfo(repo, backup)).toEqual({
      id: backup,
      subject: backupMessage(WORK_ID),
      parent: head,
    })
    // 그 뒤에 고치면 다르다
    writeFiles(tree, { 'notes.txt': '메모 더\n' })
    expect(await worktreeTree(tree)).not.toBe(await treeOf(tree, backup))
    expect((await commitInfo(repo, head)).subject).toBe('init')
  })

  it('stash의 제목은 On <브랜치>: <메시지>다. 끊긴 전달이 만든 stash를 메시지로 찾는다', async () => {
    writeFiles(tree, { 'debug.log': '실험\n' })
    const stash = await stashAll(tree, stashMessage(WORK_ID))
    writeFiles(tree, { 'other.txt': '다른 것\n' })
    git(tree, 'stash', 'push', '-q', '--include-untracked', '--message', '사람의 stash')
    const entries = await stashEntries(repo)
    expect(entries).toEqual([
      { commit: git(repo, 'rev-parse', 'refs/stash'), subject: `On ${BRANCH}: 사람의 stash` },
      { commit: stash, subject: `On ${BRANCH}: ${stashMessage(WORK_ID)}` },
    ])
    expect(lostStashes(WORK_ID, entries, [])).toEqual([stash])
    expect(lostStashes(WORK_ID, entries, [stash])).toEqual([])
  })
})

describe('[어댑터] 끊긴 정리의 git (D123)', () => {
  let repo: string
  let tree: string

  beforeEach(async () => {
    repo = makeRepo(root, 'sample', { 'src/a.js': 'a\n', 'src/b.js': 'b\n' }).repo
    tree = path.join(root, 'worktree')
    await addWorktree(repo, tree, BRANCH, git(repo, 'rev-parse', 'HEAD'))
  })

  it('.git이 없어진 반쯤 지운 worktree는 --force로도 지우지 않는다. prune은 관리 정보만 지우고 폴더는 남긴다', async () => {
    // git은 Windows에서도 경로를 /로 찍는다
    const listed = () => git(repo, 'worktree', 'list', '--porcelain').replace(/\\/g, '/')
    const entry = `worktree ${tree.replace(/\\/g, '/')}`
    expect(listed()).toContain(entry)
    fs.rmSync(path.join(tree, '.git'))
    await expect(removeWorktree(repo, tree, { force: false })).rejects.toThrow()
    await expect(removeWorktree(repo, tree, { force: true })).rejects.toThrow()
    expect(listed()).toContain(entry)
    await pruneWorktrees(repo)
    expect(listed()).not.toContain(entry)
    expect(fs.existsSync(path.join(tree, 'src', 'a.js'))).toBe(true)
  })

  it('지운 추적 파일은 변경이라 --force가 있어야 worktree를 지운다', async () => {
    fs.rmSync(path.join(tree, 'src', 'a.js'))
    expect(git(tree, 'status', '--porcelain')).toBe('D src/a.js')
    await expect(removeWorktree(repo, tree, { force: false })).rejects.toThrow()
    await removeWorktree(repo, tree, { force: true })
    expect(fs.existsSync(tree)).toBe(false)
  })

  it('git branch -D는 없는 브랜치가 섞이면 있는 것은 지우고 실패한다', async () => {
    await removeWorktree(repo, tree, { force: false })
    const base = git(repo, 'rev-parse', 'HEAD')
    git(repo, 'branch', `${BRANCH}-discarded-1`, base)
    await expect(
      deleteBranches(repo, [`${BRANCH}-discarded-9`, BRANCH, `${BRANCH}-discarded-1`]),
    ).rejects.toThrow()
    expect(git(repo, 'branch', '--list', 'relay/*')).toBe('')
  })
})

describe('[어댑터] 앱 소유 파일과 work.json (6.1, D124)', () => {
  it('앱 소유 파일을 쓰면 해시를 돌려주고, 읽으면 내용과 바이트의 해시를 준다. 없으면 null이다', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    const request = await w.writeRequest('요청\r\n한글\n')
    expect(request).toBe(fileHash('요청\r\n한글\n'))
    expect(await w.readOwned('request.md')).toEqual({ text: '요청\r\n한글\n', hash: request })
    const intent = await w.writeIntent('v1\n', 1)
    expect(intent).toEqual({ before: null, hash: fileHash('v1\n') })
    const decisions = await w.appendDecisions(
      '## t-01 intake — 2026-09-27 10:00 (사람 승인)\n없음\n',
    )
    expect(decisions.before).toBeNull()
    expect(await w.ownedHashes(['request.md', 'intent.md', 'decisions.md'])).toEqual({
      'request.md': request,
      'intent.md': intent.hash,
      'decisions.md': decisions.hash,
    })
    // 고쳐 쓰면 쓰기 전에 읽은 내용의 해시도 준다
    fs.appendFileSync(w.ownedPath('intent.md'), '사람이 고침\n')
    const v2 = await w.writeIntent('v2\n', 2)
    expect(v2.before).toBe(fileHash('v1\n사람이 고침\n'))
    expect(fs.readFileSync(path.join(w.intentHistory, 'v1.md'), 'utf8')).toBe('v1\n사람이 고침\n')
    const more = await w.appendDecisions('## t-02 fix — 2026-09-27 11:00 (사람 승인)\n없음\n')
    expect(more.before).toBe(decisions.hash)
    fs.rmSync(w.ownedPath('intent.md'))
    fs.writeFileSync(w.ownedPath('decisions.md'), Buffer.from([0xff, 0xfe, 0x41]))
    const now = await w.ownedHashes(['intent.md', 'decisions.md'])
    expect(now['intent.md']).toBeNull()
    // 해시는 읽은 글자가 아니라 바이트로 잰다
    expect(now['decisions.md']).toBe(fileHash(Buffer.from([0xff, 0xfe, 0x41])))
  })

  it('work.json은 앱이 마지막으로 쓰거나 읽은 내용과 다르면 바뀐 내용을 옆에 남기고 앱의 상태로 쓴다', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    const work = createWork({
      workId: WORK_ID,
      baseBranch: 'main',
      baseCommit: 'base0001',
      at: '2026-09-27T10:00:00+09:00',
    }).work
    const first = await w.save(work)
    expect(first).toMatchObject({ changed: false })
    const loaded = await w.readWork()
    expect(loaded?.text).toBe(first.text)
    expect(loaded?.work).toEqual(work)
    const name = 'work.json.changed-20260927T100500'
    const same = await w.save(
      { ...work, status: 'stopped' },
      { expected: first.text, copyName: name },
    )
    expect(same).toMatchObject({ changed: false })
    // 스크립트가 바꿨다
    const script = same.text.replace('"stopped"', '"completed"')
    fs.writeFileSync(w.workJson, script)
    const next = { ...work, status: 'active' as const }
    const r = await w.save(next, { expected: same.text, copyName: name })
    expect(r).toEqual({ text: r.text, changed: true, copy: path.join(w.dir, name) })
    expect(fs.readFileSync(path.join(w.dir, name), 'utf8')).toBe(script)
    expect((await w.readWork())?.work).toEqual(next)
    // 같은 이름이 있으면 번호를 붙인다. 없어졌으면 남길 것이 없다
    fs.writeFileSync(w.workJson, '{}')
    const again = await w.save(next, { expected: r.text, copyName: name })
    expect(again).toMatchObject({ changed: true, copy: path.join(w.dir, `${name}-2`) })
    fs.rmSync(w.workJson)
    expect(await w.save(next, { expected: again.text, copyName: name })).toMatchObject({
      changed: true,
      copy: null,
    })
  })
})

describe('[어댑터] 잘린 pty.log (시나리오 9-5)', () => {
  it('끝의 덜 쓴 UTF-8 문자는 버리고 남은 만큼 읽는다. 없으면 null이다', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    const task = { seq: 1, node: 'intake' as const }
    expect(await w.readPtyLog(task)).toBeNull()
    const file = path.join(w.taskDir(task), 'pty.log')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const full = Buffer.from('FAKE-CLAUDE READY\r\n\x1b[1m한글 출력 확인', 'utf8')
    fs.writeFileSync(file, full.subarray(0, full.length - 2))
    // '인'(3바이트)의 첫 바이트만 남았다
    expect(await w.readPtyLog(task)).toBe('FAKE-CLAUDE READY\r\n\x1b[1m한글 출력 확')
    // 중간의 잘못된 바이트는 대체 문자로 보이고 계속 읽는다
    fs.writeFileSync(file, Buffer.concat([Buffer.from('a'), Buffer.from([0xe1]), Buffer.from('b')]))
    expect(await w.readPtyLog(task)).toBe('a�b')
  })
})
