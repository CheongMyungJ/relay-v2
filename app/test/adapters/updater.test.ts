import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { hasCommand } from '../../src/adapters/which'
import { GUI_SUDO, lastInstallFailed, markInstallAttempt } from '../../src/main/update'

const dirs: string[] = []
const temp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-updater-'))
  dirs.push(d)
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true })
})

describe('끌 때 설치의 실패 기록 (D353)', () => {
  it('다음 실행의 버전이 그대로면 실패이고 기록을 남긴다', () => {
    const dir = temp()
    expect(lastInstallFailed(dir, '0.1.0')).toBe(false)
    markInstallAttempt(dir, '0.1.0', '0.2.0')
    expect(lastInstallFailed(dir, '0.1.0')).toBe(true)
    // 또 실패하면 다음 실행에서도 알린다
    expect(lastInstallFailed(dir, '0.1.0')).toBe(true)
  })

  it('버전이 바뀌면(설치 성공, 사람이 직접 설치) 기록을 지운다', () => {
    const dir = temp()
    markInstallAttempt(dir, '0.1.0', '0.2.0')
    expect(lastInstallFailed(dir, '0.2.0')).toBe(false)
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('깨진 기록은 실패로 보지 않는다', () => {
    const dir = temp()
    fs.writeFileSync(path.join(dir, 'update-install.json'), '{')
    expect(lastInstallFailed(dir, '0.1.0')).toBe(false)
  })
})

describe.skipIf(process.platform === 'win32')('그래픽 비밀번호 도구 찾기 (PR #37 리뷰)', () => {
  it('electron-updater처럼 절대 경로 PATH의 실행 파일만 찾는다', () => {
    const dir = temp()
    const exe = path.join(dir, 'pkexec')
    fs.writeFileSync(exe, '#!/bin/sh\n')
    fs.chmodSync(exe, 0o644)
    expect(hasCommand('pkexec', { PATH: dir })).toBe(false)
    fs.chmodSync(exe, 0o755)
    expect(hasCommand('pkexec', { PATH: dir })).toBe(true)
    expect(hasCommand('pkexec', { PATH: path.relative(process.cwd(), dir) })).toBe(false)
    expect(hasCommand('pkexec', { PATH: '' })).toBe(false)
  })

  it('목록이 설치된 electron-updater의 LinuxUpdater와 같다', () => {
    const require = createRequire(import.meta.url)
    const file = path.join(path.dirname(require.resolve('electron-updater')), 'LinuxUpdater.js')
    const list = /const sudos = (\[[^\]]*\])/.exec(fs.readFileSync(file, 'utf8'))?.[1]
    expect(list).toBeDefined()
    expect(JSON.parse(list ?? '[]')).toEqual(GUI_SUDO)
  })
})
