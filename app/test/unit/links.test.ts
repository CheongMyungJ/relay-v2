// [단위] 터미널의 파일 열기와 붙여넣기 (D410~D412). 렌더러가 글에서 찾는 주소와 경로, main이 받는 경로와 링크 따라가기,
// 여는 형식, 붙여넣을 경로의 모양
import { describe, expect, it } from 'vitest'
import { linkPath, opensSafely, pasteExt, realLinkPath, type LinkFs } from '../../src/main/links'
import { Terminal } from '@xterm/headless'
import { findLinks, logicalLine, pasteText, pastesFiles } from '../../src/renderer/src/links'

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

/** 폭 cols인 터미널에 글을 쓴 화면 버퍼 */
async function screen(cols: number, data: string) {
  const term = new Terminal({ cols, rows: 5, allowProposedApi: true })
  await new Promise<void>((resolve) => term.write(data, resolve))
  return term.buffer.active
}

describe('터미널 줄 읽기 (D411)', () => {
  it('줄바꿈으로 이어진 줄은 한 줄로 읽고, 넓은 글자는 두 칸이다', async () => {
    const buf = await screen(10, '수정: src/main/a.ts')
    const { text, cells } = logicalLine(buf, 1)
    expect(text.trimEnd()).toBe('수정: src/main/a.ts')
    expect(cells[0]).toEqual({ x: 1, y: 1, w: 2 })
    expect(cells[4]).toEqual({ x: 7, y: 1, w: 1 })
    // 둘째 줄의 첫 글자
    expect(cells[text.indexOf('main/')]).toEqual({ x: 1, y: 2, w: 1 })
  })

  it('넓은 글자가 들어가지 못해 남은 줄 끝 칸은 공백으로 읽지 않는다', async () => {
    // 9칸을 채우면 마지막 한 칸에 '설'이 들어가지 못해 다음 줄로 넘어간다
    const buf = await screen(10, 'docs/abcd설계/결정.md')
    expect(buf.getLine(1)?.isWrapped).toBe(true)
    expect(logicalLine(buf, 0).text.trimEnd()).toBe('docs/abcd설계/결정.md')
    expect(findLinks(logicalLine(buf, 1).text).paths[0]?.[0]?.text).toBe('docs/abcd설계/결정.md')
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

  it('Windows 장치 이름은 확장자가 붙어도, 어느 폴더에 있어도 받지 않는다', () => {
    for (const raw of ['CON', 'nul.txt', 'logs/aux.log', 'COM1', 'lpt9.md', 'con .txt']) {
      expect(linkPath(raw, 'C:\\w', 'C:\\Users\\me', 'win32')).toBeNull()
    }
    expect(linkPath('console.md', 'C:\\w', 'C:\\Users\\me', 'win32')).toBe('C:\\w\\console.md')
    expect(linkPath('COM10', 'C:\\w', 'C:\\Users\\me', 'win32')).toBe('C:\\w\\COM10')
    // Linux에서는 보통 이름이다
    expect(linkPath('nul.txt', '/w', '/h', 'posix')).toBe('/w/nul.txt')
  })
})

/** 링크 표로 만든 가짜 파일 시스템. 표에 없는 경로는 일반 파일이나 폴더, missing은 없는 것이다 */
function fakeFs(
  links: Record<string, string>,
  missing: string[] = [],
): LinkFs & { seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    lstat: (file) => {
      seen.push(file)
      if (missing.includes(file)) return Promise.resolve(null)
      return Promise.resolve({ isSymbolicLink: () => file in links })
    },
    readlink: (file) => Promise.resolve(links[file] ?? null),
  }
}

describe('링크 따라가기 (D412)', () => {
  it('링크를 앞에서부터 따라가 실제 경로를 낸다. 상대 링크와 링크를 가리키는 링크도 푼다', async () => {
    const fs = fakeFs({ '/w/docs': '../shared/docs', '/shared/docs/a.md': '/w/notes/b.md' })
    expect(await realLinkPath('/w/docs/a.md', fs, 'posix')).toBe('/w/notes/b.md')
    expect(await realLinkPath('/w/src/a.ts', fakeFs({}), 'posix')).toBe('/w/src/a.ts')
    expect(await realLinkPath('/w/none', fakeFs({}, ['/w/none']), 'posix')).toBeNull()
  })

  it('네트워크를 가리키는 링크를 만나면 그 아래를 보지 않는다', async () => {
    for (const target of [
      '\\\\evil\\share',
      '//evil/share',
      '\\\\?\\UNC\\evil\\share',
      '\\??\\UNC\\evil\\share',
    ]) {
      const fs = fakeFs({ 'C:\\w\\docs': target })
      expect(await realLinkPath('C:\\w\\docs\\a.md', fs, 'win32')).toBeNull()
      // 링크 아래 경로는 열어 보지 않는다
      expect(fs.seen).toEqual(['C:\\w', 'C:\\w\\docs'])
    }
  })

  it('이 컴퓨터를 가리키는 junction의 앞머리는 떼고 따라간다. 돌고 도는 링크는 null이다', async () => {
    const fs = fakeFs({ 'C:\\w\\docs': '\\\\?\\D:\\shared' })
    expect(await realLinkPath('C:\\w\\docs\\a.md', fs, 'win32')).toBe('D:\\shared\\a.md')
    const loop = fakeFs({ '/w/a': '/w/b', '/w/b': '/w/a' })
    expect(await realLinkPath('/w/a/x.md', loop, 'posix')).toBeNull()
  })
})

describe('여는 형식 (D412)', () => {
  it('문서, 코드, 그림은 열고 목록에 없는 것은 폴더에서 보여 준다', () => {
    for (const f of [
      'C:\\w\\a.ts',
      'C:\\w\\shot.PNG',
      'C:\\w\\README.md',
      'C:\\w\\Makefile',
      'C:\\w\\.gitignore',
    ]) {
      expect(opensSafely(f, false, false, 'win32')).toBe(true)
    }
    for (const f of [
      'setup.exe',
      'run.cmd',
      'a.ps1',
      'a.js',
      'a.py',
      'a.pyw',
      'a.sh',
      'a.chm',
      'a.scf',
      'a.msix',
      'run',
    ]) {
      expect(opensSafely(`C:\\w\\${f}`, false, false, 'win32')).toBe(false)
    }
    // Linux는 .js와 .py를 편집기로 연다. 실행 권한이 있거나 데스크톱·Wine 실행 파일은 열지 않는다
    expect(opensSafely('/w/a.js', false, false, 'posix')).toBe(true)
    expect(opensSafely('/w/a.py', false, false, 'posix')).toBe(true)
    expect(opensSafely('/w/a.md', false, true, 'posix')).toBe(false)
    for (const f of ['app.desktop', 'setup.exe', 'tool.jar', 'x.AppImage', 'a.sh']) {
      expect(opensSafely(`/w/${f}`, false, false, 'posix')).toBe(false)
    }
  })

  it('폴더는 이름에 확장자가 없을 때만 연다 (macOS .app 꾸러미)', () => {
    expect(opensSafely('/w/src', true, true, 'posix')).toBe(true)
    expect(opensSafely('/w/.github', true, true, 'posix')).toBe(true)
    expect(opensSafely('/w/Tool.app', true, true, 'posix')).toBe(false)
    expect(opensSafely('C:\\w\\docs', true, false, 'win32')).toBe(true)
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

  it('글이 함께 오면 글을 붙여넣고, 디스크의 파일이 있으면 같이 온 파일 이름 글은 버린다', () => {
    // 화면 캡처: 그림뿐
    expect(pastesFiles('', 1, false)).toBe(true)
    // 표 복사: 글과 그림
    expect(pastesFiles('a\tb', 1, false)).toBe(false)
    // Finder 복사: 파일 이름 글과 파일
    expect(pastesFiles('shot.png', 1, true)).toBe(true)
    expect(pastesFiles('그냥 글', 0, false)).toBe(false)
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
