// [어댑터] 중앙 저장소 (5.1): 원자적 쓰기, config.json 기본값, intent 이력, decisions.md, 산출물, 스킬 배포.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  claudeVersion,
  composeSkill,
  deploySkill,
  mergeSkill,
  soloSkill,
} from '../../src/adapters/claude'
import { WorkFiles, loadConfig, relayHome, writeFileAtomic } from '../../src/adapters/store'
import { DEFAULT_CONFIG } from '../../src/shared/config'
import { FAKE_CLAUDE, SKILLS } from '../flow/harness'

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
    await w.appendDecisions('## t-02 evidence — 2026-09-26 11:00 (사람 승인)\n없음\n')
    expect(read(w.decisions)).toBe(
      '## t-01 intake — 2026-09-26 10:00 (사람 승인)\n없음\n\n## t-02 evidence — 2026-09-26 11:00 (사람 승인)\n없음\n',
    )
    const event = { ts: 'x', work_id: 'w', type: 'work.created' as const, payload: {} }
    await w.appendEvent(event)
    await w.appendEvent({ ...event, type: 'work.completed' })
    expect((await w.readEvents()).map((e) => e.type)).toEqual(['work.created', 'work.completed'])
  })

  it('산출물은 task 디렉터리의 .md 중 context.md와 handoff.md를 뺀 것이다 (D89)', async () => {
    const w = new WorkFiles(path.join(root, 'w'))
    const task = { seq: 2, node: 'evidence' as const }
    const dir = w.taskDir(task)
    expect(dir).toBe(path.join(root, 'w', 'tasks', '02-evidence'))
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true })
    for (const f of [
      'context.md',
      'handoff.md',
      'evidence.md',
      'notes.md',
      'pty.log',
      'task.settings.json',
    ]) {
      fs.writeFileSync(path.join(dir, f), f)
    }
    expect(await w.artifacts(task)).toEqual([
      path.join(dir, 'evidence.md'),
      path.join(dir, 'notes.md'),
    ])
    expect(Object.keys(await w.taskFiles(task))).toEqual([
      'context.md',
      'evidence.md',
      'handoff.md',
      'notes.md',
    ])
    expect(await w.taskFiles({ seq: 9, node: 'fix' })).toEqual({})
  })
})

describe('[어댑터] 스킬 배포와 claude 실행 (5.6.3, D103, D105, D108)', () => {
  it('이번 task의 스킬에 공통 규칙을 붙여 배포하고 다른 relay 스킬은 지운다', async () => {
    const workDir = path.join(root, 'w')
    const skills = path.join(workDir, '.claude', 'skills')
    fs.mkdirSync(path.join(skills, 'relay-evidence'), { recursive: true })
    fs.writeFileSync(path.join(skills, 'relay-evidence', 'SKILL.md'), 'old')
    fs.mkdirSync(path.join(skills, 'my-own'), { recursive: true })
    const first = await deploySkill({ source: SKILLS, workDir, skill: 'root-cause' })
    expect(fs.readdirSync(skills).sort()).toEqual(['my-own', 'relay-root-cause'])
    const expected = mergeSkill(
      soloSkill(read(path.join(SKILLS, 'root-cause', 'SKILL.md'))),
      read(path.join(SKILLS, '_common.md')),
    )
    expect(read(first.file)).toBe(expected)
    expect(read(first.file)).toContain('`evidence.md`, at the path in `context.md`.')
    expect(read(first.file)).not.toContain('<!-- solo -->')
    expect(first.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    // 같은 원본이면 해시가 같다
    expect((await deploySkill({ source: SKILLS, workDir, skill: 'root-cause' })).hash).toBe(
      first.hash,
    )
  })

  it('investigate는 머리 뒤에 evidence와 root-cause의 본문을 붙여 배포한다 (D148)', async () => {
    const workDir = path.join(root, 'w-investigate')
    const deployed = await deploySkill({ source: SKILLS, workDir, skill: 'investigate' })
    expect(path.basename(path.dirname(deployed.file))).toBe('relay-investigate')
    const src = (name: string) => read(path.join(SKILLS, name, 'SKILL.md'))
    const text = read(deployed.file)
    expect(text).toBe(
      mergeSkill(
        composeSkill(src('investigate'), [src('evidence'), src('root-cause')]),
        read(path.join(SKILLS, '_common.md')),
      ),
    )
    // 머리글은 머리의 것 하나이고, 두 부분과 공통 규칙이 차례로 있다
    expect(text.match(/^description: /gm)).toHaveLength(1)
    expect(text).toMatch(/^---\ndescription: relay investigate step/)
    const order = [
      '# relay: investigate',
      '# relay: evidence',
      '# relay: root-cause (rca)',
      '# Common rules',
    ]
    const at = order.map((h) => text.indexOf(`\n${h}`))
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // 부분의 단독 구간은 빠진다
    expect(text).not.toContain('Judging the cause is the job of rca.')
    expect(text).not.toContain('`evidence.md`, at the path in `context.md`.')
    expect(text).not.toContain('<!-- solo -->')
  })

  it('review는 단독 스킬로 배포한다: relay-review에 공통 규칙을 붙인다 (D187, 5.6.10)', async () => {
    const workDir = path.join(root, 'w-review')
    const deployed = await deploySkill({ source: SKILLS, workDir, skill: 'review' })
    expect(path.basename(path.dirname(deployed.file))).toBe('relay-review')
    const text = read(deployed.file)
    expect(text).toBe(
      mergeSkill(
        soloSkill(read(path.join(SKILLS, 'review', 'SKILL.md'))),
        read(path.join(SKILLS, '_common.md')),
      ),
    )
    expect(text).toMatch(/^---\ndescription: relay review step/)
    expect(text).toContain('\n# relay: review')
    expect(text).toContain('\n# Common rules')
    expect(fs.readdirSync(path.join(workDir, '.claude', 'skills'))).toEqual(['relay-review'])
  })

  it('단독 구간: 단독으로 쓰면 표시 줄만 지우고, 합치면 구간을 뺀다 (D148)', () => {
    const part = '---\nd: 1\n---\n# P\n\n한 줄\n<!-- solo -->\n단독만\n<!-- /solo -->\n\n## 절\n'
    expect(soloSkill(part)).toBe('---\nd: 1\n---\n# P\n\n한 줄\n단독만\n\n## 절\n')
    expect(composeSkill('---\nd: 0\n---\n# H\r\n', [part])).toBe(
      '---\nd: 0\n---\n# H\n\n# P\n\n한 줄\n\n## 절\n',
    )
  })

  it('공통 규칙은 SKILL.md 끝에 붙인다. 줄 끝은 LF로 맞춘다 (skills/check.mjs와 같은 방식)', () => {
    expect(mergeSkill('---\na: 1\n---\n본문\r\n\r\n', '\n---\n\n# Common\r\n')).toBe(
      '---\na: 1\n---\n본문\n\n---\n\n# Common\n',
    )
  })

  it('claude --version을 읽는다 (D105)', async () => {
    const env = { ...process.env, FAKE_CLAUDE_VERSION: '2.1.283 (Claude Code)' }
    expect(await claudeVersion(FAKE_CLAUDE, env)).toBe('2.1.283 (Claude Code)')
  })
})
