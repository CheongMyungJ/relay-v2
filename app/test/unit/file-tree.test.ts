// [단위] [파일] 탭의 트리 표시와 연 파일 탭 (D490~D492): 바뀐 파일과 그 폴더의 표시, 지운 파일을 트리에 더하기,
// 같은 이름 탭의 폴더, 탭을 닫은 뒤 고를 탭. 화면의 연결은 [스모크] `test/smoke/files.spec.ts`가 본다.
import { describe, expect, it } from 'vitest'
import {
  afterClose,
  changeMarks,
  parentDirs,
  tabHints,
  withDeleted,
} from '../../src/renderer/src/fileTree'
import type { FileChangeView } from '../../src/shared/views'

const changes: FileChangeView[] = [
  { path: 'README.md', status: 'D' },
  { path: 'docs/new.md', status: 'A' },
  { path: 'docs/old/a.md', status: 'D' },
  { path: 'docs/old/b.md', status: 'D' },
  { path: 'src/avg.js', status: 'M' },
  { path: 'src/lib/new.ts', status: 'A' },
]

describe('바뀐 파일의 표시 (D490)', () => {
  it('파일은 그 상태, 폴더는 아래가 모두 같으면 그 상태이고 섞이면 M이다', () => {
    const marks = changeMarks(changes)
    expect(marks.files.get('src/avg.js')).toBe('M')
    expect(marks.files.get('README.md')).toBe('D')
    expect(marks.files.has('src')).toBe(false)
    expect(Object.fromEntries(marks.dirs)).toEqual({
      docs: 'M',
      'docs/old': 'D',
      src: 'M',
      'src/lib': 'A',
    })
  })

  it('지운 파일과 지운 파일만 남은 폴더를 그 자리에 차례대로 더한다. 디스크에 있는 이름은 더하지 않는다', () => {
    expect(
      withDeleted(
        '',
        [
          { name: 'docs', kind: 'dir' },
          { name: 'src', kind: 'dir' },
          { name: 'package.json', kind: 'file' },
        ],
        changes,
      ),
    ).toEqual([
      { name: 'docs', kind: 'dir' },
      { name: 'src', kind: 'dir' },
      { name: 'package.json', kind: 'file' },
      { name: 'README.md', kind: 'file', deleted: true },
    ])
    expect(withDeleted('docs', [{ name: 'new.md', kind: 'file' }], changes)).toEqual([
      { name: 'old', kind: 'dir', deleted: true },
      { name: 'new.md', kind: 'file' },
    ])
    // 지운 폴더 안은 디스크에 없어 바뀐 파일 목록으로만 그린다
    expect(withDeleted('docs/old', [], changes)).toEqual([
      { name: 'a.md', kind: 'file', deleted: true },
      { name: 'b.md', kind: 'file', deleted: true },
    ])
    // 지운 뒤 같은 이름을 다시 만들었으면 디스크의 것만 보인다
    const back = [
      { name: 'docs', kind: 'dir' },
      { name: 'README.md', kind: 'file' },
    ] as const
    expect(withDeleted('', back, changes)).toEqual(back)
    expect(withDeleted('src', [{ name: 'avg.js', kind: 'file' }], changes)).toEqual([
      { name: 'avg.js', kind: 'file' },
    ])
  })
})

describe('연 파일 탭 (D491, D492)', () => {
  it('파일을 담은 폴더는 바깥부터다', () => {
    expect(parentDirs('a/b/c.md')).toEqual(['a', 'a/b'])
    expect(parentDirs('README.md')).toEqual([])
  })

  it('같은 이름의 탭에만 갈리는 데까지의 폴더를 붙인다', () => {
    expect(
      tabHints([
        'src/a/index.ts',
        'src/b/index.ts',
        'index.ts',
        'README.md',
        'x/lib/util.ts',
        'y/lib/util.ts',
      ]),
    ).toEqual(['a', 'b', './', '', 'x/lib', 'y/lib'])
  })

  it('지금 탭을 닫으면 오른쪽, 없으면 왼쪽 탭을 고른다. 다른 탭을 닫으면 그대로다', () => {
    const tabs = ['a', 'b', 'c']
    expect(afterClose(tabs, 'b', 'b')).toBe('c')
    expect(afterClose(tabs, 'c', 'c')).toBe('b')
    expect(afterClose(tabs, 'a', 'c')).toBe('a')
    expect(afterClose(['a'], 'a', 'a')).toBeNull()
  })
})
