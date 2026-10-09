// extract run 평가 도구의 시험(모델을 부르지 않는다, docs/extract-eval.md, 결정 21).
// 1. 시나리오마다 손으로 쓴 reference 결과가 조립한 스키마를 통과하고 만점이다(PM-A 0, PM-B 1, 앵커 모두 맞음)
// 2. 함정(traps/*.json)이 해당 지표에서 잡힌다
// 3. 채점 규칙(앵커 대조, 구성, 수치, 판정 읽기), 사용량 읽기, 사용량 한도 가르기, 집계
// 4. 하네스를 가짜 claude(dry)로 끝까지 돌린다: 끝 판정, worktree 변경, 스키마 검사
// 5. 구성별 빌드 인덱스와 제출 검사 config_active(AI 결정 87·88. 컴파일이 드는 경우는 컴파일러가 없으면 건너뛴다)
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
import { buildIndex } from '../extract/lib/build-index.mjs'
import { findCompiler } from '../extract/lib/cc.mjs'
import { runBin } from '../extract/lib/claude-bin.mjs'
import { applyOps, mergeJudge, readReference, readTraps } from '../extract/lib/fixtures.mjs'
import { judgeArgs } from '../extract/lib/judge.mjs'
import {
  renderPacket,
  runOne,
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
  expandConfigs,
  hasLeak,
  judgePrompt,
  nameHas,
  normPath,
  normQuote,
  scoreRun,
  unitKey,
} from '../extract/lib/score.mjs'
import { buildSide, sideId } from '../extract/lib/sides.mjs'
import { guard, parseUsage } from '../extract/lib/usage.mjs'
import {
  adoption,
  comparePair,
  fromStored,
  relabel,
  summarize,
  toStored,
} from '../extract/report.mjs'
import { listScenarios, loadScenario, plan } from '../extract/run.mjs'
import { loadTruth, repoReader, scoreDir } from '../extract/score.mjs'

const scenarios = listScenarios()

function score(dir, truth, task, out, judge) {
  const anchors = checkAnchors(collectAnchors(out), repoReader(dir), '/run/repo')
  return scoreRun({
    out,
    truth,
    task,
    anchors,
    judge,
    leak: hasLeak(JSON.stringify(out), truth),
    worktreeChanged: false,
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
    for (const side of ['base', 'v1'])
      for (const t of scenario.tasks)
        texts.push(buildSide(side, t.kind, t.lens ?? null).instructions)
    expect(texts.some((x) => x.includes(truth.canary))).toBe(false)
  })

  it.each(scenario.tasks.map((t) => [t.id, t]))('reference %s: 스키마 통과, 만점', (_, task) => {
    const { out, judge } = readReference(dir, task.id)
    const built = buildSide('base', task.kind, task.lens ?? null)
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(built.schema)
    expect(validate(out), JSON.stringify(validate.errors)).toBe(true)
    const s = score(dir, truth, task.id, out, judge)
    expect(s.violated).toEqual([])
    expect(s.pmB).toBe(1)
    expect(s.undecided).toEqual([])
    expect(s.softened).toEqual([])
    expect(s.anchors.fabricated + s.anchors.lineMismatch).toBe(0)
    expect(s.anchors.total).toBeGreaterThan(0)
  })

  it.each(readTraps(dir).map((t) => [t.name, t]))('함정 %s가 잡힌다', (_, trap) => {
    const ref = readReference(dir, trap.task)
    const out = applyOps(ref.out, trap.ops)
    const judge = mergeJudge(ref.judge, trap.judge)
    const s = score(dir, truth, trap.task, out, judge)
    const e = trap.expect
    if (e.violated) expect(s.violated).toEqual(expect.arrayContaining(e.violated))
    if (e.violated && e.violated.length === 0) expect(s.violated).toEqual([])
    if (e.missed) for (const id of e.missed) expect(s.recall[id], id).toBe(false)
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
    const p = judgePrompt(out, truth, 'trace-timing')
    expect(p).toContain('r.tim.wdt_unknown')
    expect(p).not.toContain('r.tim.frame_ms')
    expect(p).not.toContain('"quote"')
    expect(p).not.toContain(truth.canary)
    expect(claimLines(out).every((l) => /^[a-z_]+[ :]/.test(l))).toBe(true)
  })

  it('판정 호출은 도구·MCP·사용자 설정·세션 저장 없이 부른다', () => {
    const a = judgeArgs({ model: 'sonnet', system: 's', schema: {} })
    expect(a).toEqual(expect.arrayContaining(['--strict-mcp-config', '--no-session-persistence']))
    expect(a[a.indexOf('--tools') + 1]).toBe('')
    expect(a[a.indexOf('--setting-sources') + 1]).toBe('')
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
