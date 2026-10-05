// 지식 관리의 켜고 끔 (K1, 규약 2.2): 켜면 intake의 context.md에 레포의 지식이 들어가고 넣은 기록이 남는다. RELAY_KNOWLEDGE=off면
// 지식 절도 기록도 없다
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { drive } from './driver'
import { harness, makeRepo, register, settle, type Harness } from './harness'
import {
  PR,
  REPO_FILES,
  REQUEST,
  VERIFICATION,
  handoff,
  scenario,
  steps,
  type Scenario,
  type Step,
} from './scenarios'

let h: Harness | undefined
afterEach(async () => {
  await h?.close()
  h = undefined
})
const wait: Scenario = { tasks: { 'work-start': [{ do: 'prompt' }, { do: 'wait' }] } }

async function intakeDir(env: Record<string, string>) {
  const hh = await harness({ scenario: wait, env })
  h = hh
  const { repo } = makeRepo(hh.root, 'knowledge', {
    ...REPO_FILES,
    'docs/knowledge/amount-floor.md': '# 금액은 원 단위로 내림\n',
  })
  const projectId = await register(hh, repo)
  const r = await hh.relay.createWork(projectId, {
    request: REQUEST,
    baseBranch: 'main',
    type: 'bugfix',
    baseLocation: 'local',
  })
  if (!r.ok) throw new Error(r.error)
  await hh.ui.until(
    () => hh.records().some((x) => x['type'] === 'hook' && x['event'] === 'UserPromptSubmit'),
    '첫 프롬프트',
  )
  const workId = r.workKey.split('/')[1] ?? ''
  return path.join(hh.home, 'projects', projectId, 'works', workId, 'tasks', '01-intake')
}

describe('[흐름] 지식 켜고 끔', () => {
  it('켜면 레포의 지식을 context.md에 넣고 넣은 기록을 남긴다', async () => {
    const dir = await intakeDir({ RELAY_KNOWLEDGE: 'on' })
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).toContain('## 팀 지식')
    expect(context).toContain('# 금액은 원 단위로 내림')
    expect(fs.readFileSync(path.join(dir, 'knowledge-injected.md'), 'utf8')).toContain(
      'docs/knowledge/amount-floor.md',
    )
  })

  it('RELAY_KNOWLEDGE=off면 지식 절도 넣은 기록도 없다', async () => {
    const dir = await intakeDir({ RELAY_KNOWLEDGE: 'off' })
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).not.toContain('지식')
    expect(context).not.toContain('docs/knowledge')
    expect(fs.existsSync(path.join(dir, 'knowledge-injected.md'))).toBe(false)
  })
})

const FEE_PATH = 'docs/knowledge/shipping/fee.md'
const FEE_RULE = [
  '---',
  'kind: rule',
  'source: human',
  '---',
  '# 배송비 기준은 쿠폰 뺀 금액',
  '',
  '## 규칙',
  '- 쿠폰을 뺀 금액으로 무료배송을 판단한다.',
].join('\n')

describe('[흐름] verify의 지식 확인 (D293, D294)', () => {
  it('옛 형식의 지식과 줄 없는 handoff는 되돌리고, 고친 뒤에는 Work가 끝난다', async () => {
    const verify: Scenario['tasks'][string] = [
      { do: 'prompt' },
      {
        do: 'commit',
        files: { [FEE_PATH]: '# 배송비\n쿠폰을 뺀 금액으로 본다.\n' },
        message: 'knowledge',
      },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: '고쳤다.' }) },
      {
        do: 'stop',
        onBlock: [
          { do: 'commit', files: { [FEE_PATH]: FEE_RULE }, message: 'knowledge: 형식' },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({ summary: `고쳤다.\n새 지식: ${FEE_PATH} — 맞는 기존 항목 없음` }),
          },
          { do: 'stop' },
        ],
      },
    ]
    const hh = await harness({ scenario: scenario({ verify }), env: { RELAY_KNOWLEDGE: 'on' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-verify', REPO_FILES)
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const result = await drive(hh.relay, hh.ui, r.workKey)
    await settle(hh, r.workKey)
    expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => [t.label, t.bounces])).toEqual([
      ['01 의도 정리', 0],
      ['02 원인 분석과 수정', 0],
      ['03 리뷰와 검증', 1],
    ])
    const workId = r.workKey.split('/')[1] ?? ''
    const events = fs
      .readFileSync(
        path.join(hh.home, 'projects', projectId, 'works', workId, 'events.jsonl'),
        'utf8',
      )
      .split('\n')
      .filter((l) => l.includes('bounce'))
      .join('\n')
    expect(events).toContain(FEE_PATH)
    expect(events).toContain('새 지식')
  })
})

describe('[흐름] 아직 따르지 않는 곳, 지운 지식, 이 Work의 지식 (D296, D297, D298)', () => {
  it('아직 따르지 않는 곳의 코드를 바꾸고 항목을 두면 되돌리고, 고치고 지운 뒤에는 완료 화면에 지식 변경이 보인다', async () => {
    const AVG = 'docs/knowledge/avg.md'
    const STALE = 'docs/knowledge/stale.md'
    const rule = (notYet: boolean) =>
      [
        '---',
        'kind: rule',
        'source: human',
        '---',
        '# 빈 목록의 평균은 0',
        '',
        '## 규칙',
        '- 빈 배열의 평균은 0이다.',
        ...(notYet ? ['', '## 아직 규칙을 따르지 않는 곳', '- `src/avg.js`: NaN을 낸다.'] : []),
        '',
        '## 바뀐 이력',
        '- 2026-10-01 처음 남김 (Work w-0)',
        ...(notYet ? [] : ['- 2026-10-04 src/avg.js를 규칙대로 고침']),
      ].join('\n') + '\n'
    const verify: Scenario['tasks'][string] = [
      { do: 'prompt' },
      {
        do: 'commit',
        files: { 'src/avg.js': 'export function avg(xs) {\n  return xs.length ? 1 : 0\n}\n' },
        message: 'fix',
      },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      {
        do: 'write',
        file: 'handoff.md',
        text: handoff({ summary: '고쳤다.\n남긴 지식: 없음 (없음)' }),
      },
      {
        do: 'stop',
        onBlock: [
          { do: 'git', args: ['rm', '-q', STALE] },
          { do: 'commit', files: { [AVG]: rule(false) }, message: 'knowledge' },
          {
            do: 'write',
            file: 'handoff.md',
            text: handoff({
              summary: `고쳤다.\n고친 지식: ${AVG} — src/avg.js를 고쳐 아직 따르지 않는 곳에서 뺌\n지운 지식: ${STALE} — 더는 맞지 않음`,
            }),
          },
          { do: 'stop' },
        ],
      },
    ]
    const hh = await harness({ scenario: scenario({ verify }), env: { RELAY_KNOWLEDGE: 'on' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-not-yet', {
      ...REPO_FILES,
      [AVG]: rule(true),
      [STALE]: '---\nkind: fact\nsource: investigation\n---\n# 낡은 사실\n\n## 내용\n- 옛것\n',
    })
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const result = await drive(hh.relay, hh.ui, r.workKey)
    await settle(hh, r.workKey)
    expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 0, 1])
    const workId = r.workKey.split('/')[1] ?? ''
    const bounced = fs
      .readFileSync(
        path.join(hh.home, 'projects', projectId, 'works', workId, 'events.jsonl'),
        'utf8',
      )
      .split('\n')
      .filter((l) => l.includes('task.bounced'))
      .join('\n')
    expect(bounced).toContain(AVG)
    expect(bounced).toContain('아직 규칙을 따르지 않는 곳')

    const review = await hh.relay.review(r.workKey, 't-03')
    expect(review?.completion?.knowledge?.map((k) => [k.path, k.change, k.kind, k.note])).toEqual([
      [AVG, 'updated', 'rule', 'src/avg.js를 고쳐 아직 따르지 않는 곳에서 뺌'],
      [STALE, 'removed', null, '더는 맞지 않음'],
    ])
    expect(review?.completion?.knowledge?.[0]?.diff).toContain('-- `src/avg.js`: NaN을 낸다.')
  })
})

describe('[흐름] 지식 검토 호출 (D300)', () => {
  it('기계적 확인을 지난 지식을 모델이 한 번 보고, 찾은 것은 한 번 되돌리며, 시간과 비용을 기록한다', async () => {
    const RATE = 'docs/knowledge/points/rate.md'
    const text = (undecided: boolean) =>
      [
        '---',
        'kind: rule',
        'source: human',
        '---',
        '# 적립률은 2%',
        '',
        '## 규칙',
        '- 적립률은 2%다.',
        ...(undecided
          ? ['', '## 아직 정하지 않은 것', '- 환불 회수율: 정산팀이 정함. 지금 코드는 1%']
          : ['- 환불 회수율은 1%다.']),
      ].join('\n') + '\n'
    const verify: Scenario['tasks'][string] = [
      { do: 'prompt' },
      { do: 'commit', files: { [RATE]: text(false) }, message: 'knowledge' },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      {
        do: 'write',
        file: 'handoff.md',
        text: handoff({ summary: `고쳤다.\n새 지식: ${RATE} — 없음` }),
      },
      {
        do: 'stop',
        onBlock: [
          { do: 'commit', files: { [RATE]: text(true) }, message: 'knowledge: 정하지 않은 것' },
          { do: 'stop' },
        ],
      },
    ]
    const hh = await harness({
      scenario: {
        ...scenario({ verify }),
        review: [
          {
            issues: [
              {
                file: RATE,
                kind: 'undecided_in_rule',
                quote: '환불 회수율은 1%다.',
                fix: '`## 아직 정하지 않은 것`으로 옮긴다',
              },
            ],
          },
          { issues: [] },
        ],
      },
      env: { RELAY_KNOWLEDGE: 'on' },
    })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-review', REPO_FILES)
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const result = await drive(hh.relay, hh.ui, r.workKey)
    await settle(hh, r.workKey)
    expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 0, 1])
    const workDir = path.join(
      hh.home,
      'projects',
      projectId,
      'works',
      r.workKey.split('/')[1] ?? '',
    )
    const bounced = fs
      .readFileSync(path.join(workDir, 'events.jsonl'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('task.bounced'))
      .join('\n')
    expect(bounced).toContain('[지식 검토: 규칙 절에 정하지 않은 것]')
    // 프롬프트에 바꾼 지식이 들어갔다
    expect(
      fs.readFileSync(`${path.join(hh.root, 'scenario.json')}.review-1.txt`, 'utf8'),
    ).toContain('환불 회수율은 1%다.')
    const record = JSON.parse(
      fs.readFileSync(path.join(workDir, 'tasks', '03-verify', 'knowledge-review.json'), 'utf8'),
    ) as {
      calls: { bounced: boolean; costUsd: number; ms: number; issues: unknown[]; usage: unknown }[]
    }
    expect(record.calls.map((c) => [c.bounced, c.issues.length, c.costUsd])).toEqual([
      [true, 1, 0.0123],
      [false, 0, 0.0123],
    ])
    expect(record.calls[0]?.ms).toBeGreaterThanOrEqual(0)
    expect(record.calls[0]?.usage).toEqual({
      input: 1000,
      output: 50,
      cacheRead: 0,
      cacheCreation: 0,
    })
    // 승인 화면은 기록을 쓰고 모델을 다시 부르지 않는다
    await hh.relay.review(r.workKey, 't-03')
    expect(fs.readFileSync(`${path.join(hh.root, 'scenario.json')}.review-count`, 'utf8')).toBe('2')
  })
})

describe('[흐름] 지식 검토 호출의 되돌림은 task마다 한 번이다 (D300)', () => {
  it('되돌린 뒤 고치지 않고 다시 멈추면 같은 지적은 다시 되돌리지 않고 경고로만 남는다', async () => {
    const RATE = 'docs/knowledge/points/rate.md'
    const text =
      [
        '---',
        'kind: rule',
        'source: human',
        '---',
        '# 적립률은 2%',
        '',
        '## 규칙',
        '- 환불 회수율은 1%다.',
      ].join('\n') + '\n'
    const verify: Scenario['tasks'][string] = [
      { do: 'prompt' },
      { do: 'commit', files: { [RATE]: text }, message: 'knowledge' },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      {
        do: 'write',
        file: 'handoff.md',
        text: handoff({ summary: `고쳤다.\n새 지식: ${RATE} — 없음` }),
      },
      // 지적에 동의하지 않아 아무것도 고치지 않고 다시 멈춘다
      { do: 'stop', onBlock: [{ do: 'stop' }] },
    ]
    const hh = await harness({
      scenario: {
        ...scenario({ verify }),
        review: [
          {
            issues: [
              {
                file: RATE,
                kind: 'undecided_in_rule',
                quote: '환불 회수율은 1%다.',
                fix: '옮긴다',
              },
            ],
          },
        ],
      },
      env: { RELAY_KNOWLEDGE: 'on' },
    })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-review-once', REPO_FILES)
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const result = await drive(hh.relay, hh.ui, r.workKey)
    await settle(hh, r.workKey)
    expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    expect(result.tasks.map((t) => t.bounces)).toEqual([0, 0, 1])
    expect(fs.readFileSync(`${path.join(hh.root, 'scenario.json')}.review-count`, 'utf8')).toBe('1')
    const workDir = path.join(
      hh.home,
      'projects',
      projectId,
      'works',
      r.workKey.split('/')[1] ?? '',
    )
    const record = JSON.parse(
      fs.readFileSync(path.join(workDir, 'tasks', '03-verify', 'knowledge-review.json'), 'utf8'),
    ) as { calls: { bounced: boolean }[] }
    expect(record.calls.map((c) => c.bounced)).toEqual([true])
    // 승인 화면에서도 같은 지적은 막는 오류가 아니라 경고다
    const review = await hh.relay.review(r.workKey, 't-03')
    expect(review?.errors.map((e) => e.message).join()).not.toContain('[지식 검토')
    expect(review?.warnings.map((e) => e.message).join()).toContain('[지식 검토')
  })
})

describe('[흐름] 이 Work가 고친 지식은 머지 전 앞 Work의 글보다 이긴다', () => {
  it('앞 Work가 남긴 1%를 이 Work가 2%로 고치면, 이 Work의 다음 task에는 2%가 들어간다', async () => {
    const RATE = 'docs/knowledge/rate.md'
    const rule = (v: string) =>
      [
        '---',
        'kind: rule',
        'source: human',
        '---',
        `# 적립률은 ${v}`,
        '',
        '## 규칙',
        `- 적립률은 ${v}다.`,
      ].join('\n') + '\n'
    const verify = (line: string): Step[] => [
      { do: 'prompt' },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      { do: 'write', file: 'handoff.md', text: handoff({ summary: `고쳤다.\n${line}` }) },
      { do: 'stop' },
    ]
    const first = scenario({
      verify: [
        { do: 'prompt' },
        { do: 'commit', files: { [RATE]: rule('1%') }, message: 'knowledge' },
        ...verify(`새 지식: ${RATE} — 없음`).slice(1),
      ],
    })
    const hh = await harness({
      scenario: first,
      env: { RELAY_KNOWLEDGE: 'on', RELAY_KNOWLEDGE_REVIEW: 'off' },
    })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-mine', REPO_FILES)
    const projectId = await register(hh, repo)
    const make = async () => {
      const r = await hh.relay.createWork(projectId, {
        request: REQUEST,
        baseBranch: 'main',
        type: 'bugfix',
        baseLocation: 'local',
      })
      if (!r.ok) throw new Error(r.error)
      const result = await drive(hh.relay, hh.ui, r.workKey)
      await settle(hh, r.workKey)
      expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
      return r.workKey.split('/')[1] ?? ''
    }
    await make()
    // 두 번째 Work: fix가 같은 경로를 2%로 고쳐 커밋한다. 앞 Work는 머지되지 않았다
    const second = scenario({
      fix: [
        { do: 'prompt' },
        { do: 'commit', files: { [RATE]: rule('2%') }, message: 'knowledge: 2%' },
        ...steps('fix').slice(1),
      ],
      verify: verify(`고친 지식: ${RATE} — 1% → 2%`),
    })
    fs.writeFileSync(path.join(hh.root, 'scenario.json'), JSON.stringify(second))
    const workId = await make()
    const injected = fs.readFileSync(
      path.join(
        hh.home,
        'projects',
        projectId,
        'works',
        workId,
        'tasks',
        '03-verify',
        'knowledge-injected.md',
      ),
      'utf8',
    )
    expect(injected).toContain('적립률은 2%다.')
    expect(injected).not.toContain('적립률은 1%다.')
  })
})

describe('[흐름] 지식이 많으면 관련 항목만 넣는다 (D295)', () => {
  it('요청과 관련 있는 항목은 본문으로, 나머지는 제목만이거나 빼고, 그렇다고 context.md에 적는다', async () => {
    const many: Record<string, string> = {}
    for (let k = 0; k < 60; k++)
      many[`docs/knowledge/misc/item-${String(k).padStart(2, '0')}.md`] =
        `---\nkind: fact\nsource: investigation\n---\n# 배포 메모 ${k}\n\n## 내용\n- ${'서버 설정 '.repeat(30)}\n`
    many['docs/knowledge/math/empty-average.md'] =
      '---\nkind: rule\nsource: human\n---\n# 빈 배열의 평균은 0\n\n## 규칙\n- 빈 배열의 평균은 NaN이 아니라 0이다. `src/avg.js`\n'
    const hh = await harness({ scenario: wait, env: { RELAY_KNOWLEDGE: 'on' } })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-many', { ...REPO_FILES, ...many })
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    await hh.ui.until(
      () => hh.records().some((x) => x['type'] === 'hook' && x['event'] === 'UserPromptSubmit'),
      '첫 프롬프트',
    )
    const dir = path.join(
      hh.home,
      'projects',
      projectId,
      'works',
      r.workKey.split('/')[1] ?? '',
      'tasks',
      '01-intake',
    )
    const context = fs.readFileSync(path.join(dir, 'context.md'), 'utf8')
    expect(context).toContain('관련 있어 보이는 항목만 넣었다(전체 61개')
    const injected = fs.readFileSync(path.join(dir, 'knowledge-injected.md'), 'utf8')
    expect(injected.indexOf('docs/knowledge/math/empty-average.md')).toBe(3)
    expect(injected).toContain('(제목만)')
  })
})

describe('[흐름] 지식 파일만 고친 턴도 검토 되돌림을 받는다 (D328)', () => {
  it('형식 되돌림 뒤 지식 파일만 고쳐 멈춰도 검토가 찾은 것을 되돌리고, 실제로 되돌렸을 때만 썼다고 적는다', async () => {
    const RATE = 'docs/knowledge/points/rate.md'
    const text = (undecided: boolean) =>
      [
        '---',
        'kind: rule',
        'source: human',
        '---',
        '# 적립률은 2%',
        '',
        '## 규칙',
        '- 적립률은 2%다.',
        ...(undecided
          ? ['', '## 아직 정하지 않은 것', '- 환불 회수율: 정산팀이 정함. 지금 코드는 1%']
          : ['- 환불 회수율은 1%다.']),
      ].join('\n') + '\n'
    const verify: Scenario['tasks'][string] = [
      { do: 'prompt' },
      // 머리글이 없는 지식 파일: 기계적 확인(형식)이 먼저 되돌린다
      { do: 'commit', files: { [RATE]: '# 적립률\n환불 회수율은 1%다.\n' }, message: 'knowledge' },
      { do: 'write', file: 'verification.md', text: VERIFICATION },
      { do: 'write', file: 'pr.md', text: PR },
      {
        do: 'write',
        file: 'handoff.md',
        text: handoff({ summary: `고쳤다.\n새 지식: ${RATE} — 없음` }),
      },
      {
        do: 'stop',
        onBlock: [
          // handoff는 그대로 두고 지식 파일의 형식만 고친다. 이번에는 검토가 찾는다
          { do: 'commit', files: { [RATE]: text(false) }, message: 'knowledge: 형식' },
          {
            do: 'stop',
            onBlock: [
              { do: 'commit', files: { [RATE]: text(true) }, message: 'knowledge: 정하지 않은 것' },
              { do: 'stop' },
            ],
          },
        ],
      },
    ]
    const hh = await harness({
      scenario: {
        ...scenario({ verify }),
        review: [
          {
            issues: [
              {
                file: RATE,
                kind: 'undecided_in_rule',
                quote: '환불 회수율은 1%다.',
                fix: '`## 아직 정하지 않은 것`으로 옮긴다',
              },
            ],
          },
          { issues: [] },
        ],
      },
      env: { RELAY_KNOWLEDGE: 'on' },
    })
    h = hh
    const { repo } = makeRepo(hh.root, 'knowledge-only-turn', REPO_FILES)
    const projectId = await register(hh, repo)
    const r = await hh.relay.createWork(projectId, {
      request: REQUEST,
      baseBranch: 'main',
      type: 'bugfix',
      baseLocation: 'local',
    })
    if (!r.ok) throw new Error(r.error)
    const result = await drive(hh.relay, hh.ui, r.workKey)
    await settle(hh, r.workKey)
    expect(result, hh.ui.dump()).toMatchObject({ status: 'completed', reason: null })
    const workDir = path.join(
      hh.home,
      'projects',
      projectId,
      'works',
      r.workKey.split('/')[1] ?? '',
    )
    const bounced = fs
      .readFileSync(path.join(workDir, 'events.jsonl'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('task.bounced'))
    expect(bounced).toHaveLength(2)
    expect(bounced[1]).toContain('[지식 검토: 규칙 절에 정하지 않은 것]')
    const record = JSON.parse(
      fs.readFileSync(path.join(workDir, 'tasks', '03-verify', 'knowledge-review.json'), 'utf8'),
    ) as { calls: { bounced: boolean; issues: unknown[] }[] }
    expect(record.calls.map((c) => [c.bounced, c.issues.length])).toEqual([
      [true, 1],
      [false, 0],
    ])
  })
})
