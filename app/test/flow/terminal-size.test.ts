// [흐름] 터미널 조각과 지난 출력의 PTY 크기 (I189). 숨은 탭의 xterm이 PTY와 같은 크기로 그리게, main은 PTY를 띄운 크기와
// 바꾼 크기를 조각과 지난 출력에 붙인다. xterm 쪽은 [단위] terminal-size.test.ts가 본다
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST, scenario } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

describe('터미널의 PTY 크기 (I189)', () => {
  it('조각과 지난 출력에 PTY 크기가 붙고, 크기를 바꾸면 그 뒤로 바뀐 크기가 붙는다', async () => {
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
    const key = `${r.workKey}/t-01`
    const out = () => hh.ui.output.get(key) ?? ''
    await hh.ui.until(() => out().includes('FAKE-CLAUDE READY'), '첫 세션의 출력')

    // 탭이 크기를 보내기 전에는 앱의 기본 크기로 띄운다
    expect(hh.ui.sizes.get(key)).toEqual({ cols: 120, rows: 32 })
    expect(await hh.relay.terminalAttach(key)).toMatchObject({
      live: true,
      size: { cols: 120, rows: 32 },
    })

    hh.relay.terminalResize(key, 100, 30)
    await hh.ui.until(() => out().includes('SIZE 100x30'), 'CLI가 받은 바뀐 크기')
    expect(hh.ui.sizes.get(key)).toEqual({ cols: 100, rows: 30 })
    expect((await hh.relay.terminalAttach(key)).size).toEqual({ cols: 100, rows: 30 })
  })
})
