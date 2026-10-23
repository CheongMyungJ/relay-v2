// [흐름] 커스텀 유형 (docs/implementation.md M30, D447~D463). 가짜 claude로 레포의 두 단계 커스텀 유형 Work가
// intake → 조사 → 적용 → verify → Work 완료로 가고, Work를 만들 때 복사한 정의로 끝까지 도는 것(D458), 단계별 자동 승인
// 기본값(D457), 같은 id의 레포 유형이 이기는 것(D451), 깨진 유형을 막는 것(D460), 업무 유형 화면의 명령(D459)을 본다.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CUSTOM_INTAKE_HEAD, CUSTOM_PROCEDURE_HEAD } from '../../src/adapters/claude'
import { parseFrontMatter } from '../../src/core/validate'
import type { LifecycleEvent, WorkState } from '../../src/shared/work'
import { drive } from '../support/driver'
import { git, harness, makeRepo, register, settle, type Harness } from '../support/harness'
import {
  GENERAL_PR,
  GENERAL_REQUEST,
  GENERAL_VERDICTS,
  REPO_FILES,
  REVIEW_NONE,
  customSteps,
  generalIntentDraft,
  steps,
  type Scenario,
} from '../support/scenarios'

let h: Harness | undefined

afterEach(async () => {
  await h?.close()
  h = undefined
})

const read = (file: string) => fs.readFileSync(file, 'utf8')

const TYPE = {
  schema_version: 1,
  name: '조사 후 적용',
  description: '먼저 바꿀 곳을 조사하고 그대로 적용하는 일',
  steps: [
    { id: 'survey', title: '조사', sections: ['조사한 곳', '적용 계획'], auto_approve: false },
    { id: 'apply', title: '적용', auto_approve: true },
  ],
}

/** 유형 폴더를 쓴다 */
function writeType(dir: string, def: object = TYPE, extra: Record<string, string> = {}) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'type.json'), JSON.stringify(def, null, 2))
  fs.writeFileSync(path.join(dir, 'survey.md'), '바꿀 곳을 모두 찾아 조사한 곳에 적는다.\n')
  fs.writeFileSync(path.join(dir, 'apply.md'), '조사한 대로 바꾸고 커밋한다.\n')
  for (const [name, text] of Object.entries(extra)) fs.writeFileSync(path.join(dir, name), text)
}

/** 두 커스텀 단계의 시나리오: 단계는 task id(t-02, t-03)로 고른다. intake와 verify는 일반과 같은 intent·판정이다 (D455, D456) */
function customScenario(): Scenario {
  const intake = steps('intake').map((st) =>
    st.do === 'write' && st.file === 'intent.draft.md' ? { ...st, text: generalIntentDraft() } : st,
  )
  const verify = steps('verify').map((st) =>
    st.do === 'write' && st.file === 'verification.md'
      ? { ...st, text: REVIEW_NONE + GENERAL_VERDICTS }
      : st.do === 'write' && st.file === 'pr.md'
        ? { ...st, text: GENERAL_PR }
        : st,
  )
  return {
    tasks: {
      'work-start': intake,
      't-02': customSteps('survey', { sections: ['조사한 곳', '적용 계획'], commit: false }),
      't-03': customSteps('apply'),
      verify,
    },
  }
}

async function setup(s: Scenario) {
  h = await harness({ scenario: s, config: { auto_approve_countdown_sec: 1 } })
  const hh = h
  const { repo } = makeRepo(hh.root, 'sample', REPO_FILES)
  const projectId = await register(hh, repo)
  const id = (key: string) => key.split('/')[1] ?? ''
  return {
    h: hh,
    repo,
    projectId,
    repoType: path.join(repo, '.relay', 'types', 'survey-apply'),
    globalTypes: path.join(hh.home, 'types'),
    create: (customType = 'survey-apply') =>
      hh.relay.createWork(projectId, {
        request: GENERAL_REQUEST,
        type: 'custom',
        customType,
        baseBranch: 'main',
        baseLocation: 'local',
      }),
    dir: (key: string) => path.join(hh.home, 'projects', projectId, 'works', id(key)),
    tree: (key: string) => path.join(hh.home, 'projects', projectId, 'worktrees', id(key)),
  }
}

function work(dir: string): WorkState {
  return JSON.parse(read(path.join(dir, 'work.json'))) as WorkState
}

function events(dir: string): LifecycleEvent[] {
  return read(path.join(dir, 'events.jsonl'))
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LifecycleEvent)
}

describe('[흐름] 커스텀 유형 (M30)', () => {
  it('레포 유형으로 intake → 조사 → 적용(자동 승인) → verify → [완료만]. 단계마다 사람이 쓴 절차를 받는다 (D447, D452, D457)', async () => {
    const s = await setup(customScenario())
    writeType(s.repoType, TYPE, { 'intake.md': '조사할 범위를 제약에 적는다.\n' })
    const base = git(s.repo, 'rev-parse', 'main')
    const r = await s.create()
    if (!r.ok) throw new Error(r.error)
    const key = r.workKey
    const dir = s.dir(key)
    // 만든 뒤 원본을 고쳐도 이 Work는 복사본으로 돈다 (D458)
    fs.writeFileSync(path.join(s.repoType, 'apply.md'), '고친 절차\n')

    const result = await drive(s.h.relay, s.h.ui, key, { awaitAuto: true })
    await settle(s.h, key)
    expect(result, s.h.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces, t.auto])).toEqual([
      ['01 의도 정리', 0, false],
      ['02 조사', 0, false],
      ['03 적용', 0, true],
      ['04 리뷰와 검증', 0, false],
    ])

    const w = work(dir)
    expect(w).toMatchObject({
      type: 'custom',
      status: 'completed',
      custom_type: { id: 'survey-apply', name: '조사 후 적용', source: 'repo' },
    })
    expect(w.custom_type?.hash).toMatch(/^sha256:/)
    expect(w.tasks.map((t) => [t.id, t.node, t.step ?? null, t.approved_by])).toEqual([
      ['t-01', 'intake', null, 'human'],
      ['t-02', 'custom', 'survey', 'human'],
      ['t-03', 'custom', 'apply', 'auto'],
      ['t-04', 'verify', null, 'human'],
    ])
    expect(events(dir)[0]).toMatchObject({
      type: 'work.created',
      payload: { type: 'custom', custom_type: { id: 'survey-apply', source: 'repo' } },
    })
    const intent = parseFrontMatter(read(path.join(dir, 'intent.md')))
    expect(intent.ok && intent.data).toEqual({ schema_version: 1, version: 1, type: 'custom' })

    // task 디렉터리와 산출물은 단계 id다 (D453, D462)
    expect(fs.readdirSync(path.join(dir, 'tasks')).sort()).toEqual([
      '01-intake',
      '02-survey',
      '03-apply',
      '04-verify',
    ])
    expect(read(path.join(dir, 'tasks', '02-survey', 'survey.md'))).toContain('## 적용 계획')
    expect(fs.readdirSync(path.join(dir, 'type')).sort()).toEqual([
      'apply.md',
      'intake.md',
      'survey.md',
      'type.json',
    ])

    // 절차: intake는 유형의 지시를, 커스텀 단계는 공통 바탕 뒤에 복사본의 절차를 받는다 (D452, D456, D458)
    const instructions = (task: string) => read(path.join(dir, 'tasks', task, 'instructions.md'))
    expect(instructions('01-intake')).toContain(
      `${CUSTOM_INTAKE_HEAD}\n\n조사할 범위를 제약에 적는다.\n`,
    )
    expect(instructions('02-survey')).toContain(
      `${CUSTOM_PROCEDURE_HEAD}\n\n바꿀 곳을 모두 찾아 조사한 곳에 적는다.\n`,
    )
    expect(instructions('03-apply')).toContain(
      `${CUSTOM_PROCEDURE_HEAD}\n\n조사한 대로 바꾸고 커밋한다.\n`,
    )
    expect(instructions('03-apply')).not.toContain('고친 절차')
    expect(instructions('04-verify')).toContain('artifacts of the custom steps')
    expect(instructions('04-verify')).not.toContain('`execution.md`')

    // context.md: 유형과 단계, 이 단계의 산출물. verify는 두 단계의 산출물 경로를 받는다
    const surveyCtx = read(path.join(dir, 'tasks', '02-survey', 'context.md'))
    expect(surveyCtx).toContain('- 업무 유형: 조사 후 적용 (커스텀 유형 `survey-apply`)')
    expect(surveyCtx).toContain('- 단계: 의도 정리 → 조사(`survey`) → 적용(`apply`) → 리뷰와 검증')
    expect(surveyCtx).toContain(
      '- 이 단계의 산출물: `survey.md`, 절 `## 조사한 곳`, `## 적용 계획`',
    )
    const verifyCtx = read(path.join(dir, 'tasks', '04-verify', 'context.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '02-survey', 'survey.md'))
    expect(verifyCtx).toContain(path.join(dir, 'tasks', '03-apply', 'apply.md'))
    expect(read(path.join(dir, 'decisions.md'))).toMatch(/^## t-02 custom:survey — /m)

    const skills = s.h
      .records()
      .filter((x) => x['type'] === 'start' && !x['resume'])
      .map((x) => x['skill'])
    expect(skills).toEqual(['work-start', 'custom', 'custom', 'verify'])
    // 적용 단계의 커밋. 조사 단계는 커밋하지 않았다
    expect(git(s.tree(key), 'log', '--format=%s', `${base}..HEAD`)).toBe('chore: apply 단계')
    expect(s.h.ui.works.get(key)?.customType).toMatchObject({ id: 'survey-apply', source: 'repo' })
  })

  it('같은 id면 레포 유형을 쓰고, 깨진 유형과 없는 유형으로는 만들지 않는다 (D451, D460)', async () => {
    const s = await setup(customScenario())
    writeType(path.join(s.globalTypes, 'survey-apply'), { ...TYPE, name: '전역의 것' })
    writeType(s.repoType)
    writeType(path.join(s.globalTypes, 'broken'), { name: '깨짐', steps: [] })
    const list = await s.h.relay.customTypes(s.projectId)
    expect(list.map((t) => [t.source, t.id, t.name, t.errors.length > 0])).toEqual([
      ['repo', 'survey-apply', '조사 후 적용', false],
      ['global', 'broken', 'broken', true],
    ])
    const all = await s.h.relay.customTypeList()
    expect(all.global.map((t) => t.id)).toEqual(['broken', 'survey-apply'])
    expect(all.projects[0]?.types.map((t) => [t.source, t.id, t.shadowed ?? false])).toEqual([
      ['repo', 'survey-apply', false],
      ['global', 'survey-apply', true],
    ])

    expect(await s.create('broken')).toMatchObject({
      ok: false,
      error: expect.stringContaining('형식이 깨졌습니다'),
    })
    expect(await s.create('gone')).toMatchObject({
      ok: false,
      error: '커스텀 유형이 없습니다: gone',
    })
    const r = await s.create()
    if (!r.ok) throw new Error(r.error)
    await settle(s.h, r.workKey)
    expect(work(s.dir(r.workKey)).custom_type).toMatchObject({
      source: 'repo',
      name: '조사 후 적용',
    })
  })

  it('업무 유형 화면: 전역 유형을 쓰고, 레포로 복사하고, 지운다 (D450, D459)', async () => {
    const s = await setup({ tasks: {} })
    const files = {
      def: {
        id: 'survey-apply',
        name: '조사 후 적용',
        description: '설명',
        steps: [{ id: 'survey', title: '조사', sections: [], auto_approve: false }],
      },
      procedures: { survey: '찾는다' },
      intake: '',
      verify: '',
    }
    expect(await s.h.relay.saveCustomType(files, null)).toEqual({ ok: true })
    expect(await s.h.relay.saveCustomType(files, null)).toMatchObject({ ok: false })
    expect((await s.h.relay.customTypeFiles('global', null, 'survey-apply'))?.procedures).toEqual({
      survey: '찾는다',
    })
    // id를 바꾸면 앞 폴더를 지운다
    expect(
      await s.h.relay.saveCustomType(
        { ...files, def: { ...files.def, id: 'survey' } },
        'survey-apply',
      ),
    ).toEqual({ ok: true })
    expect(fs.readdirSync(s.globalTypes)).toEqual(['survey'])
    const copied = await s.h.relay.copyCustomTypeToRepo('survey', s.projectId)
    expect(copied).toMatchObject({ ok: true, path: path.join(s.repo, '.relay', 'types', 'survey') })
    expect((await s.h.relay.customTypes(s.projectId)).map((t) => t.source)).toEqual(['repo'])
    expect(await s.h.relay.deleteCustomType('survey')).toEqual({ ok: true })
    expect(fs.readdirSync(s.globalTypes)).toEqual([])
    expect(await s.h.relay.skillProcedure('execute')).toMatch(/^# relay: execute/)
  })
})
