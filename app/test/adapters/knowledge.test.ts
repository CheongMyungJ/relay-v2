import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { KNOWLEDGE_FILE, KNOWLEDGE_LIMIT, sharedKnowledge } from '../../src/adapters/knowledge'
import { git, makeRepo, writeFiles } from '../flow/repo'

let root: string
let repo: string
let remote: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-'))
  ;({ repo, remote } = makeRepo(root, 'source', { 'README.md': 'fixture' }))
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

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
