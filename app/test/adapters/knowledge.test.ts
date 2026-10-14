// 지식 파일 읽기 (adapters/knowledge, K1): 레포의 지식과 머지되지 않은 앞 Work 브랜치의 지식
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  changedCodePaths,
  changedKnowledge,
  filesAt,
  knowledgeFileChanges,
  knowledgePathsAt,
  namesInCode,
  readKnowledgeAt,
  readPendingKnowledge,
  readRepoKnowledge,
  removedKnowledge,
} from '../../src/adapters/knowledge'
import { git, makeRepo, writeFiles } from '../support/repo'

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

describe('[어댑터] 지식 정리의 커밋 읽기 (D393)', () => {
  it('커밋의 지식 파일과 경로를 읽고, 지식과 문서 밖의 파일에서 낱말로만 이름을 찾는다', async () => {
    root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-knowledge-')))
    const { repo } = makeRepo(root, 'r', {
      'src/vat.js': 'const VAT_RATE_OLD = 1\nconst VAT_RATE = 0.1\n',
      'src/round.js': 'export const roundLineTotal = 1\n',
      'docs/design.md': '옛 함수 legacyRound는 없앴다\n',
      'docs/knowledge/billing/vat.md': '# VAT_RATE와 onlyInKnowledge\n',
      'docs/knowledge/README.md': '# 안내\n',
    })
    git(repo, 'checkout', '-q', '-b', 'later')
    writeFiles(repo, { 'docs/knowledge/billing/later.md': '# 뒤\n' })
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'later')
    git(repo, 'checkout', '-q', 'main')

    const files = await filesAt(repo, 'main')
    expect([...files].sort()).toEqual([
      'docs/design.md',
      'docs/knowledge/README.md',
      'docs/knowledge/billing/vat.md',
      'src/round.js',
      'src/vat.js',
    ])
    // 작업 트리가 아니라 커밋에서 읽는다(지금 체크아웃은 main, 읽는 것은 later)
    const later = await readKnowledgeAt(repo, 'later', await filesAt(repo, 'later'))
    expect(later.map((e) => e.path)).toEqual([
      'docs/knowledge/billing/later.md',
      'docs/knowledge/billing/vat.md',
    ])
    expect(later[1]?.text).toBe('# VAT_RATE와 onlyInKnowledge')

    // -w: VAT_RATE_OLD 안의 VAT_RATE나 roundLineTotal 안의 roundLine은 같은 이름이 아니다
    expect(
      await namesInCode(repo, 'main', ['VAT_RATE', 'roundLine', 'legacyRound', 'onlyInKnowledge']),
    ).toEqual(new Set(['VAT_RATE']))
    // 찾은 것이 없으면(git grep 1) 빈 집합, 이름이 없으면 git을 부르지 않는다
    expect(await namesInCode(repo, 'main', ['nowhere'])).toEqual(new Set())
    expect(await namesInCode(repo, 'no-such-ref', [])).toEqual(new Set())
    // 그 밖의 실패는 빈 집합으로 삼키지 않는다: 모든 anchor가 "코드에 없음"이 되지 않게
    await expect(namesInCode(repo, 'no-such-ref', ['VAT_RATE'])).rejects.toThrow()
  })
})
