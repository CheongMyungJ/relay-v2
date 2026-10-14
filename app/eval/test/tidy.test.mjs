// 지식 정리 실험의 지표 (eval/tidy.mjs, docs/tidy-experiment/protocol.md 4절). 모델을 부르지 않는다
import { describe, expect, it } from 'vitest'
import { tidyRequest } from '../../src/core/knowledge-tidy'
import { badgeClicks, checkRoles, isTidyRequest, runMetrics, summarize } from '../tidy.mjs'

const scenario = {
  checks: [
    { name: '버그', tidyRole: 'bug' },
    { name: '중복' },
    { name: '낡음' },
    { name: '멀쩡', guard: true },
  ],
}

const run = (pass, extra = {}) => ({
  ending: 'done',
  wallMs: 600000,
  human: { costUsd: 1.5 },
  outcome: { checks: Object.entries(pass).map(([name, p]) => ({ name, pass: p })) },
  ...extra,
})

describe('지식 정리 실험 지표', () => {
  it('후보로 채운 요청은 앱이 쓰는 글의 첫머리로 알아본다(사람이 뒤를 고쳐도)', () => {
    const text = tidyRequest([
      { kind: 'stale_anchor', paths: ['docs/knowledge/a.md'], detail: 'X' },
    ])
    expect(isTidyRequest(text)).toBe(true)
    expect(isTidyRequest(`${text}\n\n버그도 같이 봐 줘`)).toBe(true)
    expect(isTidyRequest('지식 파일을 정리해 줘')).toBe(false)
    expect(isTidyRequest(undefined)).toBe(false)
  })

  it('사이드바 후보 누름은 단추 이름으로 세고, 대화상자의 요약과 실패한 누름은 세지 않는다', () => {
    const turns = [
      { actions: [{ do: 'click', label: 'button "지식 정리 후보 3건"', ok: true }] },
      { actions: [{ do: 'click', label: 'summary "지식 정리 후보 3건"', ok: true }] },
      { actions: [{ do: 'click', label: 'button "지식 정리 후보 2건"', ok: false }] },
      { actions: [{ do: 'click', label: 'button "지식 정리 Work로 채우기"', ok: true }] },
    ]
    expect(badgeClicks(turns)).toBe(1)
  })

  it('시험을 버그, 심은 문제, guard로 나눈다', () => {
    expect(checkRoles(scenario)).toEqual({
      bug: ['버그'],
      planted: ['중복', '낡음'],
      guard: ['멀쩡'],
    })
  })

  it('실행 값과 모음: 도구 오류는 빼고, 버그 시험이 없으면 ask 무리다', () => {
    const a = runMetrics(
      run({ 버그: true, 중복: true, 낡음: false, 멀쩡: true }),
      scenario,
      ['버그 고쳐 줘', tidyRequest([])],
      [{ actions: [{ do: 'click', label: 'button "지식 정리 후보 1건"' }] }],
    )
    expect(a).toMatchObject({
      group: 'noask',
      tidyWork: true,
      badge: true,
      planted: 1,
      plantedTotal: 2,
      bug: true,
      guard: true,
    })
    const b = runMetrics(
      run({ 버그: false, 중복: false, 낡음: false, 멀쩡: false }),
      scenario,
      ['버그'],
      [],
    )
    expect(b).toMatchObject({ tidyWork: false, badge: false, planted: 0, bug: false, guard: false })
    expect(runMetrics(run({}, { ending: 'harness_error' }), scenario, [], [])).toBeNull()
    const ask = runMetrics(run({ 중복: true }), { checks: [{ name: '중복' }] }, [], [])
    expect(ask).toMatchObject({ group: 'ask', bug: null, planted: 1, plantedTotal: 1 })
    expect(summarize([a, b])).toMatchObject({
      runs: 2,
      tidyWork: 1,
      badge: 1,
      planted: 1,
      plantedTotal: 4,
      plantedRate: 0.25,
      bug: 1,
      bugRuns: 2,
      guard: 1,
      minutes: 10,
      humanCost: 3,
    })
  })
})
