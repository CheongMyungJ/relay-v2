// 지식 파일 읽기 (adapters/knowledge, K1): 레포의 지식과 머지되지 않은 앞 Work 브랜치의 지식
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  changedCodePaths,
  changedKnowledge,
  knowledgeFileChanges,
  knowledgePathsAt,
  readPendingKnowledge,
  readRepoKnowledge,
  removedKnowledge,
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

  it('지운 지식, 바꾼 코드, 완료 화면의 지식 변경과 앞 글, 앞 Work가 지운 지식 (D296, D297, D298)', async () => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-')))
    const { repo } = makeRepo(root, 'r', {
      'a.js': '1\n',
      'docs/knowledge/old.md': '# 옛\n- 하나\n',
      'docs/knowledge/d.md': '# 지울 것\n',
      'docs/knowledge/gone.md': '# 앞 Work가 지움\n',
    })
    const base = git(repo, 'rev-parse', 'HEAD')
    // 머지 전 앞 Work: p.md를 더하고 gone.md를 지움
    git(repo, 'checkout', '-q', '-b', 'relay/w-1')
    writeFiles(repo, { 'docs/knowledge/p.md': '# 앞 Work\n- 처음\n' })
    git(repo, 'rm', '-q', 'docs/knowledge/gone.md')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'w1')
    git(repo, 'checkout', '-q', 'main')
    const pending = await readPendingKnowledge(repo, base, [
      { workId: 'w-1', branch: 'relay/w-1', baseCommit: base },
    ])
    expect(pending.map((e) => [e.path, e.removed ?? false])).toEqual([
      ['docs/knowledge/gone.md', true],
      ['docs/knowledge/p.md', false],
    ])

    // 이 Work: old.md 고쳐 커밋, d.md 지움(커밋 안 함), new.md와 p.md는 추적하지 않는 새 파일, 코드 둘
    git(repo, 'checkout', '-q', '-b', 'relay/w-2')
    writeFiles(repo, { 'docs/knowledge/old.md': '# 옛\n- 둘\n', 'a.js': '2\n' })
    git(repo, 'commit', '-q', '-am', 'w2')
    fs.rmSync(path.join(repo, 'docs/knowledge/d.md'))
    writeFiles(repo, {
      'docs/knowledge/new.md': '# 새것\n',
      'docs/knowledge/p.md': '# 앞 Work\n- 이어 씀\n',
      'src/b.js': 'x\n',
    })
    expect(await removedKnowledge(repo, base)).toEqual(['docs/knowledge/d.md'])
    expect(await changedCodePaths(repo, base)).toEqual(['a.js', 'src/b.js'])

    const files = await knowledgeFileChanges(
      repo,
      base,
      null,
      new Map([['docs/knowledge/p.md', 'relay/w-1']]),
    )
    const by = new Map(files.map((f) => [f.path, f]))
    expect([...by.keys()].sort()).toEqual([
      'docs/knowledge/d.md',
      'docs/knowledge/new.md',
      'docs/knowledge/old.md',
      'docs/knowledge/p.md',
    ])
    expect(by.get('docs/knowledge/d.md')).toMatchObject({
      status: 'D',
      text: null,
      before: '# 지울 것',
    })
    expect(by.get('docs/knowledge/new.md')).toMatchObject({
      status: 'A',
      before: null,
      text: '# 새것\n',
    })
    expect(by.get('docs/knowledge/old.md')).toMatchObject({ status: 'M', before: '# 옛\n- 하나' })
    // 앞 Work의 항목을 다시 쓴 것은 그 Work의 글이 앞 글이다
    expect(by.get('docs/knowledge/p.md')).toMatchObject({
      status: 'A',
      before: '# 앞 Work\n- 처음',
    })

    // 커밋끼리 (정리한 Work): 추적하지 않는 파일은 없다
    const head = git(repo, 'rev-parse', 'HEAD')
    expect(
      (await knowledgeFileChanges(repo, base, head, new Map())).map((f) => [f.path, f.status]),
    ).toEqual([['docs/knowledge/old.md', 'M']])
  })

  it('squash·rebase로 머지된 앞 Work의 지식은 넣지 않고, 그 뒤 main에서 고친 글을 덮지 않는다', async () => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-')))
    const { repo } = makeRepo(root, 'r', {
      'a.js': '1\n',
      'docs/knowledge/gone.md': '# 지울 것\n',
    })
    const base = git(repo, 'rev-parse', 'HEAD')
    // 앞 Work: rate.md(1%)를 더하고 gone.md를 지움
    git(repo, 'checkout', '-q', '-b', 'relay/w-1')
    writeFiles(repo, { 'docs/knowledge/rate.md': '# 적립률은 1%\n' })
    git(repo, 'rm', '-q', 'docs/knowledge/gone.md')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'w1')
    const source = [{ workId: 'w-1', branch: 'relay/w-1', baseCommit: base }]
    git(repo, 'checkout', '-q', 'main')
    expect(
      (await readPendingKnowledge(repo, git(repo, 'rev-parse', 'HEAD'), source)).map((e) => e.path),
    ).toEqual(['docs/knowledge/gone.md', 'docs/knowledge/rate.md'])
    // squash 머지: 같은 글을 main에 새 커밋으로 넣는다(브랜치는 조상이 아니다). 그 뒤 main에서 2%로 고친다
    writeFiles(repo, { 'docs/knowledge/rate.md': '# 적립률은 1%\n' })
    git(repo, 'rm', '-q', 'docs/knowledge/gone.md')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'squash w1')
    writeFiles(repo, { 'docs/knowledge/rate.md': '# 적립률은 2%\n' })
    git(repo, 'commit', '-q', '-am', '2%')
    expect(await readPendingKnowledge(repo, git(repo, 'rev-parse', 'HEAD'), source)).toEqual([])
  })
})
