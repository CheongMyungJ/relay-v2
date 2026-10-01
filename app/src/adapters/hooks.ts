// 훅 HTTP 서버 (I13, D20). 앱 시작 때 127.0.0.1 임의 포트에 하나 띄운다.
// URL은 /hook/<task-id>/<Event>이고, task마다 무작위 토큰을 Authorization 머리글로 받는다.
// task id는 Work 안에서만 겹치지 않으므로 토큰으로 task를 찾고 URL의 task id와 맞춰 본다.
// 토큰이 틀린 요청은 무시한다. 응답 본문은 명령 훅과 같은 JSON 출력 형식이고, 비어 있으면 결정이 없다
// (Claude Code 문서 hooks). Stop 되돌림은 {"decision":"block","reason":…}다 (S2, D21).
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { HOOK_EVENTS, type HookEvent } from '../core/settings'
import { CODEX_HOOK_EVENTS, type CodexHookEvent } from '../core/codex'

export interface HookRequest {
  taskId: string
  event: HookEvent | CodexHookEvent
  /** 훅 본문 (session_id, cwd, permission_mode, hook_event_name, 이벤트별 필드) */
  body: Record<string, unknown>
}

/** 응답 본문. null이면 빈 본문으로 답한다 */
export type HookReply = Record<string, unknown> | null

export type HookHandler = (req: HookRequest) => Promise<HookReply>
export type QuestionHandler = (
  body: Record<string, unknown>,
  signal: AbortSignal,
) => Promise<HookReply>
export interface HookRouteOptions {
  question?: QuestionHandler
  /** Codex 도구 보호 훅은 main의 오류를 빈 성공으로 번역하지 않는다. */
  failClosed?: boolean
}

const MAX_BODY = 8 * 1024 * 1024
const HOOK_PATH = /^\/hook\/([^/?#]+)\/([^/?#]+)$/
const QUESTION_PATH = /^\/question\/([^/?#]+)$/

function isHookEvent(s: string): s is HookRequest['event'] {
  return (
    (HOOK_EVENTS as readonly string[]).includes(s) ||
    (CODEX_HOOK_EVENTS as readonly string[]).includes(s)
  )
}

export class HookServer {
  private server: http.Server | null = null
  private readonly routes = new Map<
    string,
    {
      taskId: string
      handler: HookHandler
      options: HookRouteOptions
      pending: Set<AbortController>
    }
  >()
  port = 0

  /** 서버를 띄우고 포트를 돌려준다 */
  async listen(): Promise<number> {
    const server = http.createServer((req, res) => void this.handle(req, res))
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })
    this.server = server
    this.port = (server.address() as AddressInfo).port
    return this.port
  }

  /** task의 토큰을 등록한다. 돌려준 함수를 부르면 지운다 */
  register(
    token: string,
    taskId: string,
    handler: HookHandler,
    options: HookRouteOptions = {},
  ): () => void {
    const pending = new Set<AbortController>()
    this.routes.set(token, { taskId, handler, options, pending })
    return () => {
      if (this.routes.get(token)?.handler === handler) {
        this.routes.delete(token)
        for (const c of pending) c.abort()
      }
    }
  }

  async close(): Promise<void> {
    const server = this.server
    this.server = null
    for (const route of this.routes.values()) for (const c of route.pending) c.abort()
    this.routes.clear()
    if (!server) return
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const m = req.method === 'POST' ? HOOK_PATH.exec(req.url ?? '') : null
    const q = req.method === 'POST' ? QUESTION_PATH.exec(req.url ?? '') : null
    if (!m && !q) return end(res, 404)
    let taskId: string
    try {
      taskId = decodeURIComponent(m?.[1] ?? q?.[1] ?? '')
    } catch {
      return end(res, 400)
    }
    const event = m?.[2] ?? ''
    const token = /^Bearer\s+(\S+)$/.exec(req.headers.authorization ?? '')?.[1]
    const route = token ? this.routes.get(token) : undefined
    if (!route || route.taskId !== taskId || (m ? !isHookEvent(event) : !route.options.question))
      return end(res, 403)

    let body: Record<string, unknown>
    try {
      body = await readJsonBody(req)
    } catch {
      return end(res, 400)
    }
    let reply: HookReply = null
    const controller = new AbortController()
    route.pending.add(controller)
    const closed = () => controller.abort()
    res.once('close', closed)
    try {
      reply =
        q && route.options.question
          ? await route.options.question(body, controller.signal)
          : isHookEvent(event)
            ? await route.handler({ taskId, event, body })
            : null
    } catch (e) {
      // 앱의 처리 오류로 CLI를 막지 않는다. 빈 본문은 결정 없음이다.
      console.error(`훅 처리 실패 (${taskId} ${event}):`, e)
      if (q) reply = { cancelled: true, reason: e instanceof Error ? e.message : String(e) }
      else if (route.options.failClosed && event === 'PreToolUse')
        reply = {
          hookSpecificOutput: {
            hookEventName: event,
            permissionDecision: 'deny',
            permissionDecisionReason: 'relay 도구 보호 검사에 실패했습니다.',
          },
        }
    } finally {
      res.removeListener('close', closed)
      route.pending.delete(controller)
    }
    if (res.destroyed) return
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(reply ? JSON.stringify(reply) : '')
  }
}

function end(res: http.ServerResponse, status: number): void {
  res.writeHead(status)
  res.end()
}

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        reject(new Error('본문이 너무 큼'))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('error', reject)
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      try {
        const data: unknown = text.trim() ? JSON.parse(text) : {}
        resolve(typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {})
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)))
      }
    })
  })
}
