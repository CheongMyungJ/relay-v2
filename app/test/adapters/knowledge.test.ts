// [어댑터] 지식의 git과 파일 (I71~I73): ls-tree 해시(파일, 디렉터리, 없는 경로, 지식 폴더를 품은 디렉터리), 지식 폴더만
// 올린 커밋, 커밋에서 지식 읽기, 앱 저장소의 원자적 쓰기. 실제 git으로 레포를 만들어 돌린다.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  commitPaths,
  filesAt,
  headCommit,
  objectHash,
  pathHashes,
  pathsDirty,
  showFile,
  showFiles,
  statusLines,
} from '../../src/adapters/git'
import {
  KnowledgeStore,
  readKnowledgeAt,
  readRepoKnowledge,
  storeKnowledgeDir,
  writeRepoEntries,
} from '../../src/adapters/knowledge'
import { renderEntry } from '../../src/core/knowledge'
import type { KnowledgeEntry } from '../../src/shared/knowledge'
import { git, makeRepo, writeFiles } from '../flow/repo'

const DIR = 'docs/knowledge/'

function entry(over: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'domain-a1b2c3d4',
    kind: 'domain',
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths: ['src/money.js'],
    terms: ['반올림'],
    hashes: {},
    source: { work: 'w-1', task: 't-01', by: 'human' },
    rule: '금액은 0.5에서 올린다',
    why: '회계팀',
    not_in_code: '사람이 정함',
    incentive: '은행가 반올림',
    ...over,
  }
}

let root: string
let repo: string

beforeEach(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-')))
  repo = makeRepo(root, 'sample', {
    'src/money.js': 'export const round = (x) => Math.round(x)\n',
    'src/other.js': 'export const x = 1\n',
    'docs/guide.md': '# 안내\n',
  }).repo
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

describe('ls-tree 해시 (I72)', () => {
  it('파일은 blob, 디렉터리는 tree, 없는 경로는 null이다', async () => {
    const head = await headCommit(repo)
    expect(await objectHash(repo, head, 'src/money.js')).toBe(
      git(repo, 'rev-parse', `${head}:src/money.js`),
    )
    expect(await objectHash(repo, head, './src/')).toBe(git(repo, 'rev-parse', `${head}:src`))
    expect(await objectHash(repo, head, 'src/none.js')).toBeNull()
    const hashes = await pathHashes(repo, head, ['src/money.js:round', 'src', 'nope'], DIR)
    expect(hashes['src/money.js:round']).toBe(git(repo, 'rev-parse', `${head}:src/money.js`))
    expect(hashes['nope']).toBeNull()
  })

  it('지식 폴더를 품은 디렉터리는 지식 커밋 뒤에도 같고, 다른 파일이 바뀌면 다르다', async () => {
    const before = await headCommit(repo)
    const h1 = (await pathHashes(repo, before, ['docs'], DIR))['docs']
    await writeRepoEntries(repo, DIR, [entry()])
    await commitPaths(repo, [DIR], 'relay(w-1): 지식 1건')
    const after = await headCommit(repo)
    expect((await pathHashes(repo, after, ['docs'], DIR))['docs']).toBe(h1)
    // 지식 폴더 자신은 그대로 해시한다
    expect((await pathHashes(repo, after, [DIR], DIR))['docs/knowledge']).not.toBeNull()
    writeFiles(repo, { 'docs/guide.md': '# 바뀐 안내\n' })
    git(repo, 'commit', '-qam', 'guide')
    expect((await pathHashes(repo, await headCommit(repo), ['docs'], DIR))['docs']).not.toBe(h1)
  })
})

describe('지식 폴더만 올린 커밋 (I73)', () => {
  it('다른 변경은 커밋하지 않고, 처음 만들 때 README를 쓴다', async () => {
    writeFiles(repo, { 'src/other.js': 'export const x = 2\n' })
    git(repo, 'add', 'src/other.js')
    writeFiles(repo, { 'src/new.js': '1\n' })
    const written = await writeRepoEntries(repo, DIR, [entry()])
    expect(written).toEqual([`${DIR}README.md`, `${DIR}domain/domain-a1b2c3d4.md`])
    expect(await pathsDirty(repo, [DIR])).toBe(true)
    const head = await commitPaths(repo, [DIR], 'relay(w-1): 지식 1건')
    expect(git(repo, 'show', '--name-only', '--format=', head).split('\n').sort()).toEqual([
      `${DIR}README.md`,
      `${DIR}domain/domain-a1b2c3d4.md`,
    ])
    expect(await pathsDirty(repo, [DIR])).toBe(false)
    expect((await statusLines(repo)).sort()).toEqual(['?? src/new.js', 'M  src/other.js'])
    // 두 번째 쓰기는 README를 다시 쓰지 않는다
    expect(await writeRepoEntries(repo, DIR, [entry({ id: 'domain-0000000b' })])).toEqual([
      `${DIR}domain/domain-0000000b.md`,
    ])
  })
})

describe('커밋에서 지식 읽기 (I77)', () => {
  it('기준 브랜치의 커밋에서 항목을 읽고, 틀린 파일은 문제로 남긴다', async () => {
    await writeRepoEntries(repo, DIR, [entry(), entry({ id: 'failure-0000000c', kind: 'failure' })])
    writeFiles(repo, { [`${DIR}recipe/recipe-bad00000.md`]: '---\nid: x\n---\n# 규칙\n' })
    await commitPaths(repo, [DIR], 'relay(w-1): 지식 2건')
    const head = await headCommit(repo)
    git(repo, 'checkout', '-q', '-b', 'other')
    fs.rmSync(path.join(repo, DIR), { recursive: true })
    const r = await readKnowledgeAt(repo, head, DIR)
    expect(r.entries.map((e) => e.entry.id).sort()).toEqual(['domain-a1b2c3d4', 'failure-0000000c'])
    expect(r.problems).toHaveLength(1)
    expect(await filesAt(repo, head, DIR)).toContain(`${DIR}README.md`)
    expect(await showFile(repo, head, `${DIR}domain/domain-a1b2c3d4.md`)).toBe(renderEntry(entry()))
    expect(await showFile(repo, head, `${DIR}none.md`)).toBeNull()
    expect((await readRepoKnowledge(repo, DIR)).entries).toEqual([])
  })
})

describe('커밋의 파일 여럿 (I74)', () => {
  it('git 두 번으로 읽고 showFile과 같은 글을 준다. 없는 파일과 디렉터리는 null이다', async () => {
    // 줄 끝은 LF만 쓴다: Windows 러너의 git은 core.autocrlf로 커밋할 때 CRLF를 LF로 바꾼다
    const text = '---\nid: x\n---\n\n# 한글 규칙 — 끝\n\n두 줄\n'
    writeFiles(repo, { 'docs/knowledge/domain/a.md': text, 'docs/knowledge/domain/b.md': '' })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'k')
    const head = await headCommit(repo)
    const got = await showFiles(repo, head, [
      'docs/knowledge/domain/a.md',
      './docs/knowledge/domain/b.md',
      'docs/knowledge/domain/none.md',
      'docs/knowledge',
    ])
    expect([...got.entries()]).toEqual([
      ['docs/knowledge/domain/a.md', await showFile(repo, head, 'docs/knowledge/domain/a.md')],
      ['docs/knowledge/domain/b.md', ''],
      ['docs/knowledge/domain/none.md', null],
      ['docs/knowledge', null],
    ])
    expect(got.get('docs/knowledge/domain/a.md')).toBe(text)
    expect((await showFiles(repo, head, [])).size).toBe(0)
  })
})

describe('앱 저장소 (I71)', () => {
  it('나만·공유 대기·knowledge.json을 원자적으로 쓰고 읽는다', async () => {
    const store = new KnowledgeStore(storeKnowledgeDir(path.join(root, 'home'), 'p-1'))
    await store.write('pending', entry())
    await store.write('mine', entry({ id: 'recipe-0000000d', kind: 'recipe' }))
    expect((await store.list('pending')).entries.map((e) => e.entry)).toEqual([entry()])
    // 종류를 고쳐 다시 쓰면 옛 종류의 파일을 지운다
    await store.write('pending', entry({ kind: 'failure' }))
    expect((await store.list('pending')).entries.map((e) => e.entry.kind)).toEqual(['failure'])
    await store.remove('pending', 'domain-a1b2c3d4')
    expect((await store.list('pending')).entries).toEqual([])
    expect(await store.index()).toEqual({ schema_version: 1, carried: {} })
    const carried = { work: 'w-1', branch: 'relay/w-1', pr: 3, commit: 'abc', at: 't' }
    await store.saveIndex({ schema_version: 1, carried: { 'domain-a1b2c3d4': carried } })
    expect((await store.index()).carried['domain-a1b2c3d4']).toEqual(carried)
    const leftovers = fs
      .readdirSync(store.dir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})
