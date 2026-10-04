// 지식 파일 읽기 (adapters/knowledge, K1): 레포의 지식과 머지되지 않은 앞 Work 브랜치의 지식
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  changedKnowledge,
  knowledgePathsAt,
  readPendingKnowledge,
  readRepoKnowledge,
} from '../../src/adapters/knowledge'
import { git, makeRepo, writeFiles } from '../flow/repo'

let root: string | undefined
afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true })
  root = undefined
})

describe('[어댑터] 지식 읽기', () => {
  it('레포의 docs/knowledge와, 기준 브랜치에 아직 없는 Work 브랜치의 지식을 읽는다', async () => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-')))
    const { repo } = makeRepo(root, 'r', {
      'a.js': '1\n',
      'docs/knowledge/old.md': '# 옛 지식\n',
      'docs/knowledge/README.md': '# 안내\n',
    })
    const base = git(repo, 'rev-parse', 'HEAD')
    expect((await readRepoKnowledge(repo)).map((e) => e.path)).toEqual(['docs/knowledge/old.md'])
    expect(await readRepoKnowledge(path.join(root, 'none'))).toEqual([])

    // 완료한 Work 1: 지식 하나를 더하고 하나를 고침
    git(repo, 'checkout', '-q', '-b', 'relay/w-1')
    writeFiles(repo, {
      'docs/knowledge/new.md': '# 새 지식\n',
      'docs/knowledge/old.md': '# 옛 지식 고침\n',
      'a.js': '2\n',
    })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'w1')
    // Work 2: 머지됨
    git(repo, 'checkout', '-q', 'main')
    git(repo, 'checkout', '-q', '-b', 'relay/w-2')
    writeFiles(repo, { 'docs/knowledge/merged.md': '# 머지된 지식\n' })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'w2')
    git(repo, 'checkout', '-q', 'main')
    git(repo, 'merge', '-q', '--ff-only', 'relay/w-2')
    const head = git(repo, 'rev-parse', 'HEAD')

    const pending = await readPendingKnowledge(repo, head, [
      { workId: 'w-1', branch: 'relay/w-1', baseCommit: base },
      { workId: 'w-2', branch: 'relay/w-2', baseCommit: base },
      { workId: 'w-3', branch: 'relay/w-3', baseCommit: base },
    ])
    expect(pending.map((e) => [e.path, e.pendingFrom, e.text])).toEqual([
      ['docs/knowledge/new.md', 'w-1', '# 새 지식'],
      ['docs/knowledge/old.md', 'w-1', '# 옛 지식 고침'],
    ])
  })

  it('영역 폴더의 지식, 이 Work가 더하거나 고친 지식(커밋 안 한 것 포함), 커밋의 지식 경로를 읽는다 (D293, D294)', async () => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-')))
    const { repo } = makeRepo(root, 'r', {
      'a.js': '1\n',
      'docs/knowledge/top.md': '# 위\n',
      'docs/knowledge/shipping/fee.md': '# 배송비\n',
      'docs/knowledge/shipping/deep/x.md': '# 너무 깊음\n',
    })
    const base = git(repo, 'rev-parse', 'HEAD')
    expect((await readRepoKnowledge(repo)).map((e) => e.path)).toEqual([
      'docs/knowledge/shipping/fee.md',
      'docs/knowledge/top.md',
    ])
    expect(await knowledgePathsAt(repo, base)).toEqual([
      'docs/knowledge/shipping/fee.md',
      'docs/knowledge/top.md',
    ])
    // 커밋한 고침, 커밋 안 한 새 파일, 지운 파일
    writeFiles(repo, { 'docs/knowledge/shipping/fee.md': '# 배송비 고침\n' })
    git(repo, 'commit', '-q', '-am', 'fee')
    writeFiles(repo, { 'docs/knowledge/returns/box.md': '# 상자마다\n', 'a.js': '2\n' })
    fs.rmSync(path.join(repo, 'docs/knowledge/top.md'))
    expect((await changedKnowledge(repo, base)).map((c) => [c.path, c.text])).toEqual([
      ['docs/knowledge/returns/box.md', '# 상자마다\n'],
      ['docs/knowledge/shipping/fee.md', '# 배송비 고침\n'],
    ])
  })
})
