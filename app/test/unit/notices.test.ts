import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_USER_MODEL_ID, KEEP_NOTICES, keepNotice } from '../../src/main/notices'

class FakeNotice {
  private readonly listeners = new Map<string, (() => void)[]>()
  on(event: string, l: () => void): this {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), l])
    return this
  }
  emit(event: string): void {
    for (const l of this.listeners.get(event) ?? []) l()
  }
}

describe('OS 알림 (D81, D142)', () => {
  it('눌리거나 실패할 때까지 붙잡아 둔다. 알림 센터로 옮겨 가며 닫혀도 놓지 않는다', () => {
    const kept = new Set<FakeNotice>()
    const a = keepNotice(kept, new FakeNotice())
    const b = keepNotice(kept, new FakeNotice())
    a.emit('close')
    expect(kept.has(a)).toBe(true)
    a.emit('click')
    b.emit('failed')
    expect(kept.size).toBe(0)
  })

  it('붙잡아 두는 알림은 최근 것부터 정해진 수까지다', () => {
    const kept = new Set<FakeNotice>()
    const first = keepNotice(kept, new FakeNotice())
    for (let i = 0; i < KEEP_NOTICES; i++) keepNotice(kept, new FakeNotice())
    expect(kept.size).toBe(KEEP_NOTICES)
    expect(kept.has(first)).toBe(false)
  })

  it('Windows 앱 ID는 설치 파일의 appId와 같다', () => {
    const yml = fs.readFileSync(path.resolve(__dirname, '../../electron-builder.yml'), 'utf8')
    expect(yml).toMatch(new RegExp(`^appId: ${APP_USER_MODEL_ID.replace(/\./g, '\\.')}$`, 'm'))
  })
})
