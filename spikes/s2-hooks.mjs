// S2. HTTP 훅: 설계에서 쓰는 신호가 모두 오는지, Stop 되돌림, 앱(서버)이 꺼졌을 때 세션이 계속되는지.
import path from 'node:path';
import crypto from 'node:crypto';
import { Session, sleep } from './lib/session.mjs';
import { HookServer } from './lib/hooks.mjs';
import { makeFixture, writeSettings, Result, MODEL } from './lib/util.mjs';

export default async function run() {
  const r = new Result('S2', 'HTTP 훅');
  const hooks = new HookServer();
  const port = await hooks.listen();
  let s;
  try {
    const fx = makeFixture('s2');
    const settings = writeSettings(
      fx.workDir,
      'task.settings.json',
      hooks.settings({ matchers: { PreToolUse: 'AskUserQuestion', PostToolUse: 'AskUserQuestion' } }),
    );
    s = new Session({
      name: 's2',
      cwd: fx.worktree,
      logPath: path.join(fx.base, 'pty.log'),
      args: ['--dangerously-skip-permissions', '--model', MODEL, '--session-id', crypto.randomUUID(), '--settings', settings, "READY 라고만 출력하고 턴을 끝내."],
    }).start();

    // 1. 첫 프롬프트 → UserPromptSubmit, Stop
    await hooks.waitEvent('Stop', { session: s, timeout: 180000 });
    r.check('UserPromptSubmit 훅이 옴', hooks.count('UserPromptSubmit') >= 1);
    r.check('Stop 훅이 옴', hooks.count('Stop') >= 1);

    // 2. AskUserQuestion → PreToolUse, (답) → PostToolUse
    let m = hooks.mark();
    await s.typeLine("AskUserQuestion 도구로 질문을 하나 해 줘. 질문: '색을 고르세요', 선택지: '빨강', '파랑'. 답을 받으면 '선택: <답>'이라고만 출력하고 턴을 끝내.");
    try {
      await hooks.waitEvent('PreToolUse', { mark: m, session: s, timeout: 180000 });
      r.check('PreToolUse(AskUserQuestion) 훅이 옴', true);
      await sleep(2000);
      r.observe('질문 화면', s.screen());
      for (let i = 0; i < 4 && hooks.since(m, 'PostToolUse').length === 0; i++) {
        s.write('\r');
        await sleep(3000);
      }
      await hooks.waitEvent('PostToolUse', { mark: m, session: s, timeout: 60000 });
      r.check('PostToolUse(AskUserQuestion) 훅이 옴', true);
      await hooks.waitEvent('Stop', { mark: m, session: s, timeout: 120000 });
    } catch (e) {
      r.check('AskUserQuestion 훅 흐름', false, e.message);
    }
    r.observe('Notification 훅(지금까지)', hooks.events.filter((e) => e.event === 'Notification').map((e) => e.body.notification_type || e.body.message));

    // 3. Stop 되돌림 2회
    m = hooks.mark();
    hooks.blockStops = 2;
    hooks.blockReason = "형식 오류 시험: handoff.md가 없다. 'RETRY-OK'라고 출력하고 턴을 끝내라.";
    await s.typeLine("'PING'이라고만 출력하고 턴을 끝내.");
    try {
      await hooks.waitEvent('Stop', { mark: m, n: 3, session: s, timeout: 240000 });
      const stops = hooks.since(m, 'Stop');
      r.check('Stop 되돌림 뒤 에이전트가 이어서 작업함(Stop 3번)', stops.length >= 3);
      r.observe('되돌림 뒤 Stop의 stop_hook_active', stops.map((e) => e.body.stop_hook_active));
      r.check('되돌림 이유를 받아 출력함', /RETRY-OK/.test(s.fullText()));
    } catch (e) {
      r.check('Stop 되돌림', false, e.message);
    }

    // 4. 서버가 꺼져 있을 때
    await hooks.close();
    await s.typeLine("'DOWN-TEST'라고만 출력하고 턴을 끝내.");
    await sleep(3000);
    await s.waitIdle({ quietMs: 5000, timeout: 120000 });
    r.check('훅 서버가 꺼져도 세션이 계속됨', s.alive() && /DOWN-TEST/.test(s.fullText()), s.screen());
    r.observe('서버가 꺼졌을 때 화면', s.screen());
    await hooks.listen(port);

    // 5. /exit → SessionEnd
    m = hooks.mark();
    await s.typeLine('/exit');
    try {
      await hooks.waitEvent('SessionEnd', { mark: m, timeout: 30000 });
      r.check('SessionEnd 훅이 옴', true);
    } catch (e) {
      r.check('SessionEnd 훅이 옴', false, e.message);
    }

    // 6. 훅 본문의 키
    const keys = {};
    for (const e of hooks.events) keys[e.event] = [...new Set([...(keys[e.event] || []), ...Object.keys(e.body)])];
    r.observe('이벤트별 본문 키', keys);
  } catch (e) {
    r.error(e);
  } finally {
    s?.kill();
    try {
      await hooks.close();
    } catch {}
    r.save();
  }
  return r;
}
