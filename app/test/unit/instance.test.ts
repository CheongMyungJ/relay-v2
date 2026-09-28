import { describe, expect, it, vi } from 'vitest'
import { holdSingleInstance, type InstanceApp } from '../../src/main/instance'

function fakeApp(locked: boolean) {
  const listeners = new Map<string, () => void>()
  const app: InstanceApp = {
    requestSingleInstanceLock: () => locked,
    on: (event, listener) => {
      listeners.set(event, listener)
    },
    exit: vi.fn(),
  }
  return { app, listeners }
}

describe('앱은 하나만 켠다 (D133)', () => {
  it('처음 켠 앱은 잠금을 잡고, 두 번째로 켜면 창을 앞으로 가져온다', () => {
    const { app, listeners } = fakeApp(true)
    const focus = vi.fn()
    expect(holdSingleInstance(app, focus)).toBe(true)
    expect(app.exit).not.toHaveBeenCalled()
    listeners.get('second-instance')?.()
    expect(focus).toHaveBeenCalledOnce()
  })

  it('두 번째로 켠 앱은 relay를 열지 않고 바로 끝난다', () => {
    const { app, listeners } = fakeApp(false)
    const focus = vi.fn()
    expect(holdSingleInstance(app, focus)).toBe(false)
    expect(app.exit).toHaveBeenCalledWith(0)
    expect(listeners.size).toBe(0)
  })
})
