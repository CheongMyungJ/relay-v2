// [어댑터] 중앙 저장소 (5.1): 원자적 쓰기, config.json 기본값, intent 이력, decisions.md, 산출물, 스킬 배포.
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claudeVersion,
  deploySkill,
  mergeSkill,
  selectType,
  skillText,
} from '../../src/adapters/claude'
import { WORK_TYPES } from '../../src/shared/work'
import { TYPES, assemble } from '../../../skills/assemble.mjs'
import {
  WorkFiles,
  loadConfig,
  readThemeSync,
  partialUtf8,
  relayHome,
  writeFileAtomic,
} from '../../src/adapters/store'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import { FAKE_CLAUDE, SKILLS } from '../support/harness'

let root: string

beforeEach(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-store-')))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 })
})

const read = (f: string) => fs.readFileSync(f, 'utf8')

describe('[어댑터] 저장소 (5.1)', () => {
  it('RELAY_HOME은 환경 변수로만 바꾼다. 기본은 사용자 폴더의 .relay (D74)', () => {
    expect(relayHome({ RELAY_HOME: root })).toBe(root)
    expect(relayHome({})).toBe(path.join(os.homedir(), '.relay'))
  })

  it('원자적으로 쓰고 임시 파일을 남기지 않는다 (I11)', async () => {
    const file = path.join(root, 'a', 'work.json')
    await writeFileAtomic(file, '{"v":1}\n')
    await writeFileAtomic(file, '{"v":2}\n')
    expect(read(file)).toBe('{"v":2}\n')
    expect(fs.readdirSync(path.dirname(file))).toEqual(['work.json'])
  })

  it('창을 그리기 전에 테마만 동기로 읽는다. 없거나 깨졌거나 틀린 값이면 system이다 (D335)', () => {
    const file = path.join(root, 'config.json')
    expect(readThemeSync(root)).toBe('system')
    fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ theme: 'light' }))
    expect(readThemeSync(root)).toBe('light')
    fs.writeFileSync(file, JSON.stringify({ theme: 'blue' }))
    expect(readThemeSync(root)).toBe('system')
    fs.writeFileSync(file, '{')
    expect(readThemeSync(root)).toBe('system')
  })

  it('config.json이 없으면 기본값으로 만들고, 없는 키는 기본값을 쓴다 (5.1.1)', async () => {
    expect((await loadConfig(root)).config).toEqual(DEFAULT_CONFIG)
    expect(JSON.parse(read(path.join(root, 'config.json')))).toEqual(DEFAULT_CONFIG)
    fs.writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({ format_error_bounce_max: 1, question_mode: { fix: 'confirm_each' } }),
    )
    const { config } = await loadConfig(root)
    expect(config.format_error_bounce_max).toBe(1)
    expect(config.question_mode).toEqual({ ...DEFAULT_CONFIG.question_mode, fix: 'confirm_each' })
    expect(config.session_limit).toBe(3)
  })

  it('값이 틀린 키는 기본값을 쓰고 경고한다 (core/config)', async () => {
    fs.writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({ session_limit: 0, format_error_bounce_max: 1 }),
    )
    const r = await loadConfig(root)
    expect(r.config).toEqual({ ...DEFAULT_CONFIG, format_error_bounce_max: 1 })
    expect(r.warning).toContain('세션 상한')
  })

  it('UTF-8 BOM으로 저장한 config.json도 읽는다 (Windows 메모장)', async () => {
    fs.writeFileSync(
      path.join(root, 'config.json'),
      `\uFEFF${JSON.stringify({ format_error_bounce_max: 1 })}`,
    )
    const r = await loadConfig(root)
    expect(r.warning).toBeUndefined()
    expect(r.config.format_error_bounce_max).toBe(1)
  })

  it('config.json을 읽을 수 없으면 파일은 그대로 두고 기본값을 쓰며 경고한다', async () => {
    fs.writeFileSync(path.join(root, 'config.json'), '{ 틀림')
    const r = await loadConfig(root)
    expect(r.config).toEqual(DEFAULT_CONFIG)
    expect(r.warning).toContain('config.json')
    expect(read(path.join(root, 'config.json'))).toBe('{ 틀림')
  })

  it('intent.md를 새 버전으로 바꾸면 이전 버전은 intent.history/v<N>.md에 둔다 (5.3)', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    await w.writeIntent('v1\n', 1)
    expect(fs.existsSync(w.intentHistory)).toBe(false)
    await w.writeIntent('v2\n', 2)
    expect(read(w.intent)).toBe('v2\n')
    expect(read(path.join(w.intentHistory, 'v1.md'))).toBe('v1\n')
  })

  it('decisions.md와 events.jsonl에 더한다 (5.4, 5.5)', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    await w.appendDecisions('## t-01 intake — 2026-09-26 10:00 (사람 승인)\n없음\n')
    await w.appendDecisions('## t-02 fix — 2026-09-26 11:00 (사람 승인)\n없음\n')
    expect(read(w.decisions)).toBe(
      '## t-01 intake — 2026-09-26 10:00 (사람 승인)\n없음\n\n## t-02 fix — 2026-09-26 11:00 (사람 승인)\n없음\n',
    )
    const event = { ts: 'x', work_id: 'w', type: 'work.created' as const, payload: {} }
    await w.appendEvent(event)
    await w.appendEvent({ ...event, type: 'work.completed' })
    expect((await w.readEvents()).map((e) => e.type)).toEqual(['work.created', 'work.completed'])
  })

  it('산출물은 task 디렉터리의 .md 중 context.md와 handoff.md를 뺀 것이다 (D89)', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    const task = { seq: 2, node: 'fix' as const }
    const dir = w.taskDir(task)
    expect(dir).toBe(path.join(root, 'w', 'tasks', '02-fix'))
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true })
    for (const f of [
      'context.md',
      'handoff.md',
      'fix.md',
      'notes.md',
      'pty.log',
      'task.settings.json',
    ]) {
      fs.writeFileSync(path.join(dir, f), f)
    }
    expect(await w.artifacts(task)).toEqual([path.join(dir, 'fix.md'), path.join(dir, 'notes.md')])
    expect(Object.keys(await w.taskFiles(task))).toEqual([
      'context.md',
      'fix.md',
      'handoff.md',
      'notes.md',
    ])
    expect(await w.taskFiles({ seq: 9, node: 'verify' })).toEqual({})
  })

  it('pty.log 끝에 표시 줄을 한 번만 붙이고, 끝의 덜 쓴 UTF-8 문자는 지운다. pty.log가 없으면 만들지 않는다 (D219)', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    const task = { seq: 4, node: 'fix' as const }
    const file = path.join(w.taskDir(task), 'pty.log')
    const mark = '\r\n── relay: 앱이 꺼져 세션이 여기서 끝났습니다 ──\r\n'
    await w.appendPtyMark(task, mark)
    expect(fs.existsSync(file)).toBe(false)
    // 충돌로 "한"(ED 95 9C)의 앞 두 바이트만 쓰였다
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, Buffer.concat([Buffer.from('작업 중'), Buffer.from([0xed, 0x95])]))
    await w.appendPtyMark(task, mark)
    await w.appendPtyMark(task, mark)
    expect(read(file)).toBe(`작업 중${mark}`)
    expect(await w.readPtyLog(task)).toBe(`작업 중${mark}`)
  })

  it('끝의 덜 쓴 UTF-8 문자의 바이트 수', () => {
    expect(partialUtf8(Buffer.from('abc'))).toBe(0)
    expect(partialUtf8(Buffer.from('가'))).toBe(0)
    expect(partialUtf8(Buffer.from([0x61, 0xea]))).toBe(1)
    expect(partialUtf8(Buffer.from([0x61, 0xea, 0xb0]))).toBe(2)
    expect(partialUtf8(Buffer.from([0xf0, 0x9f, 0x98]))).toBe(3)
    expect(partialUtf8(Buffer.from('😀'))).toBe(0)
    expect(partialUtf8(Buffer.alloc(0))).toBe(0)
  })
})

describe('[어댑터] 스킬 배포와 claude 실행 (5.6.3, D103, D105, D108)', () => {
  it('이번 task의 스킬에 공통 규칙을 붙여 배포하고 다른 relay 스킬은 지운다', async () => {
    const workDir = path.join(root, 'w')
    const skills = path.join(workDir, '.claude', 'skills')
    fs.mkdirSync(path.join(skills, 'relay-work-start'), { recursive: true })
    fs.writeFileSync(path.join(skills, 'relay-work-start', 'SKILL.md'), 'old')
    fs.mkdirSync(path.join(skills, 'my-own'), { recursive: true })
    const first = await deploySkill({ source: SKILLS, workDir, skill: 'fix', type: 'bugfix' })
    expect(fs.readdirSync(skills).sort()).toEqual(['my-own', 'relay-fix'])
    const expected = mergeSkill(
      read(path.join(SKILLS, 'fix', 'SKILL.md')),
      read(path.join(SKILLS, '_common.md')),
    )
    expect(read(first.file)).toBe(expected)
    expect(await skillText(SKILLS, 'fix', 'bugfix')).toBe(expected)
    // 원인 분석과 수정은 재현부터 수정까지 한 스킬이다 (D228)
    expect(read(first.file)).toMatch(/^---\ndescription: relay fix step/)
    expect(read(first.file)).toContain('\n# relay: fix')
    expect(read(first.file)).toContain('## Artifact template: `fix.md`')
    expect(first.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    // 같은 원본이면 해시가 같다
    expect(
      (await deploySkill({ source: SKILLS, workDir, skill: 'fix', type: 'bugfix' })).hash,
    ).toBe(first.hash)
  })

  it('verify는 리뷰와 최종 검증을 한 스킬로 배포한다: relay-verify에 공통 규칙을 붙인다 (D229, 5.6.6)', async () => {
    const workDir = path.join(root, 'w-verify')
    const deployed = await deploySkill({ source: SKILLS, workDir, skill: 'verify', type: 'bugfix' })
    expect(path.basename(path.dirname(deployed.file))).toBe('relay-verify')
    const text = read(deployed.file)
    expect(text).toBe(
      mergeSkill(
        selectType(read(path.join(SKILLS, 'verify', 'SKILL.md')), 'bugfix'),
        read(path.join(SKILLS, '_common.md')),
      ),
    )
    // 머리글은 하나이고, 스킬 본문 뒤에 공통 규칙이 있다
    expect(text.match(/^description: /gm)).toHaveLength(1)
    expect(text).toMatch(/^---\ndescription: relay verify step/)
    const order = ['# relay: verify', '# Common rules']
    const at = order.map((h) => text.indexOf(`\n${h}`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // 산출물 둘의 템플릿이 있다. 리뷰 지적은 verification.md에 쓴다 (3.1, D229)
    for (const f of ['verification.md', 'pr.md']) {
      expect(text).toContain(`## Artifact template: \`${f}\``)
    }
    expect(text).not.toContain('`review.md`')
    expect(fs.readdirSync(path.join(workDir, '.claude', 'skills'))).toEqual(['relay-verify'])
  })

  it('공통 규칙은 SKILL.md 끝에 붙인다. 줄 끝은 LF로 맞춘다 (skills/check.mjs와 같은 방식)', () => {
    expect(mergeSkill('---\na: 1\n---\n본문\r\n\r\n', '\n---\n\n# Common\r\n')).toBe(
      '---\na: 1\n---\n본문\n\n---\n\n# Common\n',
    )
  })

  it('공용 스킬은 그 Work 유형의 구간만 남기고 표시 줄을 지운다 (D279)', () => {
    const src = [
      '공통 1',
      '<!-- type: bugfix -->',
      '버그만',
      '<!-- /type -->',
      '<!-- type: feature refactor -->',
      '기능과 리팩터링',
      '<!-- /type -->',
      '공통 2',
    ].join('\n')
    expect(selectType(src, 'bugfix')).toBe('공통 1\n버그만\n공통 2')
    expect(selectType(src, 'feature')).toBe('공통 1\n기능과 리팩터링\n공통 2')
    expect(selectType(src, 'refactor')).toBe('공통 1\n기능과 리팩터링\n공통 2')
    expect(selectType('표시 없음\r\n', 'refactor')).toBe('표시 없음\n')
  })

  it('유형 표시의 실수는 배포하지 않고 오류다 (D279)', () => {
    expect(() => selectType('<!-- type: perf -->\nx\n<!-- /type -->', 'bugfix')).toThrow(
      '모르는 유형: perf',
    )
    expect(() => selectType('<!-- type: bugfix -->\nx', 'bugfix')).toThrow('닫히지 않음')
    expect(() => selectType('x\n<!-- /type -->', 'bugfix')).toThrow('짝이 없음')
    expect(() =>
      selectType('<!-- type: bugfix -->\n<!-- type: feature -->\n<!-- /type -->', 'bugfix'),
    ).toThrow('겹침')
  })

  it('표시처럼 보이지만 모양이 틀린 줄은 오류다 (D279, PR #24 리뷰)', () => {
    for (const bad of [
      '<!--type: refactor-->',
      '<!-- type: Refactor -->',
      '<!-- type: refactor --> ',
      '<!-- /type-->',
      '  <!-- type: bugfix -->',
    ]) {
      expect(() => selectType(`a\n${bad}\nb`, 'bugfix'), bad).toThrow()
    }
  })

  it('앱의 selectType과 check.mjs의 assemble은 같은 결과와 같은 오류를 낸다 (I68, PR #24 리뷰)', async () => {
    const samples = [
      ...(await Promise.all(
        [
          'work-start',
          'verify',
          'pr-respond',
          'fix',
          'design',
          'implement',
          'refactor',
          'spec',
          'execute',
        ].map((s) => fsp.readFile(path.join(SKILLS, s, 'SKILL.md'), 'utf8')),
      )),
      await fsp.readFile(path.join(SKILLS, '_common.md'), 'utf8'),
      'a\r\n<!-- type: feature refactor -->\r\nb\r\n<!-- /type -->\r\nc',
      'x\n<!--type: bugfix-->\ny',
      '<!-- type: perf -->\nx\n<!-- /type -->',
      '<!-- type: bugfix -->\nx',
      'x\n<!-- /type -->',
    ]
    expect(TYPES).toEqual(WORK_TYPES)
    const outcome = (f: () => string) => {
      try {
        return { ok: f() }
      } catch {
        return { error: true }
      }
    }
    for (const [i, text] of samples.entries()) {
      for (const type of WORK_TYPES) {
        expect(
          outcome(() => selectType(text, type)),
          `${i} ${type}`,
        ).toEqual(outcome(() => assemble(text, type)))
      }
    }
  })

  it('공용 스킬 셋을 유형마다 조립하면 다른 유형의 산출물과 표시가 남지 않는다 (D279)', async () => {
    const own = {
      bugfix: 'fix.md',
      feature: 'design.md',
      refactor: 'refactor.md',
      spec: 'spec.md',
      general: 'execution.md',
    } as const
    for (const skill of ['work-start', 'verify', 'pr-respond'] as const) {
      for (const type of WORK_TYPES) {
        const text = await skillText(SKILLS, skill, type)
        expect(text, `${skill} ${type}`).not.toContain('<!-- type:')
        expect(text, `${skill} ${type}`).not.toContain('<!-- /type -->')
        if (skill === 'work-start') continue
        for (const [other, file] of Object.entries(own)) {
          if (other === type) expect(text, `${skill} ${type}`).toContain(`\`${file}\``)
          else expect(text, `${skill} ${type}`).not.toContain(`\`${file}\``)
        }
      }
    }
  })

  it('설계 문서를 따르는 요청의 줄(D369, D370)은 모든 유형의 intake에, 그 Work의 규칙(D371)은 모든 스킬에 있다 (I107)', async () => {
    for (const type of WORK_TYPES) {
      const intake = await skillText(SKILLS, 'work-start', type)
      expect(intake, type).toContain('write "`<path>`의 결정을 따른다" in `제약`')
      expect(intake, type).toContain('wait for the merge (`blocked`)')
    }
    for (const skill of ['fix', 'design', 'implement', 'refactor', 'execute', 'verify'] as const) {
      const text = await skillText(SKILLS, skill, 'bugfix')
      expect(text, skill).toContain('## Works that follow a design document')
    }
  })

  it('claude --version을 읽는다 (D105)', async () => {
    const env = { ...process.env, FAKE_CLAUDE_VERSION: '2.1.283 (Claude Code)' }
    expect(await claudeVersion(FAKE_CLAUDE, env)).toBe('2.1.283 (Claude Code)')
  })
})
