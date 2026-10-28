// [단위] relay MCP의 도구 정의 (D518, D525)와 변경 파일 읽기. 상태 요약(workSummary)은 실제 스냅샷으로 [흐름] mcp.test.ts가 본다
import { describe, expect, it } from 'vitest'
import {
  MCP_TOOLS,
  READ_TOOLS,
  WAIT_DEFAULT_SEC,
  WAIT_MAX_SEC,
  changedFiles,
} from '../../src/core/mcp'

describe('[단위] relay MCP 도구 정의 (D518)', () => {
  it('이름이 겹치지 않고 조회 도구는 모두 정의에 있다', () => {
    const names = MCP_TOOLS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const r of READ_TOOLS) expect(names).toContain(r)
  })

  it('도구마다 객체 스키마이고 required는 properties에 있다', () => {
    for (const t of MCP_TOOLS) {
      expect(t.inputSchema['type'], t.name).toBe('object')
      const props = Object.keys((t.inputSchema['properties'] as object | undefined) ?? {})
      for (const r of (t.inputSchema['required'] as string[] | undefined) ?? [])
        expect(props, `${t.name}.${r}`).toContain(r)
    }
  })

  it('wait의 설명이 앱의 제한 시간과 같다 (D525)', () => {
    const wait = MCP_TOOLS.find((t) => t.name === 'wait')
    const props = wait?.inputSchema['properties'] as Record<string, { description: string }>
    expect(props['timeout_sec']?.description).toContain(`기본 ${WAIT_DEFAULT_SEC}`)
    expect(props['timeout_sec']?.description).toContain(`최대 ${WAIT_MAX_SEC}`)
  })

  it('넣지 않기로 한 도구(등록 해제, 머지, 기록 지우기)가 없다 (D518)', () => {
    const names = MCP_TOOLS.map((t) => t.name).join(' ')
    expect(names).not.toMatch(/merge|remove|delete|unregister|clean/)
  })
})

describe('[단위] diff의 바뀐 파일', () => {
  it('diff --git 줄의 b 쪽 경로를 차례로 한 번씩 돌려준다', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      'diff --git a/old.md b/new.md',
      'diff --git a/src/a.ts b/src/a.ts',
    ].join('\n')
    expect(changedFiles(diff)).toEqual(['src/a.ts', 'new.md'])
    expect(changedFiles('')).toEqual([])
  })
})
