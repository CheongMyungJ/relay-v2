// [흐름] 곁 세션 (docs/implementation.md M21, 시나리오 11, D385~D390, I127).
// 첫 프롬프트 없이 Work 디렉터리를 붙여 worktree에서 뜨고, 안내는 시스템 프롬프트 파일로 준다. 세션 상한을 거치지 않고
// 다른 동작을 막지 않는다. 첫 요청의 session_id를 적어 다시 열면 --resume으로 잇는다. [Work 정리]가 먼저 끝낸다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WorkView } from '../../src/shared/views'
import type { WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { harness, makeRepo, register, settle, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST, scenario, type Scenario } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

interface Setup {
  h: Harness
  key: string
  /** Work 디렉터리 */
  dir: string
  /** worktree */
  tree: string
}

async function setup(s: Scenario, config: object = {}): Promise<Setup> {
  h = await harness({ scenario: s, config })
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
  const workId = r.workKey.split('/')[1] ?? ''
  return {
    h: hh,
    key: r.workKey,
    dir: path.join(hh.home, 'projects', projectId, 'works', workId),
    tree: path.join(hh.home, 'projects', projectId, 'worktrees', workId),
  }
}

const work = (s: Setup) => JSON.parse(read(path.join(s.dir, 'work.json'))) as WorkState
const view = (s: Setup) => s.h.ui.works.get(s.key)

function until(s: Setup, pred: (w: WorkView) => boolean, label: string) {
  return s.h.ui.until(
    () => {
      const w = view(s)
      return w && pred(w) ? w : null
    },
    label,
    60_000,
  )
}

interface Start {
  args: string[]
  cwd: string
  resume: boolean
  guide: string
}

/** n번째(1부터) 곁 세션의 시작 기록. 가짜 claude는 뜬 뒤에 남긴다 */
async function sideStart(s: Setup, n: number): Promise<Start> {
  const found = await s.h.ui.until(
    () => {
      const all = s.h.records().filter((r) => r['type'] === 'start' && r['side'] === true)
      return all.length >= n ? all[n - 1] : null
    },
    `${n}번째 곁 세션의 기록`,
    30_000,
  )
  return found as unknown as Start
}

/** 끝난 곁 세션의 터미널로 바뀔 때까지 */
const ended = (s: Setup) => until(s, (w) => w.side.status === 'ended', '곁 세션 끝남')

const SIDE: Scenario['side'] = [
  { do: 'waitEnter' },
  { do: 'prompt', text: '원인 분석이 왜 이렇게 나왔어?' },
  { do: 'wait' },
]

describe('곁 세션 (시나리오 11)', () => {
  it('첫 프롬프트 없이 Work 디렉터리를 붙여 뜨고 세션 상한을 거치지 않는다. 다른 동작을 막지 않고, 닫았다 열면 앞 대화를 잇는다 (D385~D390)', async () => {
    const s = await setup({ ...scenario(), side: SIDE }, { session_limit: 1 })
    // intake가 승인 대기로 자리를 차지한다
    await until(s, (w) => w.tasks[0]?.status === 'awaiting_approval', 'intake 승인 대기')
    await settle(s.h, s.key)
    expect(view(s)?.side).toEqual({ terminal: null, status: null, resumable: false, blocked: null })
    expect(await s.h.relay.openSide(s.key, false)).toEqual({ ok: true })
    const opened = await until(s, (w) => w.side.status === 'live', '곁 세션')
    expect(view(s)?.tasks[0]?.live).toBe(true)

    // 첫 프롬프트 없이 Work 디렉터리를 붙이고 안내를 시스템 프롬프트 파일로 준다 (D386)
    const first = await sideStart(s, 1)
    expect(first.args).toHaveLength(9)
    expect(first.args.slice(0, 2)).toEqual(['--dangerously-skip-permissions', '--session-id'])
    const sessionId = first.args[2] ?? ''
    expect(first.args.slice(3)).toEqual([
      '--add-dir',
      s.dir,
      '--settings',
      expect.stringMatching(/side\.settings\.json$/),
      '--append-system-prompt-file',
      expect.stringMatching(/side\.guide\.md$/),
    ])
    expect(fs.realpathSync.native(first.cwd)).toBe(fs.realpathSync.native(s.tree))
    // 안내는 열 때의 지도다 (D387)
    expect(first.guide).toContain(`- Work 디렉터리: ${s.dir}`)
    expect(first.guide).toContain('- t-01 01 의도 정리: 승인 대기, tasks/01-intake/ — 승인 전')
    // push와 gh는 막지 않고, 훅은 UserPromptSubmit 하나다 (D388)
    const settings = JSON.parse(read(first.args[6] ?? '')) as {
      hooks: Record<string, { hooks: { url: string }[] }[]>
      permissions: { deny: string[] }
      autoMemoryEnabled: boolean
    }
    expect(Object.keys(settings.hooks)).toEqual(['UserPromptSubmit'])
    expect(settings.hooks['UserPromptSubmit']?.[0]?.hooks[0]?.url).toMatch(
      /\/hook\/side\/UserPromptSubmit$/,
    )
    expect(settings.permissions.deny.some((r) => r.startsWith('Bash('))).toBe(false)
    expect(settings.permissions.deny.filter((r) => r.endsWith('/tasks/**)'))).toHaveLength(1)
    expect(settings.autoMemoryEnabled).toBe(false)
    // 살아 있는 동안 프로세스를 적는다. 묻기 전이라 대화는 없다 (D389)
    expect(work(s).side?.process?.pid).toBeGreaterThan(0)
    expect(work(s).side?.session_id).toBeUndefined()
    expect(await s.h.relay.openSide(s.key, false)).toEqual({
      ok: false,
      error: '곁 세션이 이미 열려 있음',
    })

    // 사람이 물으면 그 대화를 적는다
    s.h.relay.terminalWrite(opened.side.terminal ?? '', '\r')
    await s.h.ui.until(() => work(s).side?.session_id === sessionId, '대화를 적음')
    await until(s, (w) => w.side.resumable, '이어 갈 대화')

    // 곁 세션이 열려 있어도 승인하고 다음 단계로 간다 (D390). 상한 1이어도 곁 세션은 자리를 차지하지 않는다
    expect(await s.h.relay.approve(s.key, 't-01', {})).toEqual({ ok: true })
    await until(s, (w) => w.tasks[1]?.status === 'awaiting_approval', 'fix 승인 대기')
    expect(view(s)?.side.status).toBe('live')

    // 닫으면 프로세스와 임시 파일을 지우고 대화는 남긴다
    expect(await s.h.relay.closeSide(s.key)).toEqual({ ok: true })
    await ended(s)
    await settle(s.h, s.key)
    expect(work(s).side).toEqual({ session_id: sessionId })
    expect(fs.existsSync(first.args[6] ?? '')).toBe(false)
    expect(fs.existsSync(first.args[8] ?? '')).toBe(false)
    expect(await s.h.relay.closeSide(s.key)).toEqual({
      ok: false,
      error: '곁 세션이 열려 있지 않음',
    })

    // 다시 열면 --resume으로 잇고, 안내는 지금 상태로 새로 만든다 (D386)
    expect(await s.h.relay.openSide(s.key, false)).toEqual({ ok: true })
    const second = await sideStart(s, 2)
    expect(second.resume).toBe(true)
    expect(second.args.slice(1, 3)).toEqual(['--resume', sessionId])
    expect(second.args).toHaveLength(9)
    expect(second.guide).toContain('- t-01 01 의도 정리: 승인됨, tasks/01-intake/\n')
    expect(second.guide).toContain('- t-02 02 원인 분석과 수정: 승인 대기')
    // 열 때마다 새 터미널이다
    const reopened = await until(s, (w) => w.side.status === 'live', '다시 연 곁 세션')
    expect(reopened.side.terminal).not.toBe(opened.side.terminal)

    // [새 대화로 열기]는 새 대화다
    expect(await s.h.relay.closeSide(s.key)).toEqual({ ok: true })
    await ended(s)
    expect(await s.h.relay.openSide(s.key, true)).toEqual({ ok: true })
    const third = await sideStart(s, 3)
    expect(third.args[1]).toBe('--session-id')
    expect(third.args[2]).not.toBe(sessionId)
    // 앞 대화는 새 대화에서 묻기 전까지 그대로다
    expect(work(s).side?.session_id).toBe(sessionId)
    // 곁 세션은 task가 아니다
    expect(work(s).tasks.map((t) => t.id)).toEqual(['t-01', 't-02'])
  })

  it('묻지 않고 닫은 대화는 적지 않는다. 이어 갈 대화를 찾지 못하면 끝난 터미널로 남는다 (D389)', async () => {
    const s = await setup({ ...scenario(), side: SIDE })
    await until(s, (w) => w.tasks[0]?.status === 'awaiting_approval', 'intake 승인 대기')
    // 묻지 않고 닫으면 적을 대화가 없다
    expect(await s.h.relay.openSide(s.key, false)).toEqual({ ok: true })
    await sideStart(s, 1)
    expect(await s.h.relay.closeSide(s.key)).toEqual({ ok: true })
    await ended(s)
    await settle(s.h, s.key)
    expect(work(s).side).toBeUndefined()
    expect(view(s)?.side.resumable).toBe(false)

    // 물은 대화가 claude에 없으면(지워짐 등) claude가 끝나고, 끝난 터미널로 남는다
    expect(await s.h.relay.openSide(s.key, false)).toEqual({ ok: true })
    const second = await sideStart(s, 2)
    expect(second.args[1]).toBe('--session-id')
    const live = await until(s, (w) => w.side.status === 'live', '곁 세션')
    s.h.relay.terminalWrite(live.side.terminal ?? '', '\r')
    const sessionId = second.args[2] ?? ''
    await s.h.ui.until(() => work(s).side?.session_id === sessionId, '대화를 적음')
    expect(await s.h.relay.closeSide(s.key)).toEqual({ ok: true })
    await ended(s)
    fs.rmSync(path.join(s.h.root, 'record', 'sessions', `${sessionId}.json`))
    expect(await s.h.relay.openSide(s.key, false)).toEqual({ ok: true })
    const gone = await until(
      s,
      (w) => w.side.status === 'ended' && w.side.terminal !== live.side.terminal,
      '이어 갈 대화가 없어 끝남',
    )
    expect(s.h.ui.output.get(gone.side.terminal ?? '')).toContain(
      `No conversation found with session ID: ${sessionId}`,
    )
    await settle(s.h, s.key)
    // 대화 기록은 사람이 [새 대화로 열기]를 고를 때까지 둔다
    expect(work(s).side).toEqual({ session_id: sessionId })
    expect(view(s)?.side.resumable).toBe(true)
  })

  it('[Work 정리]는 곁 세션을 먼저 끝낸다. 보관된 Work에서는 열지 않는다 (D385, D390)', async () => {
    const s = await setup({ ...scenario(), side: [{ do: 'wait' }] })
    const paused = await drive(s.h.relay, s.h.ui, s.key, {
      pauseAt: (t) => t.node === 'verify' && t.status === 'awaiting_approval',
    })
    expect(paused, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    expect(await s.h.relay.deliver(s.key, { choice: 'push', uncommitted: null })).toEqual({
      ok: true,
    })
    await settle(s.h, s.key)
    expect(work(s).status).toBe('completed')
    // 완료한 Work에서도 연다
    expect(await s.h.relay.openSide(s.key, false)).toEqual({ ok: true })
    await until(s, (w) => w.side.status === 'live', '곁 세션')
    const pid = work(s).side?.process?.pid ?? 0
    const r = await s.h.relay.cleanPreview(s.key)
    if (!r.ok) throw new Error(r.error)
    // 정리가 끝낼 살아 있는 세션으로 센다
    expect(r.preview.live).toBe(1)
    expect(
      await s.h.relay.clean(s.key, {
        deleteBranch: false,
        deleteBackups: true,
        confirmed: true,
        expect: r.preview.expect,
      }),
    ).toEqual({ ok: true })
    await settle(s.h, s.key)
    expect(work(s).status).toBe('archived')
    expect(work(s).side).toBeUndefined()
    expect(alive(pid)).toBe(false)
    expect(view(s)?.side).toMatchObject({ status: 'ended', blocked: expect.stringMatching(/보관/) })
    expect(await s.h.relay.openSide(s.key, false)).toEqual({
      ok: false,
      error: '보관된 Work는 worktree가 없어 곁 세션을 열 수 없음',
    })
  })
})

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
