// Claude Code의 HTTP 훅을 받는 로컬 서버. 받은 요청을 모두 기록한다.
// Stop에 {"decision":"block"}으로 응답해 되돌림을 시험할 수 있다(S2).
import http from 'node:http';
import { sleep } from './session.mjs';

export const EVENTS = ['UserPromptSubmit', 'Stop', 'Notification', 'SessionEnd', 'PreToolUse', 'PostToolUse'];

export class HookServer {
  constructor() {
    this.events = []; // { event, body, at }
    this.blockStops = 0; // 남은 Stop 되돌림 횟수
    this.blockReason = '';
  }

  async listen(port = 0) {
    this.server = http.createServer((req, res) => {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        let body = {};
        try {
          body = JSON.parse(data || '{}');
        } catch {
          body = { _raw: data };
        }
        const event = body.hook_event_name || req.url.replace(/^\//, '');
        this.events.push({ event, body, at: Date.now() });
        let out = '';
        if (event === 'Stop' && this.blockStops > 0) {
          this.blockStops--;
          out = JSON.stringify({ decision: 'block', reason: this.blockReason });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(out);
      });
    });
    await new Promise((r) => this.server.listen(port, '127.0.0.1', r));
    this.port = this.server.address().port;
    return this.port;
  }

  async close() {
    await new Promise((r) => this.server.close(r));
    this.server.closeAllConnections?.();
  }

  // 훅 설정. matchers로 도구를 제한할 이벤트를 준다(예: { PreToolUse: 'AskUserQuestion' }).
  settings({ events = EVENTS, matchers = {}, extra = {} } = {}) {
    const hooks = {};
    for (const ev of events) {
      const entry = { hooks: [{ type: 'http', url: `http://127.0.0.1:${this.port}/${ev}`, timeout: 30 }] };
      if (matchers[ev]) entry.matcher = matchers[ev];
      hooks[ev] = [entry];
    }
    return { hooks, ...extra };
  }

  count(event, pred = () => true) {
    return this.events.filter((e) => e.event === event && pred(e.body)).length;
  }

  mark() {
    return this.events.length;
  }

  since(mark, event) {
    return this.events.slice(mark).filter((e) => !event || e.event === event);
  }

  // mark 이후 event가 n번 올 때까지 기다린다. session이 있으면 기다리는 동안 첫 실행 창을 처리한다.
  async waitEvent(event, { mark = 0, n = 1, timeout = 120000, pred = () => true, session } = {}) {
    const ok = () => this.events.slice(mark).filter((e) => e.event === event && pred(e.body)).length >= n;
    if (session) return session.waitUntil(ok, { timeout, label: `hook ${event} x${n}` });
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (ok()) return true;
      await sleep(250);
    }
    throw new Error(`timeout waiting for hook ${event} x${n}`);
  }
}
