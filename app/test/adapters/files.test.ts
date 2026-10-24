// [어댑터] Work의 [파일] 탭의 파일 읽기와 쓰기 (D464~D468): 폴더의 항목, 링크 따라가기와 worktree 밖 막기, 글 파일
// 읽기, 줄 끝을 지키는 저장과 바뀐 파일 알리기, 터미널의 절대 경로를 worktree 기준 경로로 바꾸기(D491). 경로 검사와 글 판정의 세부는 [단위] `test/unit/work-files.test.ts`가 본다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listFiles, readTextFile, relativeFile, writeTextFile } from '../../src/adapters/files'
import { DIR_MAX_ENTRIES, FILE_MAX_BYTES } from '../../src/core/files'

const isWin = process.platform === 'win32'

let root: string
let tree: string

beforeEach(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'relay-files-')))
  tree = path.join(root, 'tree')
  const files: Record<string, string> = {
    'README.md': '# 안내\n',
    'src/avg.js': 'export const avg = 1\n',
    'src/lib/z.ts': 'z\n',
    'docs/b.md': 'b\n',
    '.gitignore': 'out/\n',
    '.git/config': '[core]\n',
  }
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(tree, rel)), { recursive: true })
    fs.writeFileSync(path.join(tree, rel), text)
  }
  fs.writeFileSync(path.join(root, 'secret.txt'), '비밀\n')
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

const names = async (rel: string) => {
  const r = await listFiles(tree, rel)
  if (!r.ok) throw new Error(r.error)
  return r.entries.map((e) => `${e.name}${e.kind === 'dir' ? '/' : e.kind === 'other' ? '!' : ''}`)
}

describe('[어댑터] [파일] 탭의 폴더 (D465)', () => {
  it('폴더 하나만 읽고 폴더 먼저 이름 순이다. `.git`은 보이지 않는다', async () => {
    expect(await names('')).toEqual(['docs/', 'src/', '.gitignore', 'README.md'])
    expect(await names('src')).toEqual(['lib/', 'avg.js'])
    expect(await names('src/lib')).toEqual(['z.ts'])
    expect(await listFiles(tree, '.git')).toEqual({
      ok: false,
      error: '받지 않는 경로: .git',
    })
    expect(await listFiles(tree, '../')).toMatchObject({ ok: false })
    expect(await listFiles(tree, 'none')).toMatchObject({ ok: false })
    expect(await listFiles(path.join(root, 'gone'), '')).toEqual({
      ok: false,
      error: 'worktree가 없습니다',
    })
  })

  it('상한을 넘는 항목은 개수만 돌려준다', async () => {
    const big = path.join(tree, 'big')
    fs.mkdirSync(big)
    for (let i = 0; i < DIR_MAX_ENTRIES + 3; i++) fs.writeFileSync(path.join(big, `f${i}`), '')
    const r = await listFiles(tree, 'big')
    if (!r.ok) throw new Error(r.error)
    expect(r.entries).toHaveLength(DIR_MAX_ENTRIES)
    expect(r.more).toBe(3)
  })

  it('폴더 링크(junction)는 worktree 안을 가리키면 폴더로 따라가고, 밖을 가리키면 열지 않는다 (D468)', async () => {
    fs.symlinkSync(path.join(tree, 'src'), path.join(tree, 'src-link'), 'junction')
    fs.mkdirSync(path.join(root, 'outside'))
    fs.writeFileSync(path.join(root, 'outside', 'x.md'), 'x\n')
    fs.symlinkSync(path.join(root, 'outside'), path.join(tree, 'out-link'), 'junction')
    expect(await names('')).toEqual([
      'docs/',
      'src/',
      'src-link/',
      '.gitignore',
      'out-link!',
      'README.md',
    ])
    expect(await names('src-link')).toEqual(['lib/', 'avg.js'])
    expect(await readTextFile(tree, 'src-link/avg.js')).toMatchObject({ kind: 'text' })
    expect(await listFiles(tree, 'out-link')).toMatchObject({ ok: false })
    expect(await readTextFile(tree, 'out-link/x.md')).toMatchObject({ ok: false })
  })

  it('Work가 아는 worktree 경로가 링크를 지나도(RELAY_HOME이 링크 아래), 그 경로로 만든 절대 경로 링크를 안으로 본다 (D468)', async () => {
    // 에이전트는 Work가 아는 경로(alias)에서 돌아 링크를 그 경로로 만든다
    const alias = path.join(root, 'alias')
    fs.symlinkSync(tree, alias, 'junction')
    fs.symlinkSync(path.join(alias, 'src'), path.join(tree, 'abs-src'), 'junction')
    const r = await listFiles(alias, '')
    if (!r.ok) throw new Error(r.error)
    expect(r.entries.find((e) => e.name === 'abs-src')).toEqual({ name: 'abs-src', kind: 'dir' })
    expect(await readTextFile(alias, 'abs-src/avg.js')).toMatchObject({ kind: 'text' })
  })

  it.skipIf(isWin)(
    '파일 링크도 worktree 안만 따라간다: 밖, `.git`, 깨진 링크는 열지도 쓰지도 않는다',
    async () => {
      fs.symlinkSync('README.md', path.join(tree, 'CLAUDE.md'))
      fs.symlinkSync(path.join(root, 'secret.txt'), path.join(tree, 'secret.md'))
      fs.symlinkSync('../../secret.txt', path.join(tree, 'src', 'up.md'))
      fs.symlinkSync('.git/config', path.join(tree, 'git.md'))
      fs.symlinkSync('none.md', path.join(tree, 'broken.md'))
      fs.symlinkSync('loop-b', path.join(tree, 'loop-a'))
      fs.symlinkSync('loop-a', path.join(tree, 'loop-b'))
      expect(await names('')).toEqual([
        'docs/',
        'src/',
        '.gitignore',
        'broken.md!',
        'CLAUDE.md',
        'git.md!',
        'loop-a!',
        'loop-b!',
        'README.md',
        'secret.md!',
      ])
      expect(await readTextFile(tree, 'CLAUDE.md')).toMatchObject({
        kind: 'text',
        text: '# 안내\n',
      })
      for (const rel of ['secret.md', 'src/up.md', 'git.md', 'broken.md', 'loop-a']) {
        expect(await readTextFile(tree, rel), rel).toMatchObject({ ok: false })
        expect(await writeTextFile(tree, rel, 'x', null), rel).toMatchObject({ ok: false })
      }
      expect(fs.readFileSync(path.join(root, 'secret.txt'), 'utf8')).toBe('비밀\n')
      // 링크로 저장하면 링크는 그대로이고 가리키는 파일이 바뀐다
      const opened = await readTextFile(tree, 'CLAUDE.md')
      if (!opened.ok || opened.kind !== 'text') throw new Error('글이어야 함')
      expect(await writeTextFile(tree, 'CLAUDE.md', '# 고침\n', opened.hash)).toMatchObject({
        ok: true,
      })
      expect(fs.lstatSync(path.join(tree, 'CLAUDE.md')).isSymbolicLink()).toBe(true)
      expect(fs.readFileSync(path.join(tree, 'README.md'), 'utf8')).toBe('# 고침\n')
    },
  )
})

describe('[어댑터] [파일] 탭의 읽기와 저장 (D466, D467)', () => {
  it('글 파일은 줄 끝을 `\\n`으로 바꿔 읽고, 그림처럼 글이 아니거나 상한을 넘으면 크기만 돌려준다', async () => {
    fs.writeFileSync(path.join(tree, 'win.txt'), 'a\r\nb\r\n')
    fs.writeFileSync(path.join(tree, 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]))
    fs.writeFileSync(path.join(tree, 'big.log'), Buffer.alloc(FILE_MAX_BYTES + 1, 0x61))
    expect(await readTextFile(tree, 'win.txt')).toMatchObject({
      ok: true,
      kind: 'text',
      text: 'a\nb\n',
    })
    expect(await readTextFile(tree, 'pic.png')).toEqual({ ok: true, kind: 'binary', size: 6 })
    expect(await readTextFile(tree, 'big.log')).toEqual({
      ok: true,
      kind: 'large',
      size: FILE_MAX_BYTES + 1,
    })
    expect(await readTextFile(tree, 'src')).toEqual({ ok: false, error: '파일이 아님: src' })
    expect(await readTextFile(tree, '.git/config')).toMatchObject({ ok: false })
    expect(await readTextFile(tree, '../secret.txt')).toMatchObject({ ok: false })
  })

  it('저장은 원래의 줄 끝과 BOM을 지키고, 연 뒤 파일이 바뀌었으면 쓰지 않는다. hash 없이는 덮어쓴다', async () => {
    const file = path.join(tree, 'docs', 'win.md')
    fs.writeFileSync(file, '\ufeff# 제목\r\n본문\r\n')
    const opened = await readTextFile(tree, 'docs/win.md')
    if (!opened.ok || opened.kind !== 'text') throw new Error('글이어야 함')
    expect(opened.text).toBe('# 제목\n본문\n')

    const saved = await writeTextFile(tree, 'docs/win.md', '# 제목\n고친 본문\n', opened.hash)
    if (!saved.ok) throw new Error(saved.error)
    expect(fs.readFileSync(file, 'utf8')).toBe('\ufeff# 제목\r\n고친 본문\r\n')
    // 받은 hash로 이어서 저장한다
    expect(await writeTextFile(tree, 'docs/win.md', '# 제목\n', saved.hash)).toMatchObject({
      ok: true,
    })

    // 그 사이 에이전트가 고쳤다
    fs.writeFileSync(file, '# 에이전트\n')
    expect(await writeTextFile(tree, 'docs/win.md', '# 사람\n', saved.hash)).toEqual({
      ok: false,
      conflict: true,
      error: '연 뒤 파일이 바뀌었습니다',
    })
    expect(fs.readFileSync(file, 'utf8')).toBe('# 에이전트\n')
    expect(await writeTextFile(tree, 'docs/win.md', '# 사람\n', null)).toMatchObject({ ok: true })
    expect(fs.readFileSync(file, 'utf8')).toBe('# 사람\n')
  })

  it('있는 글 파일만 고친다: 새 파일, 폴더, 글이 아닌 파일, 상한을 넘는 글은 쓰지 않는다', async () => {
    fs.writeFileSync(path.join(tree, 'pic.png'), Buffer.from([0x89, 0x50, 0, 1]))
    expect(await writeTextFile(tree, 'new.md', 'x', null)).toMatchObject({ ok: false })
    expect(fs.existsSync(path.join(tree, 'new.md'))).toBe(false)
    expect(await writeTextFile(tree, 'src', 'x', null)).toMatchObject({ ok: false })
    expect(await writeTextFile(tree, 'pic.png', 'x', null)).toEqual({
      ok: false,
      error: '글 파일이 아님: pic.png',
    })
    expect(await writeTextFile(tree, 'README.md', 'a'.repeat(FILE_MAX_BYTES + 1), null)).toEqual({
      ok: false,
      error: '글이 너무 큼',
    })
    expect(fs.readFileSync(path.join(tree, 'README.md'), 'utf8')).toBe('# 안내\n')
  })

  it('하드 링크가 있는 파일은 읽기만 하고 쓰지 않는다: worktree 밖과 같은 파일일 수 있다 (D468)', async () => {
    const secret = path.join(root, 'secret.txt')
    fs.linkSync(secret, path.join(tree, 'hard.md'))
    expect(await readTextFile(tree, 'hard.md')).toMatchObject({ kind: 'text', text: '비밀\n' })
    expect(await writeTextFile(tree, 'hard.md', '바꿈\n', null)).toEqual({
      ok: false,
      error: '다른 이름(하드 링크)이 있는 파일이라 고치지 않음: hard.md',
    })
    expect(fs.readFileSync(secret, 'utf8')).toBe('비밀\n')
  })

  it.runIf(isWin)(
    'Windows의 8.3 짧은 이름(`GIT~1`)으로도 `.git`을 열지 않는다 (D468)',
    async (ctx) => {
      // cmd의 for가 짧은 이름을 낸다. 읽지 못하면 빈 글이다
      const git = path.join(tree, '.git')
      const out = spawnSync('cmd', ['/d', '/s', '/c', `"for %I in ("${git}") do @echo %~snxI"`], {
        windowsVerbatimArguments: true,
        encoding: 'utf8',
      })
      const short = (out.stdout ?? '').trim()
      // 짧은 이름을 만들지 않는 볼륨이면 긴 이름이 나온다
      if (!short || short.toLowerCase() === '.git') return ctx.skip()
      expect(await listFiles(tree, short)).toMatchObject({ ok: false })
      expect(await readTextFile(tree, `${short}/config`)).toMatchObject({ ok: false })
      expect(await writeTextFile(tree, `${short}/config`, 'x', null)).toMatchObject({ ok: false })
      expect(fs.readFileSync(path.join(tree, '.git', 'config'), 'utf8')).toBe('[core]\n')
    },
  )

  it.skipIf(isWin)('실행 권한은 저장한 뒤에도 그대로다', async () => {
    const script = path.join(tree, 'run.sh')
    fs.writeFileSync(script, 'echo a\n', { mode: 0o755 })
    const opened = await readTextFile(tree, 'run.sh')
    if (!opened.ok || opened.kind !== 'text') throw new Error('글이어야 함')
    await writeTextFile(tree, 'run.sh', 'echo b\n', opened.hash)
    expect(fs.statSync(script).mode & 0o777).toBe(0o755)
    expect(fs.readFileSync(script, 'utf8')).toBe('echo b\n')
  })
})

describe('[어댑터] 터미널에서 연 경로의 worktree 기준 경로 (D491)', () => {
  it('worktree 안의 파일만 받는다: 폴더, 밖, `.git`, 없는 파일은 null이다', async () => {
    expect(await relativeFile(tree, path.join(tree, 'src', 'avg.js'))).toBe('src/avg.js')
    expect(await relativeFile(tree, path.join(tree, 'README.md'))).toBe('README.md')
    expect(await relativeFile(tree, path.join(tree, 'src'))).toBeNull()
    expect(await relativeFile(tree, tree)).toBeNull()
    expect(await relativeFile(tree, path.join(root, 'secret.txt'))).toBeNull()
    expect(await relativeFile(tree, path.join(tree, '.git', 'config'))).toBeNull()
    expect(await relativeFile(tree, path.join(tree, 'none.md'))).toBeNull()
  })

  it('밖을 가리키는 폴더 링크 아래는 받지 않고, Work가 아는 경로로 본 것은 받는다', async () => {
    fs.mkdirSync(path.join(root, 'outside'))
    fs.writeFileSync(path.join(root, 'outside', 'x.md'), 'x\n')
    fs.symlinkSync(path.join(root, 'outside'), path.join(tree, 'out-link'), 'junction')
    expect(await relativeFile(tree, path.join(tree, 'out-link', 'x.md'))).toBeNull()
    const alias = path.join(root, 'alias')
    fs.symlinkSync(tree, alias, 'junction')
    expect(await relativeFile(alias, path.join(alias, 'docs', 'b.md'))).toBe('docs/b.md')
    expect(await relativeFile(alias, path.join(tree, 'docs', 'b.md'))).toBe('docs/b.md')
  })
})
