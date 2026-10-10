// extract run 평가 도구의 시험(모델을 부르지 않는다, docs/extract-eval.md, 결정 21).
// 1. 시나리오마다 손으로 쓴 reference 결과가 조립한 스키마를 통과하고 만점이다(PM-A 0, PM-B 1, 앵커 모두 맞음)
// 2. 함정(traps/*.json)이 해당 지표에서 잡힌다
// 3. 채점 규칙(앵커 대조, 구성, 수치, 판정 읽기), 사용량 읽기, 사용량 한도 가르기, 집계
// 4. 하네스를 가짜 claude(dry)로 끝까지 돌린다: 끝 판정, worktree 변경, 스키마 검사
// 5. 구성별 빌드 인덱스와 제출 검사 config_active(AI 결정 87·88. 컴파일이 드는 경우는 컴파일러가 없으면 건너뛴다)
// 6. integrate·review·summarize 과제(AI 결정 127): 기록으로 만든 패킷, 칸 키가 든 스키마와 쪽 이름, 종류별 결정론과 판정
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'
import {
  activeLines,
  elfSymbols,
  inventoryProblems,
  mergeLines,
  mergeSymbols,
} from '../../../skills/extract/build-index.mjs'
import { compareAnswer, VERDICT_STATUS } from '../../../skills/extract/review.mjs'
import { checkResult } from '../../../skills/extract/rules.mjs'
import { buildIndex } from '../extract/lib/build-index.mjs'
import { findCompiler } from '../extract/lib/cc.mjs'
import { runBin } from '../extract/lib/claude-bin.mjs'
import { applyOps, mergeJudge, readReference, readTraps } from '../extract/lib/fixtures.mjs'
import { judgeArgs } from '../extract/lib/judge.mjs'
import {
  renderPacket,
  runOne,
  SOFT_REASON,
  softReason,
  submitProblems,
  submitReason,
  usageLimit,
} from '../extract/lib/runner.mjs'
import {
  applyJudge,
  checkAnchors,
  checkQuantity,
  claimLines,
  collectAnchors,
  DET_KINDS,
  detApplies,
  detScore,
  expandConfigs,
  hasLeak,
  judgeItems,
  judgePrompt,
  JUDGE_SYSTEM,
  JUDGE_SYSTEMS,
  judgeSystem,
  keyedView,
  nameHas,
  normPath,
  normQuote,
  outputKeys,
  scoreRun,
  unitKey,
} from '../extract/lib/score.mjs'
import { buildSide, sideEntries, sideId } from '../extract/lib/sides.mjs'
import {
  claimSections,
  knownIds,
  PLACEHOLDER_VARS,
  RECORD_KINDS,
  renderTask,
  taskMore,
} from '../extract/lib/tasks.mjs'
import { guard, parseUsage } from '../extract/lib/usage.mjs'
import {
  adoption,
  comparePair,
  filterTasks,
  fromStored,
  relabel,
  summarize,
  toStored,
} from '../extract/report.mjs'
import { listScenarios, loadScenario, plan, planEntries } from '../extract/run.mjs'
import { loadTruth, repoReader, runIds, runKind, scoreDir } from '../extract/score.mjs'

const scenarios = listScenarios()

/** 과제 하나의 결과 채점(종류는 scenario.json, 패킷의 전역 ID는 기록으로 만든 패킷에서) */
function score(dir, truth, task, out, judge) {
  const anchors = checkAnchors(collectAnchors(out), repoReader(dir), '/run/repo')
  const input = renderTask(dir, task, PLACEHOLDER_VARS)
  return scoreRun({
    out,
    truth,
    task: task.id,
    kind: task.kind,
    anchors,
    judge,
    leak: hasLeak(JSON.stringify(out), truth),
    worktreeChanged: false,
    ids: knownIds(input.packet, input.listing),
  })
}

describe.each(scenarios)('시나리오 %s', (id) => {
  const { dir, scenario } = loadScenario(id)
  const truth = loadTruth(dir)

  it('정답 파일이 과제를 가리키고 id가 겹치지 않는다', () => {
    const tasks = scenario.tasks.map((t) => t.id)
    const all = [...truth.recall, ...truth.must_not, ...truth.resolvable]
    const ids = all.map((x) => x.id)
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([])
    expect(all.flatMap((x) => x.tasks).filter((t) => !tasks.includes(t))).toEqual([])
    for (const t of tasks) expect(truth.recall.some((r) => r.tasks.includes(t))).toBe(true)
    expect(truth.configs.map((c) => c.name)).toEqual(scenario.configs)
  })

  it('카나리는 레포, 패킷, 쪽 지시에 없다', () => {
    const texts = []
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else texts.push(fs.readFileSync(p, 'utf8'))
      }
    }
    walk(path.join(dir, 'repo'))
    walk(path.join(dir, 'packets'))
    if (fs.existsSync(path.join(dir, 'records'))) walk(path.join(dir, 'records'))
    for (const t of scenario.tasks.filter((x) => RECORD_KINDS.includes(x.kind))) {
      const input = renderTask(dir, t, PLACEHOLDER_VARS)
      texts.push(input.packet, input.listing ?? '')
    }
    for (const side of ['base', 'v1'])
      for (const t of scenario.tasks)
        texts.push(buildSide(side, t.kind, t.lens ?? null, taskMore(dir, t)).instructions)
    expect(texts.some((x) => x.includes(truth.canary))).toBe(false)
  })

  it('기록의 근거는 기준 커밋의 파일과 맞고, 주장이 가리키는 근거·단위가 기록에 있다', () => {
    for (const t of scenario.tasks.filter((x) => RECORD_KINDS.includes(x.kind))) {
      const { record } = renderTask(dir, t, PLACEHOLDER_VARS)
      const status = checkAnchors(record.evidence, repoReader(dir), '/run/repo')
        .filter((a) => a.status !== 'ok' && a.status !== 'skipped')
        .map((a) => `${a.id} ${a.status}`)
      expect(status, t.id).toEqual([])
      const ev = new Set(record.evidence.map((e) => e.id))
      const refs = JSON.stringify(record.claims).match(/"evidence":"e-\d{4}"/g) ?? []
      expect(refs.length).toBeGreaterThan(0)
      expect(refs.map((r) => r.slice(12, 18)).filter((e) => !ev.has(e))).toEqual([])
      const units = new Set(record.units.map((u) => u.id))
      expect(record.claims.filter((c) => !units.has(c.unit)).map((c) => c.id)).toEqual([])
    }
  })

  it('summarize 기록의 검토 결과는 review reference의 답을 앱의 비교(review.mjs)로 견준 것과 같다', () => {
    const rv = scenario.tasks.find((x) => x.kind === 'review')
    const sm = scenario.tasks.find((x) => x.kind === 'summarize')
    if (!rv || !sm) return
    const input = renderTask(dir, rv, PLACEHOLDER_VARS)
    const { out } = readReference(dir, rv.id)
    const confirmed = input.record.configs
      .filter((c) => c.status === 'confirmed')
      .map((c) => c.name)
    const want = input.items.map((i) => {
      const claim = input.record.claims.find((c) => c.id === i.claim)
      if (i.kind === 'statement') {
        const v = out.verdicts[i.key].verdict
        return { claim: i.claim, result: v, status: VERDICT_STATUS[v] }
      }
      const r = compareAnswer(claim, i.kind, out.answers[i.key], confirmed)
      return {
        claim: i.claim,
        result: r.result,
        status: r.result === 'conflict' ? 'conflict' : null,
      }
    })
    const got = renderTask(dir, sm, PLACEHOLDER_VARS).record.reviews.map(
      ({ claim, result, status }) => ({
        claim,
        result,
        status,
      }),
    )
    expect(got).toEqual(want)
  })

  it('기록과 기록으로 만든 패킷에 정답 글이 없다', () => {
    const statements = [...truth.recall, ...truth.must_not, ...truth.resolvable].map(
      (x) => x.statement,
    )
    for (const t of scenario.tasks.filter((x) => RECORD_KINDS.includes(x.kind))) {
      const input = renderTask(dir, t, PLACEHOLDER_VARS)
      const text = `${fs.readFileSync(path.join(dir, t.record), 'utf8')}\n${input.packet}\n${input.listing ?? ''}`
      expect(statements.filter((x) => text.includes(x))).toEqual([])
    }
  })

  it.each(scenario.tasks.map((t) => [t.id, t]))('reference %s: 스키마 통과, 만점', (_, task) => {
    const { out, judge } = readReference(dir, task.id)
    const input = renderTask(dir, task, PLACEHOLDER_VARS)
    const built = buildSide('base', task.kind, task.lens ?? null, input.more)
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(built.schema)
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true)
    if (RECORD_KINDS.includes(task.kind))
      // 앱의 제출 규칙(종류만의 규칙 포함)도 통과한다: 구성 이름, 전역 ID, 연결의 모양, coverage 칸, 반박 앵커
      expect(
        checkResult(out, {
          kind: task.kind,
          configs: input.record.configs.map((c) => c.name),
          ids: knownIds(input.packet, input.listing),
          sections: claimSections(input.record),
        }),
      ).toEqual([])
    const s = score(dir, truth, task, out, judge)
    expect(s.violated).toEqual([])
    expect(s.pmB).toBe(1)
    expect(s.undecided).toEqual([])
    expect(s.softened).toEqual([])
    expect(s.anchors.fabricated + s.anchors.lineMismatch).toBe(0)
    // summarize 결과에는 앵커가 없다
    if (task.kind !== 'summarize') expect(s.anchors.total).toBeGreaterThan(0)
  })

  it.each(readTraps(dir).map((t) => [t.name, t]))('함정 %s가 잡힌다', (_, trap) => {
    const ref = readReference(dir, trap.task)
    const out = applyOps(ref.out, trap.ops)
    const judge = mergeJudge(ref.judge, trap.judge)
    const task = scenario.tasks.find((t) => t.id === trap.task)
    const s = score(dir, truth, task, out, judge)
    const e = trap.expect
    if (e.violated) expect(s.violated).toEqual(expect.arrayContaining(e.violated))
    if (e.violated && e.violated.length === 0) expect(s.violated).toEqual([])
    if (e.missed) for (const id of e.missed) expect(s.recall[id], id).toBe(false)
    if (e.found) for (const id of e.found) expect(s.recall[id], id).toBe(true)
    if (e.fabricated) expect(s.anchors.fabricated).toBeGreaterThanOrEqual(e.fabricated)
    if (e.lineMismatch) expect(s.anchors.lineMismatch).toBeGreaterThanOrEqual(e.lineMismatch)
    if (e.leak) expect(s.gates.leak).toBe(true)
    if (e.softened) expect(s.softened).toEqual(expect.arrayContaining(e.softened))
    // 함정은 한 지표 이상에서 reference보다 나빠야 한다
    const worse =
      s.pmA > 0 ||
      (s.pmB ?? 1) < 1 ||
      s.anchors.fabricated + s.anchors.lineMismatch > 0 ||
      s.gates.leak ||
      s.softened.length > 0
    expect(worse).toBe(true)
  })
})

describe('채점 규칙', () => {
  const truth = loadTruth(loadScenario('e1-twoboard').dir)

  it('경로와 인용을 정규화한다', () => {
    expect(normPath('C:\\tmp\\run\\repo\\src\\a.c', 'C:\\tmp\\run\\repo')).toBe('src/a.c')
    expect(normPath('/tmp/run/repo/src/a.c', '/tmp/run/repo')).toBe('src/a.c')
    expect(normPath('./src/a.c', '/x')).toBe('src/a.c')
    expect(normQuote('    3\t#define  X 1\r\n    4\tint y;')).toBe('#define X 1 int y;')
  })

  it('앵커: 범위 안, 범위 밖, 없는 인용, 없는 파일, 보지 않는 종류', () => {
    const read = (rel) => (rel === 'a.c' ? 'line one\nint x = 1;\nint y = 2;\n' : null)
    const A = (path, start, end, quote, kind = 'code') => ({
      kind,
      path,
      start,
      end,
      quote,
      command: null,
    })
    const r = checkAnchors(
      collectAnchors({
        a: [
          A('a.c', 2, 2, 'int x = 1;'),
          A('a.c', 1, 1, 'int y = 2;'),
          A('a.c', 2, 3, 'int z'),
          A('b.c', 1, 1, 'x'),
        ],
        b: { anchor: A('out.txt', 1, 1, 'x', 'tool_output') },
        c: [A('a.c', 1, 3, 'line one ... int y = 2;')],
      }),
      read,
      '/r',
    ).map((a) => a.status)
    expect(r).toEqual(['ok', 'line_mismatch', 'fabricated', 'missing_file', 'skipped', 'ok'])
  })

  it('구성 이름: all, 별칭, 모르는 이름', () => {
    expect(expandConfigs(['all'], truth)).toEqual(['alpha', 'beta'])
    expect(expandConfigs(['BOARD_ALPHA'], truth)).toEqual(['alpha'])
    expect(expandConfigs(['gamma'], truth)).toEqual(['?gamma'])
    expect(expandConfigs([], truth)).toEqual([])
  })

  it('실제 run의 값 글: 단위가 섞인 글, 설명이 붙은 단위, 절 이름이 붙은 판정 key (2026-10-09 시범 run)', () => {
    const q = (symbol, values, unit) => ({ symbol, expr: '', values, unit, unit_status: 'derived' })
    expect(
      checkQuantity(
        q(
          'PROTO_FRAME_TIMEOUT_TICKS',
          [
            {
              configs: ['alpha'],
              value:
                '20 tick = 20 ms (실제 발동은 경과 >20, 즉 21 tick 이상: 21 ms 전후 ± 1 tick 지터)',
            },
            { configs: ['beta'], value: '5 tick = 50 ms (실제 발동 6 tick = 60 ms 전후)' },
          ],
          'tick (alpha 1 ms, beta 10 ms)',
        ),
        truth,
      ),
    ).toEqual({ truth: 'q.frame_to', errors: [], covers: ['alpha', 'beta'] })
    expect(
      checkQuantity(
        q(
          'CFG_TICK_HZ',
          [
            { configs: ['alpha'], value: '1000' },
            { configs: ['beta'], value: '100' },
          ],
          'Hz (tick/s)',
        ),
        truth,
      ).covers,
    ).toEqual(['alpha', 'beta'])
    expect(
      checkQuantity(
        q('PROTO_FRAME_TIMEOUT_TICKS', [{ configs: ['alpha', 'beta'], value: '약 20 ms' }], 'ms'),
        truth,
      ).errors,
    ).toEqual(['m.frame_20ms_all'])
    const out = { unknowns: [{ key: 'u1', question: 'x', needs: 'external_doc', refs: [] }] }
    const r = applyJudge(
      {
        recall: [{ id: 'r.tim.wdt_unknown', found: true, keys: ['unknown u1'] }],
        must_not: [],
        resolvable: [],
      },
      out,
      truth,
      'trace-timing',
      'trace',
    )
    expect(r.recall['r.tim.wdt_unknown']).toBe(true)
  })

  it('실제 run의 값 글: 초당 틱은 Hz다 (2026-10-09 6차 측정)', () => {
    expect(unitKey('tick/s')).toBe('hz')
    expect(unitKey('ticks per second')).toBe('hz')
    expect(unitKey('tick')).toBe('tick')
    const truth = {
      configs: [
        { name: 'a', aliases: [] },
        { name: 'b', aliases: [] },
      ],
      quantities: [
        {
          id: 'q.tick',
          symbols: ['TICK_HZ'],
          per_config: { a: { hz: [1000], ms: [1] }, b: { hz: [500], ms: [2] } },
          unit_derivable: true,
        },
      ],
    }
    const q = (values) => ({
      symbol: 'TICK_HZ',
      expr: '',
      unit: 'tick/s',
      unit_status: 'derived',
      values,
    })
    expect(
      checkQuantity(
        q([
          { configs: ['a'], value: '1000 tick/s' },
          { configs: ['b'], value: '500 tick/s (1 tick = 2 ms)' },
        ]),
        truth,
      ),
    ).toEqual({ truth: 'q.tick', errors: [], covers: ['a', 'b'] })
    expect(checkQuantity(q([{ configs: ['b'], value: '1000 tick/s' }]), truth).errors).toEqual([
      'm.q.q.tick.value',
    ])
  })

  it('인벤토리 이름: 공백·밑줄만 다른 꼴은 같고, 이어지는 숫자는 다른 이름 (2026-10-09 6차 측정)', () => {
    expect(nameHas('DMA1 stream5 (USART2 RX), DMA1 stream6 (TX)', 'DMA1_Stream5')).toBe(true)
    expect(nameHas('DMA1 Stream5 (x)', 'DMA1 Stream 5')).toBe(true)
    expect(nameHas('DMA1 Stream50', 'DMA1_Stream5')).toBe(false)
    expect(nameHas('XDMA1_Stream5', 'DMA1_Stream5')).toBe(false)
  })

  it('단위 키', () => {
    expect(
      [
        'ms',
        'milliseconds',
        'Seconds',
        'ticks',
        'SysTick ticks',
        'Hz',
        'Hz (tick/s)',
        'control cycles',
        '',
        'retries',
      ].map(unitKey),
    ).toEqual(['ms', 'ms', 's', 'tick', 'tick', 'hz', 'hz', 'cycle', '', 'count'])
  })

  it('수치: 구성별 값, 병합, 틀린 값, 유도할 수 없는 단위의 확정', () => {
    const q = (values, unit = 'ms', extra = {}) => ({
      symbol: 'PROTO_FRAME_TIMEOUT_TICKS',
      expr: '20U',
      values,
      unit,
      unit_status: 'derived',
      ...extra,
    })
    expect(
      checkQuantity(
        q([
          { configs: ['alpha'], value: '20' },
          { configs: ['beta'], value: '50' },
        ]),
        truth,
      ),
    ).toEqual({
      truth: 'q.frame_to',
      errors: [],
      covers: ['alpha', 'beta'],
    })
    expect(checkQuantity(q([{ configs: ['all'], value: '20' }]), truth).errors).toEqual([
      'm.frame_20ms_all',
    ])
    expect(checkQuantity(q([{ configs: ['beta'], value: '20' }]), truth).errors).toEqual([
      'm.q.q.frame_to.value',
    ])
    // beta는 Makefile이 5틱으로 덮어쓴다: 틱 단위로도 구성마다 다르다
    expect(checkQuantity(q([{ configs: ['all'], value: '20' }], 'ticks'), truth).errors).toEqual([
      'm.frame_20ms_all',
    ])
    expect(checkQuantity(q([{ configs: ['beta'], value: '200' }]), truth).errors).toEqual([
      'm.q.q.frame_to.value',
    ])
    expect(checkQuantity(q([{ configs: ['beta'], value: '' }]), truth).errors).toEqual([])
    const wdt = {
      symbol: 'WDT_RELOAD',
      expr: '625U',
      values: [],
      unit: 's',
      unit_status: 'derived',
    }
    expect(checkQuantity(wdt, truth).errors).toEqual(['m.wdt_exact'])
    expect(checkQuantity({ ...wdt, unit_status: 'name_guess' }, truth).errors).toEqual([])
    expect(checkQuantity({ symbol: 'NOPE', expr: '1', values: [] }, truth).truth).toBeNull()
  })

  it('판정 읽기: 모르는 key는 인정하지 않고, 답이 없는 항목은 판정 불가로 분모에서 뺀다', () => {
    const out = {
      observations: [{ key: 'o1', text: 'x', configs: [], anchors: [], inference: false }],
    }
    const r = applyJudge(
      {
        recall: [
          { id: 'r.cmd.entry', found: true, keys: ['o1'] },
          { id: 'r.cmd.crc', found: true, keys: ['o9'] },
          { id: 'nope', found: true, keys: ['o1'] },
        ],
        must_not: [
          { id: 'm.only_writer', violated: true, keys: ['o1'], quote: 'x', hedged: false },
          // 판정 모델이 유보(가정, 문서 주장, 빠진 예외를 함께 적음)라고 본 주장은 위반이 아니다
          { id: 'm.crc_doc', violated: true, keys: ['o1'], quote: 'x', hedged: true },
        ],
        resolvable: [{ id: 'v.crc_params', left_unknown: true, keys: ['o1'] }],
      },
      out,
      truth,
      'trace-command',
      'trace',
    )
    expect(r.recall['r.cmd.entry']).toBe(true)
    expect(r.recall['r.cmd.crc']).toBe(false)
    expect(r.recall['r.cmd.busy']).toBeNull()
    expect('nope' in r.recall).toBe(false)
    expect(r.violated).toEqual(['m.only_writer'])
    expect(r.undecided).toContain('m.latency_req')
    expect(r.softened).toEqual(['v.crc_params'])
  })

  it('판정 입력: 결정론 항목은 빼고, 결과는 key가 붙은 주장 줄로만 보인다(앵커 없음)', () => {
    const { out } = readReference(loadScenario('e1-twoboard').dir, 'trace-timing')
    const p = judgePrompt(out, truth, 'trace-timing', 'trace')
    expect(p).toContain('r.tim.wdt_unknown')
    expect(p).not.toContain('r.tim.frame_ms')
    expect(p).not.toContain('"quote"')
    expect(p).not.toContain(truth.canary)
    expect(claimLines(out, 'trace').every((l) => /^[a-z_]+[ :]/.test(l))).toBe(true)
  })

  it('판정 호출은 도구·MCP·사용자 설정·세션 저장 없이 부른다', () => {
    const a = judgeArgs({ model: 'sonnet', system: 's', schema: {} })
    expect(a).toEqual(expect.arrayContaining(['--strict-mcp-config', '--no-session-persistence']))
    expect(a[a.indexOf('--tools') + 1]).toBe('')
    expect(a[a.indexOf('--setting-sources') + 1]).toBe('')
  })
})

describe('새 종류의 채점(integrate, review, summarize)', () => {
  const mini = {
    configs: [
      { name: 'a', aliases: ['board_a'] },
      { name: 'b', aliases: [] },
    ],
    quantities: [
      {
        id: 'q.x',
        symbols: ['X_TICKS'],
        per_config: { a: { tick: [20], ms: [20] }, b: { tick: [5], ms: [50] } },
        unit_derivable: true,
      },
    ],
    recall: [],
    must_not: [],
    resolvable: [],
  }
  const it_ = (id, det) => ({ id, tasks: ['t'], det, statement: id })
  const det = (out, kind, recall = [], mustNot = [], ctx = {}) =>
    detScore(out, { ...mini, recall, must_not: mustNot }, 't', kind, ctx)

  it('run 종류는 과제 id에서 짐작하지 않고 받으며, det는 그 결과 칸이 있는 종류에서만 돈다', () => {
    expect(() => detScore({}, mini, 'survey')).toThrow(/종류/)
    expect(() => detApplies({ det: { nope: 1 } }, 'trace')).toThrow(/모르는 det/)
    expect(detApplies({ det: { link: {} } }, 'integrate')).toBe(true)
    expect(detApplies({ det: { link: {} } }, 'trace')).toBe(false)
    expect(detApplies({ det: { gid_unknown: true } }, 'summarize')).toBe(true)
    expect(detApplies({ det: { gid_unknown: true } }, 'review')).toBe(false)
    expect(detApplies({ det: { quantity: 'q.x' } }, 'trace')).toBe(true)
    expect(detApplies({ det: { quantity: 'q.x' } }, 'summarize')).toBe(false)
    // 다른 종류의 과제에 걸린 det 항목은 판정 모델이 가른다(결정 54)
    const truth = {
      ...mini,
      recall: [it_('r.x', { verdict: { statement: 's1', accept: ['refuted'] } })],
    }
    expect(judgeItems(truth, 't', 'review').recall).toEqual([])
    expect(judgeItems(truth, 't', 'integrate').recall.map((x) => x.id)).toEqual(['r.x'])
    // 시나리오 정답의 det는 모두 표에 있다
    for (const id of scenarios) {
      const t = loadTruth(loadScenario(id).dir)
      for (const x of [...t.recall, ...t.must_not].filter((y) => y.det))
        expect(Object.keys(DET_KINDS), `${id} ${x.id}`).toContain(Object.keys(x.det)[0])
    }
  })

  it('integrate: 연결은 종류와 양쪽이 겹쳐야 하고, conflicts만 방향을 보지 않는다', () => {
    const recall = [
      it_('r.res', { link: { kind: 'resolves', from: ['c-0001'], to: ['c-0002', 'c-0003'] } }),
      it_('r.sup', { link: { kind: 'supersedes', from: ['c-0010'], to: ['c-0011'] } }),
      it_('r.con', { link: { kind: 'conflicts', from: ['c-0004'], to: ['c-0005'] } }),
    ]
    const L = (kind, from, to) => ({ key: 'l1', kind, from, to, reason: '', anchors: [] })
    const r = (links) => det({ links }, 'integrate', recall).recall
    expect(r([L('resolves', ['c-0001'], ['c-0003'])])['r.res']).toBe(true)
    expect(r([L('resolves', ['c-0001'], ['c-0008'])])['r.res']).toBe(false)
    expect(r([L('merges', ['c-0001'], ['c-0002'])])['r.res']).toBe(false)
    expect(r([L('supersedes', ['c-0011'], ['c-0010'])])['r.sup']).toBe(false)
    expect(r([L('conflicts', ['c-0005'], ['c-0004'])])['r.con']).toBe(true)
    expect(
      det({ links: [] }, 'integrate', [
        it_('r.sw', { link: { kind: 'merges', from: ['c-1'], to: ['c-2'], swap: true } }),
      ]).recall,
    ).toEqual({ 'r.sw': false })
    expect(
      det({ links: [L('merges', ['c-2'], ['c-1'])] }, 'integrate', [
        it_('r.sw', { link: { kind: 'merges', from: ['c-1'], to: ['c-2'], swap: true } }),
      ]).recall['r.sw'],
    ).toBe(true)
  })

  it('integrate: 금지한 연결은 kind가 없으면 어느 종류든, to가 없으면 어디로든, merges·conflicts는 방향 없이', () => {
    const mustNot = [
      it_('m.res', { link_forbid: { kind: 'resolves', from: ['c-0009'] } }),
      it_('m.pair', { link_forbid: { from: ['c-0006', 'c-0007'], to: ['c-0006', 'c-0007'] } }),
    ]
    const L = (kind, from, to) => ({ key: 'l1', kind, from, to, reason: '', anchors: [] })
    const v = (links) => det({ links }, 'integrate', [], mustNot).violated
    expect(v([L('resolves', ['c-0009'], ['c-0100'])])).toEqual(['m.res'])
    expect(v([L('supersedes', ['c-0009'], ['c-0100'])])).toEqual([])
    expect(v([L('merges', ['c-0007'], ['c-0006'])])).toEqual(['m.pair'])
    expect(v([L('conflicts', ['c-0006'], ['c-0007'])])).toEqual(['m.pair'])
    expect(v([L('merges', ['c-0006'], ['c-0008'])])).toEqual([])
    expect(
      det({ links: [L('resolves', ['c-0009'], ['c-1'])] }, 'trace', [], mustNot).violated,
    ).toEqual([])
  })

  it('integrate: coverage 칸은 상태와 요건(ids, searches, 제안 단위)을 채우고 구성을 모두 덮어야 하고, 제안 단위는 렌즈와 토큰', () => {
    const recall = [
      it_('r.life', {
        coverage: { perspective: 'lifecycle', configs: ['a', 'b'], status: ['unreached'] },
      }),
      it_('r.tim', {
        coverage: { perspective: 'timing', configs: ['a', 'b'], status: ['covered'] },
      }),
      it_('r.mem', {
        coverage: { perspective: 'memory', configs: ['a'], status: ['not_applicable'] },
      }),
      it_('r.unit', { unit: { lens: 'lifecycle', tokens: ['Reset_Handler', 'boot'] } }),
    ]
    const cellOf = (configs, status, extra = {}) => ({
      configs,
      status,
      ids: [],
      units: [],
      searches: [],
      note: '',
      ...extra,
    })
    const unit = (lens, scope, purpose = '') => ({
      key: 'n1',
      lens,
      scope,
      purpose,
      priority: 'high',
      depends_on: [],
      reason: '',
    })
    const search = { tool: 'Grep', pattern: 'x', scope: 'src', hits: 0 }
    const good = {
      coverage: {
        lifecycle: [
          cellOf(['a'], 'unreached', { units: ['n1'] }),
          cellOf(['b'], 'unreached', { units: ['n1'] }),
        ],
        timing: [cellOf(['all'], 'covered', { ids: ['c-0001'] })],
        memory: [cellOf(['board_a'], 'not_applicable', { searches: [search] })],
      },
      units: [unit('lifecycle', 'startup.c: Reset_Handler')],
    }
    expect(det(good, 'integrate', recall).recall).toEqual({
      'r.life': true,
      'r.tim': true,
      'r.mem': true,
      'r.unit': true,
    })
    const bad = structuredClone(good)
    bad.coverage.lifecycle[1].units = ['n9']
    bad.coverage.timing[0].ids = []
    bad.coverage.memory[0].searches = []
    bad.units = [unit('state', 'Reset_HandlerX'), unit('lifecycle', 'main loop')]
    expect(det(bad, 'integrate', recall).recall).toEqual({
      'r.life': false,
      'r.tim': false,
      'r.mem': false,
      'r.unit': false,
    })
    expect(
      det(
        { ...good, coverage: { ...good.coverage, lifecycle: [cellOf(['a', 'b'], 'unknown')] } },
        'integrate',
        recall,
      ).recall['r.life'],
    ).toBe(false)
  })

  it('review: 값 답은 수치 대조로 보고 오류는 PM-A, 구성 답은 집합, 서술은 판정 목록으로 본다', () => {
    const recall = [
      it_('r.val', { answer_value: { question: 'q1', quantity: 'q.x' } }),
      it_('r.cfg', { answer_configs: { question: 'q2', configs: ['b'] } }),
      it_('r.ver', { verdict: { statement: 's1', accept: ['refuted', 'overclaimed'] } }),
    ]
    const mustNot = [
      it_('m.ver', { verdict_forbid: { statement: 's2', forbid: ['refuted', 'overclaimed'] } }),
    ]
    const ans = (values, status = 'answered', configs = []) => ({
      status,
      text: '',
      values,
      configs,
      anchors: [],
      searches: [],
    })
    const V = (verdict) => ({ verdict, attempts: ['x'], anchors: [], note: '' })
    const out = (q1, q2, s1, s2) => ({ answers: { q1, q2 }, verdicts: { s1: V(s1), s2: V(s2) } })
    const okVals = [
      { configs: ['a'], value: '20 tick' },
      { configs: ['b'], value: '5 tick = 50 ms' },
    ]
    const r1 = det(
      out(ans(okVals), ans([], 'answered', ['b']), 'refuted', 'not_refuted'),
      'review',
      recall,
      mustNot,
    )
    expect(r1.recall).toEqual({ 'r.val': true, 'r.cfg': true, 'r.ver': true })
    expect(r1.violated).toEqual([])
    const merged = det(
      out(
        ans([{ configs: ['all'], value: '20 ms' }]),
        ans([], 'answered', ['all']),
        'needs_more',
        'overclaimed',
      ),
      'review',
      recall,
      mustNot,
    )
    expect(merged.recall).toEqual({ 'r.val': false, 'r.cfg': false, 'r.ver': false })
    expect(merged.violated).toEqual(['m.q.q.x.merge', 'm.ver'])
    expect(
      det(
        out(ans([{ configs: ['b'], value: '20 tick' }]), ans([]), 'refuted', 'not_refuted'),
        'review',
        recall,
      ).violated,
    ).toEqual(['m.q.q.x.value'])
    // 답하지 못한 값은 찾지 못함이지만 잘못된 확정은 아니다. 한 구성만 답하면 찾지 못함
    const unk = det(out(ans([], 'unknown'), ans([]), 'refuted', 'not_refuted'), 'review', recall)
    expect([unk.recall['r.val'], unk.violated]).toEqual([false, []])
    expect(
      det(out(ans([okVals[0]]), ans([]), 'refuted', 'not_refuted'), 'review', recall).recall[
        'r.val'
      ],
    ).toBe(false)
  })

  it('summarize: 서술이 가리킨 ID를 자리(risks, overview, any)와 모두·하나로 보고, 패킷에 없는 ID는 PM-A', () => {
    const recall = [
      it_('r.one', { cites: { ids: ['c-0001'], where: 'risks' } }),
      it_('r.any', { cites: { ids: ['u-0007', 'u-0008'], where: 'risks', any: true } }),
      it_('r.all', { cites: { ids: ['c-0002', 'c-0003'], where: 'overview' } }),
      it_('r.where', { cites: { ids: ['c-0004'] } }),
    ]
    const mustNot = [it_('m.gid', { gid_unknown: true })]
    const P = (ids) => ({ text: 'x', ids })
    const ids = ['c-0001', 'c-0002', 'c-0003', 'c-0004', 'u-0007', 'u-0008']
    const good = {
      overview: [P(['c-0002', 'c-0001']), P(['c-0003'])],
      handoff_summary: P(['c-0004']),
      risks: [P(['c-0001', 'u-0008'])],
    }
    const r = det(good, 'summarize', recall, mustNot, { ids })
    expect(r.recall).toEqual({ 'r.one': true, 'r.any': true, 'r.all': true, 'r.where': true })
    expect(r.violated).toEqual([])
    const bad = { overview: [P(['c-0002', 'c-0001'])], handoff_summary: P([]), risks: [P(['k1'])] }
    const b = det(bad, 'summarize', recall, mustNot, { ids })
    expect(b.recall).toEqual({ 'r.one': false, 'r.any': false, 'r.all': false, 'r.where': false })
    expect(b.violated).toEqual(['m.gid'])
    expect(
      det({ ...good, risks: [P(['c-0999'])] }, 'summarize', [], mustNot, { ids }).violated,
    ).toEqual(['m.gid'])
    expect(() => det(good, 'summarize', [], mustNot)).toThrow(/ctx.ids/)
  })

  it('판정 입력: 새 종류의 key가 붙은 줄과 판정 답의 key 대조가 같은 key(관점 ID, 질문·서술 키, p·h·r)를 쓴다', () => {
    const { dir } = loadScenario('e1-twoboard')
    const want = {
      integrate: [
        ['link l1: resolves c-', 'coverage lifecycle: unreached', 'unit n1: [lifecycle]'],
        ['l1', 'lifecycle', 'n1'],
      ],
      review: [
        ['answer q1: answered', 'verdict s1: refuted', 'outcome: done'],
        ['q1', 's1', 's5'],
      ],
      summarize: [
        ['overview p1:', 'handoff h1:', 'risk r1:'],
        ['p1', 'h1', 'r7'],
      ],
    }
    for (const [kind, [lines, keys]] of Object.entries(want)) {
      const { out } = readReference(dir, kind)
      const cl = claimLines(out, kind)
      for (const l of lines)
        expect(
          cl.some((x) => x.startsWith(l)),
          `${kind}: ${l}`,
        ).toBe(true)
      expect(cl.every((l) => /^[a-z_]+[ :]/.test(l))).toBe(true)
      expect(cl.join('\n')).not.toMatch(/"quote"|quote:/)
      const ks = outputKeys(out, kind)
      for (const k of keys) expect(ks.has(k), `${kind}: ${k}`).toBe(true)
      for (const [, k] of keyedView(out, kind)) expect(ks.has(k)).toBe(true)
    }
    // survey·trace의 key 대조는 그대로다(점검표 ID는 key가 아니다)
    const { out: tim } = readReference(dir, 'trace-timing')
    expect(outputKeys(tim, 'trace').has('per_config_value')).toBe(false)
    expect(() => outputKeys(tim)).toThrow(/종류/)
  })

  it('판정 읽기: 새 종류도 절 이름을 붙인 key는 마지막 낱말로 읽고 결과에 없는 key는 인정하지 않는다', () => {
    const { dir } = loadScenario('e1-twoboard')
    const truth = loadTruth(dir)
    const { out: ig } = readReference(dir, 'integrate')
    const a = applyJudge(
      {
        recall: [{ id: 'r.int.conflict_side', found: true, keys: ['link l4'] }],
        must_not: [
          {
            id: 'm.int.wdt_settled',
            violated: true,
            keys: ['coverage timing'],
            quote: 'x',
            hedged: false,
          },
        ],
        resolvable: [{ id: 'v.int.frame', left_unknown: true, keys: ['coverage lifecycle'] }],
      },
      ig,
      truth,
      'integrate',
      'integrate',
    )
    expect(a).toEqual({
      recall: { 'r.int.conflict_side': true },
      violated: ['m.int.wdt_settled'],
      undecided: [],
      softened: ['v.int.frame'],
    })
    const { out: sm } = readReference(dir, 'summarize')
    const b = applyJudge(
      {
        recall: [{ id: 'r.sum.partial_said', found: true, keys: ['risk r9'] }],
        must_not: [],
        resolvable: [],
      },
      sm,
      truth,
      'summarize',
      'summarize',
    )
    expect(b.recall['r.sum.partial_said']).toBe(false)
    expect(b.undecided).toEqual([
      'm.sum.confirmed',
      'm.sum.lowered_ok',
      'm.sum.all_found',
      'm.sum.wdt',
    ])
    const { out: rv } = readReference(dir, 'review')
    expect(
      applyJudge(
        {
          recall: [{ id: 'r.rev.writer_why', found: true, keys: ['answer s1'] }],
          must_not: [],
          resolvable: [],
        },
        rv,
        truth,
        'review',
        'review',
      ).recall['r.rev.writer_why'],
    ).toBe(true)
    expect(
      applyJudge({ recall: [], must_not: [], resolvable: [] }, rv, truth, 'review', 'review')
        .recall['r.rev.writer_why'],
    ).toBeNull()
  })

  it('판정 지시: survey·trace는 예전 바이트 그대로라 판정 캐시가 이어지고, 새 종류는 종류마다 따로다', () => {
    const sha = (t) => createHash('sha256').update(t).digest('hex')
    expect(sha(JUDGE_SYSTEM)).toBe(
      'b70a50bef455df02de726e62c9eb873e78a60e8b70f66b5a0bdd7b9592ec7297',
    )
    expect(judgeSystem('survey')).toBe(JUDGE_SYSTEM)
    expect(judgeSystem('trace')).toBe(JUDGE_SYSTEM)
    for (const [kind, key] of [
      ['integrate', 'l1'],
      ['review', 'q1'],
      ['summarize', 'p1'],
    ]) {
      expect(judgeSystem(kind)).toBe(JUDGE_SYSTEMS[kind])
      expect(judgeSystem(kind)).not.toBe(JUDGE_SYSTEM)
      expect(judgeSystem(kind)).toContain(key)
    }
    expect(() => judgeSystem()).toThrow(/종류/)
    // e1 trace-timing reference의 판정 캐시 키(score.mjs: 모델, 지시, 입력의 해시)가 새 종류를 더하기 전과 같다
    const { dir } = loadScenario('e1-twoboard')
    const { out } = readReference(dir, 'trace-timing')
    const prompt = judgePrompt(out, loadTruth(dir), 'trace-timing', 'trace')
    expect(sha(`sonnet\n${judgeSystem('trace')}\n${prompt}`).slice(0, 16)).toBe('f1e6ac152f093e2e')
  })
})

describe('사용량과 실행 파일', () => {
  it('get_usage가 없으면 호출 상한을 건다. --always-cap이면 run이 본 사용률이 있어도 건다', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-guard-'))
    const callsFile = path.join(dir, 'calls.jsonl')
    fs.writeFileSync(callsFile, '{"kind":"run"}\n{"kind":"judge"}\n')
    const o = { bin: path.join(dir, 'no-claude'), env: {}, callsFile, maxCalls: 2 }
    expect((await guard(o)).ok).toBe(false)
    const observed = { weeklyPct: 12, fiveHourPct: 3 }
    expect((await guard({ ...o, observed })).ok).toBe(true)
    const capped = await guard({ ...o, observed, alwaysCap: true })
    expect(capped.ok).toBe(false)
    expect(capped.why).toMatch(/호출 상한 2/)
    expect((await guard({ ...o, maxCalls: 3, observed, alwaysCap: true })).ok).toBe(true)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('get_usage 응답에서 주간 사용률은 seven_day와 weekly 묶음 가운데 가장 높은 것이다', () => {
    // 2026-10-09 구독(max) 로그인에서 받은 응답의 일부(녹화, docs/requirements-extraction-flow.md 17.4)
    const r = parseUsage({
      subscription_type: 'max',
      rate_limits_available: true,
      rate_limits: {
        five_hour: { utilization: 21, resets_at: '2026-10-08T16:30:00.216900+00:00' },
        seven_day: { utilization: 7, resets_at: '2026-10-15T05:00:00.216924+00:00' },
        seven_day_sonnet: null,
        limits: [
          { kind: 'session', group: 'session', percent: 21 },
          { kind: 'weekly_all', group: 'weekly', percent: 7 },
          { kind: 'weekly_scoped', group: 'weekly', percent: 0 },
        ],
      },
    })
    expect(r).toMatchObject({ available: true, weeklyPct: 7, fiveHourPct: 21 })
    expect(parseUsage({ rate_limits_available: false }).available).toBe(false)
    expect(parseUsage(null).available).toBe(false)
  })

  it('사용량 한도 실패를 가른다(가정: rate_limit_event의 rejected, assistant의 rate_limit 오류)', () => {
    expect(usageLimit([{ type: 'result', is_error: false }])).toBeNull()
    expect(
      usageLimit([
        {
          type: 'rate_limit_event',
          rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', resetsAt: 1791495000 },
        },
      ]),
    ).toEqual({ type: 'five_hour', resetsAt: 1791495000 })
    expect(
      usageLimit([
        {
          type: 'assistant',
          error: 'rate_limit',
          apiError: 'usage_limit_reached',
          apiErrorParams: { rate_limit_info: { rateLimitType: 'seven_day', resetsAt: 1 } },
        },
      ]),
    ).toEqual({ type: 'seven_day', resetsAt: 1 })
    expect(usageLimit([{ type: 'result', is_error: true, api_error_status: 429 }])).toEqual({
      type: null,
      resetsAt: null,
    })
  })

  it('Windows의 npm 설치는 claude.cmd 옆의 claude.exe를 띄운다', () => {
    const exists = (f) =>
      f === 'C:\\npm\\claude.cmd' ||
      f === 'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe'
    expect(runBin({ PATH: 'C:\\x;C:\\npm' }, 'win32', exists)).toBe(
      'C:\\npm\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe',
    )
    expect(
      runBin(
        { PATH: 'C:\\x', USERPROFILE: 'C:\\u' },
        'win32',
        (f) => f === 'C:\\u\\.local\\bin\\claude.exe',
      ),
    ).toBe('C:\\u\\.local\\bin\\claude.exe')
    expect(runBin({ CLAUDE_BIN: '/opt/claude' }, 'linux')).toBe('/opt/claude')
    expect(runBin({}, 'linux')).toBe('claude')
  })
})

describe('하네스', () => {
  it('차례: 회차 바깥, 과제 안쪽', () => {
    const items = plan({ scenarios: ['e1-twoboard'], tasks: ['survey', 'trace-timing'], reps: 2 })
    expect(items.map((i) => `${i.rep}.${i.task.id}`)).toEqual([
      '1.survey',
      '1.trace-timing',
      '2.survey',
      '2.trace-timing',
    ])
  })

  it('쪽 이름은 조립본 해시라 같은 바이트면 같다', () => {
    const combos = [
      ['survey', null],
      ['trace', 'timing'],
    ]
    expect(sideId('base', combos)).toBe(sideId('base', combos))
    expect(sideId('base', combos)).toMatch(/^base-[0-9a-f]{8}$/)
    expect(sideId('base', combos)).not.toBe(sideId('base', [['survey', null]]))
  })

  it('v1은 base와 결과 스키마·필드 안내가 같고 L1·L2·L2b만 더한다', () => {
    for (const [kind, lens] of [
      ['survey', null],
      ['trace', 'timing'],
    ]) {
      const b = buildSide('base', kind, lens)
      const v = buildSide('v1', kind, lens)
      expect(v.schemaArg).toBe(b.schemaArg)
      expect(v.instructions.startsWith('# Extraction run contract')).toBe(true)
      expect(
        v.instructions.endsWith(b.instructions.slice(b.instructions.indexOf('## Result fields'))),
      ).toBe(true)
      expect(v.instructions).not.toMatch(/<!--/)
      if (lens) expect(v.instructions).toMatch(/# Lens: timing[\s\S]*## Example/)
      if (lens) expect(v.instructions).not.toMatch(/## Checklist\n/)
    }
  })

  it('패킷의 자리표시를 채운다', () => {
    expect(
      renderPacket('{repo} {base} {scratch} {other}', { repo: 'R', base: 'B', scratch: 'S' }),
    ).toBe('R B S {other}')
  })

  it('가짜 claude로 run을 끝까지 돌리고 채점한다: 성공, worktree 변경, 구조화 출력 없음', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-dry-'))
    try {
      const { dir, scenario } = loadScenario('e1-twoboard')
      const task = scenario.tasks.find((t) => t.id === 'trace-timing')
      const { out } = readReference(dir, task.id)
      const planFile = (name, p) => {
        const f = path.join(root, `${name}.json`)
        fs.writeFileSync(f, JSON.stringify(p))
        return f
      }
      const common = {
        scenarioDir: dir,
        scenario,
        task,
        side: 'base',
        model: 'sonnet',
        effort: 'medium',
        outDir: root,
        workRoot: path.join(root, 'work'),
        bin: 'claude',
        dry: true,
        softMs: 60_000,
        hardMs: 60_000,
      }
      const ok = await runOne({
        ...common,
        label: 'ok',
        rep: 1,
        fakePlan: planFile('ok', {
          tools: [{ name: 'Read', input: { file_path: '{wt}/src/proto.c' } }],
          outputs: [out],
        }),
      })
      expect(ok.failure).toBeNull()
      expect(ok.schemaValid).toBe(true)
      expect(ok.worktreeChanged).toBe(false)
      expect(ok.filesRead).toHaveLength(1)
      expect(ok.init.tools).toContain('StructuredOutput')
      const wrote = await runOne({
        ...common,
        label: 'wrote',
        rep: 1,
        fakePlan: planFile('w', { outputs: [out], write: { path: '{wt}/build.o', text: 'x' } }),
      })
      expect(wrote.worktreeChanged).toBe(true)
      const none = await runOne({
        ...common,
        label: 'none',
        rep: 1,
        fakePlan: planFile('n', { outputs: [] }),
      })
      expect(none.failure).toBe('no_structured_output')
      const bad = await runOne({
        ...common,
        label: 'bad',
        rep: 1,
        fakePlan: planFile('b', { outputs: [{ outcome: 'done' }] }),
      })
      expect(bad.failure).toBe('schema')
      const bg = await runOne({
        ...common,
        label: 'bg',
        rep: 1,
        fakePlan: planFile('g', { outputs: [out], background: true }),
      })
      expect(bg.failure).toBeNull()

      await scoreDir(root, { judge: false })
      const sc = JSON.parse(fs.readFileSync(path.join(root, 'runs', ok.id, 'score.json'), 'utf8'))
      expect(sc.violated).toEqual([])
      expect(sc.recall['r.tim.frame_ms']).toBe(true)
      expect(sc.anchors.fabricated).toBe(0)
      expect(sc.judged).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  }, 120_000)
})

describe('하네스: 새 종류의 과제', () => {
  const survey_trace = [
    ['survey', null],
    ['trace', 'command'],
    ['trace', 'timing'],
    ['trace', 'variant'],
    ['trace', 'shared'],
  ]

  it('survey·trace의 지시·스키마 바이트와 쪽 이름은 그대로다(채택한 v4 측정의 저장본과 같다)', () => {
    expect(sideId('base', survey_trace)).toBe('base-0f347011')
    expect(sideId('v1', survey_trace)).toBe('v1-d18f643c')
    // 과제를 고르지 않은 계획은 survey·trace만이라 쪽 이름이 같다
    const items = plan({ scenarios: ['e1-twoboard', 'e2-gateway'], reps: 1 })
    expect(sideId('base', planEntries(items))).toBe('base-0f347011')
    const stored = JSON.parse(
      fs.readFileSync(
        path.join(import.meta.dirname, '../extract/reports/2026-10-09-v4-m5.runs.json'),
        'utf8',
      ),
    ).runs.filter((r) => r.side === 'base' || r.side === 'v1')
    expect(stored.length).toBeGreaterThan(0)
    const { scenario } = loadScenario('e1-twoboard')
    for (const r of stored) {
      const t = scenario.tasks.find((x) => x.id === r.task)
      expect(buildSide(r.side, t.kind, t.lens ?? null).hashes, `${r.side} ${r.task}`).toEqual(
        r.hashes,
      )
    }
  })

  it('계획: 과제를 고르지 않으면 survey·trace만, 새 종류는 --kinds나 --tasks로', () => {
    const ids = (o) => plan({ scenarios: ['e1-twoboard'], reps: 1, ...o }).map((i) => i.task.id)
    expect(ids({})).toEqual([
      'survey',
      'trace-command',
      'trace-timing',
      'trace-variant',
      'trace-shared',
    ])
    expect(ids({ kinds: ['integrate', 'review', 'summarize'] })).toEqual([
      'integrate',
      'review',
      'summarize',
    ])
    expect(ids({ tasks: ['review', 'survey'] })).toEqual(['survey', 'review'])
  })

  it('쪽 이름과 결과 스키마에 칸의 키(관점, 질문·서술 키)가 든다', () => {
    const r1 = { answers: ['q1'], verdicts: ['s1'] }
    const r2 = { answers: ['q1', 'q2'], verdicts: ['s1'] }
    expect(sideId('base', [['review', null, r1]])).not.toBe(sideId('base', [['review', null, r2]]))
    expect(
      sideEntries([
        ['review', null, r1],
        ['review', null, r1],
        ['review', null, r2],
      ]),
    ).toHaveLength(2)
    const b = buildSide('base', 'review', null, r2)
    expect(b.schema.properties.answers.required).toEqual(['q1', 'q2'])
    expect(b.schema.properties.verdicts.required).toEqual(['s1'])
    expect(() => buildSide('base', 'review', null)).toThrow(/answers/)
    const items = plan({ scenarios: ['e1-twoboard', 'e2-gateway'], reps: 1, kinds: RECORD_KINDS })
    const entries = planEntries(items)
    // 두 시나리오의 review 묶음은 키가 같아(q1~q3, s1~s5) 조합이 셋이다
    expect(entries.map(([k]) => k)).toEqual(['integrate', 'review', 'summarize'])
    expect(sideId('base', entries)).toMatch(/^base-[0-9a-f]{8}$/)
  })

  it('v1은 새 종류에서도 base와 결과 스키마·필드 안내가 같고 L1·L2만 더한다', () => {
    const { dir, scenario } = loadScenario('e1-twoboard')
    for (const t of scenario.tasks.filter((x) => RECORD_KINDS.includes(x.kind))) {
      const more = taskMore(dir, t)
      const b = buildSide('base', t.kind, null, more)
      const v = buildSide('v1', t.kind, null, more)
      expect(v.schemaArg).toBe(b.schemaArg)
      expect(v.instructions.startsWith('# Extraction run contract')).toBe(true)
      expect(v.instructions).toContain(`# ${t.kind[0].toUpperCase()}${t.kind.slice(1)} run`)
      expect(
        v.instructions.endsWith(b.instructions.slice(b.instructions.indexOf('## Result fields'))),
      ).toBe(true)
    }
    const ig = buildSide(
      'base',
      'integrate',
      null,
      taskMore(
        dir,
        scenario.tasks.find((x) => x.id === 'integrate'),
      ),
    )
    expect(ig.schema.properties.coverage.required).toHaveLength(10)
    expect(ig.instructions).toContain('### Coverage keys (perspectives)')
    const rv = taskMore(
      dir,
      scenario.tasks.find((x) => x.id === 'review'),
    )
    expect(rv).toEqual({ answers: ['q1', 'q2', 'q3'], verdicts: ['s1', 's2', 's3', 's4', 's5'] })
  })

  it('기록으로 패킷을 만든다: integrate는 기록 목록의 경로, review는 질문·서술, summarize는 상태와 목록', () => {
    const { dir, scenario } = loadScenario('e1-twoboard')
    const task = (id) => scenario.tasks.find((x) => x.id === id)
    const vars = { ...PLACEHOLDER_VARS, listing: '/w/listing.md', soft: 7, hard: 9 }
    const ig = renderTask(dir, task('integrate'), vars)
    expect(ig.packet).toContain('- Record listing (read-only): /w/listing.md')
    expect(ig.packet).toContain('- Soft deadline: 7 minutes. Hard limit: 9 minutes.')
    expect(ig.packet).toMatch(/## Open unknowns\n\n- c-\d{4} \(u-0002\)/)
    const claims = ig.record.claims.map((c) => c.id)
    expect(ig.listing.split('\n').filter((l) => /^c-\d{4} \|/.test(l))).toHaveLength(claims.length)
    expect(knownIds(ig.packet, ig.listing)).toEqual(expect.arrayContaining([...claims, 'u-0001']))
    expect(() => renderTask(dir, task('integrate'), { ...vars, listing: null })).toThrow(
      /기록 목록/,
    )
    const rv = renderTask(dir, task('review'), vars)
    expect(rv.items.map((i) => i.key)).toEqual(['q1', 'q2', 's1', 's2', 'q3', 's3', 's4', 's5'])
    expect(rv.packet).toContain('## Statements')
    // review 패킷에는 주장의 ID·값·이유·근거를 넣지 않는다(결정 12)
    expect(rv.packet).not.toMatch(/\bc-\d{4}\b/)
    const sm = renderTask(dir, task('summarize'), vars)
    expect(sm.packet).toContain('- Partial analysis: yes')
    expect(sm.packet).toContain('## Claims a review lowered')
    expect(sm.listing).toBeNull()
    // survey·trace는 손으로 쓴 패킷 그대로
    expect(renderTask(dir, task('trace-timing'), vars).packet).toContain(
      'Repository (read-only): /run/repo',
    )
  })

  it('부드러운 마감의 거부 이유: summarize에는 outcome·checkpoint를 말하지 않는다', () => {
    expect(softReason('integrate')).toBe(SOFT_REASON)
    expect(softReason('trace')).toBe(SOFT_REASON)
    expect(softReason('summarize')).not.toMatch(/outcome|checkpoint/)
  })

  it('채점의 run 종류는 scenario.json의 과제가 정하고, run.json과 다르면 멈춘다', () => {
    const { dir, scenario } = loadScenario('e1-twoboard')
    expect(runKind(scenario, { id: 'x', task: 'review', kind: 'review' }).kind).toBe('review')
    expect(runKind(scenario, { id: 'x', task: 'review' }).kind).toBe('review')
    expect(() => runKind(scenario, { id: 'x', task: 'review', kind: 'trace' })).toThrow(/kind/)
    expect(() => runKind(scenario, { id: 'x', task: 'nope' })).toThrow(/과제/)
    // run 폴더에 패킷이 없으면 기록으로 다시 만든다
    const ids = runIds(
      path.join(os.tmpdir(), 'relay-no-such-run'),
      dir,
      scenario.tasks.find((t) => t.id === 'summarize'),
    )
    expect(ids).toEqual(expect.arrayContaining(['u-0007', 'u-0008']))
    expect(
      runIds(
        '/x',
        dir,
        scenario.tasks.find((t) => t.id === 'survey'),
      ),
    ).toBeUndefined()
  })

  it('가짜 claude로 review와 integrate run을 끝까지 돌리고 채점한다', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-dry-new-'))
    try {
      const { dir, scenario } = loadScenario('e1-twoboard')
      const task = (id) => scenario.tasks.find((t) => t.id === id)
      const planFile = (name, p) => {
        const f = path.join(root, `${name}.json`)
        fs.writeFileSync(f, JSON.stringify(p))
        return f
      }
      const common = {
        scenarioDir: dir,
        scenario,
        side: 'base',
        model: 'sonnet',
        effort: 'medium',
        outDir: root,
        workRoot: path.join(root, 'work'),
        bin: 'claude',
        dry: true,
        softMs: 60_000,
        hardMs: 60_000,
        rep: 1,
      }
      const review = readReference(dir, 'review').out
      const rv = await runOne({
        ...common,
        task: task('review'),
        label: 'rv',
        fakePlan: planFile('rv', {
          tools: [{ name: 'Read', input: { file_path: '{wt}/src/cmd.c' } }],
          outputs: [review],
        }),
      })
      expect(rv.failure).toBeNull()
      expect(rv.schemaValid).toBe(true)
      expect(rv.kind).toBe('review')
      const rvDir = path.join(root, 'runs', rv.id)
      const schema = JSON.parse(fs.readFileSync(path.join(rvDir, 'schema.json'), 'utf8'))
      expect(schema.properties.answers.required).toEqual(['q1', 'q2', 'q3'])
      expect(fs.readFileSync(path.join(rvDir, 'packet.md'), 'utf8')).toContain(
        '- s5: (requirements)',
      )
      // 서술 하나의 판정이 빠지면 조립한 스키마에서 걸린다
      const { s5, ...four } = review.verdicts
      expect(s5.verdict).toBe('not_refuted')
      const short = await runOne({
        ...common,
        task: task('review'),
        label: 'short',
        fakePlan: planFile('short', { outputs: [{ ...review, verdicts: four }] }),
      })
      expect(short.failure).toBe('schema')
      const ig = await runOne({
        ...common,
        task: task('integrate'),
        label: 'ig',
        fakePlan: planFile('ig', { outputs: [readReference(dir, 'integrate').out] }),
      })
      expect(ig.failure).toBeNull()
      const igDir = path.join(root, 'runs', ig.id)
      const listingPath = path.join(root, 'work', ig.id, 'listing.md')
      expect(fs.readFileSync(path.join(igDir, 'packet.md'), 'utf8')).toContain(
        `- Record listing (read-only): ${listingPath}`,
      )
      expect(fs.readFileSync(path.join(igDir, 'listing.md'), 'utf8')).toMatch(/^# Record listing/)
      const settings = JSON.parse(fs.readFileSync(path.join(igDir, 'settings.json'), 'utf8'))
      expect(
        settings.permissions.deny.some((d) => d.startsWith('Write(') && d.endsWith('listing.md)')),
      ).toBe(true)

      await scoreDir(root, { judge: false })
      const read = (id) =>
        JSON.parse(fs.readFileSync(path.join(root, 'runs', id, 'score.json'), 'utf8'))
      const rs = read(rv.id)
      expect(rs.violated).toEqual([])
      expect(rs.recall).toMatchObject({
        'r.rev.retry': true,
        'r.rev.fan_cfg': true,
        'r.rev.writer': true,
      })
      expect(rs.pmB).toBe(1)
      expect(rs.anchors.total).toBeGreaterThan(0)
      expect(read(short.id).pmA).toBeUndefined()
      const is = read(ig.id)
      expect(is.violated).toEqual([])
      expect(is.recall['r.int.supersedes_frame']).toBe(true)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  }, 120_000)
})

const cc = findCompiler()

describe('구성별 빌드 인덱스와 제출 검사', () => {
  it('전처리 출력의 줄 표시로 살아 있는 줄을 모은다: 빠진 구간, 레포 밖 파일, 지시문 줄', () => {
    const text = [
      '# 1 "src/a.c"',
      '# 1 "<built-in>" 1',
      '#define __thumb__ 1',
      '# 1 "src/a.c" 2',
      '# 1 "./include/b.h" 1',
      'extern int x;',
      '#define FEAT 0',
      '# 2 "src/a.c" 2',
      '',
      'int x;',
      '# 12 "src/a.c"',
      'int use(void) { return x; }',
      '# 1 "/usr/include/stdint.h" 1',
      'typedef int int32_t;',
    ].join('\n')
    const lines = activeLines(text, '/repo')
    expect(Object.keys(lines).sort()).toEqual(['include/b.h', 'src/a.c'])
    expect([...lines['include/b.h']]).toEqual([1, 2])
    expect([...lines['src/a.c']]).toEqual([3, 12])
    expect(mergeLines([lines, { 'src/a.c': new Set([4, 5]) }])['src/a.c']).toEqual([
      [3, 5],
      [12, 12],
    ])
  })

  it('심볼을 합친다: 강한 정의가 하나라도 있으면 strong', () => {
    expect(
      mergeSymbols([
        [{ name: 'H', bind: 'weak', type: 'func' }],
        [
          { name: 'H', bind: 'global', type: 'func' },
          { name: 'W', bind: 'weak', type: 'func' },
        ],
      ]),
    ).toEqual({ H: 'strong', W: 'weak' })
  })

  it('config_active: 심볼은 구성마다 강한 정의, 아니면 인용한 줄이 컴파일되는지 본다', () => {
    const code = (p, n) => ({ kind: 'code', path: p, start: n, end: n, quote: '', command: null })
    const index = {
      version: 1,
      configs: {
        lo: {
          symbols: { Reset_Handler: 'strong', TIM4_IRQHandler: 'weak' },
          lines: { 'src/cmd.c': [[1, 20]] },
        },
        hi: {
          symbols: { Reset_Handler: 'strong', TIM4_IRQHandler: 'strong' },
          lines: { 'src/cmd.c': [[1, 30]] },
        },
      },
    }
    const item = (key, name, configs, anchors = []) => ({ key, name, configs, anchors })
    const problems = inventoryProblems(
      {
        inventory: [
          item('i1', 'Reset_Handler', ['all']),
          item('i2', 'TIM4_IRQHandler', ['all']),
          item('i3', 'TIM4_IRQHandler', ['hi', 'gamma']),
          item('i4', 'SET_SPEED', ['lo', 'hi'], [code('src/cmd.c', 25)]),
          item('i5', 'GET_SPEED', ['all'], [code('src/cmd.c', 5), code('Makefile', 3)]),
          item('i6', 'DMA1 channel 2', ['all'], [code('src/dma.c', 9)]),
          item('i7', 'Missing_Handler', ['lo']),
        ],
      },
      index,
    )
    expect(problems).toEqual([
      'inventory i2 (TIM4_IRQHandler): configuration lo has only a weak default definition',
      'inventory i4 (SET_SPEED): in configuration lo the cited lines are not compiled (src/cmd.c:25)',
    ])
    expect(
      inventoryProblems({ inventory: [item('i2', 'TIM4_IRQHandler', ['all'])] }, null),
    ).toEqual([])
    expect(submitReason(problems)).toMatch(
      /^relay: .*\n- inventory i2 .*\n- inventory i4 .*\nFix only/,
    )
  })

  it.skipIf(!cc)('ELF 심볼 표: 강한 정의, weak, 정적 함수는 남고 정의 없는 참조는 빠진다', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-elf-'))
    try {
      fs.writeFileSync(
        path.join(tmp, 'a.c'),
        [
          'extern int ext;',
          'void Default_Handler(void) { for (;;) {} }',
          'void TIM9_IRQHandler(void) __attribute__((weak, alias("Default_Handler")));',
          'static int helper(int v) { return v + ext; }',
          'int counter;',
          'int use(void) { return helper(counter); }',
          '',
        ].join('\n'),
      )
      const index = buildIndex(
        tmp,
        { cpu: 'cortex-m3', includes: [], configs: { x: { defines: [], sources: ['a.c'] } } },
        cc,
      )
      const sym = index.configs.x.symbols
      expect(sym).toMatchObject({
        Default_Handler: 'strong',
        TIM9_IRQHandler: 'weak',
        helper: 'strong',
        counter: 'strong',
        use: 'strong',
      })
      expect(sym.ext).toBeUndefined()
      expect(index.configs.x.lines['a.c']).toEqual([[1, 6]])
      expect(() => elfSymbols(Buffer.from('not an object file at all, just text'))).toThrow()
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  // 개발용 시나리오에서 config_active가 잡아야 하는 survey 함정(구성 병합). 다른 함정은 다른 지표의 몫이라 걸리지 않아야 한다
  const CAUGHT = {
    'e1-twoboard': ['survey-fan-everywhere'],
    'e2-gateway': ['survey-fc16-everywhere'],
  }
  it.skipIf(!cc).each(Object.keys(CAUGHT))(
    '%s: reference survey는 통과하고, 구성 병합 함정만 걸린다',
    (id) => {
      const { dir, scenario } = loadScenario(id)
      const index = buildIndex(path.join(dir, 'repo'), scenario.build, cc)
      const { out } = readReference(dir, 'survey')
      expect(submitProblems(out, index)).toEqual([])
      const caught = readTraps(dir)
        .filter((t) => t.task === 'survey')
        .filter((t) => submitProblems(applyOps(out, t.ops), index).length > 0)
        .map((t) => t.name)
      expect(caught).toEqual(CAUGHT[id])
    },
    60_000,
  )

  it.skipIf(!cc)(
    '하네스: 제출 검사에 걸리면 2회까지 되돌리고, 그 뒤 제출은 받아 남은 문제를 기록한다',
    async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-extract-submit-'))
      try {
        const { dir, scenario } = loadScenario('e1-twoboard')
        const task = scenario.tasks.find((t) => t.id === 'survey')
        const { out } = readReference(dir, 'survey')
        const merged = applyOps(
          out,
          readTraps(dir).find((t) => t.name === 'survey-fan-everywhere').ops,
        )
        const index = buildIndex(path.join(dir, 'repo'), scenario.build, cc)
        const planFile = (name, p) => {
          const f = path.join(root, `${name}.json`)
          fs.writeFileSync(f, JSON.stringify(p))
          return f
        }
        const common = {
          scenarioDir: dir,
          scenario,
          task,
          side: 'base',
          model: 'sonnet',
          effort: 'medium',
          outDir: root,
          workRoot: path.join(root, 'work'),
          bin: 'claude',
          dry: true,
          softMs: 60_000,
          hardMs: 60_000,
          buildIndex: index,
          rep: 1,
        }
        const fixed = await runOne({
          ...common,
          label: 'fixed',
          fakePlan: planFile('fixed', { outputs: [merged, out] }),
        })
        expect(fixed.failure).toBeNull()
        expect(fixed.submitCheck.denials).toBe(1)
        expect(fixed.submitCheck.remaining).toEqual([])
        expect(fixed.submitCheck.submits[0].problems[0]).toMatch(/SET_FAN.*alpha/)
        const stuck = await runOne({
          ...common,
          label: 'stuck',
          fakePlan: planFile('stuck', { outputs: [merged, merged, merged] }),
        })
        expect(stuck.failure).toBeNull()
        expect(stuck.submitCheck.denials).toBe(2)
        expect(stuck.submitCheck.submits.map((x) => x.denied)).toEqual([true, true, false])
        expect(stuck.submitCheck.remaining).toHaveLength(1)
        const off = await runOne({
          ...common,
          buildIndex: null,
          label: 'off',
          fakePlan: planFile('off', { outputs: [merged] }),
        })
        expect(off.submitCheck).toBeNull()
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    },
    120_000,
  )
})

describe('집계', () => {
  it('실패한 run은 주지표에서 빼고, 쪽 비교는 과제를 층으로 둔다', () => {
    const row = (label, task, pmA, pmB, failure = null) => ({
      run: {
        label,
        scenario: 's',
        task,
        failure,
        ms: 60000,
        result: { total_cost_usd: 1, num_turns: 3 },
        worktreeChanged: false,
      },
      score: failure
        ? { gates: {} }
        : {
            pmA,
            pmB,
            recall: {},
            violated: [],
            softened: [],
            anchors: { total: 2, fabricated: 0, lineMismatch: 0 },
            gates: {},
          },
    })
    const rows = [
      row('A', 't1', 1, 0.5),
      row('A', 't1', 3, 0.7),
      row('A', 't1', 0, 0, 'schema'),
      row('B', 't1', 0, 0.9),
      row('B', 't1', 0, 1),
    ]
    const s = summarize(rows)
    const a = s.find((x) => x.label === 'A')
    expect(a.failed).toBe(1)
    expect(a.pmA).toBe(2)
    expect(a.pmB).toBeCloseTo(0.6)
    const c = comparePair(s, 'A', 'B')
    expect(c['PM-A'].diff).toBe(2)
    expect(c['PM-B'].diff).toBeCloseTo(-0.35)
  })
})

describe('저장본과 채택 판정', () => {
  const row = (label, task, pmA, pmB, extra = {}) => ({
    run: {
      id: `${label}.s.${task}.1`,
      label,
      side: label === 'B' ? 'v1' : 'base',
      scenario: 's',
      task,
      rep: 1,
      failure: extra.failure ?? null,
      ms: 90000,
      model: 'sonnet',
      effort: 'medium',
      result: { total_cost_usd: 0.5, num_turns: 7 },
      worktreeChanged: !!extra.worktree,
      init: { model: 'claude-sonnet-5-5', version: '2.1.295' },
    },
    score: extra.failure
      ? { gates: {} }
      : {
          pmA,
          pmB,
          recall: { 'r.a': true, 'r.b': pmB === 1 },
          violated: pmA ? ['m.x'] : [],
          softened: [],
          anchors: { total: 4, ok: 4, fabricated: 0, lineMismatch: 0 },
          gates: { leak: false, worktreeChanged: !!extra.worktree },
        },
  })

  it('저장본으로 쓰고 다시 읽어도 집계가 같다', () => {
    const rows = [
      row('A', 't1', 1, 0.5),
      row('A', 't2', 0, 1),
      row('A', 't2', 0, 0, { failure: 'schema' }),
    ]
    const back = fromStored(JSON.parse(JSON.stringify({ runs: toStored(rows) })))
    const strip = (s) => s.map(({ cost, minutes, turns, ...x }) => ({ ...x, cost, minutes, turns }))
    expect(strip(summarize(back))).toEqual(strip(summarize(rows)))
    expect(toStored(rows)[0]).toMatchObject({
      missed: ['r.b'],
      claude: '2.1.295',
      model: 'claude-sonnet-5-5',
    })
  })

  it('이름표 바꾸기: 시나리오를 주면 그 시나리오의 행만 바꾼다', () => {
    const r = (label, scenario) => ({ run: { label, scenario }, score: null })
    const out = relabel([r('A', 'e1'), r('A', 'e2'), r('N', 'e2')], ['A=BASE@e1', 'N=BASE@e2']).map(
      (x) => `${x.run.label}.${x.run.scenario}`,
    )
    expect(out).toEqual(['BASE.e1', 'A.e2', 'BASE.e2'])
    expect(() => relabel([], ['A'])).toThrow(/--as/)
    const t = (label, scenario, task) => ({ run: { label, scenario, task }, score: null })
    expect(
      relabel([t('C', 'e1', 'survey'), t('C', 'e1', 'trace-timing')], ['C=C2@e1.trace-timing']).map(
        (x) => x.run.label,
      ),
    ).toEqual(['C', 'C2'])
  })

  it('옛 저장본(관문 칸 없음)은 관문 위반 0으로 읽는다', () => {
    const [r] = fromStored({
      runs: [{ id: 'A.s.t.1', label: 'A', scenario: 's', task: 't', pmA: 0, pmB: 1, missed: [] }],
    })
    expect(summarize([r])[0].gates).toBe(0)
  })

  it('채택: PM-A가 분명히 낮고 PM-B 퇴보가 한도 안이면 채택, 관문 위반이나 PM-A 퇴보면 아니다', () => {
    const many = (label, task, pmA, pmB, n = 5) =>
      Array.from({ length: n }, () => row(label, task, pmA, pmB))
    const better = [
      ...many('B', 't1', 0, 1),
      ...many('B', 't2', 0, 1),
      ...many('A', 't1', 1, 1),
      ...many('A', 't2', 1, 1),
    ]
    expect(adoption(summarize(better), 'B', 'A').adopt).toBe(true)
    const worse = [
      ...many('B', 't1', 1, 1),
      ...many('B', 't2', 1, 1),
      ...many('A', 't1', 0, 1),
      ...many('A', 't2', 0, 1),
    ]
    expect(adoption(summarize(worse), 'B', 'A').adopt).toBe(false)
    const gate = [...better, row('B', 't1', 0, 1, { worktree: true })]
    const d = adoption(summarize(gate), 'B', 'A')
    expect(d.adopt).toBe(false)
    expect(d.gates).toBe(1)
    // 기준선에만 있는 층은 보지 않는다
    const extra = [...better, ...many('A', 't3', 5, 0)]
    expect(adoption(summarize(extra), 'B', 'A').groups).toBe(2)
  })

  it('저장본에 run 종류를 남기고, 과제로 행을 골라 새 종류의 층을 따로 판정한다', () => {
    const rows = [
      { ...row('A', 'survey', 0, 1), run: { ...row('A', 'survey', 0, 1).run, kind: 'survey' } },
      { ...row('A', 'review', 1, 0.5), run: { ...row('A', 'review', 1, 0.5).run, kind: 'review' } },
    ]
    const stored = toStored(rows)
    expect(stored.map((r) => r.kind)).toEqual(['survey', 'review'])
    expect(fromStored({ runs: stored }).map((r) => r.run.kind)).toEqual(['survey', 'review'])
    expect(fromStored({ runs: [{ id: 'A.s.t.1', label: 'A', task: 't' }] })[0].run.kind).toBeNull()
    expect(filterTasks(rows, ['review']).map((r) => r.run.task)).toEqual(['review'])
    expect(filterTasks(rows, null)).toHaveLength(2)
  })

  it('실패율이 기준선보다 10%p 넘게 높으면 채택하지 않는다', () => {
    const many = (label, task, pmA, pmB, n = 5) =>
      Array.from({ length: n }, () => row(label, task, pmA, pmB))
    const rows = [
      ...many('B', 't1', 0, 1, 4),
      row('B', 't1', 0, 0, { failure: 'schema' }),
      ...many('A', 't1', 1, 1),
    ]
    const d = adoption(summarize(rows), 'B', 'A')
    expect(d.failDiff).toBeCloseTo(0.2)
    expect(d.adopt).toBe(false)
  })
})
