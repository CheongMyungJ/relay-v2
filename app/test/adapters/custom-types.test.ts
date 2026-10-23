// [어댑터] 커스텀 유형 폴더 (5.6.13, D449~D451, D458, D459)와 커스텀 Work의 절차 조립 (D452, D456)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_INTAKE_HEAD,
  CUSTOM_PROCEDURE_HEAD,
  CUSTOM_VERIFY_HEAD,
  deploySkill,
  mergeSkill,
  procedureText,
  selectType,
  skillText,
  stripFrontMatter,
} from '../../src/adapters/claude'
import { deployCodexSkill } from '../../src/adapters/codex'
import {
  copyTypeToRepo,
  deleteCustomType,
  globalTypesDir,
  listGlobalTypes,
  listRepoTypes,
  mergeTypes,
  readCustomTypeFiles,
  repoTypesDir,
  saveCustomType,
  snapshotCustomType,
} from '../../src/adapters/custom-types'
import { SKILLS } from '../support/harness'

let root: string

beforeEach(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-types-')))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const read = (p: string) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

const TYPE_JSON = {
  name: '조사 후 적용',
  description: '조사하고 적용한다',
  steps: [
    { id: 'survey', title: '조사', sections: ['조사한 곳'] },
    { id: 'apply', title: '적용', auto_approve: true },
  ],
}

/** 유형 폴더를 만든다 */
function writeType(dir: string, files: Record<string, string | object>) {
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, body] of Object.entries(files)) {
    fs.writeFileSync(
      path.join(dir, name),
      typeof body === 'string' ? body : JSON.stringify(body, null, 2),
    )
  }
}

const FULL = {
  'type.json': TYPE_JSON,
  'survey.md': '바꿀 곳을 모두 찾는다.\n',
  'apply.md': '조사한 대로 바꾼다.\n',
}

describe('[어댑터] 유형 폴더 읽기 (D449~D451)', () => {
  it('전역과 레포의 유형을 읽고, 깨진 폴더는 까닭과 함께 남긴다', async () => {
    const home = path.join(root, 'home')
    const repo = path.join(root, 'repo')
    writeType(path.join(globalTypesDir(home), 'survey-apply'), FULL)
    writeType(path.join(globalTypesDir(home), 'broken'), { 'type.json': TYPE_JSON })
    writeType(path.join(globalTypesDir(home), 'General'), FULL)
    fs.mkdirSync(path.join(globalTypesDir(home), '.hidden'), { recursive: true })
    writeType(path.join(repoTypesDir(repo), 'survey-apply'), {
      ...FULL,
      'type.json': { ...TYPE_JSON, name: '레포의 조사 후 적용' },
    })
    const global = await listGlobalTypes(home)
    expect(global.map((t) => [t.id, t.def?.name ?? null, t.errors])).toEqual([
      ['General', null, ['유형 id `General`: 영어 소문자·숫자·`-`만 씀']],
      [
        'broken',
        null,
        [
          '`survey.md` 없음: 단계 `survey`(조사)의 절차 파일',
          '`apply.md` 없음: 단계 `apply`(적용)의 절차 파일',
        ],
      ],
      ['survey-apply', '조사 후 적용', []],
    ])
    const repoTypes = await listRepoTypes(repo)
    expect(repoTypes.map((t) => [t.id, t.source, t.def?.name])).toEqual([
      ['survey-apply', 'repo', '레포의 조사 후 적용'],
    ])
    // 같은 id면 레포 것을 쓰고 전역 것은 가려진다 (D451)
    const merged = mergeTypes(repoTypes, global)
    expect(merged.types.map((t) => `${t.source}:${t.id}`)).toEqual([
      'repo:survey-apply',
      'global:General',
      'global:broken',
    ])
    expect(merged.shadowed.map((t) => t.id)).toEqual(['survey-apply'])
  })

  it('폴더가 없으면 빈 목록이다', async () => {
    expect(await listGlobalTypes(path.join(root, 'none'))).toEqual([])
    expect(await listRepoTypes(path.join(root, 'none'))).toEqual([])
  })
})

describe('[어댑터] Work를 만들 때의 복사 (D458)', () => {
  it('정의와 절차, 선택 파일만 type/에 복사하고 해시와 단계를 돌려준다', async () => {
    const src = path.join(root, 'types', 'survey-apply')
    writeType(src, { ...FULL, 'intake.md': '대상 표를 제약에 적는다\n', 'notes.txt': '복사 안 함' })
    const dest = path.join(root, 'work', 'type')
    const copied = await snapshotCustomType({ dir: src, source: 'global' }, dest)
    expect(fs.readdirSync(dest).sort()).toEqual(['apply.md', 'intake.md', 'survey.md', 'type.json'])
    expect(copied).toMatchObject({
      id: 'survey-apply',
      name: '조사 후 적용',
      source: 'global',
      steps: [
        { id: 'survey', title: '조사', sections: ['조사한 곳'], auto_approve: false },
        { id: 'apply', title: '적용', sections: [], auto_approve: true },
      ],
    })
    expect(copied.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
    // 원본을 고쳐도 복사본은 그대로다. 다시 복사하면 해시가 바뀐다
    fs.writeFileSync(path.join(src, 'apply.md'), '다르게 바꾼다\n')
    expect(read(path.join(dest, 'apply.md'))).toBe('조사한 대로 바꾼다.\n')
    const again = await snapshotCustomType({ dir: src, source: 'global' }, path.join(root, 'w2'))
    expect(again.hash).not.toBe(copied.hash)
  })

  it('깨진 유형은 복사하지 않는다', async () => {
    const src = path.join(root, 'types', 'survey-apply')
    writeType(src, { 'type.json': TYPE_JSON })
    await expect(
      snapshotCustomType({ dir: src, source: 'global' }, path.join(root, 'w')),
    ).rejects.toThrow('형식이 깨졌습니다')
    expect(fs.existsSync(path.join(root, 'w'))).toBe(false)
  })
})

describe('[어댑터] 유형 편집과 레포로 복사 (D450, D459)', () => {
  it('쓰고 다시 읽으면 같고, 빠진 단계의 절차와 비운 선택 파일은 지운다', async () => {
    const types = path.join(root, 'types')
    await saveCustomType(types, {
      def: {
        id: 'survey-apply',
        name: '조사 후 적용',
        description: '',
        steps: [
          { id: 'survey', title: '조사', sections: [], auto_approve: false },
          { id: 'apply', title: '적용', sections: [], auto_approve: true },
        ],
      },
      procedures: { survey: '찾는다', apply: '바꾼다' },
      intake: '지시',
      verify: '',
    })
    const dir = path.join(types, 'survey-apply')
    expect(fs.readdirSync(dir).sort()).toEqual(['apply.md', 'intake.md', 'survey.md', 'type.json'])
    const files = await readCustomTypeFiles(dir)
    expect(files?.procedures).toEqual({ survey: '찾는다', apply: '바꾼다' })
    expect(files?.intake).toBe('지시')
    fs.writeFileSync(path.join(dir, 'keep.txt'), '사람이 둔 것')
    await saveCustomType(types, {
      def: {
        ...(files?.def ?? { id: '', name: '', description: '', steps: [] }),
        steps: [{ id: 'apply', title: '적용', sections: [], auto_approve: true }],
      },
      procedures: { apply: '바꾼다' },
      intake: '',
      verify: '관점',
    })
    expect(fs.readdirSync(dir).sort()).toEqual(['apply.md', 'keep.txt', 'type.json', 'verify.md'])
    await expect(
      saveCustomType(types, {
        def: { id: 'x', name: '', description: '', steps: [] },
        procedures: {},
        intake: '',
        verify: '',
      }),
    ).rejects.toThrow('유형 이름이 없음')
    await deleteCustomType(types, 'survey-apply')
    expect(fs.existsSync(dir)).toBe(false)
  })

  it('[레포로 복사]는 .relay/types/<id>/에 쓰고, 이미 있으면 덮어쓰지 않는다', async () => {
    const src = path.join(root, 'types', 'survey-apply')
    writeType(src, FULL)
    const repo = path.join(root, 'repo')
    const [entry] = await listGlobalTypes(root)
    if (!entry) throw new Error('유형 없음')
    const dest = await copyTypeToRepo(entry, repo)
    expect(dest).toBe(path.join(repo, '.relay', 'types', 'survey-apply'))
    expect(fs.readdirSync(dest).sort()).toEqual(['apply.md', 'survey.md', 'type.json'])
    await expect(copyTypeToRepo(entry, repo)).rejects.toThrow('이미 있습니다')
  })
})

describe('[어댑터] 커스텀 Work의 절차 조립 (D452, D456)', () => {
  const typeDir = () => path.join(root, 'work', 'type')

  beforeEach(() => {
    writeType(typeDir(), {
      ...FULL,
      'intake.md': '대상 표를 제약에 적는다.\n',
      'verify.md': '바꾼 표마다 되돌리기를 본다.\n',
    })
  })

  it('커스텀 단계는 공통 바탕, 사람이 쓴 절차, 공통 규칙 순이다', async () => {
    const taskDir = path.join(root, 'work', 'tasks', '02-survey')
    const deployed = await deploySkill({
      source: SKILLS,
      workDir: path.join(root, 'work'),
      taskDir,
      contextPath: path.join(taskDir, 'context.md'),
      skill: 'custom',
      type: 'custom',
      custom: { dir: typeDir(), step: 'survey' },
    })
    const text = read(deployed.file)
    const base = selectType(
      stripFrontMatter(read(path.join(SKILLS, 'custom', 'SKILL.md'))),
      'custom',
    )
    const common = selectType(read(path.join(SKILLS, '_common.md')), 'custom')
    expect(text.startsWith('# relay: custom step')).toBe(true)
    expect(text).toContain(
      mergeSkill(
        `${base.trimEnd()}\n\n${CUSTOM_PROCEDURE_HEAD}\n\n바꿀 곳을 모두 찾는다.\n`,
        common,
      ),
    )
    expect(text.indexOf(CUSTOM_PROCEDURE_HEAD)).toBeLessThan(text.indexOf('## This task'))
  })

  it('절차 파일이 없거나 단계 id가 없으면 배포하지 않는다', async () => {
    await expect(
      skillText(SKILLS, 'custom', 'custom', { dir: typeDir(), step: 'gone' }),
    ).rejects.toThrow('gone.md')
    await expect(skillText(SKILLS, 'custom', 'custom', { dir: typeDir() })).rejects.toThrow(
      '단계 id',
    )
  })

  it('intake와 verify는 커스텀 구간에 유형의 지시를 끝에 붙인다', async () => {
    const intake = await skillText(SKILLS, 'work-start', 'custom', { dir: typeDir() })
    expect(intake).toContain(`${CUSTOM_INTAKE_HEAD}\n\n대상 표를 제약에 적는다.\n`)
    expect(intake).toContain('picked a Work type their team defined')
    expect(intake).not.toContain('`execution.md`')
    const verify = await skillText(SKILLS, 'verify', 'custom', { dir: typeDir() })
    expect(verify).toContain(`${CUSTOM_VERIFY_HEAD}\n\n바꾼 표마다 되돌리기를 본다.\n`)
    expect(verify).toContain('artifacts of the custom steps (`<step id>.md`')
    // 커스텀 Work가 아니면 붙이지 않는다
    const general = await skillText(SKILLS, 'verify', 'general', { dir: typeDir() })
    expect(general).not.toContain(`${CUSTOM_VERIFY_HEAD}\n\n`)
    // 선택 파일이 없으면 제목도 없다
    fs.rmSync(path.join(typeDir(), 'verify.md'))
    expect(await skillText(SKILLS, 'verify', 'custom', { dir: typeDir() })).not.toContain(
      `${CUSTOM_VERIFY_HEAD}\n\n`,
    )
  })

  it('Codex 배포본도 같은 절차를 쓴다 (D461)', async () => {
    const taskDir = path.join(root, 'work', 'tasks', '03-apply')
    const deployed = await deployCodexSkill({
      source: SKILLS,
      workDir: path.join(root, 'work'),
      taskDir,
      contextPath: path.join(taskDir, 'context.md'),
      skill: 'custom',
      type: 'custom',
      custom: { dir: typeDir(), step: 'apply' },
    })
    expect(read(deployed.file)).toContain(`${CUSTOM_PROCEDURE_HEAD}\n\n조사한 대로 바꾼다.\n`)
    expect(read(deployed.file)).toContain('name: relay-custom')
  })

  it('[새 유형]의 시작점은 머리글을 뗀 기존 단계 절차다 (D448)', async () => {
    const text = await procedureText(SKILLS, 'execute')
    expect(text.startsWith('# relay: execute')).toBe(true)
    expect(text).not.toContain('description:')
  })
})
