// [어댑터] 유형 폴더 (5.6.13, 5.6.15, D449~D451, D458, D459, D506~D514)와 유형의 절차 조립 (D452, D456, D507, D508)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CUSTOM_INTAKE_HEAD,
  CUSTOM_PROCEDURE_HEAD,
  CUSTOM_VERIFY_HEAD,
  TYPES_DIR,
  deploySkill,
  mergeSkill,
  selectFlags,
  skillText,
  stripFrontMatter,
  type TypeSource,
} from '../../src/adapters/claude'
import { deployCodexSkill } from '../../src/adapters/codex'
import {
  copyTypeToRepo,
  deleteCustomType,
  findCustomType,
  globalTypesDir,
  listBuiltinTypes,
  listGlobalTypes,
  listRepoTypes,
  mergeTypes,
  readCustomType,
  readCustomTypeFiles,
  renameCustomType,
  repoTypesDir,
  saveCustomType,
  snapshotCustomType,
  typeBaseFiles,
} from '../../src/adapters/custom-types'
import { assemblyFlags } from '../../src/core/builtin-types'
import { parseCustomType } from '../../src/core/custom-type'
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

describe('[어댑터] id로 유형 찾기와 링크 (D451, D458)', () => {
  it('레포의 폴더가 있으면 그것, 없으면 전역의 것이다', async () => {
    const home = path.join(root, 'home')
    const repo = path.join(root, 'repo')
    writeType(path.join(globalTypesDir(home), 'survey-apply'), FULL)
    expect((await findCustomType(home, repo, 'survey-apply'))?.source).toBe('global')
    writeType(path.join(repoTypesDir(repo), 'survey-apply'), FULL)
    expect((await findCustomType(home, repo, 'survey-apply'))?.source).toBe('repo')
    expect(await findCustomType(home, repo, 'gone')).toBeUndefined()
    expect(await findCustomType(home, repo, '../home')).toBeUndefined()
  })

  it.skipIf(process.platform === 'win32')(
    '심볼릭 링크는 따라가지 않는다: 링크한 절차는 없음이고 링크한 선택 파일은 복사하지 않는다',
    async () => {
      const secret = path.join(root, 'secret.txt')
      fs.writeFileSync(secret, '비밀')
      const src = path.join(root, 'types', 'survey-apply')
      writeType(src, FULL)
      fs.symlinkSync(secret, path.join(src, 'intake.md'))
      const copied = path.join(root, 'w', 'type')
      await snapshotCustomType({ dir: src, source: 'repo' }, copied)
      expect(fs.readdirSync(copied).sort()).toEqual(['apply.md', 'survey.md', 'type.json'])
      fs.rmSync(path.join(src, 'apply.md'))
      fs.symlinkSync(secret, path.join(src, 'apply.md'))
      const entry = await readCustomType(src, 'repo')
      expect(entry.errors).toEqual(['`apply.md` 없음: 단계 `apply`(적용)의 절차 파일'])
      await expect(
        snapshotCustomType({ dir: src, source: 'repo' }, path.join(root, 'w2')),
      ).rejects.toThrow('apply.md')
    },
  )
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
      finish: '',
      prTemplate: '',
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
      finish: '',
      prTemplate: '',
    })
    expect(fs.readdirSync(dir).sort()).toEqual(['apply.md', 'keep.txt', 'type.json', 'verify.md'])
    await expect(
      saveCustomType(types, {
        def: { id: 'x', name: '', description: '', steps: [] },
        procedures: {},
        intake: '',
        verify: '',
        finish: '',
        prTemplate: '',
      }),
    ).rejects.toThrow('유형 이름이 없음')
    // id를 바꾸면 폴더를 옮긴다: 사람이 둔 파일이 남는다
    await renameCustomType(types, 'survey-apply', 'survey-fix')
    expect(fs.readdirSync(path.join(types, 'survey-fix'))).toContain('keep.txt')
    expect(fs.existsSync(dir)).toBe(false)
    await deleteCustomType(types, 'survey-fix')
    expect(fs.existsSync(path.join(types, 'survey-fix'))).toBe(false)
  })

  it('2판 type.json에 유형 설정과 단계 설정을 쓰고, 마무리 판정 규칙과 PR 템플릿도 칸 파일로 쓴다 (D507, D509~D511)', async () => {
    const types = path.join(root, 'types')
    await saveCustomType(types, {
      def: {
        id: 'doc-check',
        name: '문서 점검',
        description: '',
        request_hint: '점검할 문서를 적으세요',
        branch_prefix: 'docs',
        check_method: false,
        target: 'document',
        steps: [
          {
            id: 'review-doc',
            title: '점검',
            sections: ['본 곳', '고친 곳'],
            lead: ['고친 곳'],
            question_mode: 'confirm_each',
            auto_approve: false,
            step_base: false,
          },
        ],
      },
      procedures: { 'review-doc': '문서를 읽고 고친다' },
      intake: '',
      verify: '',
      finish: '- 고친 곳마다 읽어서 판정한다',
      prTemplate: '```markdown\n# PR 제목\n\n## 고친 곳\n```',
    })
    const dir = path.join(types, 'doc-check')
    expect(fs.readdirSync(dir).sort()).toEqual([
      'finish.md',
      'pr-template.md',
      'review-doc.md',
      'type.json',
    ])
    expect(JSON.parse(read(path.join(dir, 'type.json')))).toMatchObject({
      schema_version: 2,
      check_method: false,
      target: 'document',
      steps: [{ lead: ['고친 곳'], question_mode: 'confirm_each', step_base: false }],
    })
    const files = await readCustomTypeFiles(dir)
    expect(files?.finish).toBe('- 고친 곳마다 읽어서 판정한다')
    expect(files?.prTemplate).toContain('## 고친 곳')
    // 복사본(Work의 type/)에도 칸 파일이 든다
    const dest = path.join(root, 'w', 'type')
    const copied = await snapshotCustomType({ dir, source: 'global' }, dest)
    expect(fs.readdirSync(dest).sort()).toEqual([
      'finish.md',
      'pr-template.md',
      'review-doc.md',
      'type.json',
    ])
    expect(copied).toMatchObject({ check_method: false, target: 'document', branch_prefix: 'docs' })
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

describe('[어댑터] 커스텀 Work의 절차 조립 (D452, D456, D507, D508)', () => {
  const typeDir = () => path.join(root, 'work', 'type')
  /** 1판 커스텀 유형의 재료: 확인 방법을 켠 코드 유형 */
  const src = (o: Partial<TypeSource> = {}): TypeSource => ({
    dir: typeDir(),
    flags: assemblyFlags({ type: 'custom' }),
    ...o,
  })

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
      typeSource: src({ step: 'survey' }),
    })
    const text = read(deployed.file)
    const base = selectFlags(
      stripFrontMatter(read(path.join(SKILLS, 'custom', 'SKILL.md'))),
      assemblyFlags({ type: 'custom' }),
    )
    const common = read(path.join(SKILLS, '_common.md'))
    expect(text.startsWith('# relay: custom step')).toBe(true)
    expect(text).toContain(
      mergeSkill(
        `${base.trimEnd()}\n\n${CUSTOM_PROCEDURE_HEAD}\n\n바꿀 곳을 모두 찾는다.\n`,
        common,
      ),
    )
    expect(text).toContain('**Self-check:**')
    expect(text.indexOf(CUSTOM_PROCEDURE_HEAD)).toBeLessThan(text.indexOf('## This task'))
  })

  it('확인 방법을 끈 유형의 공통 바탕에는 자체 확인 규칙이 없고, 공통 바탕을 끈 단계는 절차만이다 (D508, D509)', async () => {
    const off = await skillText(
      SKILLS,
      'custom',
      'custom',
      src({ step: 'survey', flags: ['code', 'no-check-method', 'custom'] }),
    )
    expect(off).not.toContain('**Self-check:**')
    expect(off).toContain(CUSTOM_PROCEDURE_HEAD)
    const bare = await skillText(
      SKILLS,
      'custom',
      'custom',
      src({ step: 'survey', stepBase: false }),
    )
    expect(bare.startsWith('바꿀 곳을 모두 찾는다.')).toBe(true)
    expect(bare).not.toContain(CUSTOM_PROCEDURE_HEAD)
  })

  it('절차 파일이 없거나 단계 id가 없으면 배포하지 않는다', async () => {
    await expect(skillText(SKILLS, 'custom', 'custom', src({ step: 'gone' }))).rejects.toThrow(
      'gone.md',
    )
    await expect(skillText(SKILLS, 'custom', 'custom', src())).rejects.toThrow('단계 id')
    await expect(skillText(SKILLS, 'custom', 'custom')).rejects.toThrow('유형 재료')
  })

  it('intake는 유형의 지시를 끝에 붙이고, 옛 Work의 verify는 커스텀 구간에 리뷰 관점을 붙인다', async () => {
    const intake = await skillText(SKILLS, 'work-start', 'custom', src())
    expect(intake).toContain(`${CUSTOM_INTAKE_HEAD}\n\n대상 표를 제약에 적는다.\n`)
    expect(intake).toContain('picked a Work type their team defined')
    expect(intake).not.toContain('`execution.md`')
    const verify = await skillText(SKILLS, 'verify', 'custom', src())
    expect(verify).toContain(`${CUSTOM_VERIFY_HEAD}\n\n바꾼 표마다 되돌리기를 본다.\n`)
    expect(verify).toContain('artifacts of the custom steps (`<step id>.md`')
    // 기본 유형의 옛 verify에는 붙이지 않는다
    const general = await skillText(SKILLS, 'verify', 'general', src())
    expect(general).not.toContain(`${CUSTOM_VERIFY_HEAD}\n\n`)
    // 선택 파일이 없으면 제목도 없다
    fs.rmSync(path.join(typeDir(), 'verify.md'))
    expect(await skillText(SKILLS, 'verify', 'custom', src())).not.toContain(
      `${CUSTOM_VERIFY_HEAD}\n\n`,
    )
  })

  it('마무리 단계는 유형의 판정 규칙과 PR 템플릿을 칸 자리에 넣고, PR 템플릿이 없으면 일반 템플릿이다 (D507)', async () => {
    const plain = await skillText(SKILLS, 'custom', 'custom', src({ step: 'apply' }), true)
    expect(plain).toContain('## 주요 결정')
    expect(plain).not.toContain('<!-- slot')
    fs.writeFileSync(path.join(typeDir(), 'finish.md'), '- **표마다:** 되돌린 표를 다시 연다\n')
    fs.writeFileSync(
      path.join(typeDir(), 'pr-template.md'),
      '```markdown\n# PR 제목\n\n## 바꾼 표\n```\n',
    )
    // 빈 줄뿐인 PR 템플릿은 없는 것과 같다: 일반 템플릿을 쓴다
    fs.writeFileSync(path.join(typeDir(), 'pr-template.md'), '\n  \n')
    expect(await skillText(SKILLS, 'custom', 'custom', src({ step: 'apply' }), true)).toContain(
      '## 주요 결정',
    )
    fs.writeFileSync(
      path.join(typeDir(), 'pr-template.md'),
      '```markdown\n# PR 제목\n\n## 바꾼 표\n```\n',
    )
    const filled = await skillText(SKILLS, 'custom', 'custom', src({ step: 'apply' }), true)
    expect(filled).toContain('- **표마다:** 되돌린 표를 다시 연다\n')
    expect(filled.indexOf('되돌린 표를 다시 연다')).toBeLessThan(
      filled.indexOf('### Finishing decisions'),
    )
    expect(filled).toContain('## 바꾼 표')
    expect(filled).not.toContain('## 주요 결정\n')
  })

  it('문서 대상 유형의 마무리는 문서 규칙과 문서 밖 파일 변경 절이다 (D510)', async () => {
    const doc = await skillText(
      SKILLS,
      'custom',
      'custom',
      src({ step: 'apply', flags: ['document', 'no-check-method', 'custom'] }),
      true,
    )
    expect(doc).toContain('change the target document only for the findings the human picked')
    expect(doc).toContain('## 문서 밖 파일 변경')
    expect(doc).not.toContain('## 나중에 정리할 곳')
    expect(doc).not.toContain('`확인: 사람` items:')
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
      typeSource: src({ step: 'apply' }),
    })
    expect(read(deployed.file)).toContain(`${CUSTOM_PROCEDURE_HEAD}\n\n조사한 대로 바꾼다.\n`)
    expect(read(deployed.file)).toContain('name: relay-custom')
  })
})

describe('[어댑터] 기본 유형 폴더 (D506, D512)', () => {
  it('기본 유형 다섯을 읽고, 모두 형식에 맞다', async () => {
    const types = await listBuiltinTypes(path.join(SKILLS, TYPES_DIR))
    expect(types.map((t) => [t.id, t.source, t.errors])).toEqual([
      ['bugfix', 'builtin', []],
      ['feature', 'builtin', []],
      ['refactor', 'builtin', []],
      ['spec', 'builtin', []],
      ['general', 'builtin', []],
    ])
  })

  it('베이스로 쓰면 모든 칸을 채우고, 산출물 이름을 커스텀 단계의 이름으로 바꾼다', async () => {
    const bugfix = await typeBaseFiles(path.join(SKILLS, TYPES_DIR, 'bugfix'), 'builtin')
    expect(bugfix?.def.steps.map((s) => [s.id, s.step_base])).toEqual([['fix', false]])
    expect(bugfix?.intake).toContain('재현 절차가 더 이상 실패하지 않는다')
    expect(bugfix?.verify).toContain('`fix.md`')
    expect(bugfix?.finish).toContain('Reproduction steps')
    expect(bugfix?.prTemplate).toContain('## 원인')
    const general = await typeBaseFiles(path.join(SKILLS, TYPES_DIR, 'general'), 'builtin')
    expect(general?.procedures['execute']).toContain('`execute.md`')
    expect(general?.procedures['execute']).not.toContain('`execution.md`')
    expect(general?.verify).toContain('`execute.md`')
    // 베이스로 고친 정의는 커스텀 유형의 검사를 통과한다
    if (!general) throw new Error('읽지 못함')
    const saved = path.join(root, 'types')
    await saveCustomType(saved, { ...general, def: { ...general.def, id: 'my-general' } })
    const again = await readCustomTypeFiles(path.join(saved, 'my-general'))
    expect(again?.def.check_method).toBe(true)
    expect(again?.procedures['execute']).toBe(general.procedures['execute'])
    expect(
      parseCustomType('my-general', read(path.join(saved, 'my-general', 'type.json'))).ok,
    ).toBe(true)
  })
})
