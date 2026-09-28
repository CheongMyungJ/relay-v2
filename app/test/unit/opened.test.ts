import { describe, expect, it } from 'vitest'
import { withOpened } from '../../src/renderer/src/opened'

describe('터미널을 만드는 Work (D143)', () => {
  it('고른 Work를 더한다. 이미 있거나 고른 것이 없으면 같은 집합을 돌려준다', () => {
    const none: ReadonlySet<string> = new Set()
    const a = withOpened(none, 'p/w-1')
    expect([...a]).toEqual(['p/w-1'])
    expect(withOpened(a, 'p/w-1')).toBe(a)
    expect(withOpened(a, null)).toBe(a)
    expect([...withOpened(a, 'p/w-2')]).toEqual(['p/w-1', 'p/w-2'])
  })
})
