// [흐름] 터미널의 파일 열기와 붙여넣은 그림 (D410~D412). 터미널 출력의 경로는 그 터미널의 폴더(Work는 worktree, 기본
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

describe('터미널의 파일 (D410~D412)', () => {
  it('Work 터미널은 worktree에서, 기본 세션은 그 폴더에서 경로를 푼다. 안전한 형식만 열고 나머지는 폴더에서 보여 준다', async () => {
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

    // 낱말마다 처음으로 있는 시도의 번호 (붙은 조사를 뗀 것 등)
    const work = `${r.workKey}/t-01`
    expect(
      await hh.relay.terminalPaths(work, [
        ['src/avg.js'],
        ['src를', 'src'],
        ['src/none.js'],
        [path.join(tree, 'package.json')],
      ]),
    ).toEqual([0, 1, null, 0])
    expect(await hh.relay.terminalTarget(work, 'src/avg.js')).toEqual({
      path: path.join(tree, 'src', 'avg.js'),
      open: true,
    })
    expect(await hh.relay.terminalTarget(work, 'src')).toEqual({
      path: path.join(tree, 'src'),
      open: true,
    })
    expect(await hh.relay.terminalTarget(work, 'src/none.js')).toBeNull()

    const cwd = fs.mkdtempSync(path.join(hh.root, 'session-'))
    fs.writeFileSync(path.join(cwd, 'notes.md'), '# 메모\n')
    fs.writeFileSync(path.join(cwd, 'tool.py'), 'print(1)\n')
    fs.writeFileSync(path.join(cwd, 'run.md'), '#!/bin/sh\n')
    fs.chmodSync(path.join(cwd, 'run.md'), 0o755)
    const created = await hh.relay.createSession(cwd)
    if (!created.ok) throw new Error(`세션 생성 실패: ${created.error}`)
    const terminal = await hh.ui.until(
      () => hh.ui.session(created.id)?.terminal ?? null,
      '기본 세션의 터미널',
      30_000,
    )
    expect(await hh.relay.terminalPaths(terminal, [['notes.md'], ['src/avg.js']])).toEqual([
      0,
      null,
    ])
    expect(await hh.relay.terminalTarget(terminal, 'notes.md')).toEqual({
      path: path.join(cwd, 'notes.md'),
      open: true,
    })
    // 안전한 형식이 아니면 폴더에서 보여 준다 (D412): Windows의 .py, Linux의 실행 권한
    expect(await hh.relay.terminalTarget(terminal, 'tool.py')).toEqual({
      path: path.join(cwd, 'tool.py'),
      open: process.platform !== 'win32',
    })
    expect(await hh.relay.terminalTarget(terminal, 'run.md')).toEqual({
      path: path.join(cwd, 'run.md'),
      open: process.platform === 'win32',
    })
    // 링크는 가리키는 파일로도 본다: 이름이 .md여도 열지 않는 것을 가리키면 그 자리를 보여 준다
    if (process.platform !== 'win32') {
      fs.writeFileSync(path.join(cwd, 'app.desktop'), '[Desktop Entry]\n')
      fs.symlinkSync(path.join(cwd, 'app.desktop'), path.join(cwd, 'guide.md'))
      expect(await hh.relay.terminalTarget(terminal, 'guide.md')).toEqual({
        path: path.join(cwd, 'guide.md'),
        open: false,
      })
      fs.symlinkSync(path.join(cwd, 'notes.md'), path.join(cwd, 'memo.md'))
      expect(await hh.relay.terminalTarget(terminal, 'memo.md')).toEqual({
        path: path.join(cwd, 'notes.md'),
        open: true,
      })
    }
    expect(await hh.relay.terminalPaths('sessions/none/x', [['notes.md']])).toEqual([null])
    expect(await hh.relay.terminalTarget('sessions/none/x', 'notes.md')).toBeNull()
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
