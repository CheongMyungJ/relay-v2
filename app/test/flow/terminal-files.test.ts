// [흐름] 터미널의 파일 열기와 붙여넣은 그림 (D410, D411). 터미널 출력의 경로는 그 터미널의 폴더(Work는 worktree, 기본
// 세션은 고른 폴더)에서 풀고 있는 것만 받는다. 붙여넣은 그림은 RELAY_HOME/pastes/에 저장하고 오래된 것은 지운다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST, scenario } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

describe('터미널의 파일 (D410, D411)', () => {
  it('Work 터미널은 worktree에서, 기본 세션은 그 폴더에서 경로를 푼다. 없는 것과 모르는 터미널은 null이다', async () => {
    h = await harness({ scenario: scenario() })
    const hh = h
    const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
    const tree = path.join(
      hh.home,
      'projects',
      projectId,
      'worktrees',
      r.workKey.split('/')[1] ?? '',
    )

    const found = await hh.relay.terminalPaths(`${r.workKey}/t-01`, [
      'src/avg.js',
      'src',
      'src/none.js',
      path.join(tree, 'package.json'),
    ])
    expect(found).toEqual([
      { path: path.join(tree, 'src', 'avg.js'), dir: false, executable: false },
      { path: path.join(tree, 'src'), dir: true, executable: false },
      null,
      { path: path.join(tree, 'package.json'), dir: false, executable: false },
    ])

    const cwd = fs.mkdtempSync(path.join(hh.root, 'session-'))
    fs.writeFileSync(path.join(cwd, 'notes.md'), '# 메모\n')
    fs.writeFileSync(path.join(cwd, 'run.sh'), '#!/bin/sh\n')
    fs.chmodSync(path.join(cwd, 'run.sh'), 0o755)
    const created = await hh.relay.createSession(cwd)
    if (!created.ok) throw new Error(`세션 생성 실패: ${created.error}`)
    const terminal = await hh.ui.until(
      () => hh.ui.session(created.id)?.terminal ?? null,
      '기본 세션의 터미널',
      30_000,
    )
    expect(await hh.relay.terminalPaths(terminal, ['notes.md', 'src/avg.js', 'run.sh'])).toEqual([
      { path: path.join(cwd, 'notes.md'), dir: false, executable: false },
      null,
      // Windows는 실행 권한이 없어 확장자로 가른다(.sh는 Windows에서 실행 파일이 아님)
      { path: path.join(cwd, 'run.sh'), dir: false, executable: process.platform !== 'win32' },
    ])
    // 링크는 가리키는 파일로도 본다: 이름이 .md여도 실행 파일을 가리키면 열지 않는다 (D412)
    if (process.platform !== 'win32') {
      fs.writeFileSync(path.join(cwd, 'app.desktop'), '[Desktop Entry]\n')
      fs.symlinkSync(path.join(cwd, 'app.desktop'), path.join(cwd, 'guide.md'))
      expect(await hh.relay.terminalPaths(terminal, ['guide.md'])).toEqual([
        { path: path.join(cwd, 'guide.md'), dir: false, executable: true },
      ])
    }
    expect(await hh.relay.terminalPaths('sessions/none/x', ['notes.md'])).toEqual([null])
  })

  it('붙여넣은 그림은 RELAY_HOME/pastes/에 저장하고, 저장할 때 7일 지난 것을 지운다', async () => {
    h = await harness({ scenario: scenario() })
    const hh = h
    const dir = path.join(hh.home, 'pastes')
    fs.mkdirSync(dir, { recursive: true })
    const old = path.join(dir, 'paste-old.png')
    const recent = path.join(dir, 'paste-recent.png')
    fs.writeFileSync(old, 'x')
    fs.writeFileSync(recent, 'x')
    const day = 24 * 60 * 60 * 1000
    fs.utimesSync(old, new Date(Date.now() - 8 * day), new Date(Date.now() - 8 * day))
    fs.utimesSync(recent, new Date(Date.now() - 6 * day), new Date(Date.now() - 6 * day))

    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const first = await hh.relay.savePaste(png, 'png')
    const second = await hh.relay.savePaste(png, 'png')
    expect(path.dirname(first)).toBe(dir)
    expect(path.basename(first)).toMatch(/^paste-\d{8}-\d{6}-[0-9a-f]{8}\.png$/)
    expect(second).not.toBe(first)
    expect(fs.readFileSync(first)).toEqual(Buffer.from(png))
    expect(fs.existsSync(old)).toBe(false)
    expect(fs.existsSync(recent)).toBe(true)
  })
})
