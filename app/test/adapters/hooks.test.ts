// [어댑터] 훅 서버 (I13): 토큰으로 task를 가리고, 틀린 요청은 무시하고, Stop 응답을 돌려준다.
import { afterEach, describe, expect, it } from 'vitest'
import { HookServer, type HookRequest } from '../../src/adapters/hooks'

let server: HookServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

async function post(port: number, url: string, body: unknown, token?: string) {
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: res.status, text: await res.text() }
}

describe('[어댑터] 훅 서버 (I13)', () => {
  it('127.0.0.1 임의 포트에 뜨고, 토큰과 URL의 task id가 맞는 요청만 넘긴다', async () => {
    server = new HookServer()
    const port = await server.listen()
    expect(port).toBeGreaterThan(0)
    const seen: HookRequest[] = []
    server.register('tok-a', 't-01', async (req) => {
      seen.push(req)
      return null
    })

    const ok = await post(
      port,
      '/hook/t-01/UserPromptSubmit',
      { permission_mode: 'bypassPermissions' },
      'tok-a',
    )
    expect(ok).toEqual({ status: 200, text: '' })
    expect(seen).toEqual([
      { taskId: 't-01', event: 'UserPromptSubmit', body: { permission_mode: 'bypassPermissions' } },
    ])

    // 토큰이 없거나 틀리거나, 다른 task의 URL이면 무시한다
    expect((await post(port, '/hook/t-01/Stop', {})).status).toBe(403)
    expect((await post(port, '/hook/t-01/Stop', {}, 'tok-b')).status).toBe(403)
    expect((await post(port, '/hook/t-02/Stop', {}, 'tok-a')).status).toBe(403)
    // 모르는 이벤트와 경로
    expect((await post(port, '/hook/t-01/Other', {}, 'tok-a')).status).toBe(403)
    expect((await post(port, '/other', {}, 'tok-a')).status).toBe(404)
    expect((await fetch(`http://127.0.0.1:${port}/hook/t-01/Stop`)).status).toBe(404)
    expect(seen).toHaveLength(1)
  })

  it('handler의 응답을 JSON 본문으로 돌려준다 (Stop 되돌림, S2)', async () => {
    server = new HookServer()
    const port = await server.listen()
    server.register('tok', 't-03', async (req) =>
      req.event === 'Stop' ? { decision: 'block', reason: '형식 오류' } : null,
    )
    const r = await post(port, '/hook/t-03/Stop', { stop_hook_active: false }, 'tok')
    expect(r.status).toBe(200)
    expect(JSON.parse(r.text)).toEqual({ decision: 'block', reason: '형식 오류' })
  })

  it('처리가 실패해도 CLI를 막지 않는다: 빈 본문(결정 없음)으로 답한다', async () => {
    server = new HookServer()
    const port = await server.listen()
    server.register('tok', 't-01', async () => {
      throw new Error('처리 실패')
    })
    const errors: unknown[] = []
    const original = console.error
    console.error = (...args: unknown[]) => errors.push(args)
    try {
      expect(await post(port, '/hook/t-01/Stop', {}, 'tok')).toEqual({ status: 200, text: '' })
    } finally {
      console.error = original
    }
    expect(errors).toHaveLength(1)
    // JSON이 아닌 본문은 받지 않는다
    expect((await post(port, '/hook/t-01/Stop', '{', 'tok')).status).toBe(400)
  })

  it('등록을 지우면 그 토큰은 더 받지 않는다', async () => {
    server = new HookServer()
    const port = await server.listen()
    const off = server.register('tok', 't-01', async () => null)
    expect((await post(port, '/hook/t-01/Stop', {}, 'tok')).status).toBe(200)
    off()
    expect((await post(port, '/hook/t-01/Stop', {}, 'tok')).status).toBe(403)
  })
})
