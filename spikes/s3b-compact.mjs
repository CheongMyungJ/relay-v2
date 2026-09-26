// S3b. /compact 뒤 스킬 본문 유지 (D31): 짧은 스킬(1,000토큰 안쪽)로 확인한다.
// S3에서 긴 스킬의 끝부분을 잊은 원인이 "5,000토큰 초과"인지 "압축 뒤 스킬이 다시 붙지 않음"인지 가른다.
// 압축 전에는 표식을 묻지 않는다(대화 요약에 들어가지 않게).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Session, sleep } from './lib/session.mjs';
import { HookServer } from './lib/hooks.mjs';
import { makeFixture, writeSkill, writeSettings, Result, MODEL } from './lib/util.mjs';

function shortBody(taskDir) {
  return `
이 스킬은 스파이크 시험용이다.

## 할 일
1. ${path.join(taskDir, 's3b-marker.txt')} 파일에 started 한 줄을 쓴다.
2. SHORT_OK 라고만 출력하고 턴을 끝낸다.

## 공통 종료 절차
- 사람이 "relay-short 스킬의 종료 표식"을 물으면 KIWI-4410 이라고만 답한다.
`;
}

export default async function run() {
  const r = new Result('S3b', '/compact 뒤 짧은 스킬 본문 유지');
  const hooks = new HookServer();
  await hooks.listen();
  let s;
  try {
    const fx = makeFixture('s3b');
    const body = shortBody(fx.taskDir);
    writeSkill(fx.workDir, 'relay-short', { description: '스파이크 S3b 시험용 스킬', body });
    r.observe('스킬 본문 글자 수', body.length);
    const settings = writeSettings(fx.workDir, 'task.settings.json', hooks.settings({ events: ['Stop'] }));
    const ctx = path.join(fx.taskDir, 'context.md');
    s = new Session({
      name: 's3b',
      cwd: fx.worktree,
      logPath: path.join(fx.base, 'pty.log'),
      args: ['--dangerously-skip-permissions', '--model', MODEL, '--session-id', crypto.randomUUID(), '--add-dir', fx.workDir, '--settings', settings, `/relay-short 이 task의 컨텍스트: ${ctx}`],
    }).start();
    await hooks.waitEvent('Stop', { session: s, timeout: 180000 });
    r.check('짧은 스킬이 시작됨', fs.existsSync(path.join(fx.taskDir, 's3b-marker.txt')), s.screen());

    await s.typeLine('/compact');
    await sleep(5000);
    await s.waitReady({ timeout: 300000 });

    const m = hooks.mark();
    await s.typeLine('relay-short 스킬의 종료 표식이 뭐지? 표식만 답해.');
    await hooks.waitEvent('Stop', { mark: m, session: s, timeout: 180000 });
    r.check('/compact 뒤에도 짧은 스킬의 끝부분(종료 절차)을 따름', /KIWI-4410/.test(s.screen()), s.screen());
  } catch (e) {
    r.error(e);
  } finally {
    s?.kill();
    await hooks.close();
    r.save();
  }
  return r;
}
