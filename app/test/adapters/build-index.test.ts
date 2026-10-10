// [어댑터] 구성별 빌드 인덱스 (requirements-extraction-flow.md AI 결정 118): 기준 커밋을 별도 폴더로 꺼내 실제 make와
// C 컴파일러로 구성마다 정의된 심볼과 살아 있는 줄을 모은다. make나 cc가 없는 기계에서는 건너뛴다
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inventoryProblems } from '../../../skills/extract/build-index.mjs'
import { buildConfigIndex } from '../../src/adapters/build-index'
import { headCommit } from '../../src/adapters/git'
import { makeRepo } from '../support/repo'
import { BUILD_REPO_FILES } from '../support/requirements'

const has = (bin: string) => spawnSync(bin, ['--version'], { encoding: 'utf8' }).status === 0
const tools = has('make') && has('cc')

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-bi-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe.skipIf(!tools)('[어댑터] 구성별 빌드 인덱스 (AI 결정 118)', () => {
  async function setup(files: Record<string, string> = BUILD_REPO_FILES) {
    const { repo } = makeRepo(tmp, 'fw', files)
    const base = await headCommit(repo)
    // 분석 worktree에 커밋하지 않은 변경이 있어도 기준 커밋을 꺼낸다
    fs.writeFileSync(path.join(repo, 'src', 'tick.c'), 'garbage(\n')
    return { repo, base, dir: path.join(tmp, 'work', 'build-index', 'src') }
  }

  it('make 구성마다 심볼(강한·weak)과 살아 있는 줄을 모은다. 분석 worktree는 건드리지 않는다', async () => {
    const s = await setup()
    const out = await buildConfigIndex({
      worktree: s.repo,
      base: s.base,
      dir: s.dir,
      targets: [
        { name: 'lo', command: 'make lo' },
        { name: 'hi', command: 'make hi' },
      ],
      env: process.env,
    })
    expect(out).toMatchObject({ status: 'built', configs: ['lo', 'hi'], detail: '' })
    const lo = out.index?.configs['lo']
    const hi = out.index?.configs['hi']
    expect(lo?.symbols).toMatchObject({ tick_isr: 'strong', fan_isr: 'weak', main: 'strong' })
    expect(hi?.symbols['tick_isr']).toBeUndefined()
    expect(hi?.symbols['fan_isr']).toBe('strong')
    // tick.c 4번 줄(tick_isr)은 lo에서만 컴파일된다
    const live = (ranges: [number, number][] | undefined, n: number) =>
      (ranges ?? []).some(([a, b]) => a <= n && n <= b)
    expect(live(lo?.lines['src/tick.c'], 4)).toBe(true)
    expect(live(hi?.lines['src/tick.c'], 4)).toBe(false)
    // 별도 체크아웃은 기준 커밋이고, 분석 worktree의 변경은 그대로다
    expect(fs.readFileSync(path.join(s.dir, 'src', 'tick.c'), 'utf8')).toContain('tick_isr')
    expect(fs.readFileSync(path.join(s.repo, 'src', 'tick.c'), 'utf8')).toBe('garbage(\n')
    // survey의 구성 주장을 검사한다(규칙 config_active와 같은 함수)
    expect(
      inventoryProblems(
        {
          inventory: [
            { key: 'c-0002', name: 'tick_isr', configs: ['lo', 'hi'], anchors: [] },
            { key: 'c-0003', name: 'fan_isr', configs: ['all'], anchors: [] },
          ],
        },
        out.index,
      ),
    ).toEqual([
      'inventory c-0002 (tick_isr): configuration hi does not define it',
      'inventory c-0003 (fan_isr): configuration lo has only a weak default definition',
    ])
  })

  it('소스가 컴파일되지 않는 구성은 까닭과 함께 빼고, make가 아닌 명령은 인덱스를 만들지 않는다', async () => {
    const files = {
      ...BUILD_REPO_FILES,
      'src/main.c': '#ifdef BOARD_HI\n#error hi is broken\n#endif\nint main(void) { return 0; }\n',
    }
    const s = await setup(files)
    const out = await buildConfigIndex({
      worktree: s.repo,
      base: s.base,
      dir: s.dir,
      targets: [
        { name: 'lo', command: 'make lo' },
        { name: 'hi', command: 'make hi' },
        { name: 'tool', command: 'node build.js' },
      ],
      env: process.env,
    })
    expect(out.status).toBe('built')
    expect(out.configs).toEqual(['lo'])
    expect(out.detail).toMatch(/hi: src\/main\.c 전처리 실패: .*hi is broken/)
    expect(out.detail).toMatch(/tool: make 계열 명령이 아님/)
    const none = await buildConfigIndex({
      worktree: s.repo,
      base: s.base,
      dir: s.dir,
      targets: [{ name: 'tool', command: 'node build.js' }],
      env: process.env,
    })
    expect(none).toMatchObject({ status: 'unavailable', configs: [], index: null })
  })
})
