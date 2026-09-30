// [흐름] 진행 표시와 세션 시각 (docs/implementation.md M12 R2, D215~D217, I25, I26).
// 새 세션의 터미널은 "새 세션을 띄우는 중" 표시 줄로 시작한다(D215). 작업 중인 task는 첫 턴 전이면 세션을 띄우는 중,
// 턴 중이면 경과 시간과 마지막 도구를 보인다(D216). 질문 도구가 아닌 도구의 훅은 core를 거치지 않고 진행 표시만
// 바꿔 따로 보낸다. 세션마다 첫 PTY 출력과 첫 훅까지 걸린 시간을 events.jsonl에 남긴다(D217).
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ActivityView } from '../../src/shared/views'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from './driver'
import { harness, makeRepo, register, settle, type Harness } from './harness'
import { REPO_FILES, REQUEST, scenario, steps } from './scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 표시 줄 (D215). 흐린 글자로 쓰고 줄을 바꾼다 */
const mark = (label: string) =>
  `\x1b[0m\x1b[2m── relay: ${label} · 새 세션을 띄우는 중 ──\x1b[0m\r\n`

describe('[흐름] 진행 표시와 세션 시각 (M12 R2)', () => {
  it('새 세션은 표시 줄로 시작하고, 세션을 띄우는 중과 도구 실행 중·끝남을 보이며, 첫 출력과 첫 훅의 시간을 남긴다 (D215~D217)', async () => {
    // 수정 세션은 첫 요청 전에 1.5초 쉬고(세션을 띄우는 중), npm test를 1.5초 돌린 뒤 1초 쉰다
    const fix = steps('fix', 'S')
    h = await harness({
      scenario: scenario('S', {
        fix: [
          { do: 'sleep', ms: 1500 },
          { do: 'prompt' },
          {
            do: 'tool',
            name: 'Bash',
            input: { command: 'npm test', description: '시험' },
            ms: 1500,
          },
          { do: 'sleep', ms: 1000 },
          ...fix.slice(1),
        ],
      }),
    })
    const ui = h.ui
    const { repo } = makeRepo(h.root, 'sample', REPO_FILES)
    const projectId = await register(h, repo)
    const created = await h.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      baseLocation: 'local',
    })
    if (!created.ok || !created.workKey)
      throw new Error(`Work 생성 실패: ${JSON.stringify(created)}`)
    const workKey = created.workKey
    const workDir = path.join(h.home, 'projects', projectId, 'works', workKey.split('/')[1] ?? '')
    const done = drive(h.relay, ui, workKey, { size: 'S' })

    const fixTask = () => ui.works.get(workKey)?.tasks.find((t) => t.node === 'fix')
    const fixActivity = (pred: (a: ActivityView) => boolean) => {
      const t = fixTask()
      const a = t ? ui.activityOf(workKey, t.id) : null
      return a && pred(a) ? a : null
    }

    // 첫 턴 전: 세션을 띄우는 중이고 task를 만든 때부터 센다
    const starting = await ui.until(() => fixActivity((a) => !a.turn), '수정: 세션을 띄우는 중')
    const fixId = fixTask()?.id ?? ''
    const createdAt = (): number => {
      const w = JSON.parse(read(path.join(workDir, 'work.json'))) as WorkState
      return Date.parse(w.tasks.find((t) => t.id === fixId)?.created_at ?? '')
    }
    expect(starting).toEqual({ turn: false, since: createdAt(), tool: null })

    // 도구 실행 중: 턴이 시작한 때부터 세고 마지막 도구는 끝나지 않았다. 표시 상태는 작업 중 그대로다
    const running = await ui.until(
      () => fixActivity((a) => a.tool?.endedAt === null),
      '수정: Bash 실행 중',
    )
    expect(running).toMatchObject({ turn: true, tool: { label: 'Bash(npm test)', endedAt: null } })
    expect(running.since).toBeLessThanOrEqual(running.tool?.startedAt ?? 0)
    expect(fixTask()?.status).toBe('working')

    // 도구가 끝남: PostToolUse를 받은 때가 남는다
    const ended = await ui.until(
      () => fixActivity((a) => typeof a.tool?.endedAt === 'number'),
      '수정: Bash 끝남',
    )
    const tool = ended.tool
    expect(tool?.label).toBe('Bash(npm test)')
    expect((tool?.endedAt ?? 0) - (tool?.startedAt ?? 0)).toBeGreaterThanOrEqual(1400)

    const result = await done
    await settle(h, workKey)
    expect(result, ui.dump()).toMatchObject({ status: 'completed' })
    const work = ui.works.get(workKey)
    // 턴이 끝나면(승인 대기, 승인됨) 진행 표시가 없다
    expect(work?.tasks.map((t) => t.activity)).toEqual([null, null, null, null])

    // 도구 훅은 스냅샷이 아니라 따로 왔다. 질문 도구가 아니라 core를 거치지 않고 빈 본문으로 바로 답했다
    const updates = ui.activityLog.filter((u) => u.workKey === workKey && u.taskId === fixId)
    expect(
      updates.map((u) => [u.activity?.tool?.label, u.activity?.tool?.endedAt === null]),
    ).toEqual([
      ['Bash(npm test)', true],
      ['Bash(npm test)', false],
    ])
    const toolHooks = h
      .records()
      .filter((r) => r['type'] === 'hook' && String(r['event']).endsWith('ToolUse'))
    expect(toolHooks.map((r) => [r['event'], r['status'], r['response']])).toEqual([
      ['PreToolUse', 200, null],
      ['PostToolUse', 200, null],
    ])

    // 새 세션의 터미널과 pty.log는 표시 줄로 시작한다 (D215)
    const tasks = work?.tasks ?? []
    expect(tasks.map((t) => t.label)).toEqual([
      '01 의도 정리',
      '02 수정',
      '03 리뷰',
      '04 최종 검증',
    ])
    for (const t of tasks) {
      expect(ui.output.get(t.terminal)?.startsWith(`${mark(t.label)}FAKE-CLAUDE READY`)).toBe(true)
    }
    const dirs = ['01-intake', '02-fix', '03-review', '04-verify']
    for (const [i, dir] of dirs.entries()) {
      const log = read(path.join(workDir, 'tasks', dir, 'pty.log'))
      expect(log.startsWith(mark(tasks[i]?.label ?? ''))).toBe(true)
    }

    // events.jsonl: 세션마다 task.started 다음에 첫 출력, 첫 훅(UserPromptSubmit)을 남긴다 (D217)
    const events = read(path.join(workDir, 'events.jsonl'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LifecycleEvent)
    const state = JSON.parse(read(path.join(workDir, 'work.json'))) as WorkState
    for (const t of state.tasks) {
      const own = events.filter((e) => e.task_id === t.id)
      expect(own.map((e) => e.type)).toEqual([
        'task.started',
        'task.first_output',
        'task.first_hook',
        'task.awaiting_approval',
        'task.approved',
      ])
      const pid = t.session?.pid
      expect(own[1]?.payload).toEqual({ pid, ms: expect.any(Number) })
      expect(own[2]?.payload).toEqual({ pid, ms: expect.any(Number), event: 'UserPromptSubmit' })
      expect(Number(own[1]?.payload['ms'])).toBeLessThanOrEqual(Number(own[2]?.payload['ms']))
    }
    // 수정 세션은 첫 요청 전에 1.5초 쉬었다
    const fixHook = events.find((e) => e.task_id === fixId && e.type === 'task.first_hook')
    expect(Number(fixHook?.payload['ms'])).toBeGreaterThanOrEqual(1400)
  })
})
