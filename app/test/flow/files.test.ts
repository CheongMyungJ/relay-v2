// [흐름] Work의 [파일] 탭 (D464~D468): 명령이 그 Work의 worktree를 보고, 정리한 Work는 worktree가 없다고 답한다. 경로
// 검사, 링크, 줄 끝, 바뀐 파일 알리기의 세부는 [어댑터] `test/adapters/files.test.ts`가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, settle, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST, scenario } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

describe('[파일] 탭 (D464~D468)', () => {
  it('Work의 worktree를 읽고 고친다. 정리한 Work와 없는 Work는 worktree가 없다', async () => {
    h = await harness({ scenario: scenario() })
    const hh = h
    const { repo } = makeRepo(hh.root, 'sample', { ...REPO_FILES, 'README.md': '# 샘플\n' })
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
    const key = r.workKey
    const tree = path.join(hh.home, 'projects', projectId, 'worktrees', key.split('/')[1] ?? '')
    await settle(hh, key)

    const root = await hh.relay.workFiles(key, '')
    expect(root).toMatchObject({ ok: true, more: 0 })
    expect(root.ok && root.entries.map((e) => e.name)).toEqual(
      expect.arrayContaining(['src', 'test', 'README.md', 'package.json']),
    )
    expect(await hh.relay.workFiles(key, 'src')).toEqual({
      ok: true,
      entries: [{ name: 'avg.js', kind: 'file' }],
      more: 0,
    })
    const opened = await hh.relay.readWorkFile(key, 'README.md')
    if (!opened.ok || opened.kind !== 'text') throw new Error('글이어야 함')
    expect(opened.text).toBe('# 샘플\n')
    // 메인 체크아웃이 아니라 worktree를 고친다
    expect(await hh.relay.saveWorkFile(key, 'README.md', '# 고침\n', opened.hash)).toMatchObject({
      ok: true,
    })
    expect(fs.readFileSync(path.join(tree, 'README.md'), 'utf8')).toBe('# 고침\n')
    expect(fs.readFileSync(path.join(repo, 'README.md'), 'utf8')).toBe('# 샘플\n')
    expect(await hh.relay.saveWorkFile(key, 'README.md', '# 또\n', opened.hash)).toMatchObject({
      ok: false,
      conflict: true,
    })
    expect(await hh.relay.workFiles('none/w-1', '')).toEqual({
      ok: false,
      error: 'worktree가 없습니다 (정리한 Work)',
    })

    // [Work 포기] 뒤 [Work 정리]로 worktree를 지운다
    expect(await hh.relay.abandon(key)).toEqual({ ok: true })
    await settle(hh, key)
    const preview = await hh.relay.cleanPreview(key)
    if (!preview.ok) throw new Error(preview.error)
    expect(
      await hh.relay.clean(key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: true,
        expect: preview.preview.expect,
      }),
    ).toEqual({ ok: true })
    await settle(hh, key)
    expect(hh.ui.works.get(key)?.status).toBe('archived')
    expect(await hh.relay.workFiles(key, '')).toEqual({
      ok: false,
      error: 'worktree가 없습니다 (정리한 Work)',
    })
    expect(await hh.relay.readWorkFile(key, 'README.md')).toMatchObject({ ok: false })
    expect(await hh.relay.saveWorkFile(key, 'README.md', 'x', null)).toMatchObject({ ok: false })
  })
})
