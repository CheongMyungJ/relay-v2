// relay-v3 쪽 (relay3, relay3-noreview; relay-v3 docs/experiments/m2/protocol.md): 쪽 등록, 사람 역할의 화면 종류와 설명서,
// 기본 짝, 앱 저장소에서 Work·판정할 폴더·리뷰 토큰 읽기, 보고서의 관문 표
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  guideName,
  pickTypeLines,
  renderObservation,
  screenKind,
  systemPrompt,
} from '../lib/human.mjs'
import { isRelay3, relay3Env } from '../lib/kind.mjs'
import {
  gateSummary,
  parseEvents,
  Relay3Arm,
  reviewUsage,
  sumReviews,
  withReviewUsage,
  workedAfterReview,
  workEnd,
  workLabel,
} from '../lib/relay3-arm.mjs'
import { defaultPairs } from '../lib/works.mjs'
import { unrelatedFiles } from '../lib/repo.mjs'
import { relay3Rows } from '../report.mjs'

const dirs = []
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const scenario = {
  id: 'x',
  title: 't',
  purpose: 'p',
  report: '청구서 합계가 3원 크다',
  knowledge: [{ share: 'on_ask', text: '부가세는 줄마다 버림' }],
}

describe('쪽 등록', () => {
  it('relay3과 relay3-noreview만 relay-v3 쪽이고, 리뷰 끈 쪽만 RELAY_ABLATE=review를 받는다', () => {
    expect(['relay3', 'relay3-noreview'].map(isRelay3)).toEqual([true, true])
    expect(['relay', 'cli', 'relay3-off', 'relay3@auto', undefined].map(isRelay3)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ])
    expect(relay3Env('relay3')).toEqual({})
    expect(relay3Env('relay3-noreview')).toEqual({ RELAY_ABLATE: 'review' })
    // 돌려준 것을 고쳐도 다음 값이 바뀌지 않는다
    relay3Env('relay3-noreview').RELAY_ABLATE = 'x'
    expect(relay3Env('relay3-noreview')).toEqual({ RELAY_ABLATE: 'review' })
  })

  it('화면 종류는 relay3이고 설명서는 두 쪽 모두 guides/relay3.md다', () => {
    expect(['relay3', 'relay3-noreview', 'relay', 'relay@auto', 'cli'].map(screenKind)).toEqual([
      'relay3',
      'relay3',
      'relay',
      'relay',
      'cli',
    ])
    expect(guideName('relay3', 'relay3')).toBe('relay3')
    expect(guideName('relay3-noreview', 'relay3')).toBe('relay3')
    expect(fs.existsSync(path.resolve(import.meta.dirname, '../guides/relay3.md'))).toBe(true)
  })

  it('기본 짝: cli가 함께 돌았으면 relay-v3 쪽과 유형을 정한 relay 쪽 각각 대 cli를 더한다(규약의 쪽마다 P2)', () => {
    expect(defaultPairs(scenario, ['relay3', 'cli'])).toEqual([
      ['relay', 'cli'],
      ['relay3', 'cli'],
    ])
    expect(defaultPairs(scenario, ['relay3'])).toEqual([['relay', 'cli']])
    expect(
      defaultPairs(scenario, ['relay3', 'relay3-noreview', 'relay@auto', 'cli', 'relay-off']),
    ).toEqual([
      ['relay', 'cli'],
      ['relay3', 'cli'],
      ['relay3-noreview', 'cli'],
      ['relay@auto', 'cli'],
    ])
    expect(defaultPairs({ ...scenario, works: [{ report: 'a' }] }, ['relay3', 'cli'])).toEqual([
      ['relay', 'relay-off'],
      ['relay3', 'cli'],
    ])
    // 시나리오의 짝과 겹치면 더하지 않는다
    const custom = { ...scenario, type: 'custom', customType: { id: 'c', name: 'n' } }
    expect(defaultPairs(custom, ['relay', 'relay@general', 'cli'])).toEqual([
      ['relay', 'relay@general'],
      ['relay@general', 'cli'],
    ])
  })
})

describe('사람 역할 (relay3)', () => {
  it('relay 앱과 같은 행동 설명을 받고, 유형 고르기 지시는 받지 않는다', () => {
    const relay = systemPrompt('relay', scenario, '설명서', 'relay')
    const v3 = systemPrompt('relay3', scenario, '설명서', 'relay3')
    const actions = (p) => p.split('## 행동')[1].split('## 끝의 기준')[0]
    expect(actions(v3)).toBe(actions(relay))
    expect(actions(v3)).toContain('- click {id}')
    const custom = { ...scenario, type: 'custom', customType: { id: 'c', name: '조사 적용' } }
    expect(pickTypeLines('relay3', custom)).toEqual([])
    expect(pickTypeLines('relay', custom)).not.toEqual([])
  })

  it('hands-off는 relay3에도 같은 규칙이다', () => {
    const p = systemPrompt('relay3', scenario, '설명서', 'relay3', true)
    expect(p).toContain('손을 뗀 사람')
    expect(p).not.toContain('결과를 받아들이기(승인, 완료, 커밋) 전에')
  })

  it('화면은 relay처럼 보이는 글자, 터미널, 누를 수 있는 요소로 보인다', () => {
    const obs = {
      turn: 3,
      elapsed: '1분 0초',
      screen: {
        text: '승인 기다림',
        terminal: '> 계약을 냈습니다',
        elements: [{ id: 1, role: 'button', name: '승인' }],
      },
    }
    expect(renderObservation('relay3', obs, true, true)).toBe(
      renderObservation('relay', obs, true, true),
    )
    expect(renderObservation('relay3', obs, false, false)).toContain('[1] button "승인"')
  })
})

describe('앱 저장소 읽기', () => {
  it('Work 이름은 id 앞 8자, 팀원 교대 뒤 저장소는 사람 번호를 붙인다', () => {
    expect(workLabel(0, '3f2a9c1e-0000-4000-8000-000000000000')).toBe('3f2a9c1e')
    expect(workLabel(1, '3f2a9c1e-0000-4000-8000-000000000000')).toBe('p2-3f2a9c1e')
  })

  it('리뷰 토큰은 events.jsonl의 review 기록의 usage를 더한다. 깨진 줄은 건너뛴다', () => {
    const events = parseEvents(
      [
        '{"type":"created"}',
        '{"type":"review","status":"done","findings":2,"usage":{"input_tokens":100,"output_tokens":20,"cache_read_input_tokens":1000,"cache_creation_input_tokens":300}}',
        '{"type":"review","status":"failed","findings":0}',
        '{"type":"review","sta',
        '',
      ].join('\n'),
    )
    expect(events).toHaveLength(3)
    expect(reviewUsage(events)).toEqual({
      calls: 2,
      done: 1,
      failed: 1,
      skipped: 0,
      prepared: 0,
      reused: 0,
      aborted: 0,
      usageUnknown: 1,
      input: 100,
      output: 20,
      cacheRead: 1000,
      cacheWrite: 300,
    })
    expect(reviewUsage(parseEvents('{"type":"evidence"}'))).toBeNull()
    expect(sumReviews([null, null])).toBeNull()
    expect(sumReviews([reviewUsage(events), null, reviewUsage(events)])).toMatchObject({
      calls: 4,
      usageUnknown: 2,
      input: 200,
      cacheRead: 2000,
    })
  })

  it('리뷰를 끈 쪽의 skipped 기록은 호출로 세지 않고 따로 센다', () => {
    const events = parseEvents(
      ['{"type":"review","status":"skipped","findings":0}', '{"type":"ended"}'].join('\n'),
    )
    expect(reviewUsage(events)).toEqual({
      calls: 0,
      done: 0,
      failed: 0,
      skipped: 1,
      prepared: 0,
      reused: 0,
      aborted: 0,
      usageUnknown: 0,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
    })
    expect(workedAfterReview(events)).toBeNull()
  })

  it('리뷰 뒤에 세션이 도구를 더 썼는지(리뷰가 코드에 닿을 수 있었나) 본다', () => {
    const hook = (tool) => ({ type: 'hook', event: 'PreToolUse', tool })
    const review = { type: 'review', status: 'done' }
    expect(workedAfterReview([hook('Bash'), review, { type: 'ended' }])).toBe(false)
    expect(workedAfterReview([review, hook('Edit')])).toBe(true)
    expect(workedAfterReview([{ type: 'evidence' }])).toBeNull()
  })

  it('에이전트 토큰에 리뷰 토큰을 더하고 세션·메시지 수는 그대로 둔다', () => {
    const agent = { input: 10, output: 5, cacheRead: 100, cacheWrite: 50, messages: 7, sessions: 2 }
    expect(withReviewUsage(agent, null)).toBe(agent)
    const review = {
      calls: 1,
      done: 1,
      failed: 0,
      input: 1,
      output: 2,
      cacheRead: 3,
      cacheWrite: 4,
    }
    expect(withReviewUsage(agent, review)).toEqual({
      input: 11,
      output: 7,
      cacheRead: 103,
      cacheWrite: 54,
      messages: 7,
      sessions: 2,
      review,
    })
  })

  it('관문 요약', () => {
    expect(gateSummary(null)).toBeNull()
    expect(
      gateSummary({
        conclusion: 'human_merge',
        decisive: '자동 머지가 꺼져 있음',
        reasons: ['x'],
        condition: 'small',
        shadow: true,
      }),
    ).toEqual({
      conclusion: 'human_merge',
      condition: 'small',
      shadow: true,
      decisive: '자동 머지가 꺼져 있음',
      export: false,
    })
  })

  it('관문 결론이 내보내기(리뷰 포함) 측정에서 나왔는지는 마지막 evidence 기록과 내보낸 head로 가린다', () => {
    const gate = { conclusion: 'human_merge', shadow: false }
    const ev = (head, exp) => ({ type: 'evidence', head, export: exp })
    // 내보내기 뒤 같은 head
    expect(gateSummary(gate, [ev('a', false), ev('a', true)], 'a').export).toBe(true)
    // [끝내기] 전에 끝남: 마지막 측정이 Stop 뒤의 측정
    expect(gateSummary(gate, [ev('a', false)], null).export).toBe(false)
    // 내보낸 뒤 커밋이 더 생겨 다시 잼(내보내기 아님)
    expect(gateSummary(gate, [ev('a', true), ev('b', false)], 'a').export).toBe(false)
    // 리뷰가 도는 중에 끝남(내보내기 evidence 기록이 아직 없음)
    expect(gateSummary(gate, [ev('a', false)], 'a').export).toBe(false)
    // worktree HEAD를 주면 그것이 내보낸 head일 때만: 커밋했는데 다시 재기 전에 끝남(결론은 앞 커밋의 것)
    expect(gateSummary(gate, [ev('a', true)], 'a', 'a').export).toBe(true)
    expect(gateSummary(gate, [ev('a', true)], 'a', 'b').export).toBe(false)
    expect(gateSummary(gate, [ev('a', true)], 'a', null).export).toBe(false)
  })

  it('Work는 work.json으로 찾고(check worktree는 빼고), 판정할 폴더는 worktree와 세션이 따로 만든 브랜치다', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay3-arm-'))
    dirs.push(root)
    const repo = path.join(root, 'repo')
    fs.mkdirSync(repo)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'config', 'user.email', 'a@b')
    git(repo, 'config', 'user.name', 'a')
    fs.writeFileSync(path.join(repo, 'a.js'), 'a\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'base')
    const base = git(repo, 'rev-parse', 'HEAD')

    const arm = new Relay3Arm({ dir: root, repo, base, agentEnv: {}, agentConfigDir: root })
    const id = '3f2a9c1e-0000-4000-8000-000000000000'
    const home = path.join(root, 'relay3-home')
    const wt = path.join(home, 'worktrees', id)
    git(repo, 'worktree', 'add', '-q', '-b', 'relay/fix-3f2a', wt, 'main')
    fs.writeFileSync(path.join(wt, 'b.js'), 'b\n')
    git(wt, 'add', '.')
    git(wt, 'commit', '-qm', 'fix')
    const head = git(wt, 'rev-parse', 'HEAD')
    // 세션이 따로 만든 로컬 브랜치
    git(repo, 'branch', 'extra', 'main')
    git(repo, 'checkout', '-q', 'extra')
    fs.writeFileSync(path.join(repo, 'c.js'), 'c\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'extra')
    git(repo, 'checkout', '-q', 'main')
    // 증거를 재는 check worktree (Work가 아님)
    git(
      repo,
      'worktree',
      'add',
      '-q',
      '--detach',
      path.join(home, 'worktrees', 'key', 'head'),
      'main',
    )

    const work = path.join(home, 'works', id)
    fs.mkdirSync(work, { recursive: true })
    fs.writeFileSync(
      path.join(work, 'work.json'),
      JSON.stringify({
        id,
        state: 'done',
        branch: 'relay/fix-3f2a',
        worktree: wt,
        session_id: 'sess-1',
        gate: { conclusion: 'human_merge', condition: null, shadow: false, decisive: 'd' },
        evidence_path: path.join(home, 'evidence', 'k', 'x.json'),
        exported_head: head,
      }),
    )
    fs.writeFileSync(
      path.join(work, 'contract.json'),
      JSON.stringify({ id: 'fix-3f2a', approved_by: 'human' }),
    )
    fs.writeFileSync(
      path.join(work, 'events.jsonl'),
      [
        JSON.stringify({ type: 'evidence', head, export: false, conclusion: 'human_merge' }),
        '{"type":"review","status":"done","usage":{"input_tokens":5,"output_tokens":1}}',
        JSON.stringify({ type: 'evidence', head, export: true, conclusion: 'human_merge' }),
        '{"type":"ended"}',
        '',
      ].join('\n'),
    )

    expect(arm.worktrees()).toEqual([{ path: wt, label: '3f2a9c1e' }])
    const [w] = arm.works()
    expect(w).toMatchObject({
      id: '3f2a9c1e',
      dir: work,
      status: 'done',
      end: 'confirmed',
      ended: true,
      branch: 'relay/fix-3f2a',
      contract: { id: 'fix-3f2a', approvedBy: 'human' },
      gate: { conclusion: 'human_merge', shadow: false, export: true },
      review: { calls: 1, input: 5, output: 1 },
      workedAfterReview: false,
      tasks: [{ seq: 1, node: 'session', session: 'sess-1', approved_by: 'human' }],
    })
    expect(Object.keys(w.files)).toEqual(['evidence.json', 'ledger.jsonl'])
    expect(arm.reviewUsage()).toMatchObject({ calls: 1, input: 5 })

    const trees = arm.finalTrees()
    expect(trees.map((t) => [t.label, t.git?.branch, t.git?.commits])).toEqual([
      ['3f2a9c1e', 'relay/fix-3f2a', 1],
      ['branch-extra', 'extra', 1],
    ])

    // 세션이 평가 레포의 main을 직접 움직이면 판정 폴더에는 들지 않고(skipBranches) mainMoved로 남는다
    expect(arm.mainMoved()).toBeNull()
    fs.writeFileSync(path.join(repo, 'd.js'), 'd\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'on main')
    expect(arm.mainMoved()).toMatchObject({ from: base, commits: 1 })
    expect(arm.finalTrees().map((t) => t.label)).toEqual(['3f2a9c1e', 'branch-extra'])
  })
})

describe('Work의 끝 (V18 끝내기 두 단계)', () => {
  const ev = (head, exp) => ({ type: 'evidence', head, export: exp })
  const working = (o) =>
    workEnd({ state: 'working', events: [], exportedHead: null, head: 'a', clean: true, ...o })

  it('[끝 확정]·머지·닫힘·버림은 상태와 relay-v3가 남기는 기록(ended, merged, merged_outside, pr_closed)으로 가른다', () => {
    const done = (...events) => workEnd({ state: 'done', events })
    expect(done({ type: 'ended' })).toBe('confirmed')
    // 앱의 [머지]·정책 머지(works-evidence.ts mergeOnce)와 앱 밖 머지(poll)
    expect(done({ type: 'merged', by: 'policy', head: 'a', pr: 1 })).toBe('merged')
    expect(done({ type: 'merged', by: 'human', head: 'a', pr: 1 })).toBe('merged')
    expect(done({ type: 'merged_outside', head: 'a', pr: 1 })).toBe('merged')
    expect(done({ type: 'pr_closed', pr: 1 })).toBe('closed')
    // 머지에 실패한 뒤 [끝 확정]으로 끝낸 것은 확정이다
    expect(done({ type: 'merge_failed', by: 'human' }, { type: 'ended' })).toBe('confirmed')
    // 기록을 읽지 못하면 끝났다는 것만 안다(확정으로 치지 않는다)
    expect(done()).toBe('done')
    expect(workEnd({ state: 'abandoned', events: [] })).toBe('abandoned')
  })

  it('[끝 확정] 없이 끝나도 끝낸 커밋 상태가 내보내기 증거·리뷰를 받은 그 상태면 끝이다(prepared)', () => {
    expect(working({ events: [ev('a', false), ev('a', true)], exportedHead: 'a' })).toBe('prepared')
    // 계약 다시 중에도 같다
    expect(working({ state: 'recontract', events: [ev('a', true)], exportedHead: 'a' })).toBe(
      'prepared',
    )
  })

  it('[끝내기] 뒤 커밋이 더 생겼거나 커밋하지 않은 변경이 남으면 끝이 아니다(stale)', () => {
    // 커밋이 더 생겨 다시 잼(내보내기 아님)
    expect(working({ events: [ev('a', true), ev('b', false)], exportedHead: 'a', head: 'b' })).toBe(
      'stale',
    )
    // 커밋했지만 증거를 다시 재기 전에 끝남(debounce 중)
    expect(working({ events: [ev('a', true)], exportedHead: 'a', head: 'b' })).toBe('stale')
    // 커밋하지 않은 변경이 남음(v3 증거는 커밋만 잰다)
    expect(working({ events: [ev('a', true)], exportedHead: 'a', clean: false })).toBe('stale')
  })

  it('내보내기 증거가 없으면 끝이 아니다([끝내기]를 누르지 않았거나 리뷰가 도는 중)', () => {
    expect(working({ events: [ev('a', false)] })).toBeNull()
    expect(working({ events: [ev('a', false)], exportedHead: 'a' })).toBeNull()
    expect(working({ state: 'drafting' })).toBeNull()
  })

  it('works()는 Work worktree의 HEAD와 커밋하지 않은 변경으로 끝을 가른다', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay3-end-'))
    dirs.push(root)
    const repo = path.join(root, 'repo')
    fs.mkdirSync(repo)
    git(repo, 'init', '-q', '-b', 'main')
    git(repo, 'config', 'user.email', 'a@b')
    git(repo, 'config', 'user.name', 'a')
    fs.writeFileSync(path.join(repo, 'a.js'), 'a\n')
    git(repo, 'add', '.')
    git(repo, 'commit', '-qm', 'base')
    const arm = new Relay3Arm({
      dir: root,
      repo,
      base: git(repo, 'rev-parse', 'HEAD'),
      agentEnv: {},
      agentConfigDir: root,
    })
    const id = '9a1b2c3d-0000-4000-8000-000000000000'
    const wt = path.join(root, 'relay3-home', 'worktrees', id)
    git(repo, 'worktree', 'add', '-q', '-b', 'relay/fix-9a1b', wt, 'main')
    fs.writeFileSync(path.join(wt, 'b.js'), 'b\n')
    git(wt, 'add', '.')
    git(wt, 'commit', '-qm', 'fix')
    const head = git(wt, 'rev-parse', 'HEAD')
    const work = path.join(root, 'relay3-home', 'works', id)
    fs.mkdirSync(work, { recursive: true })
    fs.writeFileSync(
      path.join(work, 'work.json'),
      JSON.stringify({ id, state: 'working', worktree: wt, exported_head: head }),
    )
    fs.writeFileSync(
      path.join(work, 'events.jsonl'),
      `${JSON.stringify({ type: 'evidence', head, export: true })}\n`,
    )
    expect(arm.works()[0]).toMatchObject({ status: 'working', end: 'prepared', ended: true })
    fs.writeFileSync(path.join(wt, 'c.js'), 'c\n')
    expect(arm.works()[0]).toMatchObject({ end: 'stale', ended: false })
  })
})

describe('보고서의 relay-v3 표', () => {
  const run = (success, gate, review = null, approvedBy = 'human', after = null) => ({
    outcome: { success },
    agent: { review },
    works: [{ status: 'done', contract: { approvedBy }, gate, workedAfterReview: after }],
  })

  it('G1은 자동 조건을 채운 실행 가운데 숨긴 시험 통과, G2는 그 거꾸로다. 판정 불가와 내보내기 결론이 없는 실행은 뺀다', () => {
    const shadow = { conclusion: 'human_merge', shadow: true, export: true }
    const human = { conclusion: 'human_merge', shadow: false, export: true }
    // [끝내기] 전에 끝난 실행: 마지막 결론이 Stop 뒤의 측정이라 G1, G2에 넣지 않는다
    const stopOnly = { conclusion: 'human_merge', shadow: false, export: false }
    const rows = Object.fromEntries(
      relay3Rows([
        run(
          true,
          shadow,
          { calls: 2, input: 1000, cacheRead: 2000, cacheWrite: 0 },
          'human',
          false,
        ),
        run(false, shadow),
        run(true, human),
        run(null, { conclusion: 'auto_merge_candidate', shadow: false, export: true }),
        run(false, null, null, null),
        run(true, stopOnly),
        run(true, { conclusion: 'human_merge', shadow: true }),
      ]),
    )
    expect(rows['계약 승인됨']).toBe('86% (6/7)')
    expect(rows['관문 결론(Work마다 마지막)']).toBe(
      '사람 머지(내보내기) 3, 자동 머지 후보(내보내기) 1, 없음 1, 사람 머지 2',
    )
    expect(rows['내보내기 결론이 있음(G1·G2의 분모, 없으면 뺌)']).toBe('50% (3/6)')
    expect(rows['자동 조건을 채움(그림자·자동 후보)']).toBe('67% (2/3)')
    expect(rows['G1 그 가운데 숨긴 시험 모두 통과']).toBe('50% (1/2)')
    expect(rows['G2 숨긴 시험 모두 통과 가운데 자동 조건을 채움']).toBe('50% (1/2)')
    expect(rows['독립 리뷰 호출 수(돈 것)']).toMatch(/^0\.3 ± /)
    expect(rows['리뷰 뒤 세션이 더 일한 Work']).toBe('0% (0/1)')
  })
})

describe('보고서의 Work 끝', () => {
  it('[끝 확정]·머지와 확정 없이 리뷰 본 커밋 그대로 끝낸 것을 끝으로 세고, 끝의 종류를 Work마다 센다', () => {
    const r = (...ws) => ({ outcome: { success: true }, works: ws })
    const rows = Object.fromEntries(
      relay3Rows([
        r({ status: 'done', end: 'confirmed', ended: true }),
        r({ status: 'working', end: 'prepared', ended: true }),
        r({ status: 'working', end: 'stale', ended: false }),
        r({ status: 'working', end: null, ended: false }),
        // end가 없는 예전 결과는 상태로 센다
        r({ status: 'done' }),
      ]),
    )
    expect(rows['Work 끝남([끝 확정]·머지, 확정 없이 리뷰 본 커밋 그대로)']).toBe('60% (3/5)')
    expect(rows['끝의 종류(Work마다)']).toBe(
      '[끝 확정] 1, 확정 없이 리뷰 본 커밋 그대로 1, [끝내기] 뒤 바뀜(끝 아님) 1, [끝내기] 없음 1',
    )
  })
})

describe('기대 밖 파일', () => {
  it('relay-v3의 계약 예시 자료(.relay/examples/<id>.json)는 시험 자료라 기대 밖으로 세지 않는다', () => {
    const files = [
      'src/invoice/total.js',
      'test/total.test.js',
      '.relay/examples/inv-2031-5216.json',
      '.relay/examples/nested/x.json',
      '.relay/quality.json',
      'README.md',
    ]
    expect(unrelatedFiles(files, ['src/invoice/**', 'test/**'])).toEqual([
      '.relay/examples/nested/x.json',
      '.relay/quality.json',
      'README.md',
    ])
    expect(unrelatedFiles(['a.js'])).toEqual(['a.js'])
  })
})
