// [단위] 터미널의 파일 열기와 붙여넣기 (D410~D412). 렌더러가 글에서 찾는 주소와 경로, main이 받는 경로와 열지 않는
// 실행 파일, 붙여넣을 경로의 모양
import { describe, expect, it } from 'vitest'
import { executableLike, linkPath, pasteExt } from '../../src/main/links'
import { findLinks, pasteText } from '../../src/renderer/src/links'

/** 낱말마다 시도할 글만 */
const paths = (line: string) => findLinks(line).paths.map((tries) => tries.map((t) => t.text))

describe('터미널 글의 주소와 경로 (D411)', () => {
  it('http(s) 주소는 끝의 문장 부호와 붙은 조사를 빼고, 짝이 맞는 괄호는 남긴다', () => {
    const line = 'PR: https://github.com/o/r/pull/7. 문서 (https://en.wikipedia.org/wiki/A_(b))에서'
    expect(findLinks(line).urls).toEqual([
      { start: 4, end: 33, text: 'https://github.com/o/r/pull/7' },
      { start: 39, end: 74, text: 'https://en.wikipedia.org/wiki/A_(b)' },
    ])
    expect(findLinks('https://example.com/경로').urls.map((u) => u.text)).toEqual([
      'https://example.com/',
    ])
    // 주소 안의 경로는 경로로 다시 보지 않는다
    expect(paths('https://github.com/o/r/blob/main/src/a.ts')).toEqual([])
  })

  it('경로는 구분자가 있거나 확장자가 있는 낱말이다. 도구 이름의 괄호, @언급, 줄 번호를 뗀다', () => {
    expect(paths('● Update(src/main/links.ts)')).toEqual([['src/main/links.ts']])
    expect(paths('⎿  Wrote 12 lines to docs/design.md')).toEqual([['docs/design.md']])
    expect(paths('@app/package.json 을 보세요')).toEqual([['app/package.json']])
    expect(paths('실패: test/a.test.ts:42:7, README.md#L10-L20.')).toEqual([
      ['test/a.test.ts'],
      ['README.md'],
    ])
    expect(paths('C:\\Users\\me\\a b.txt ~/notes.md ./run .gitignore')).toEqual([
      ['C:\\Users\\me\\a'],
      ['b.txt'],
      ['~/notes.md'],
      ['./run'],
      ['.gitignore'],
    ])
    expect(paths('file:///tmp/a.png')).toEqual([['file:///tmp/a.png']])
    // 경로가 아닌 것
    expect(paths('버전 1.2.3, ... / ./ ~ 그리고 끝.')).toEqual([])
  })

  it('붙은 조사는 뗀 것도 시도한다. 한글 이름의 파일이 있으면 그것이 먼저다', () => {
    expect(paths('src/a.ts를 고쳤고 docs/설계.md에서')).toEqual([
      ['src/a.ts를', 'src/a.ts'],
      ['docs/설계.md에서', 'docs/설계.md'],
    ])
    // 범위는 줄 안의 자리다
    const [tries] = findLinks('수정: src/a.ts를').paths
    expect(tries?.[1]).toEqual({ start: 4, end: 12, text: 'src/a.ts' })
  })
})

describe('터미널 경로 풀기 (D411)', () => {
  it('상대 경로는 터미널의 폴더에서, ~는 홈에서 푼다. file: 주소도 받는다', () => {
    expect(linkPath('src/a.ts', '/w/tree', '/home/me', 'posix')).toBe('/w/tree/src/a.ts')
    expect(linkPath('../x', '/w/tree', '/home/me', 'posix')).toBe('/w/x')
    expect(linkPath('/etc/hosts', '/w/tree', '/home/me', 'posix')).toBe('/etc/hosts')
    expect(linkPath('~/notes.md', '/w/tree', '/home/me', 'posix')).toBe('/home/me/notes.md')
    expect(linkPath('file:///tmp/a%20b.png', '/w', '/h', 'posix')).toBe('/tmp/a b.png')
    expect(linkPath('src\\a.ts', 'C:\\w\\tree', 'C:\\Users\\me', 'win32')).toBe(
      'C:\\w\\tree\\src\\a.ts',
    )
    expect(linkPath('C:/w/b.md', 'C:\\w', 'C:\\Users\\me', 'win32')).toBe('C:\\w\\b.md')
    expect(linkPath('file:///C:/w/a.png', 'D:\\', 'C:\\Users\\me', 'win32')).toBe('C:\\w\\a.png')
  })

  it('네트워크 경로, 스트림·장치 경로, 빈 글은 받지 않는다', () => {
    for (const raw of ['\\\\server\\share\\a.txt', '//server/share/a.txt', 'file://server/a']) {
      expect(linkPath(raw, 'C:\\w', 'C:\\Users\\me', 'win32')).toBeNull()
      expect(linkPath(raw, '/w', '/home/me', 'posix')).toBeNull()
    }
    expect(linkPath('a.txt:secret', 'C:\\w', 'C:\\Users\\me', 'win32')).toBeNull()
    expect(linkPath('\\\\.\\pipe\\x', 'C:\\w', 'C:\\Users\\me', 'win32')).toBeNull()
    expect(linkPath('  ', '/w', '/h', 'posix')).toBeNull()
    expect(linkPath('a\0b', '/w', '/h', 'posix')).toBeNull()
  })

  it('열면 실행되는 파일: Windows는 확장자로, Linux는 실행 권한과 데스크톱 실행 파일로 가른다', () => {
    expect(executableLike('C:\\w\\setup.EXE', false, 'win32')).toBe(true)
    expect(executableLike('C:\\w\\build.cmd', false, 'win32')).toBe(true)
    expect(executableLike('C:\\w\\src\\a.js', false, 'win32')).toBe(true)
    expect(executableLike('C:\\w\\a.ts', false, 'win32')).toBe(false)
    expect(executableLike('C:\\w\\shot.png', false, 'win32')).toBe(false)
    expect(executableLike('/w/src/a.js', false, 'posix')).toBe(false)
    expect(executableLike('/w/scripts/x.sh', true, 'posix')).toBe(true)
    expect(executableLike('/w/app.desktop', false, 'posix')).toBe(true)
    expect(executableLike('/w/README.md', false, 'posix')).toBe(false)
  })
})

describe('붙여넣는 파일과 그림 (D410)', () => {
  it('엔진이 경로로 받는 그림 형식만 그대로 저장한다', () => {
    expect(pasteExt('image/png')).toBe('png')
    expect(pasteExt('image/JPEG')).toBe('jpg')
    expect(pasteExt('image/gif')).toBe('gif')
    expect(pasteExt('image/webp')).toBe('webp')
    expect(pasteExt('image/bmp')).toBeNull()
    expect(pasteExt('image/svg+xml')).toBeNull()
  })

  it('Windows 경로는 /로 바꾸고 공백이 있으면 따옴표로 감싼다', () => {
    expect(pasteText('C:\\Users\\me\\shot.png', 'win32')).toBe('C:/Users/me/shot.png')
    expect(pasteText('C:\\Users\\Kim Lee\\a.pdf', 'win32')).toBe('"C:/Users/Kim Lee/a.pdf"')
  })

  it('Linux 경로는 그대로, 공백은 따옴표로, 따옴표나 \\가 들면 하나씩 이스케이프한다', () => {
    expect(pasteText('/home/me/shot.png', 'linux')).toBe('/home/me/shot.png')
    expect(pasteText("/home/me/my shot's.png", 'linux')).toBe('"/home/me/my shot\'s.png"')
    expect(pasteText('/tmp/a "b".png', 'linux')).toBe('/tmp/a\\ \\"b\\".png')
  })
})
