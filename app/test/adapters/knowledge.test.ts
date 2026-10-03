import fs from 'node:fs'
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

it('refuses oversized notes without silently truncating business rules', async () => {
  writeFiles(repo, { [KNOWLEDGE_FILE]: '가'.repeat(KNOWLEDGE_LIMIT) })
  git(repo, 'add', '.')
  git(repo, 'commit', '-qm', 'oversized notes')
  expect(await sharedKnowledge(repo)).toContain('초과')
  expect(await sharedKnowledge(repo)).not.toContain('가가가')
})
