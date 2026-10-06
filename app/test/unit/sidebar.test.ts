import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ARCHIVE_GROUP,
  loadCollapsed,
  pruned,
  saveCollapsed,
  sidebarGroups,
  toggled,
} from '../../src/renderer/src/sidebar'
import type { WorkView } from '../../src/shared/views'

function view(projectId: string, workId: string, more: Partial<WorkView> = {}): WorkView {
  return {
    key: `${projectId}/${workId}`,
    projectId,
    workId,
    status: 'active',
    shelved: false,
    ...more,
  } as WorkView
}

describe('사이드바 목록 구성', () => {
  it('프로젝트별로 최근 Work가 앞에 오고, 아카이브로 옮긴 Work는 공통 아카이브에만 있다', () => {
    const g = sidebarGroups([
      view('a', 'w-1'),
      view('a', 'w-3', { status: 'archived', shelved: true }),
      view('b', 'w-2', { status: 'archived', shelved: true }),
      view('a', 'w-4', { status: 'archived' }),
      view('b', 'w-5'),
    ])
    expect(g.byProject.get('a')?.map((w) => w.workId)).toEqual(['w-4', 'w-1'])
    expect(g.byProject.get('b')?.map((w) => w.workId)).toEqual(['w-5'])
    expect(g.archive.map((w) => w.key)).toEqual(['a/w-3', 'b/w-2'])
  })

  it('프로젝트와 아카이브를 따로 접고 편다', () => {
    const none: ReadonlySet<string> = new Set()
    const a = toggled(none, 'a')
    expect([...a]).toEqual(['a'])
    const both = toggled(a, ARCHIVE_GROUP)
    expect([...both].sort()).toEqual([ARCHIVE_GROUP, 'a'].sort())
    expect([...toggled(both, 'a')]).toEqual([ARCHIVE_GROUP])
    expect([...none]).toEqual([])
  })

  it('접은 상태에서 등록되지 않은 프로젝트를 지우고 아카이브는 둔다', () => {
    const c: ReadonlySet<string> = new Set(['a', 'gone', ARCHIVE_GROUP])
    expect([...pruned(c, ['a', 'b'])].sort()).toEqual([ARCHIVE_GROUP, 'a'].sort())
    expect(pruned(c, ['a', 'gone'])).toBe(c)
  })
})

/** 브라우저 저장소 대신 Map을 쓴다. [단위] 시험은 node에서 돌아 localStorage가 없다 */
function fakeStorage(): Map<string, string> {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v)
    },
  })
  return data
}

describe('접은 상태 저장', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('저장한 접은 프로젝트와 아카이브를 다시 켜도 읽는다', () => {
    fakeStorage()
    expect([...loadCollapsed()]).toEqual([])
    saveCollapsed(new Set(['a', ARCHIVE_GROUP]))
    expect([...loadCollapsed()].sort()).toEqual([ARCHIVE_GROUP, 'a'].sort())
  })

  it('깨진 값이면 모두 펴고, 문자열 아닌 항목은 버린다', () => {
    const data = fakeStorage()
    saveCollapsed(new Set(['a']))
    expect(data.size).toBe(1)
    const key = [...data.keys()][0] ?? ''
    for (const broken of ['{', '{"a":1}', '"a"']) {
      data.set(key, broken)
      expect([...loadCollapsed()]).toEqual([])
    }
    data.set(key, '["a",1,null,"b"]')
    expect([...loadCollapsed()]).toEqual(['a', 'b'])
  })

  it('저장소를 쓸 수 없으면 모두 펴고, 저장은 조용히 넘어간다', () => {
    const denied = () => {
      throw new Error('denied')
    }
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied })
    expect([...loadCollapsed()]).toEqual([])
    expect(() => saveCollapsed(new Set(['a']))).not.toThrow()
  })
})
