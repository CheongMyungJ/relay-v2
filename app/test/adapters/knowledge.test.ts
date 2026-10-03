import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  KNOWLEDGE_FILE,
  KNOWLEDGE_LIMIT,
  sharedKnowledge,
  workSource,
} from '../../src/adapters/knowledge'
import { git, makeRepo, writeFiles } from '../flow/repo'

let root: string
let repo: string
let remote: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-'))
  ;({ repo, remote } = makeRepo(root, 'source', { 'README.md': 'fixture' }))
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

it('keeps opaque provenance across restarts and distinguishes identical clone-local Work IDs', async () => {
  const firstDir = path.join(root, 'clone-a', 'w-20261003-001')
  const secondDir = path.join(root, 'clone-b', 'w-20261003-001')
  const dirs = [firstDir, secondDir]
  dirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }))
  const [first, second] = await Promise.all(dirs.map(workSource))
  expect(first).not.toBe(second)
  expect(await workSource(firstDir)).toBe(first)
  expect(await Promise.all([workSource(firstDir), workSource(firstDir)])).toEqual([first, first])
  expect(first).toMatch(/^[a-f0-9-]{36}$/)
  expect(fs.readdirSync(firstDir)).toEqual(['knowledge-source-id'])
  fs.writeFileSync(path.join(firstDir, 'knowledge-source-id'), '/private/machine/path')
  await expect(workSource(firstDir)).rejects.toThrow('Invalid knowledge source ID')
})

it('shares only committed facts through Git; corrections and deletion replace the snapshot', async () => {
  expect(await sharedKnowledge(repo)).toBe('')
  writeFiles(repo, { [KNOWLEDGE_FILE]: 'human confirmed rule' })
  expect(await sharedKnowledge(repo)).toBe('')
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'confirmed knowledge')
  git(repo, 'push', '-q', 'origin', 'main')
  const clone = path.join(root, 'team')
  git(root, 'clone', '-q', remote, clone)
  expect(await sharedKnowledge(clone)).toContain('human confirmed rule')
  writeFiles(repo, { [KNOWLEDGE_FILE]: 'new rule supersedes old' })
  expect(await sharedKnowledge(repo)).toContain('human confirmed rule')
  git(repo, 'commit', '-qam', 'correct rule')
  expect(await sharedKnowledge(repo)).not.toContain('human confirmed rule')
  git(repo, 'rm', KNOWLEDGE_FILE)
  git(repo, 'commit', '-qm', 'remove rule')
  expect(await sharedKnowledge(repo)).toBe('')
})

it.each([11_900, 12_000, 12_100])(
  'keeps facts accessible at the %i-byte boundary',
  async (size) => {
    const facts = '# Policy\nreview days: 19\nqueue: review\nunknown: undefined\n'
    writeFiles(repo, { [KNOWLEDGE_FILE]: facts + '\n'.repeat(size - Buffer.byteLength(facts)) })
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'boundary notes')
    const context = await sharedKnowledge(repo)
    const blob = context.match(/Git blob ([a-f0-9]+)/)?.[1]
    expect(blob).toBeTruthy()
    if (!blob) throw new Error('Missing snapshot source')
    expect(git(repo, 'show', blob)).toContain(facts.trim())
    expect(context).not.toContain('사용하지 않았다')
    if (size <= KNOWLEDGE_LIMIT) expect(context).toContain(facts)
    else {
      expect(context).not.toContain(facts)
      expect(Buffer.byteLength(context)).toBeLessThan(KNOWLEDGE_LIMIT)
    }
  },
)

it('retrieves large substantive notes in a fresh clone, pinned across edits and commits', async () => {
  const notes = Array.from(
    { length: 180 },
    (_, i) =>
      `## Policy ${i}\nScope: department ${i} only\nRule: queue Q${i}\nEvidence: human answer ${i}\nSource: original-${i}\nUnknown: undefined\n`,
  ).join('\n')
  expect(Buffer.byteLength(notes)).toBeGreaterThan(KNOWLEDGE_LIMIT)
  writeFiles(repo, { [KNOWLEDGE_FILE]: notes })
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'large valid notes')
  git(repo, 'push', '-q', 'origin', 'main')
  const clone = path.join(root, 'large-team')
  git(root, 'clone', '-q', remote, clone)
  const context = await sharedKnowledge(clone)
  const blob = context.match(/Git blob ([a-f0-9]+)/)?.[1]
  if (!blob) throw new Error('Missing snapshot source')
  expect(Buffer.byteLength(context)).toBeLessThan(KNOWLEDGE_LIMIT)
  // Exercise the supplied retrieval commands, rather than asserting only their wording.
  const searchInstruction = context.split('\n').find((line) => line.startsWith('검색: '))
  if (!searchInstruction) throw new Error('Missing search instruction')
  const search = searchInstruction.slice(4).replace('작업 관련 검색어', 'Policy 179')
  const run = (cmd: string) => execFileSync('bash', ['-c', cmd], { cwd: clone, encoding: 'utf8' })
  const line = Number(run(search).split(':')[0])
  expect(line).toBeGreaterThan(1)
  const readInstruction = context.split('\n').find((entry) => entry.startsWith('범위 읽기: '))
  if (!readInstruction) throw new Error('Missing range instruction')
  const largeRead = readInstruction.slice(7).replace('시작줄,끝줄', '1,99999')
  expect(Buffer.byteLength(run(largeRead))).toBe(KNOWLEDGE_LIMIT)
  expect(git(clone, 'show', blob)).toBe(notes.replace(/\n$/, ''))
  const read = readInstruction.slice(7).replace('시작줄,끝줄', `${line},${line + 5}`)
  expect(run(read)).toContain('Source: original-179\nUnknown: undefined')
  writeFiles(clone, { [KNOWLEDGE_FILE]: 'replacement policy' })
  git(clone, 'commit', '-qam', 'replace notes')
  expect(run(read)).toContain('Rule: queue Q179')
  expect(git(clone, 'show', blob)).toContain('Source: original-0')
  expect(await sharedKnowledge(clone)).toContain('replacement policy')
})

it('does not treat a committed symlink as knowledge', async () => {
  fs.mkdirSync(path.join(repo, '.relay'))
  fs.symlinkSync('../README.md', path.join(repo, KNOWLEDGE_FILE))
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'symlink notes')
  expect(await sharedKnowledge(repo)).toContain('일반 파일이 아니므로')
})
