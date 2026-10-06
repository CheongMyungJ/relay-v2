import { describe, expect, it } from 'vitest'
import { ARCHIVE_GROUP, canShelve, sidebarGroups, toggled } from '../../src/renderer/src/sidebar'
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

  it('보관됐고 아직 옮기지 않은 Work만 아카이브로 옮길 수 있다', () => {
    expect(canShelve(view('a', 'w-1', { status: 'archived' }))).toBe(true)
    expect(canShelve(view('a', 'w-1', { status: 'archived', shelved: true }))).toBe(false)
    for (const status of ['active', 'stopped', 'pr', 'completed', 'abandoned'] as const) {
      expect(canShelve(view('a', 'w-1', { status }))).toBe(false)
    }
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
})
