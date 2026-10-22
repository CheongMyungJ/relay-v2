// 가짜 Anthropic API(S8). Claude Code가 보내는 요청 본문을 그대로 모으고, 모든 메시지 요청에 "ok" 한 마디로 답한다.
// 모델을 부르지 않으므로 인증이 필요 없다. ANTHROPIC_BASE_URL을 이 서버로 준다.
import http from 'node:http';
import zlib from 'node:zlib';
import { sleep } from './session.mjs';

export class MockApi {
  constructor() {
    this.requests = []; // { at, url, body }
  }

  listen() {
    this.server = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => this.answer(req, res, Buffer.concat(chunks)));
    });
    return new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
  }

  get url() {
    return `http://127.0.0.1:${this.server.address().port}`;
  }

  answer(req, res, raw) {
    const buf = req.headers['content-encoding'] === 'gzip' && raw.length ? zlib.gunzipSync(raw) : raw;
    let body = {};
    try {
      body = buf.length ? JSON.parse(buf) : {};
    } catch {}
    const json = (obj) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (!req.url.startsWith('/v1/messages')) return json({});
    if (req.url.startsWith('/v1/messages/count_tokens')) return json({ input_tokens: 10 });
    this.requests.push({ at: Date.now(), url: req.url, body });
    const message = { id: 'msg_spike', type: 'message', role: 'assistant', model: body.model, stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } };
    if (!body.stream) return json({ ...message, content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    ev('message_start', { message: { ...message, content: [] } });
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'ok' } });
    ev('content_block_stop', { index: 0 });
    ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } });
    ev('message_stop', {});
    res.end();
  }

  mark() {
    return this.requests.length;
  }

  // 대화의 요청(도구가 실린 것). 대화 제목 만들기 같은 곁가지 호출은 도구가 없다.
  mains(from = 0) {
    return this.requests.slice(from).filter((r) => (r.body.tools ?? []).length > 0);
  }

  async waitMain(from, session, timeout = 120000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const m = this.mains(from);
      if (m.length) return m[0].body;
      if (!session.alive()) throw new Error(`세션이 요청 전에 끝남 ${JSON.stringify(session.exit)}`);
      await sleep(250);
    }
    throw new Error(`요청을 기다리다 시간 초과\n${session.screen()}`);
  }

  close() {
    return new Promise((resolve) => this.server.close(resolve));
  }
}

// 시스템 프롬프트의 글(블록을 이어 붙임)과 메시지 전체의 글
export function systemText(body) {
  const s = body.system ?? [];
  return (Array.isArray(s) ? s : [{ text: s }]).map((b) => b.text ?? '').join('\n');
}

export function messagesText(body) {
  return JSON.stringify(body.messages ?? []);
}
