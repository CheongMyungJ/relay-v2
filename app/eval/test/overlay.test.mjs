// 품질 기준 덧씌우기(run.mjs --quality-overlay, relay-v3 docs/experiments/m2/protocol.md 7절): relay-v3 relay init 초안을
// 시나리오마다 한 번 만들고, 평가 레포의 첫 커밋과 판정의 기준에 같은 파일을 넣는다. 팀원 교대의 clone은 그 커밋에서 잇는다
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  baseWithOverlay,
  overlayFiles,
  overlayRecord,
  QUALITY_FILE,
  qualityOverlay,
  relay3Cli,
  sha256,
} from '../lib/overlay.mjs'
import { RELAY3_APP } from '../lib/relay3-arm.mjs'
import { handoffRepo, judgeTree, makeRepo } from '../lib/repo.mjs'
import { git } from '../lib/util.mjs'

const dirs = []
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-eval-overlay-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

const write = (root, files) => {
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true })
    fs.writeFileSync(path.join(root, f), text)
  }
}

/** 시나리오의 repo/와 hidden/ */
function scenarioDirs() {
  const root = tmp()
  const base = path.join(root, 'scenario/repo')
  const hidden = path.join(root, 'scenario/hidden')
  write(base, {
    'package.json': JSON.stringify({ type: 'module', scripts: { test: 'node --test' } }),
    'src/add.js': 'export const add = (a, b) => a - b\n',
  })
  write(hidden, {
    'add.test.js':
      "import { test } from 'node:test'\nimport assert from 'node:assert'\nimport { add } from '../src/add.js'\ntest('add', () => assert.strictEqual(add(2, 3), 5))\n",
  })
  return { root, base, hidden }
}

/**
 * 가짜 relay init: git 레포 안에서 돌았는지, 어떤 파일을 봤는지를 JSON으로 찍는다(진짜처럼 끝에 줄바꿈 하나). 진짜 초안의
 * 필드를 지어내지 않고 도구가 넘긴 것만 본다
 */
function fakeCli(root, body) {
  const cli = path.join(root, 'fake-cli.mjs')
  fs.writeFileSync(
    cli,
    body ??
      [
        "import { execFileSync } from 'node:child_process'",
        "const files = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\\n').filter(Boolean).sort()",
        "if (process.argv[2] !== 'init') process.exit(1)",
        'process.stdout.write(`${JSON.stringify({ version: 1, files }, null, 2)}\\n`)',
      ].join('\n'),
  )
  return cli
}

describe('초안 만들기', () => {
  it('시나리오 레포를 git 레포로 복사해 relay init을 돌리고 출력 그대로(줄바꿈 포함)와 sha256을 돌려준다. 임시 폴더는 지운다', () => {
    const { root, base } = scenarioDirs()
    const work = path.join(root, 'overlay-work')
    const o = qualityOverlay(base, fakeCli(root), work)
    expect(o.path).toBe(QUALITY_FILE)
    expect(JSON.parse(o.text)).toEqual({ version: 1, files: ['package.json', 'src/add.js'] })
    expect(o.text.endsWith('}\n')).toBe(true)
    expect(o.sha256).toBe(sha256(o.text))
    expect(fs.existsSync(work)).toBe(false)
    // 같은 레포면 같은 초안이다(시나리오마다 한 번 만들어 모든 쪽에 같게 넣는다)
    expect(qualityOverlay(base, fakeCli(root), work).sha256).toBe(o.sha256)
  })

  it('시나리오에 품질 기준이 이미 있거나 relay init이 실패하거나 JSON이 아니면 멈춘다', () => {
    const { root, base } = scenarioDirs()
    const work = path.join(root, 'overlay-work')
    expect(() => qualityOverlay(base, fakeCli(root, 'process.exit(3)'), work)).toThrow(
      /품질 기준 초안을 만들지 못했습니다/,
    )
    expect(() => qualityOverlay(base, fakeCli(root, "process.stdout.write('아님')"), work)).toThrow(
      /JSON이 아닙니다/,
    )
    expect(fs.existsSync(work)).toBe(false)
    write(base, { [QUALITY_FILE]: '{}\n' })
    expect(() => qualityOverlay(base, fakeCli(root), work)).toThrow(/이미/)
  })

  it.skipIf(!fs.existsSync(relay3Cli(RELAY3_APP)))(
    '진짜 relay-v3 relay init의 초안은 결정론적이고 품질 기준 모양이다(relay-v3 체크아웃이 있을 때만)',
    () => {
      const { root, base } = scenarioDirs()
      const a = qualityOverlay(base, relay3Cli(RELAY3_APP), path.join(root, 'w1'))
      const b = qualityOverlay(base, relay3Cli(RELAY3_APP), path.join(root, 'w2'))
      expect(a.sha256).toBe(b.sha256)
      const q = JSON.parse(a.text)
      expect(q.version).toBe(1)
      expect(q.commands.acceptance).toMatchObject({ id: 'test' })
      expect(Array.isArray(q.auto)).toBe(true)
    },
  )

  it('기록에는 경로와 해시만 남긴다. 끄면 false', () => {
    const o = { path: QUALITY_FILE, text: '{}\n', sha256: sha256('{}\n') }
    expect(overlayRecord(o)).toEqual({ path: QUALITY_FILE, sha256: sha256('{}\n') })
    expect(overlayRecord(null)).toBe(false)
    expect(overlayFiles(null)).toEqual({})
    expect(overlayFiles(o)).toEqual({ [QUALITY_FILE]: '{}\n' })
  })
})

describe('평가 레포와 판정의 기준', () => {
  const overlay = { path: QUALITY_FILE, text: '{\n  "version": 1\n}\n', sha256: 'x' }

  it('덧씌운 파일은 첫 커밋에 들어 커밋되지 않은 변경이 없다. 덧씌우지 않으면 레포 그대로다', () => {
    const { root, base } = scenarioDirs()
    const r = makeRepo(path.join(root, 'work'), 'repo', base, overlayFiles(overlay))
    expect(git(r.repo, 'show', `${r.base}:${QUALITY_FILE}`)).toBe(overlay.text.trimEnd())
    expect(git(r.repo, 'rev-list', '--count', 'HEAD')).toBe('1')
    expect(git(r.repo, 'status', '--porcelain')).toBe('')
    expect(git(r.repo, 'ls-remote', 'origin', 'main')).toContain(r.base)

    const plain = makeRepo(path.join(root, 'work2'), 'repo', base)
    expect(fs.existsSync(path.join(plain.repo, QUALITY_FILE))).toBe(false)
    // 시나리오의 repo/는 그대로다
    expect(fs.existsSync(path.join(base, QUALITY_FILE))).toBe(false)
  })

  it('판정의 기준에도 얹어 덧씌운 파일은 diff에 나오지 않는다. 세션이 고치면 나온다', () => {
    const { root, base, hidden } = scenarioDirs()
    const r = makeRepo(path.join(root, 'work'), 'repo', base, overlayFiles(overlay))
    const baseDir = baseWithOverlay(base, overlay, path.join(root, 'work/base-tree'))
    expect(baseWithOverlay(base, null, path.join(root, 'unused'))).toBe(base)
    expect(fs.existsSync(path.join(root, 'unused'))).toBe(false)
    const scenario = {
      expectedFiles: ['src/**'],
      checks: [{ name: '더하기', file: 'add.test.js' }],
    }

    write(r.repo, { 'src/add.js': 'export const add = (a, b) => a + b\n' })
    const j = judgeTree({ tree: r.repo, baseDir, hiddenDir: hidden, scenario, work: tmp() })
    expect(j.files.map((f) => f.file)).toEqual(['src/add.js'])
    expect(j.diff).not.toContain(QUALITY_FILE)
    expect(j.unrelated).toEqual([])
    expect(j.checks[0].pass).toBe(true)

    write(r.repo, { [QUALITY_FILE]: '{\n  "version": 1,\n  "auto": []\n}\n' })
    const k = judgeTree({ tree: r.repo, baseDir, hiddenDir: hidden, scenario, work: tmp() })
    expect(k.files.map((f) => f.file).sort()).toEqual([QUALITY_FILE, 'src/add.js'])
    expect(k.unrelated).toEqual([QUALITY_FILE])
  })

  it('팀원 교대의 새 clone은 덧씌운 첫 커밋에서 이어진다(따로 넣지 않는다)', () => {
    const { root, base } = scenarioDirs()
    const work = path.join(root, 'work')
    const r = makeRepo(work, 'repo', base, overlayFiles(overlay))
    git(r.repo, 'checkout', '-q', '-b', 'fix')
    write(r.repo, { 'src/add.js': 'export const add = (a, b) => a + b\n' })
    git(r.repo, 'commit', '-qam', 'fix')
    git(r.repo, 'checkout', '-q', 'main')

    const h = handoffRepo(r.repo, r.remote, path.join(work, 'repo-mate1'))
    expect(h.merged).toEqual(['fix'])
    expect(fs.readFileSync(path.join(h.repo, QUALITY_FILE), 'utf8')).toBe(overlay.text)
    expect(git(h.repo, 'merge-base', '--is-ancestor', r.base, 'HEAD')).toBe('')
    expect(git(h.repo, 'status', '--porcelain')).toBe('')
  })
})
