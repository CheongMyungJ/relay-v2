// [단위] 구성별 빌드 인덱스의 명령 읽기 (requirements-extraction-flow.md AI 결정 118): make -n -B 출력에서 C 소스의 컴파일
// 명령을 모으고, 대체 컴파일러에 넘길 인자만 고르며, make 계열 명령을 가른다
import { describe, expect, it } from 'vitest'
import { compileCommands, portableArgs, shellWords } from '../../src/adapters/build-index'
import { isMakeCommand } from '../../src/core/requirements'

describe('빌드 명령 읽기 (AI 결정 118)', () => {
  it('셸 낱말: 따옴표와 역슬래시를 풀고 명령 구분을 따로 둔다', () => {
    expect(shellWords(`cc -DNAME="a b" -I'inc dir' -c x.c && echo ok; ls | wc`)).toEqual([
      'cc',
      '-DNAME=a b',
      '-Iinc dir',
      '-c',
      'x.c',
      ';',
      'echo',
      'ok',
      ';',
      'ls',
      ';',
      'wc',
    ])
  })

  it('컴파일 명령: 컴파일러이고 C 소스가 있는 것만, -o·의존성·링크 플래그는 빼고 폴더 이동을 따른다', () => {
    const out = compileCommands(
      [
        'mkdir -p out',
        'arm-none-eabi-gcc -mcpu=cortex-m4 -DLO -Iinc -MMD -MF out/a.d -c src/a.c -o out/a.o',
        '@echo linking',
        "make[1]: Entering directory '/w/src/drivers'",
        'cc -DLO -c uart.c -oout/uart.o',
        "make[1]: Leaving directory '/w/src/drivers'",
        'cd lib && gcc-12 -O2 -c b.c -o b.o',
        'arm-none-eabi-gcc -T fw.ld -nostdlib -o fw.elf out/a.o out/uart.o -lgcc',
        'cc -c start.S -o start.o',
        // 컴파일하고 링크하는 한 줄: C 소스마다, 링크 플래그는 뺀다
        'arm-none-eabi-gcc -mcpu=cortex-m3 -DB=1 -Iinc -nostdlib -T vendor/m3.ld -Wl,-Map=x.map -o build/fw.elf src/m.c vendor/s.c start.s -lc',
      ].join('\n'),
      '/w/src',
    )
    expect(out).toEqual([
      {
        compiler: 'arm-none-eabi-gcc',
        args: ['-mcpu=cortex-m4', '-DLO', '-Iinc'],
        source: 'src/a.c',
        cwd: '/w/src',
      },
      { compiler: 'cc', args: ['-DLO'], source: 'uart.c', cwd: '/w/src/drivers' },
      { compiler: 'gcc-12', args: ['-O2'], source: 'b.c', cwd: '/w/src/lib' },
      ...['src/m.c', 'vendor/s.c'].map((source) => ({
        compiler: 'arm-none-eabi-gcc',
        args: ['-mcpu=cortex-m3', '-DB=1', '-Iinc'],
        source,
        cwd: '/w/src',
      })),
    ])
  })

  it('대체 컴파일러에는 정의, 포함 경로, 강제 포함, 표준만 넘긴다', () => {
    expect(
      portableArgs([
        '-mcpu=cortex-m4',
        '-DA=1',
        '-I',
        'inc',
        '-include',
        'cfg.h',
        '-std=c99',
        '-O2',
        '-UX',
      ]),
    ).toEqual(['-DA=1', '-I', 'inc', '-include', 'cfg.h', '-std=c99', '-UX'])
  })

  it('make 계열: 첫 낱말(변수 대입 다음)이 make, gmake, mingw32-make', () => {
    for (const c of [
      'make lo',
      'gmake -C fw',
      'CC=clang make all',
      '/usr/bin/make',
      'mingw32-make.exe hi',
    ])
      expect(isMakeCommand(c), c).toBe(true)
    for (const c of [
      'cmake --build b',
      'ninja',
      'build.bat lo',
      'iarbuild proj.ewp -build lo',
      'makefile',
    ])
      expect(isMakeCommand(c), c).toBe(false)
  })
})
