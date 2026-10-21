// [흐름] 기본 세션 (docs/implementation.md M23, 시나리오 12, D397~D406).
// 프로젝트나 Work 없이 고른 폴더에서 첫 프롬프트 없이 뜨고, RELAY_HOME을 붙이고 안내는 시스템 프롬프트 파일로 준다. 세션
// 상한을 거치지 않고 여럿을 동시에 연다. 첫 요청으로 이름과 대화를 적어 다시 열면 --resume으로 잇는다. 세션의
// work-drafts/에 쓴 초안은 카드가 되고, 그 초안으로 Work를 만들면 지운다. 재시작 때 살아남은 프로세스를 끝낸다.
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  isAlive,
  killOrphans,
  listProcesses,
  processStartTime,
  processTree,
  type ProcessRecord,
} from '../../src/adapters/pty'
import type { SessionRecord } from '../../src/shared/session'
import type { SessionView } from '../../src/shared/views'
import { harness, makeRepo, register, sleep, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST, scenario, type Scenario } from '../support/scenarios'

let h: Harness | undefined
const children: ChildProcess[] = []
const recorded: ProcessRecord[] = []

afterEach(async () => {
  for (const child of children.splice(0)) child.kill('SIGKILL')
  await killOrphans(recorded.splice(0))
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')
const TREE = path.resolve(__dirname, '../support/fixtures/tree.mjs')
/** 프로세스 목록과 시작 시각을 읽는 OS (I20, I33) */
const listing = process.platform === 'win32' || process.platform === 'linux'

const record = (hh: Harness, id: string) =>
  JSON.parse(read(path.join(hh.home, 'sessions', id, 'session.json'))) as SessionRecord

function until(hh: Harness, id: string, pred: (s: SessionView) => boolean, label: string) {
  return hh.ui.until(
    () => {
      const s = hh.ui.session(id)
      return s && pred(s) ? s : null
    },
    label,
    30_000,
  )
}

interface Start {
  args: string[]
  cwd: string
  resume: boolean
  guide: string
}

/** n번째(1부터) 기본 세션의 시작 기록. 가짜 claude는 뜬 뒤에 남긴다 */
async function sessionStart(hh: Harness, n: number): Promise<Start> {
  const found = await hh.ui.until(
    () => {
      const all = hh.records().filter((r) => r['type'] === 'start' && r['session'] === true)
      return all.length >= n ? all[n - 1] : null
    },
    `${n}번째 기본 세션의 기록`,
    30_000,
  )
  return found as unknown as Start
}

async function create(hh: Harness, cwd: string): Promise<string> {
  const r = await hh.relay.createSession(cwd)
  if (!r.ok) throw new Error(`세션 생성 실패: ${r.error}`)
  return r.id
}

/** 사람이 Enter를 누르면 묻는다 */
const ASK = (text: string): Scenario['session'] => [
  { do: 'waitEnter' },
  { do: 'prompt', text },
  { do: 'wait' },
]

describe('기본 세션 (시나리오 12)', () => {
  it('프로젝트 없이 기본 폴더에서 첫 프롬프트 없이 뜨고, 첫 요청으로 이름과 대화를 적는다. 닫았다 열면 잇고 [새 대화로 열기]는 이름을 둔다 (D397~D403)', async () => {
    h = await harness({
      scenario: { ...scenario(), session: ASK('로그인 버그를 어떤 Work로 맡길까?\n자세히는') },
    })
    const hh = h
    expect(hh.relay.snapshot().sessions).toEqual([])
    // 설정이 빈 글이면 <RELAY_HOME>/home/이고 없으면 만든다 (D398)
    expect(hh.relay.defaultSessionDir()).toBe(path.join(hh.home, 'home'))
    const id = await create(hh, '')
    expect(id).toMatch(/^s-\d{8}-001$/)
    const live = await until(hh, id, (s) => s.status === 'live', '기본 세션')
    expect(live).toMatchObject({
      name: '새 세션',
      cwd: path.join(hh.home, 'home'),
      engineLabel: 'Claude Code',
      resumable: false,
      drafts: [],
    })

    // 첫 프롬프트 없이 RELAY_HOME을 붙이고 안내를 시스템 프롬프트 파일로 준다 (D399)
    const first = await sessionStart(hh, 1)
    expect(first.args).toHaveLength(9)
    expect(first.args.slice(0, 2)).toEqual(['--dangerously-skip-permissions', '--session-id'])
    const sessionId = first.args[2] ?? ''
    expect(first.args.slice(3)).toEqual([
      '--add-dir',
      hh.home,
      '--settings',
      expect.stringMatching(/session\.settings\.json$/),
      '--append-system-prompt-file',
      expect.stringMatching(/session\.guide\.md$/),
    ])
    expect(fs.realpathSync.native(first.cwd)).toBe(path.join(hh.home, 'home'))
    // 안내는 열 때의 지도다 (D400). 프로젝트가 없다
    expect(first.guide).toContain(`- RELAY_HOME: ${hh.home}`)
    expect(first.guide).toContain(
      `- 이 세션의 Work 초안 폴더: ${path.join(hh.home, 'sessions', id, 'work-drafts')}`,
    )
    expect(first.guide).toContain('등록한 프로젝트가 없음')
    // push와 gh는 막지 않고, 훅은 UserPromptSubmit 하나다. 자동 메모리는 CLI 설정을 따른다 (D401)
    const settings = JSON.parse(read(first.args[6] ?? '')) as {
      hooks: Record<string, { hooks: { url: string }[] }[]>
      permissions: { deny: string[] }
    }
    expect(Object.keys(settings.hooks)).toEqual(['UserPromptSubmit'])
    expect(settings.hooks['UserPromptSubmit']?.[0]?.hooks[0]?.url).toMatch(
      /\/hook\/session\/UserPromptSubmit$/,
    )
    expect(settings.permissions.deny).toHaveLength(3)
    expect(settings).not.toHaveProperty('autoMemoryEnabled')
    // 살아 있는 동안 프로세스를 적는다. 묻기 전이라 이름과 대화는 없다 (D402)
    expect(record(hh, id)).toMatchObject({
      id,
      cwd: path.join(hh.home, 'home'),
      process: { pid: expect.any(Number) },
    })
    expect(record(hh, id).session_id).toBeUndefined()
    expect(await hh.relay.openSession(id, false)).toEqual({
      ok: false,
      error: '기본 세션이 이미 열려 있음',
    })

    // 사람이 물으면 첫 줄을 20자로 잘라 이름을 짓고 대화를 적는다 (D403)
    hh.relay.terminalWrite(live.terminal ?? '', '\r')
    await until(hh, id, (s) => s.resumable, '대화를 적음')
    expect(record(hh, id)).toMatchObject({
      name: '로그인 버그를 어떤 Work로 맡길까…',
      named_by: 'app',
      session_id: sessionId,
      engine: 'claude',
    })
    expect(hh.ui.session(id)?.name).toBe('로그인 버그를 어떤 Work로 맡길까…')

    // 닫으면 프로세스와 임시 파일을 지우고 대화는 남긴다
    expect(await hh.relay.closeSession(id)).toEqual({ ok: true })
    await until(hh, id, (s) => s.status === 'ended', '기본 세션 끝남')
    expect(record(hh, id).process).toBeUndefined()
    expect(fs.existsSync(first.args[6] ?? '')).toBe(false)
    expect(fs.existsSync(first.args[8] ?? '')).toBe(false)

    // 다시 열면 --resume으로 잇는다
    expect(await hh.relay.openSession(id, false)).toEqual({ ok: true })
    const second = await sessionStart(hh, 2)
    expect(second.args.slice(1, 3)).toEqual(['--resume', sessionId])
    const reopened = await until(hh, id, (s) => s.status === 'live', '다시 연 기본 세션')
    expect(reopened.terminal).not.toBe(live.terminal)

    // [새 대화로 열기]는 새 대화다. 앱이 짓는 이름은 한 번뿐이다
    expect(await hh.relay.closeSession(id)).toEqual({ ok: true })
    await until(hh, id, (s) => s.status === 'ended', '기본 세션 끝남')
    fs.writeFileSync(
      path.join(hh.root, 'scenario.json'),
      JSON.stringify({ ...scenario(), session: ASK('다른 일') }),
    )
    expect(await hh.relay.openSession(id, true)).toEqual({ ok: true })
    const third = await sessionStart(hh, 3)
    expect(third.args[1]).toBe('--session-id')
    expect(third.args[2]).not.toBe(sessionId)
    const fresh = await until(hh, id, (s) => s.status === 'live', '새 대화')
    hh.relay.terminalWrite(fresh.terminal ?? '', '\r')
    await hh.ui.until(() => record(hh, id).session_id === third.args[2], '새 대화를 적음')
    expect(record(hh, id).name).toBe('로그인 버그를 어떤 Work로 맡길까…')

    // 사람이 바꾼 이름(20자 제한)은 그대로 둔다. 열린 세션은 지우지 않는다
    expect(
      await hh.relay.renameSession(id, '  배포 스크립트 정리와 문서 손보기 그리고 더  '),
    ).toEqual({ ok: true })
    expect(record(hh, id)).toMatchObject({
      name: '배포 스크립트 정리와 문서 손보기 그…',
      named_by: 'human',
    })
    expect(await hh.relay.deleteSession(id)).toMatchObject({ ok: false })
    expect(await hh.relay.closeSession(id)).toEqual({ ok: true })
    expect(await hh.relay.deleteSession(id)).toEqual({ ok: true })
    expect(fs.existsSync(path.join(hh.home, 'sessions', id))).toBe(false)
    expect(hh.ui.sessionList).toEqual([])
  })

  it('세션 상한이 1이고 task가 돌아도 바로 뜨고, 두 세션을 동시에 연다. 고른 폴더가 없어지면 열지 않는다 (D397, D398, D406)', async () => {
    h = await harness({
      scenario: { ...scenario(), session: [{ do: 'wait' }] },
      config: { session_limit: 1 },
    })
    const hh = h
    const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
    const projectId = await register(hh, repo)
    const w = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!w.ok) throw new Error(w.error)
    await hh.ui.until(
      () => hh.ui.works.get(w.workKey)?.tasks[0]?.status === 'awaiting_approval',
      'intake 승인 대기',
    )
    const dir = path.join(hh.root, 'scratch')
    fs.mkdirSync(dir)
    const a = await create(hh, dir)
    const b = await create(hh, '')
    await until(hh, a, (s) => s.status === 'live', '첫 세션')
    await until(hh, b, (s) => s.status === 'live', '둘째 세션')
    // 최근에 만든 것이 앞이다 (D405)
    expect(hh.ui.sessionList.map((s) => s.id)).toEqual([b, a])
    expect(hh.relay.hasLiveSessions()).toBe(true)
    // 두 세션은 각자 고른 폴더에서 뜬다. 가짜 claude가 기록을 남기는 차례는 정해져 있지 않아 폴더로 찾는다
    await sessionStart(hh, 2)
    const starts = hh
      .records()
      .filter((r) => r['type'] === 'start' && r['session'] === true) as unknown as Start[]
    expect(starts.map((x) => fs.realpathSync.native(x.cwd)).sort()).toEqual(
      [fs.realpathSync.native(dir), path.join(hh.home, 'home')].sort(),
    )
    // 안내에 프로젝트와 Work가 있다 (D400)
    for (const { guide } of starts) {
      expect(guide).toContain(`(id: ${projectId})`)
      expect(guide).toContain(`- ${w.workKey.split('/')[1]} "`)
    }
    // intake는 승인 대기로 자리를 차지한 채이고 대기열은 비어 있다
    expect(hh.ui.works.get(w.workKey)?.tasks[0]?.live).toBe(true)

    // 고른 폴더가 없어지면 띄우지 않고 까닭을 보인다 (D398)
    expect(await hh.relay.closeSession(a)).toEqual({ ok: true })
    fs.rmSync(dir, { recursive: true })
    expect(await hh.relay.openSession(a, false)).toEqual({
      ok: false,
      error: expect.stringContaining(`폴더가 없어 열지 않음: ${dir}`),
    })
    // 없는 폴더로는 만들지 않는다
    expect(await hh.relay.createSession(dir)).toEqual({ ok: false, error: `폴더가 없음: ${dir}` })
  })

  it('세션의 work-drafts/에 쓴 초안은 카드가 되고 형식 오류를 보인다. 그 초안으로 Work를 만들면 지우고, [버리기]도 지운다 (D404)', async () => {
    h = await harness({ scenario: { ...scenario(), session: [{ do: 'wait' }] } })
    const hh = h
    const id = await create(hh, '')
    await until(hh, id, (s) => s.status === 'live', '기본 세션')
    const drafts = path.join(hh.home, 'sessions', id, 'work-drafts')
    // 프로젝트를 등록하기 전의 초안은 모르는 프로젝트다
    fs.writeFileSync(
      path.join(drafts, 'fix-avg.md'),
      `---\nproject: sample-x\ntype: bugfix\n---\n${REQUEST}\n`,
    )
    const unknown = await until(hh, id, (s) => s.drafts.length === 1, '초안 카드')
    expect(unknown.drafts[0]).toMatchObject({
      project: null,
      type: 'bugfix',
      errors: ['모르는 프로젝트: sample-x'],
    })
    const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
    const projectId = await register(hh, repo)
    fs.writeFileSync(
      path.join(drafts, 'fix-avg.md'),
      `---\nproject: ${projectId}\ntype: bugfix\nbase: main\n---\n${REQUEST}\n`,
    )
    fs.writeFileSync(path.join(drafts, 'empty.md'), `---\nproject: ${projectId}\ntype: nope\n---\n`)
    const cards = await until(
      hh,
      id,
      (s) => s.drafts.length === 2 && s.drafts[1]?.project === projectId,
      '초안 카드 둘',
    )
    expect(cards.drafts[0]).toMatchObject({
      ref: { source: { kind: 'session', id }, name: 'empty.md' },
      errors: [expect.stringContaining('모르는 유형: nope'), '요청(본문)이 비어 있음'],
    })
    expect(cards.drafts[1]).toMatchObject({
      ref: { source: { kind: 'session', id }, name: 'fix-avg.md' },
      project: projectId,
      type: 'bugfix',
      base: 'main',
      request: REQUEST.trim(),
      errors: [],
    })

    // 그 초안으로 Work를 만들면 앱이 초안을 지운다
    const card = cards.drafts[1]
    if (!card) throw new Error('카드 없음')
    const w = await hh.relay.createWork(projectId, {
      request: card.request,
      type: 'bugfix',
      baseBranch: card.base ?? 'main',
      baseLocation: 'local',
      draft: card.ref,
    })
    expect(w).toMatchObject({ ok: true })
    expect(fs.existsSync(path.join(drafts, 'fix-avg.md'))).toBe(false)
    await until(hh, id, (s) => s.drafts.length === 1, '만든 초안을 지움')
    // [버리기]
    expect(
      await hh.relay.discardDraft({ source: { kind: 'session', id }, name: 'empty.md' }),
    ).toEqual({ ok: true })
    await until(hh, id, (s) => s.drafts.length === 0, '버림')
    expect(
      await hh.relay.discardDraft({ source: { kind: 'session', id }, name: '../session.json' }),
    ).toMatchObject({ ok: false })
    expect(fs.existsSync(path.join(hh.home, 'sessions', id, 'session.json'))).toBe(true)
  })

  it('초안 폴더의 감시를 놓쳐도 다음 요청 때 다시 읽어 카드가 생긴다 (I140)', async () => {
    h = await harness({ scenario: { ...scenario(), session: ASK('초안 써 줘') } })
    const hh = h
    const id = await create(hh, '')
    const live = await until(hh, id, (s) => s.status === 'live', '기본 세션')
    // 폴더를 옮기고 새로 만들면 감시는 옮긴 폴더에 남는다(fs.watch는 알리지 않음)
    const drafts = path.join(hh.home, 'sessions', id, 'work-drafts')
    fs.renameSync(drafts, `${drafts}.old`)
    fs.mkdirSync(drafts)
    // 옮김 자체는 옛 감시가 알릴 수 있다. 그 다시 읽기가 지나간 뒤에 쓴다
    await sleep(1000)
    fs.writeFileSync(path.join(drafts, 'a.md'), '---\nproject: x\ntype: bugfix\n---\n요청\n')
    await sleep(1000)
    expect(hh.ui.session(id)?.drafts).toEqual([])
    // 사람이 요청하면 다시 걸고 읽는다
    hh.relay.terminalWrite(live.terminal ?? '', '\r')
    await until(hh, id, (s) => s.drafts.length === 1, '다음 요청 뒤의 카드')
    // 다시 건 감시가 이후의 초안을 본다
    fs.writeFileSync(path.join(drafts, 'b.md'), '---\nproject: x\ntype: bugfix\n---\n요청\n')
    await until(hh, id, (s) => s.drafts.length === 2, '다시 건 감시의 카드')
  })

  it('만들었지만 띄우지 못하면 세션은 남고 그 id와 까닭을 돌려준다. 지우는 중에 들어온 명령은 기록을 되살리지 않는다 (I138, D402)', async () => {
    h = await harness({ env: { CLAUDE_BIN: path.join(os.tmpdir(), 'relay-no-claude', 'claude') } })
    const hh = h
    const r = await hh.relay.createSession('')
    if (r.ok || !r.id) throw new Error(`띄우지 못한 결과가 아님: ${JSON.stringify(r)}`)
    expect(r.error).toContain('기본 세션을 열지 못함')
    expect(hh.ui.sessionList.map((s) => s.id)).toEqual([r.id])
    expect(record(hh, r.id)).toMatchObject({ id: r.id, cwd: path.join(hh.home, 'home') })
    expect(fs.existsSync(path.join(hh.home, 'sessions', r.id, 'work-drafts'))).toBe(true)
    // [지우기] 바로 뒤에 줄에 들어온 [이름 바꾸기]는 지운 세션을 되살리지 않는다
    const [removed, renamed] = await Promise.all([
      hh.relay.deleteSession(r.id),
      hh.relay.renameSession(r.id, '늦은 이름'),
    ])
    expect(removed).toEqual({ ok: true })
    expect(renamed).toMatchObject({ ok: false })
    expect(fs.existsSync(path.join(hh.home, 'sessions', r.id))).toBe(false)
    expect(hh.ui.sessionList).toEqual([])
  })

  it.runIf(listing)(
    '앱을 다시 켜면 살아남은 프로세스를 끝내고 대화는 남긴다 (D402, 시나리오 12-8)',
    async () => {
      h = await harness({ scenario: { ...scenario(), session: ASK('질문') } })
      const hh = h
      const id = await create(hh, '')
      const live = await until(hh, id, (s) => s.status === 'live', '기본 세션')
      hh.relay.terminalWrite(live.terminal ?? '', '\r')
      await until(hh, id, (s) => s.resumable, '대화를 적음')
      const before = record(hh, id)
      await hh.relay.close()

      // 앱이 충돌한 뒤 살아남은 claude: 분리해 띄운 트리를 그 세션의 프로세스로 적는다
      const p = spawn(process.execPath, [TREE], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      })
      p.unref()
      children.push(p)
      const pid = p.pid ?? 0
      let tree = processTree(pid, await listProcesses())
      for (let i = 0; tree.length < 2 && i < 100; i++) {
        await sleep(100)
        tree = processTree(pid, await listProcesses())
      }
      for (const x of tree) recorded.push({ pid: x.ProcessId, startedAt: x.Created })
      const startedAt = await processStartTime(pid)
      if (!startedAt) throw new Error('시작 시각을 읽지 못함')
      fs.writeFileSync(
        path.join(hh.home, 'sessions', id, 'session.json'),
        JSON.stringify({
          ...before,
          process: { pid, process_started_at: startedAt, started_at: before.created_at },
        }),
      )

      await hh.reopen()
      const list = await listProcesses()
      expect(tree.filter((x) => isAlive(x.ProcessId, x.Created, list))).toEqual([])
      expect(record(hh, id)).toEqual({ ...before, process: undefined })
      expect(hh.relay.snapshot().warnings).toEqual([
        expect.stringContaining(`(PID ${pid})를 끝냈습니다`),
      ])
      // 이 앱에서 연 적이 없고 대화는 남아 [열기]가 잇는다
      expect(hh.relay.snapshot().sessions[0]).toMatchObject({
        id,
        status: null,
        resumable: true,
        name: '질문',
      })
      expect(await hh.relay.openSession(id, false)).toEqual({ ok: true })
      expect((await sessionStart(hh, 2)).args.slice(1, 3)).toEqual(['--resume', before.session_id])
    },
  )

  it('상세 설정의 기본 세션 줄이 Codex면 Codex로 연다: 안내는 SessionStart로 주고, push와 home/은 막지 않고 앱 소유 파일은 막는다 (D399, D401)', async () => {
    const edit = (file: string) => ({
      do: 'hook',
      event: 'PreToolUse',
      body: { tool_name: 'Edit', tool_input: { file_path: `{workDir}/${file}` } },
    })
    h = await harness({
      scenario: {
        ...scenario(),
        sessionCodex: [
          { do: 'prompt' },
          {
            do: 'hook',
            event: 'PreToolUse',
            body: { tool_name: 'exec_command', tool_input: { cmd: 'git push origin main' } },
          },
          edit('config.json'),
          edit('projects/x-123456/works/w-1/work.json'),
          edit('home/notes.md'),
          { do: 'wait' },
        ],
      },
      config: { agent_steps: { session: { engine: 'codex' } } },
    })
    const hh = h
    const id = await create(hh, '')
    await until(hh, id, (s) => s.status === 'live' && s.engineLabel === 'Codex', 'Codex 기본 세션')
    const start = await hh.ui.until(
      () => hh.codexRecords().find((r) => r['type'] === 'start'),
      'Codex 시작',
    )
    expect((start['args'] as string[]).slice(-2)).toEqual(['--add-dir', hh.home])
    const started = (await hh.ui.until(
      () => hh.codexRecords().find((r) => r['type'] === 'hook' && r['event'] === 'SessionStart'),
      'SessionStart',
    )) as { response: { hookSpecificOutput: { additionalContext: string } } }
    expect(started.response.hookSpecificOutput.additionalContext).toContain('# relay 기본 세션')
    const decisions = () =>
      hh
        .codexRecords()
        .filter((r) => r['type'] === 'hook' && r['event'] === 'PreToolUse')
        .map(
          (r) =>
            (r['response'] as { hookSpecificOutput?: { permissionDecision?: string } } | null)
              ?.hookSpecificOutput?.permissionDecision ?? 'allow',
        )
    await hh.ui.until(() => decisions().length === 4, '도구 훅 넷')
    expect(decisions()).toEqual(['allow', 'deny', 'deny', 'allow'])
    // Codex도 prompt가 오면 이름을 짓고 대화와 엔진을 적는다
    await hh.ui.until(() => record(hh, id).engine === 'codex', 'Codex 대화를 적음')
    expect(record(hh, id)).toMatchObject({ name: '사람 요청', session_id: start['sessionId'] })
  })
})
