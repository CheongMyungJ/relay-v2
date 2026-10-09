// 픽스처 컴파일과 구성별 빌드 인덱스(check-fixtures.mjs, build-index.mjs)가 함께 쓰는 C 컴파일러 찾기와 인자(결정 57).
// 컴파일러: CC 환경 변수, clang, 아니면 `python -m ziglang cc`(pip의 ziglang, clang 동봉). libc 헤더는 eval/extract/stubs.
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const STUBS = path.join(import.meta.dirname, '..', 'stubs')

export function findCompiler() {
  const tries = []
  if (process.env.CC) tries.push([process.env.CC, []])
  tries.push(['clang', []])
  for (const py of ['python3', 'python']) tries.push([py, ['-m', 'ziglang', 'cc']])
  for (const [file, pre] of tries) {
    const r = spawnSync(file, [...pre, '--version'], { encoding: 'utf8' })
    if (r.status === 0 && /clang|zig/i.test(r.stdout + r.stderr)) return { file, pre }
  }
  return null
}

const TARGET = { 'cortex-m3': 'thumbv7m-none-eabi', 'cortex-m4': 'thumbv7em-none-eabi' }

export function compileArgs(build, cfg, cc) {
  // zig cc는 -target 이름 꼴이 다르다(arch-os-abi)
  const target = cc.pre.length ? 'thumb-freestanding-eabi' : TARGET[build.cpu]
  return [
    ...cc.pre,
    '-target',
    target,
    `-mcpu=${cc.pre.length ? build.cpu.replace('-', '_') : build.cpu}`,
    '-ffreestanding',
    '-fno-common',
    '-Wall',
    '-Wextra',
    '-isystem',
    STUBS,
    ...build.includes.flatMap((i) => ['-I', i]),
    ...(cfg.forceInclude ? ['-include', cfg.forceInclude] : []),
    ...cfg.defines.map((d) => `-D${d}`),
  ]
}
