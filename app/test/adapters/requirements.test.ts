// [어댑터] 요구사항 추출의 기록 파일과 헤드리스 run (requirements-extraction-flow.md 결정 33, 38, 41, 42, 93, 97).
// 실제 파일, git, 훅 서버, 프로세스를 쓴다. run은 가짜 claude(test/support/fake-claude/print-run.mjs)로 돌린다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadChecklist, loadLayers, loadPerspectives } from '../../../skills/extract/load.mjs'
import { buildRun } from '../../../skills/extract/run.mjs'
import { headCommit } from '../../src/adapters/git'
import { HookServer } from '../../src/adapters/hooks'
import {
  IntegrityError,
  RequirementsFiles,
  assembleRun,
  baseReader,
  resultProblems,
  runExtract,
  submitReason,
  usageLimit,
  worktreeFingerprint,
} from '../../src/adapters/requirements'
import { emptyPointer, startRevision } from '../../src/core/requirements'
import surveyBase from '../../src/shared/generated/extract-survey.v0.schema.json'
import { makeRepo } from '../support/repo'

const AT = '2026-10-09T10:00:00+09:00'
const ROOT = path.resolve(import.meta.dirname, '../../..')
const FAKE = path.resolve(import.meta.dirname, '../support/fake-claude/print-run.mjs')

let tmp: string
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-req-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('[어댑터] 기록 파일 (결정 33, 38, 41)', () => {
  it('revision을 쓰고 포인터까지 읽는다. 포인터보다 뒤 번호의 고아 파일은 지운다', async () => {
    const files = new RequirementsFiles(tmp)
    const { revision, next } = startRevision(emptyPointer().next, AT)
    const hash = await files.writeRevision(revision)
    const orphan = { ...revision, number: 2, parent: 1 }
    await files.writeRevision(orphan)
    const loaded = await files.load({ ...emptyPointer(), revision: 1, revision_hash: hash, next })
    expect(loaded).toEqual([revision])
    expect(fs.readdirSync(files.revisions)).toEqual(['000001.json'])
  })

  it('되감기로 버린 계보는 이력으로 두고 포인터의 계보만 읽는다. 다음 번호 이상만 고아다 (결정 33, 120)', async () => {
    const files = new RequirementsFiles(tmp)
    const first = startRevision(emptyPointer().next, AT)
    await files.writeRevision(first.revision)
    const second = { ...first.revision, number: 2, parent: 1, units: [] }
    await files.writeRevision(second)
    // 되감기: parent가 없는 새 시작 revision 3과 그 뒤의 4
    const restart = startRevision({ ...first.next, revision: 3 }, AT, '되감기로 다시 시작')
    await files.writeRevision(restart.revision)
    const after = { ...second, number: 4, parent: 3 }
    const hash = await files.writeRevision(after)
    await files.writeRevision({ ...second, number: 5, parent: 4 })
    const loaded = await files.load({
      ...emptyPointer(),
      revision: 4,
      revision_hash: hash,
      next: { ...restart.next, revision: 5 },
    })
    expect(loaded.map((r) => [r.number, r.parent])).toEqual([
      [3, null],
      [4, 3],
    ])
    expect(fs.readdirSync(files.revisions)).toEqual([
      '000001.json',
      '000002.json',
      '000003.json',
      '000004.json',
    ])
  })

  it('포인터의 해시가 다르거나 파일이 없으면 무결성 오류다', async () => {
    const files = new RequirementsFiles(tmp)
    const { revision } = startRevision(emptyPointer().next, AT)
    await files.writeRevision(revision)
    await expect(
      files.load({ ...emptyPointer(), revision: 1, revision_hash: 'sha256:00' }),
    ).rejects.toThrow(IntegrityError)
    await expect(
      files.load({ ...emptyPointer(), revision: 2, revision_hash: 'sha256:00' }),
    ).rejects.toThrow(/revision 2 파일이 없음/)
  })

  it('스키마를 통과하지 않는 revision은 쓰지 않는다', async () => {
    const files = new RequirementsFiles(tmp)
    const { revision } = startRevision(emptyPointer().next, AT)
    await expect(files.writeRevision({ ...revision, number: 0 })).rejects.toThrow(IntegrityError)
  })

  it('사람 답은 불변 파일과 해시로 남기고, 바뀌면 무결성 오류다', async () => {
    const files = new RequirementsFiles(tmp)
    const p = await files.writeAnswers([{ decision: 'h-0001', answer: 'lo만', at: AT }], AT)
    expect(await files.readAnswers(p)).toEqual([{ decision: 'h-0001', answer: 'lo만', at: AT }])
    fs.writeFileSync(path.join(files.answers, p.file), '[]')
    await expect(files.readAnswers(p)).rejects.toThrow(IntegrityError)
  })

  it('실행 출력 근거는 requirements/outputs/의 내용 해시 사본을 가리키게 바꾼다 (결정 42)', async () => {
    const files = new RequirementsFiles(tmp)
    const scratch = files.scratchDir('r-0002')
    fs.mkdirSync(scratch, { recursive: true })
    fs.writeFileSync(path.join(scratch, 'out.txt'), '[9,2]\n')
    const out = (p: string) => ({
      kind: 'tool_output',
      path: p,
      start: 1,
      end: 1,
      quote: '[9,2]',
      command: 'node d.mjs',
    })
    const code = { kind: 'code', path: 'src/a.js', start: 1, end: 1, quote: 'x', command: null }
    const result = {
      observations: [{ key: 'o1', anchors: [out('out.txt'), code] }],
      unknowns: [{ key: 'u1', anchors: [out(path.join(scratch, 'out.txt')), out('none.txt')] }],
    }
    const kept = await files.keepOutputs(result, { run: 'r-0002', worktree: path.join(tmp, 'wt') })
    const k = kept.result as typeof result
    const copy = k.observations[0]?.anchors[0]?.path ?? ''
    expect(copy).toMatch(/^requirements\/outputs\/[0-9a-f]{64}\.txt$/)
    // 절대 경로로 적은 같은 파일은 같은 사본이다
    expect(k.unknowns[0]?.anchors[0]?.path).toBe(copy)
    expect(k.observations[0]?.anchors[1]).toEqual(code)
    expect(fs.readFileSync(path.join(tmp, copy), 'utf8')).toBe('[9,2]\n')
    expect(kept.missing).toEqual(['none.txt'])
    // 원래 결과는 바꾸지 않는다
    expect(result.observations[0]?.anchors[0]?.path).toBe('out.txt')
  })

  it('실행 출력 사본에 명령이 가리키는 scratch 안 입력 파일도 남긴다 (AI 결정 121)', async () => {
    const files = new RequirementsFiles(tmp)
    const scratch = files.scratchDir('r-0004')
    fs.mkdirSync(scratch, { recursive: true })
    fs.writeFileSync(path.join(scratch, 'out.txt'), 'NaN\n')
    fs.writeFileSync(path.join(scratch, 'probe.mjs'), 'console.log(0/0)\n')
    fs.writeFileSync(path.join(scratch, 'data.json'), '[]\n')
    const result = {
      observations: [
        {
          key: 'o1',
          anchors: [
            {
              kind: 'tool_output',
              path: 'out.txt',
              start: 1,
              end: 1,
              quote: 'NaN',
              command: `cd ${scratch} && node probe.mjs --in "data.json" ../../etc/passwd > out.txt`,
            },
          ],
        },
      ],
    }
    const kept = await files.keepOutputs(result, { run: 'r-0004', worktree: path.join(tmp, 'wt') })
    const a = (
      kept.result as {
        observations: { anchors: { inputs?: { path: string; copy: string }[] }[] }[]
      }
    ).observations[0]?.anchors[0]
    expect(a?.inputs?.map((i) => i.path)).toEqual(['probe.mjs', 'data.json'])
    expect(fs.readFileSync(path.join(tmp, a?.inputs?.[0]?.copy ?? ''), 'utf8')).toBe(
      'console.log(0/0)\n',
    )
  })

  it('실행 출력의 인용을 사본과 같은 바이트로 대조하고, 대조한 바이트를 사본으로 둔다 (결정 42, 101)', async () => {
    const files = new RequirementsFiles(tmp)
    const scratch = files.scratchDir('r-0003')
    fs.mkdirSync(scratch, { recursive: true })
    fs.writeFileSync(path.join(scratch, 'out.txt'), 'head\nsorted: 10,2,9\n')
    const o = { run: 'r-0003', worktree: path.join(tmp, 'wt') }
    const anchor = (start: number, p = 'out.txt') => ({
      kind: 'tool_output',
      path: p,
      start,
      end: start,
      quote: 'sorted: 10,2,9',
      command: 'node rank.mjs',
    })
    const result = { observations: [{ key: 'o1', anchors: [anchor(1), anchor(1, 'none.txt')] }] }
    const reader = files.outputReader(o)
    const ctx = { repo: o.worktree, read: async () => null, readOutput: reader.read }
    expect(await resultProblems(result, ctx)).toEqual([
      expect.stringMatching(/^quote_match: .*output out\.txt:1-1 reads "head".*at line 2/),
      expect.stringMatching(/^quote_match: .*output file none\.txt was not found/),
    ])
    // 읽은 뒤 파일이 바뀌어도 사본은 대조한 바이트다
    fs.writeFileSync(path.join(scratch, 'out.txt'), 'changed\n')
    const kept = await files.keepOutputs(result, o, reader)
    const copy = (kept.result as typeof result).observations[0]?.anchors[0]?.path ?? ''
    expect(fs.readFileSync(path.join(tmp, copy), 'utf8')).toBe('head\nsorted: 10,2,9\n')
    // readOutput가 없으면(앞 판의 호출) 실행 출력은 보지 않는다
    expect(await resultProblems(result, { repo: o.worktree, read: async () => null })).toEqual([])
  })

  it('run 기록은 requirements/runs, scratch는 requirements/ 밖이다 (결정 42)', () => {
    const files = new RequirementsFiles(tmp)
    expect(path.relative(tmp, files.runDir('r-0001'))).toBe(
      path.join('requirements', 'runs', 'r-0001'),
    )
    expect(path.relative(tmp, files.scratchDir('r-0001'))).toBe(path.join('scratch', 'r-0001'))
  })
})

describe('[어댑터] 지시와 스키마는 평가와 같은 바이트다 (결정 97)', () => {
  it('survey와 trace(timing)의 조립본 해시가 skills/extract의 buildRun과 같다', () => {
    const s = assembleRun(ROOT, 'survey', null)
    expect(s.hashes).toEqual(
      buildRun({ base: surveyBase, checklist: null, layers: loadLayers('survey', null, ROOT) })
        .hashes,
    )
    const t = assembleRun(ROOT, 'trace', 'timing')
    expect(t.instructions).toContain('## Checklist keys')
    expect(loadChecklist('timing', ROOT).length).toBeGreaterThan(0)
  })

  it('integrate는 관점을, review는 패킷의 질문·서술 키를 결과 스키마의 칸에 넣는다 (AI 결정 108, 112)', () => {
    const i = assembleRun(ROOT, 'integrate', null)
    const cov = (i.schema.properties as Record<string, { required: string[] }>)['coverage']
    expect(cov?.required).toEqual(loadPerspectives(ROOT).map((p) => p.id))
    expect(i.instructions).toContain('# Integrate run')
    expect(i.instructions).toContain('### Coverage keys (perspectives)')
    const r = assembleRun(ROOT, 'review', null, { answers: ['q1'], verdicts: ['s1', 's2'] })
    const props = r.schema.properties as Record<string, { required: string[] }>
    expect(props['answers']?.required).toEqual(['q1'])
    expect(props['verdicts']?.required).toEqual(['s1', 's2'])
    expect(assembleRun(ROOT, 'summarize', null).instructions).toContain('# Summarize run')
  })
})

describe('[어댑터] 기준 커밋 읽기와 반영 검사 (결정 35, 37)', () => {
  it('기준 커밋의 파일과 blob, 규칙 표와 인용 대조의 문제', async () => {
    const { repo } = makeRepo(tmp, 'fw', { 'src/a.c': 'int x;\nvoid f(void)\n{\n}\n' })
    const commit = await headCommit(repo)
    const r = baseReader(repo, commit)
    expect(await r.read('src/a.c')).toContain('void f(void)')
    expect(await r.read('src/none.c')).toBeNull()
    expect(await r.blob('src/a.c')).toMatch(/^[0-9a-f]{40}$/)
    const result = {
      outcome: 'done',
      checkpoint: null,
      observations: [
        {
          key: 'o1',
          text: 't',
          configs: ['lo', 'zz'],
          anchors: [
            {
              kind: 'code',
              path: `${repo}/src/a.c`,
              start: 1,
              end: 1,
              quote: 'void f(void)',
              command: null,
            },
          ],
          inference: false,
        },
      ],
    }
    const problems = await resultProblems(result, { repo, read: r.read, configs: ['lo'] })
    expect(problems).toEqual([
      expect.stringMatching(/^config_known: .*zz/),
      expect.stringMatching(/^quote_match: .*the quote is at line 2/),
    ])
    expect(submitReason(problems)).toMatch(/^relay: .*\n- config_known/)
  })

  it('EUC-KR 주석이 있는 파일은 ASCII 뼈대로 대조한다: 모지바케 인용은 받고 코드가 다른 인용은 걸린다 (AI 결정 123)', async () => {
    const { repo } = makeRepo(tmp, 'euc', { 'src/p.c': 'x\n' })
    // "펌프 끄기"의 EUC-KR 바이트
    const comment = Buffer.from([0xc6, 0xdf, 0xc7, 0xc1, 0x20, 0xb2, 0xf4, 0xb1, 0xe2])
    fs.writeFileSync(
      path.join(repo, 'src', 'p.c'),
      Buffer.concat([
        Buffer.from('int x;\nvoid pump_off(void) /* '),
        comment,
        Buffer.from(' */\n{\n}\n'),
      ]),
    )
    execFileSync('git', ['-C', repo, 'commit', '-qam', 'euc-kr'])
    const commit = await headCommit(repo)
    const r = baseReader(repo, commit)
    expect(await r.read('src/p.c')).toContain('\uFFFD')
    const result = (quote: string) => ({
      outcome: 'done',
      checkpoint: null,
      observations: [
        {
          key: 'o1',
          text: 't',
          configs: ['all'],
          anchors: [{ kind: 'code', path: 'src/p.c', start: 2, end: 2, quote, command: null }],
          inference: false,
        },
      ],
    })
    expect(
      await resultProblems(result('void pump_off(void) /* ÆßÇÁ ²ô±â */'), { repo, read: r.read }),
    ).toEqual([])
    expect(
      await resultProblems(result('void pump_on(void) /* 펌프 켜기 */'), { repo, read: r.read }),
    ).toEqual([expect.stringMatching(/^quote_match: /)])
  })
})

describe('[어댑터] 헤드리스 run (15.3, 결정 13, 25)', () => {
  let hooks: HookServer
  beforeEach(async () => {
    hooks = new HookServer()
    await hooks.listen()
  })
  afterEach(async () => {
    await hooks.close()
  })

  async function go(plan: object, over: Partial<Parameters<typeof runExtract>[0]> = {}) {
    const { repo } = makeRepo(tmp, `fw${Math.random().toString(36).slice(2, 7)}`, {
      'a.c': 'int x;\n',
    })
    const planFile = path.join(tmp, `plan-${Math.random().toString(36).slice(2, 7)}.json`)
    fs.writeFileSync(planFile, JSON.stringify(plan))
    const files = new RequirementsFiles(path.join(tmp, 'work'))
    const out = await runExtract({
      run: 'r-0001',
      bin: process.execPath,
      binArgs: [FAKE],
      env: { ...process.env, FAKE_CLAUDE_RUN: planFile },
      files,
      repo,
      packet: '# Packet: survey\n',
      assembled: assembleRun(ROOT, 'survey', null),
      hooks,
      model: 'sonnet',
      effort: 'medium',
      softMs: 60_000,
      hardMs: 60_000,
      submitCheck: async () => [],
      ...over,
    })
    return { out, files, repo }
  }

  const output = {
    outcome: 'done',
    outcome_reason: '봤다',
    configs: [],
    inventory: [],
    boundaries: [],
    units: [],
    not_found: [],
    unknowns: [],
    human_decisions: [],
    checkpoint: null,
  }

  it('구조화 출력과 마지막 Stop을 받고, run 기록을 requirements/runs에 남긴다', async () => {
    let spawned: number | null = null
    const { out, files } = await go(
      { outputs: [output] },
      {
        onSpawn: (pid) => {
          spawned = pid
        },
      },
    )
    expect(out.exitCode).toBe(0)
    expect(out.output).toEqual(output)
    expect(out.schemaValid).toBe(true)
    expect(out.lastStop).toMatchObject({ background_tasks: [], session_crons: [] })
    expect(spawned).toBeGreaterThan(0)
    const dir = files.runDir('r-0001')
    expect(fs.readdirSync(dir).sort()).toEqual(
      [
        'hooks.jsonl',
        'instructions.md',
        'packet.md',
        'result.json',
        'schema.json',
        'settings.json',
        'stdout.jsonl',
      ].sort(),
    )
    const settings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')) as {
      permissions: { deny: string[] }
    }
    expect(
      settings.permissions.deny.some((d) => d.startsWith('Write(') && d.includes('requirements')),
    ).toBe(true)
  })

  it('제출 검사에 걸리면 2회까지 되돌리고 그 뒤 제출은 받는다 (결정 13)', async () => {
    const bad = { ...output, outcome_reason: 'bad' }
    const { out } = await go(
      { outputs: [bad, bad, bad] },
      {
        submitCheck: async (o) =>
          (o as { outcome_reason?: string }).outcome_reason === 'bad' ? ['x'] : [],
      },
    )
    expect(out.submits.map((s) => s.denied)).toEqual([true, true, false])
    expect(out.output).toEqual(bad)
  })

  it('[즉시 중단]이면 프로세스를 끝내고 stoppedByApp이다', async () => {
    const ac = new AbortController()
    ac.abort()
    const { out } = await go({ outputs: [output] }, { signal: ac.signal })
    expect(out.stoppedByApp).toBe(true)
  })

  it('worktree 지문은 run이 파일을 쓰면 바뀐다 (결정 39)', async () => {
    const { repo } = makeRepo(tmp, 'wt', { 'a.c': 'int x;\n' })
    const before = await worktreeFingerprint(repo)
    fs.writeFileSync(path.join(repo, 'build.o'), 'x')
    expect(await worktreeFingerprint(repo)).not.toBe(before)
  })

  it('사용량 한도 실패를 가른다 (결정 29, 52의 가정)', () => {
    expect(usageLimit([{ type: 'result', is_error: false }])).toBeNull()
    expect(
      usageLimit([
        {
          type: 'rate_limit_event',
          rate_limit_info: { status: 'rejected', rateLimitType: 'five_hour', resetsAt: 9 },
        },
      ]),
    ).toEqual({ type: 'five_hour', resetsAt: 9 })
    expect(usageLimit([{ type: 'result', is_error: true, api_error_status: 429 }])).toEqual({
      type: null,
      resetsAt: null,
    })
  })
})
