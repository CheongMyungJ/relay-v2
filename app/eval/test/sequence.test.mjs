// 장기 평가 시나리오(sequence)의 Work 나누기: 사람만 아는 규칙의 '물으면 답함' → '이미 말함', 규칙이 바뀌는 Work,
// 누적 숨긴 시험과 뺀 시험, Work마다의 유형, 모양 검사 (docs/eval.md 5절, relay-v3 docs/m3-design.md 6절).
// 다시 말하기(PM1)와 누적 회귀가 이 값으로 세어지므로 여기서 지킨다. 모델을 부르지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { sequenceProblems, shapeProblems } from '../check-scenario.mjs'
import { systemPrompt } from '../lib/human.mjs'
import {
  activeChecks,
  allChecks,
  isSequence,
  ruleKnowledge,
  workParts,
  workScenario,
} from '../lib/works.mjs'

const check = (name) => ({ name, file: `${name}.test.js` })

const scenario = {
  id: 't-seq',
  type: 'general',
  sequence: {
    chain: true,
    persona: 'continuous',
    lines: { include: ['src/**/*.js'], min: 1, max: 10 },
  },
  rules: [
    { id: 'R1', text: '규칙 하나' },
    { id: 'R2', text: '옛 규칙', changes: [{ work: 3, text: '새 규칙' }] },
  ],
  works: [
    {
      type: 'feature',
      report: 'a',
      rules: ['R1', 'R2'],
      knowledge: [{ share: 'on_ask', text: '이번 일만' }],
      checks: [check('a1'), check('a2')],
    },
    { type: 'bugfix', report: 'b', rules: ['R1'], checks: [check('b1')] },
    { report: 'c', rules: ['R2'], retires: ['a2'], checks: [check('c1')] },
    { report: 'd', rules: ['R2', 'R1'], checks: [check('d1')] },
  ],
}

describe('사람만 아는 규칙 (PM1)', () => {
  it('처음 드는 Work에서는 물으면 답함, 그 뒤는 이미 말함(carry)', () => {
    expect(ruleKnowledge(scenario, 0)).toEqual([
      { share: 'on_ask', text: '규칙 하나', rule: 'R1' },
      { share: 'on_ask', text: '옛 규칙', rule: 'R2' },
    ])
    expect(ruleKnowledge(scenario, 1)).toEqual([
      { share: 'told', text: '규칙 하나', rule: 'R1', carry: true },
    ])
  })

  it('바뀌는 Work에서는 요청이 새 규칙을 말하므로 처음부터 앎, 그 뒤는 새 글로 이미 말함', () => {
    expect(ruleKnowledge(scenario, 2)).toEqual([{ share: 'upfront', text: '새 규칙', rule: 'R2' }])
    expect(ruleKnowledge(scenario, 3)).toEqual([
      { share: 'told', text: '새 규칙', rule: 'R2', carry: true },
      { share: 'told', text: '규칙 하나', rule: 'R1', carry: true },
    ])
  })

  it('바뀐 뒤 처음 드는 Work는 새 글로 물으면 답함이다(옛 글을 말한 것은 이미 말한 것이 아니다)', () => {
    const s = {
      ...scenario,
      rules: [{ id: 'R1', text: '옛', changes: [{ work: 2, text: '새' }] }],
      works: [
        { report: 'a', rules: ['R1'] },
        { report: 'b', rules: ['R1'] },
        { report: 'c', rules: [] },
        { report: 'd', rules: ['R1'] },
      ],
    }
    expect(ruleKnowledge(s, 1)).toEqual([{ share: 'upfront', text: '새', rule: 'R1' }])
    expect(ruleKnowledge(s, 3)).toEqual([{ share: 'told', text: '새', rule: 'R1', carry: true }])
    const late = {
      ...s,
      works: [
        { report: 'a', rules: ['R1'] },
        { report: 'b', rules: [] },
        { report: 'c', rules: ['R1'] },
      ],
    }
    expect(
      ruleKnowledge(
        { ...late, rules: [{ id: 'R1', text: '옛', changes: [{ work: 2, text: '새' }] }] },
        2,
      ),
    ).toEqual([{ share: 'on_ask', text: '새', rule: 'R1' }])
  })

  it('Work의 지식은 규칙을 앞에, 그 Work만의 지식을 뒤에 둔다. carry가 다시 알려 줌의 분모다', () => {
    const parts = workParts(scenario)
    expect(parts[0].knowledge.map((k) => k.text)).toEqual(['규칙 하나', '옛 규칙', '이번 일만'])
    expect(parts.map((w) => w.knowledge.filter((k) => k.carry).length)).toEqual([0, 1, 0, 2])
    // works만 있고 sequence가 없는 시나리오는 그대로 둔다
    const plain = {
      works: [{ report: 'x', rules: ['R1'], knowledge: [], checks: [] }],
      rules: scenario.rules,
    }
    expect(workParts(plain)[0].knowledge).toEqual([])
    expect(isSequence(plain)).toBe(false)
  })

  it('사람 역할에게 이미 말함을 알리는 규칙은 그런 항목이 있을 때만 넣는다', () => {
    const first = systemPrompt('cli', workScenario(scenario, 0), '설명서', 'cli')
    const second = systemPrompt('cli', workScenario(scenario, 1), '설명서', 'cli')
    expect(first).not.toContain('이미 말함')
    expect(second).toContain('- 1. [이미 말함] 규칙 하나')
    expect(second).toContain('"이미 말함" 항목은 앞 일에서 네가 이미 알려 준 규칙이다')
  })
})

describe('누적 숨긴 시험 (chain)', () => {
  it('그 Work까지의 시험을 돌리고 앞 Work의 것에 regression을 붙인다. retires는 그 Work부터 뺀다', () => {
    const names = (n) => activeChecks(scenario, n).map((c) => `${c.name}${c.regression ? '*' : ''}`)
    expect(names(0)).toEqual(['a1', 'a2'])
    expect(names(1)).toEqual(['a1*', 'a2*', 'b1'])
    expect(names(2)).toEqual(['a1*', 'b1*', 'c1'])
    expect(names(3)).toEqual(['a1*', 'b1*', 'c1*', 'd1'])
    expect(allChecks(scenario).map((c) => c.name)).toEqual(['a1', 'a2', 'b1', 'c1', 'd1'])
  })

  it('chain이 아니면 그 Work의 시험만', () => {
    const s = { ...scenario, sequence: { ...scenario.sequence, chain: false } }
    expect(activeChecks(s, 1).map((c) => c.name)).toEqual(['b1'])
  })

  it('workScenario는 누적 시험과 그 Work의 유형을 준다(없으면 시나리오의 유형)', () => {
    const w1 = workScenario(scenario, 1)
    expect(w1.type).toBe('bugfix')
    expect(w1.checks.map((c) => c.name)).toEqual(['a1', 'a2', 'b1'])
    expect(workScenario(scenario, 2).type).toBe('general')
    expect(workScenario(scenario, 3).knowledge.filter((k) => k.carry).length).toBe(2)
  })
})

describe('장기 평가의 모양', () => {
  it('이상 없는 시나리오', () => {
    expect(sequenceProblems(scenario)).toEqual([])
    expect(shapeProblems(scenario)).toEqual([])
    expect(sequenceProblems({ id: 'x', checks: [] })).toEqual([])
  })

  it('없는 규칙, 앞에 없는 뺀 시험, 쓰이지 않는 규칙, 잘못된 바뀜, 줄 수 형식', () => {
    const bad = {
      ...scenario,
      sequence: { chain: true, lines: { include: [], min: 5, max: 1 } },
      rules: [
        { id: 'R1', text: '하나', changes: [{ work: 2, text: '둘' }] },
        { id: 'R9', text: '안 씀' },
        { id: 'R3', text: '셋', changes: [{ work: 1, text: 'x' }] },
      ],
      works: [
        { report: 'a', rules: ['R1', 'R3'], checks: [check('a1')] },
        { report: 'b', rules: ['R2'], retires: ['a1', 'b1'], checks: [check('b1')] },
      ],
    }
    expect(sequenceProblems(bad)).toEqual([
      'Work 2의 규칙 R2가 rules에 없음',
      'Work 2이 빼는 시험 b1이 앞 Work에 없음',
      '규칙 R1가 바뀌는 Work 2의 rules에 R1가 없음',
      '규칙 R9가 어느 Work에도 들지 않음',
      '규칙 R3가 바뀌는 Work 번호가 잘못됨: 1',
      'sequence.lines는 { include, min, max }',
    ])
  })

  it('장기 평가 판(48): 요청 15개, 규칙 다섯, 봉인 과제 셋, 모양 이상 없음', () => {
    const dir = path.join(import.meta.dirname, '../scenarios/48-long-shop')
    const s = JSON.parse(fs.readFileSync(path.join(dir, 'scenario.json'), 'utf8'))
    expect(shapeProblems(s)).toEqual([])
    expect(s.works).toHaveLength(15)
    expect(s.rules).toHaveLength(5)
    // 규칙마다 두 Work 이상에 들어 다시 말하기를 잴 수 있다
    for (const r of s.rules)
      expect(s.works.filter((w) => w.rules.includes(r.id)).length).toBeGreaterThan(1)
    const tasks = JSON.parse(fs.readFileSync(path.join(dir, 'sealed/tasks.json'), 'utf8')).tasks
    expect(tasks).toHaveLength(s.sequence.sealed.tasks)
    // 봉인 과제는 사람 없이 돈다: 사람 지식이 없다
    for (const t of tasks) expect(t.knowledge).toBeUndefined()
  })
})
