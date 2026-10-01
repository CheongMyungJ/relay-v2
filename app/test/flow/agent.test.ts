// 실제 PTY·저장소·대기열을 지나 엔진 선택과 재개가 어긋나지 않는지 확인한다 (E3, E5).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { harness, makeRepo, register, type Harness } from './harness'
import { REPO_FILES, REQUEST, type Scenario } from './scenarios'
import type { WorkState } from '../../src/shared/work'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
const wait: Scenario = { tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }

async function setup() {
  const hh = await harness({ scenario: wait, config: { session_limit: 1 } })
  h = hh
  const { repo } = makeRepo(hh.root, 'agent-selection', REPO_FILES)
  const projectId = await register(hh, repo)
  const create = async () => {
    const result = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!result.ok) throw new Error(result.error)
    return result.workKey
  }
  const file = (key: string) =>
    path.join(hh.home, 'projects', projectId, 'works', key.split('/')[1] ?? '', 'work.json')
  const read = (key: string) => JSON.parse(fs.readFileSync(file(key), 'utf8')) as WorkState
  const prompts = () =>
    hh.records().filter((r) => r['type'] === 'hook' && r['event'] === 'UserPromptSubmit').length
  return { hh, create, file, read, prompts }
}

describe('[흐름] 엔진 설정과 재개', () => {
  it('설정을 바꾸어도 이미 대기 중인 task와 그 재개는 기존 Claude를 사용한다', async () => {
    const s = await setup()
    const first = await s.create()
    const queued = await s.create()
    await s.hh.ui.until(() => s.prompts() >= 1, '첫 CLI 대화 생성')
    expect(s.read(queued).tasks[0]).toMatchObject({ engine: 'claude', status: 'queued' })
    expect(await s.hh.relay.updateConfig({ agent_engine: 'codex' })).toMatchObject({ ok: true })
    expect(await s.hh.relay.interrupt(first, 't-01')).toMatchObject({ ok: true })
    await s.hh.ui.until(() => s.prompts() >= 2, '대기 중이던 Claude 시작')
    const before = s.read(queued).tasks[0]
    expect(before).toMatchObject({
      engine: 'claude',
      engine_version: '0.0.0 (가짜 Claude Code)',
      session: { alive: true },
    })
    expect(await s.hh.relay.interrupt(queued, 't-01')).toMatchObject({ ok: true })
    expect(await s.hh.relay.resume(queued, 't-01')).toMatchObject({ ok: true })
    await s.hh.ui.until(
      () => s.hh.records().filter((r) => r['type'] === 'start').length >= 3,
      '원래 엔진으로 재개',
    )
    expect(s.read(queued).tasks[0]).toMatchObject({
      engine: 'claude',
      session: { id: before?.session?.id, alive: true },
    })
    const last = s.hh
      .records()
      .filter((r) => r['type'] === 'start')
      .at(-1)
    expect(last?.['args']).toContain('--resume')
  })

  it('엔진 필드가 없는 기존 기록은 기본값이 Codex인 재시작 뒤에도 Claude로 재개한다', async () => {
    const s = await setup()
    const key = await s.create()
    await s.hh.ui.until(() => s.prompts() >= 1, '기존 CLI 대화 생성')
    const id = s.read(key).tasks[0]?.session?.id
    expect(id).toBeDefined()
    await s.hh.relay.updateConfig({ agent_engine: 'codex' })
    await s.hh.relay.close()
    await s.hh.relay.settled()
    const legacy = s.read(key)
    for (const task of legacy.tasks) {
      delete task.engine
      delete task.engine_version
    }
    fs.writeFileSync(s.file(key), JSON.stringify(legacy))
    await s.hh.reopen()
    expect(s.hh.relay.currentConfig().agent_engine).toBe('codex')
    expect(s.hh.relay.snapshot().works.find((w) => w.key === key)?.tasks[0]?.engineLabel).toBe(
      'Claude Code',
    )
    expect(await s.hh.relay.resume(key, 't-01')).toMatchObject({ ok: true })
    expect(s.read(key).tasks[0]).toMatchObject({ session: { id, alive: true } })
  })

  it.each(['interrupted', 'queued', 'working'] as const)(
    '알 수 없는 엔진의 %s 기록은 표시하고 재개만 거절한다',
    async (status) => {
      const s = await setup()
      const unknown = await s.create()
      const healthy = await s.create()
      await s.hh.ui.until(() => s.prompts() >= 1, '기존 CLI 대화 생성')
      await s.hh.relay.close()
      await s.hh.relay.settled()
      const record = s.read(unknown)
      const task = record.tasks[0]
      if (!task) throw new Error('시험 task 없음')
      Object.assign(task, { engine: 'future-engine', status, session: null })
      fs.writeFileSync(s.file(unknown), JSON.stringify(record))
      const starts = s.hh.records().filter((r) => r['type'] === 'start').length
      await s.hh.reopen()
      const snapshot = s.hh.relay.snapshot()
      expect(snapshot.works.map((w) => w.key)).toEqual(expect.arrayContaining([unknown, healthy]))
      const view = snapshot.works.find((w) => w.key === unknown)
      expect(view?.tasks[0]?.engineLabel).toContain('future-engine')
      expect(view?.tasks[0]?.notice).toContain('재개할 수 없습니다')
      expect(view?.actions.resume).toBe(false)
      expect((await s.hh.relay.review(unknown, 't-01'))?.autoApprove.on).toBe(false)
      expect(await s.hh.relay.resume(unknown, 't-01')).toMatchObject({
        ok: false,
        error: expect.stringContaining('future-engine'),
      })
      expect(s.read(unknown).tasks[0]?.engine).toBe('future-engine')
      expect(s.hh.records().filter((r) => r['type'] === 'start')).toHaveLength(starts)
      expect(await s.hh.relay.resume(healthy, 't-01')).toMatchObject({ ok: true })
    },
  )

  it('미설치 Codex task를 Claude로 자동 대체하여 실행하지 않는다', async () => {
    const s = await setup()
    await s.hh.relay.updateConfig({ agent_engine: 'codex' })
    s.hh.env['CODEX_BIN'] = path.join(s.hh.root, 'missing-codex')
    const key = await s.create()
    expect(s.read(key).tasks[0]).toMatchObject({
      engine: 'codex',
      status: 'interrupted',
      session: null,
      error: expect.stringContaining('Codex'),
    })
    expect(s.hh.records().filter((r) => r['type'] === 'start')).toEqual([])
  })
})
