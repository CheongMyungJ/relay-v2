import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '../../src/shared/api'
import { Updates, type Updater } from '../../src/main/update'

/** electron-updater의 autoUpdater 흉내. 확인을 부르면 시험이 이벤트를 보낸다 */
class FakeUpdater extends EventEmitter {
  autoDownload = false
  autoInstallOnAppQuit = false
  checks = 0
  installs: [boolean | undefined, boolean | undefined][] = []
  /** quitAndInstall이 설치를 시작하지 못할 때(electron-updater는 그 자리에서 error를 보낸다) */
  failInstall = false
  checkForUpdates() {
    this.checks++
    return Promise.resolve(null)
  }
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean) {
    this.installs.push([isSilent, isForceRunAfter])
    if (this.failInstall) this.emit('error', new Error('No update filepath provided'))
  }
}

function setup(installOnQuit = true) {
  const fake = new FakeUpdater()
  const seen: UpdateState[] = []
  const downloaded: [string, string][] = []
  const updates = new Updates(fake as unknown as Updater, {
    installOnQuit,
    onDownloaded: (v, f) => downloaded.push([v, f]),
    onChange: (s) => seen.push(s),
  })
  return { fake, seen, downloaded, updates }
}

const download = (fake: FakeUpdater, version = '0.3.0') => {
  fake.emit('checking-for-update')
  fake.emit('update-available', { version })
  fake.emit('download-progress', { percent: 42.7 })
  fake.emit('update-downloaded', { version, downloadedFile: `/tmp/relay-${version}.exe` })
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('업데이트 버튼의 확인과 설치 (I121)', () => {
  it('뒤에서 받게 하고, 끌 때 설치는 설정대로 둔다', () => {
    expect(setup().fake.autoDownload).toBe(true)
    expect(setup(true).fake.autoInstallOnAppQuit).toBe(true)
    expect(setup(false).fake.autoInstallOnAppQuit).toBe(false)
  })

  it('누르면 바로 확인하고, 확인·받는 중·설치 준비 상태를 차례로 알린다', () => {
    const { fake, seen, downloaded, updates } = setup()
    updates.check()
    expect(fake.checks).toBe(1)
    download(fake)
    expect(seen.map((s) => s.kind)).toEqual([
      'checking',
      'checking',
      'downloading',
      'downloading',
      'ready',
    ])
    expect(seen[3]).toEqual({ kind: 'downloading', version: '0.3.0', percent: 42 })
    expect(updates.current()).toEqual({ kind: 'ready', version: '0.3.0' })
    expect(downloaded).toEqual([['0.3.0', '/tmp/relay-0.3.0.exe']])
  })

  it('새 버전이 없으면 최신, 실패하면 실패를 알리고 다시 누르면 다시 확인한다', () => {
    const { fake, updates } = setup()
    updates.check()
    fake.emit('update-not-available', { version: '0.2.0' })
    expect(updates.current()).toEqual({ kind: 'latest' })
    updates.check()
    fake.emit('error', new Error('net::ERR_INTERNET_DISCONNECTED'))
    expect(updates.current()).toEqual({ kind: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' })
    updates.check()
    expect(fake.checks).toBe(3)
  })

  it('확인·받는 중이거나 이미 받았으면 다시 확인하지 않는다', () => {
    const { fake, updates } = setup()
    updates.check()
    updates.check()
    fake.emit('update-available', { version: '0.3.0' })
    updates.check()
    expect(fake.checks).toBe(1)
    fake.emit('update-downloaded', { version: '0.3.0', downloadedFile: '/tmp/r.exe' })
    updates.check()
    expect(fake.checks).toBe(1)
    // 받은 뒤의 오류는 받아 둔 상태를 지우지 않는다
    fake.emit('error', new Error('late'))
    expect(updates.current().kind).toBe('ready')
  })

  it('사람이 설치해야 하는 곳(D379)은 받은 뒤 manual이고 앱에서 설치하지 않는다', () => {
    const { fake, updates } = setup(false)
    download(fake)
    expect(updates.current()).toEqual({ kind: 'manual', version: '0.3.0' })
    expect(updates.install()).toBe(false)
    expect(fake.installs).toEqual([])
  })

  it('받기 전에는 설치하지 않고, 받은 뒤 설치는 조용히 설치하고 다시 켠다', () => {
    const { fake, updates } = setup()
    expect(updates.install()).toBe(false)
    download(fake)
    expect(updates.install()).toBe(true)
    expect(fake.installs).toEqual([[true, true]])
  })

  it('설치를 시작하지 못하면 false이고 받아 둔 상태는 그대로다', () => {
    const { fake, updates } = setup()
    download(fake)
    fake.failInstall = true
    expect(updates.install()).toBe(false)
    expect(updates.current().kind).toBe('ready')
    expect(fake.listenerCount('error')).toBe(1)
  })

  it('30초 뒤 처음 확인하고 4시간마다 확인하며, 받으면 확인을 멈춘다 (I95)', () => {
    vi.useFakeTimers()
    const { fake, updates } = setup()
    updates.start()
    vi.advanceTimersByTime(29_000)
    expect(fake.checks).toBe(0)
    vi.advanceTimersByTime(1_000)
    expect(fake.checks).toBe(1)
    fake.emit('update-not-available', {})
    vi.advanceTimersByTime(4 * 60 * 60 * 1000)
    expect(fake.checks).toBe(2)
    download(fake)
    vi.advanceTimersByTime(8 * 60 * 60 * 1000)
    expect(fake.checks).toBe(2)
  })
})
