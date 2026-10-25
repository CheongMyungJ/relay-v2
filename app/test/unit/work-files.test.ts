// [단위] Work의 [파일] 탭 (D464~D468, D490): 받는 상대 경로, 트리의 차례, 글 파일 판정과 줄 끝·BOM, 바뀐 파일 목록. 파일 읽기와 링크
// 따라가기는 [어댑터] `test/adapters/files.test.ts`가 본다.
import { describe, expect, it } from 'vitest'
import {
  decodeText,
  encodeText,
  CHANGES_MAX,
  fileSegments,
  sortEntries,
  treeChanges,
  windowsDeviceName,
} from '../../src/core/files'

const bytes = (s: string) => new TextEncoder().encode(s)
/** BOM을 떼지 않고 읽는다 */
const str = (b: Uint8Array) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(b)

describe('[파일] 탭의 경로 (D468)', () => {
  it('worktree 기준 상대 경로만 이름 목록으로 받는다. 빈 글은 worktree다', () => {
    expect(fileSegments('', false)).toEqual([])
    expect(fileSegments('src/avg.js', false)).toEqual(['src', 'avg.js'])
    expect(fileSegments('docs/.relay/a.md', false)).toEqual(['docs', '.relay', 'a.md'])
    // posix는 `\`도 이름의 글자다
    expect(fileSegments('a\\b.md', false)).toEqual(['a\\b.md'])
    expect(fileSegments('src\\avg.js', true)).toEqual(['src', 'avg.js'])
  })

  it('절대 경로, `..`, 빈 이름, NUL, `.git` 아래는 받지 않는다', () => {
    for (const rel of [
      '/etc/passwd',
      '../x',
      'a/../../x',
      'a//b',
      'a/',
      './a',
      'a\0b',
      '.git',
      '.git/config',
      'sub/.GIT/HEAD',
    ]) {
      expect(fileSegments(rel, false), rel).toBeNull()
    }
  })

  it('Windows는 드라이브·스트림(`:`), 장치 이름, 끝의 점과 공백(`.. `, `.git.`)도 받지 않는다', () => {
    for (const rel of [
      'C:/x',
      'C:x',
      'a.md:stream',
      '\\x',
      '\\\\server\\share',
      'nul',
      'src/COM1.txt',
      'aux .md',
      '.. ',
      '.git.',
      'a./b',
    ]) {
      expect(fileSegments(rel, true), rel).toBeNull()
    }
    // posix에서는 평범한 이름이다
    expect(fileSegments('nul', false)).toEqual(['nul'])
    expect(windowsDeviceName('Lpt1.log')).toBe(true)
    expect(windowsDeviceName('console.md')).toBe(false)
  })
})

describe('[파일] 탭의 트리 차례 (D465)', () => {
  it('폴더 먼저, 그다음 대소문자를 가리지 않는 이름 순이고 숫자는 크기로 본다', () => {
    const sorted = sortEntries([
      { name: 'b.md', kind: 'file' },
      { name: 'src', kind: 'dir' },
      { name: 'A.md', kind: 'file' },
      { name: 'link', kind: 'other' },
      { name: 'file10.txt', kind: 'file' },
      { name: 'file2.txt', kind: 'file' },
      { name: 'Docs', kind: 'dir' },
    ] as const)
    expect(sorted.map((e) => e.name)).toEqual([
      'Docs',
      'src',
      'A.md',
      'b.md',
      'file2.txt',
      'file10.txt',
      'link',
    ])
  })
})

describe('[파일] 탭의 글 파일 (D466, D467)', () => {
  it('UTF-8 글은 줄 끝을 `\\n`으로 바꿔 열고, 줄 끝과 BOM을 기억한다', () => {
    expect(decodeText(bytes('# 제목\n본문\n'))).toEqual({
      text: '# 제목\n본문\n',
      shape: { eol: '\n', bom: false },
    })
    expect(decodeText(bytes('\ufeffa\r\nb\r\n'))).toEqual({
      text: 'a\nb\n',
      shape: { eol: '\r\n', bom: true },
    })
    expect(decodeText(new Uint8Array())).toEqual({ text: '', shape: { eol: '\n', bom: false } })
  })

  it('UTF-8이 아니거나 NUL이 있으면 글 파일이 아니다', () => {
    expect(decodeText(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBeNull()
    expect(decodeText(new Uint8Array([0x61, 0x00, 0x62]))).toBeNull()
    // EUC-KR '가'
    expect(decodeText(new Uint8Array([0xb0, 0xa1]))).toBeNull()
  })

  it('저장할 때 원래 파일의 줄 끝과 BOM을 붙인다', () => {
    const crlf = { eol: '\r\n', bom: true } as const
    expect(str(encodeText('a\nb\n', crlf))).toBe('\ufeffa\r\nb\r\n')
    // 이미 `\r\n`인 줄을 겹치지 않는다
    expect(str(encodeText('a\r\nb', { eol: '\r\n', bom: false }))).toBe('a\r\nb')
    expect(str(encodeText('a\r\nb\n', { eol: '\n', bom: false }))).toBe('a\nb\n')
    // 열고 그대로 저장하면 바이트가 같다
    const original = bytes('\ufeff# 제목\r\n\r\n본문\r\n')
    const opened = decodeText(original)
    if (!opened) throw new Error('글 파일이어야 함')
    expect(encodeText(opened.text, opened.shape)).toEqual(original)
  })
})

describe('[파일] 탭의 바뀐 파일 (D490)', () => {
  it('차이의 상태를 A·M·D로 줄이고 추적하지 않는 파일은 더한 것이다. 경로 순이다', () => {
    expect(
      treeChanges([
        {
          prefix: '',
          diff: [
            { status: 'M', path: 'src/avg.js' },
            { status: 'D', path: 'README.md' },
            { status: 'A', path: 'docs/a.md' },
            { status: 'T', path: 'link' },
            { status: 'U', path: 'conflict.txt' },
          ],
          untracked: ['new.txt'],
        },
      ]),
    ).toEqual([
      { path: 'README.md', status: 'D' },
      { path: 'conflict.txt', status: 'M' },
      { path: 'docs/a.md', status: 'A' },
      { path: 'link', status: 'M' },
      { path: 'new.txt', status: 'A' },
      { path: 'src/avg.js', status: 'M' },
    ])
  })

  it('묶음 Work의 서브모듈은 그 자리 아래에 붙이고, 트리가 받지 않는 경로는 뺀다', () => {
    expect(
      treeChanges([
        { prefix: '', diff: [{ status: 'M', path: 'libs/core' }], untracked: [] },
        {
          prefix: 'libs/core',
          diff: [{ status: 'M', path: 'src/a.ts' }],
          untracked: ['b.ts', '.git/x', '../out'],
        },
      ]),
    ).toEqual([
      { path: 'libs/core', status: 'M' },
      { path: 'libs/core/b.ts', status: 'A' },
      { path: 'libs/core/src/a.ts', status: 'M' },
    ])
  })

  it('지운 것으로 온 경로가 추적하지 않는 파일로 남아 있으면(git rm --cached) 고친 것이다', () => {
    expect(
      treeChanges([
        { prefix: '', diff: [{ status: 'D', path: 'foo.ts' }], untracked: ['foo.ts', 'bar.ts'] },
      ]),
    ).toEqual([
      { path: 'bar.ts', status: 'A' },
      { path: 'foo.ts', status: 'M' },
    ])
  })

  it('상한을 넘으면 앞의 것만 둔다', () => {
    const untracked = Array.from({ length: CHANGES_MAX + 5 }, (_, i) => `f${i}`)
    expect(treeChanges([{ prefix: '', diff: [], untracked }])).toHaveLength(CHANGES_MAX)
  })
})
