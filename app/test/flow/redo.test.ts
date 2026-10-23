// [흐름] 다시 하기: 새 Work (D418, D420, D421). 가짜 claude의 task가 근본부터 다시 하기로 하고 Work 초안 폴더에 초안을 쓴 뒤
// 막힘으로 마무리하면, Work의 패널에 초안 카드가 보이고, 그 초안으로 새 Work를 만들며 원래 Work를 포기한다. 새 Work는
// 원래 Work를 적고, 초안은 지워지고, 원래 Work의 포기는 다시 하기로 남는다. 끝난 Work는 포기하지 않고, [버리기]는
// 초안을 지운다. 이슈를 이어 쓰는 것은 issue.test.ts가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { harness, makeRepo, register, settle, type Harness } from '../support/harness'
import { REPO_FILES, REQUEST, handoff, scenario, type Step } from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

/** 다시 할 Work의 요청. 첫 줄이 Work 제목이다 */
const REDO_REQUEST =
  '빈 배열 평균을 다시 고친다\n\n원인을 0으로 나눔이 아니라 입력 검사로 다시 찾는다.'

/** 초안 파일 하나 (D404). project는 context.md의 프로젝트 id다 */
const draftText = (project: string, request = REDO_REQUEST) =>
  `---\nproject: ${project}\ntype: bugfix\n---\n${request}\n`

/** 사람과 다시 하기로 정한 fix: 초안을 쓰고 막힘으로 마무리한다 (5.6.2의 다시 하기) */
const REDO_FIX: Step[] = [
  { do: 'prompt' },
  { do: 'write', file: '{draftsDir}/redo.md', text: draftText('{projectId}') },
  {
    do: 'write',
    file: 'handoff.md',
    text: handoff({
      status: 'blocked',
      blocked_reason: '새 Work로 다시: redo.md',
      decisions: [{ what: '새 Work로 다시 한다', why: '원인을 잘못 잡음', by: 'human' }],
      summary: '원인이 틀려 새 Work로 다시 하기로 했다.',
    }),
  },
  { do: 'stop' },
  { do: 'wait' },
]

interface Setup {
  h: Harness
  projectId: string
  create(request?: string): Promise<string>
  dir(key: string): string
}

async function setup(): Promise<Setup> {
  h = await harness({ scenario: { tasks: { ...scenario().tasks, fix: REDO_FIX } } })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  return {
    h: hh,
    projectId,
    async create(request = REQUEST) {
      const r = await hh.relay.createWork(projectId, {
        request,
        baseBranch: 'main',
        type: 'bugfix',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(`Work 생성 실패: ${r.error}`)
      return r.workKey
    },
    dir: (key) => path.join(hh.home, 'projects', projectId, 'works', key.split('/')[1] ?? ''),
  }
}

const work = (dir: string) => JSON.parse(read(path.join(dir, 'work.json'))) as WorkState

function events(dir: string): LifecycleEvent[] {
  return read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

describe('[흐름] 다시 하기: 새 Work (D420, D421)', () => {
  it('task가 쓴 초안이 카드로 보이고, 그 초안으로 만든 새 Work는 원래 Work를 적고 원래 Work를 포기한다. 초안은 지운다', async () => {
    const s = await setup()
    const key = await s.create()
    const dir = s.dir(key)
    const drafts = path.join(dir, 'work-drafts')
    const blocked = await drive(s.h.relay, s.h.ui, key, { pauseAt: (t) => t.node === 'fix' })
    expect(blocked, s.h.ui.dump()).toMatchObject({ status: 'paused' })
    await settle(s.h, key)
    // fix의 context.md가 초안 폴더와 project를 알렸다
    const ctx = read(path.join(dir, 'tasks', '02-fix', 'context.md'))
    expect(ctx).toContain(`- 프로젝트 id: ${s.projectId}`)
    expect(ctx).toContain(`- Work 초안 폴더: ${drafts} `)
    expect(fs.readdirSync(drafts)).toEqual(['redo.md'])

    // 초안 카드: 만든 곳은 이 Work다
    const draft = await s.h.ui.until(() => s.h.ui.works.get(key)?.drafts[0], '초안 카드')
    expect(draft).toEqual({
      project: s.projectId,
      type: 'bugfix',
      customType: null,
      base: null,
      request: REDO_REQUEST,
      errors: [],
      ref: { source: { kind: 'work', id: key }, name: 'redo.md' },
      title: '빈 배열 평균을 다시 고친다',
    })
    const fix = s.h.ui.works.get(key)?.tasks[1]
    expect(fix?.status).toBe('blocked')
    const review = await s.h.relay.review(key, fix?.id ?? '')
    expect(review?.emphasis.find((e) => e.kind === 'blocked')?.lines).toEqual([
      '새 Work로 다시: redo.md',
    ])

    const r = await s.h.relay.createWork(s.projectId, {
      request: draft.request,
      type: 'bugfix',
      baseBranch: 'main',
      baseLocation: 'local',
      draft: draft.ref,
      abandonOriginal: true,
    })
    if (!r.ok) throw new Error(r.error)
    const newId = r.workKey.split('/')[1] ?? ''
    await settle(s.h, key)
    await settle(s.h, r.workKey)

    // 원래 Work는 다시 하기로 포기했다. 기록과 브랜치는 남는다
    const original = work(dir)
    expect(original.status).toBe('abandoned')
    expect(events(dir).find((e) => e.type === 'work.abandoned')?.payload).toEqual({
      redo_by: newId,
    })
    expect(fs.readdirSync(drafts)).toEqual([])
    await s.h.ui.until(() => s.h.ui.works.get(key)?.drafts.length === 0 || null, '초안 지움')

    // 새 Work는 원래 Work를 적고 초안의 요청으로 시작한다
    const created = work(s.dir(r.workKey))
    expect(created.from_work).toBe(original.work_id)
    expect(events(s.dir(r.workKey))[0]).toMatchObject({
      type: 'work.created',
      payload: { type: 'bugfix', from_work: original.work_id },
    })
    expect(read(path.join(s.dir(r.workKey), 'request.md'))).toContain('입력 검사로 다시 찾는다')
    expect(s.h.ui.works.get(r.workKey)?.title).toBe('빈 배열 평균을 다시 고친다')
  })

  it('끝난 Work의 초안으로는 원래 Work를 포기하지 않는다. [버리기]는 초안을 지운다 (D421)', async () => {
    const s = await setup()
    const key = await s.create()
    const dir = s.dir(key)
    await s.h.ui.until(() => s.h.ui.works.get(key)?.tasks[0]?.live || null, 'intake')
    expect(await s.h.relay.abandon(key)).toEqual({ ok: true })
    await settle(s.h, key)
    // 곁 세션이 남은 일을 초안으로 쓴다
    fs.writeFileSync(path.join(dir, 'work-drafts', 'later.md'), draftText(s.projectId))
    const draft = await s.h.ui.until(() => s.h.ui.works.get(key)?.drafts[0], '초안 카드')
    expect(draft.ref).toEqual({ source: { kind: 'work', id: key }, name: 'later.md' })

    expect(
      await s.h.relay.createWork(s.projectId, {
        request: draft.request,
        type: 'bugfix',
        baseBranch: 'main',
        baseLocation: 'local',
        draft: draft.ref,
        abandonOriginal: true,
      }),
    ).toEqual({
      ok: false,
      error: '원래 Work는 진행 중이거나 멈춘 Work가 아니라 포기할 수 없습니다',
    })
    // Work를 만들지 않았고 초안은 남았다
    expect(s.h.ui.works.size).toBe(1)
    expect(fs.existsSync(path.join(dir, 'work-drafts', 'later.md'))).toBe(true)

    // [버리기]
    expect(await s.h.relay.discardDraft(draft.ref)).toEqual({ ok: true })
    expect(fs.existsSync(path.join(dir, 'work-drafts', 'later.md'))).toBe(false)
    expect(s.h.ui.works.get(key)?.drafts).toEqual([])
    // 초안 폴더 밖의 파일은 지우지 않는다
    expect(
      await s.h.relay.discardDraft({ source: { kind: 'work', id: key }, name: '../work.json' }),
    ).toMatchObject({ ok: false })
    expect(fs.existsSync(path.join(dir, 'work.json'))).toBe(true)
  })
})
