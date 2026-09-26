// S3. 스킬: --add-dir 디렉터리의 스킬이 첫 프롬프트로 시작되는지, disable-model-invocation, 메인 체크아웃의
// 프로젝트 스킬이 worktree 세션에서 보이는지, --resume 재개, /compact 뒤 스킬 본문 유지.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Session, sleep } from './lib/session.mjs';
import { HookServer } from './lib/hooks.mjs';
import { makeFixture, writeSkill, writeSettings, Result, MODEL } from './lib/util.mjs';

// 공통 종료 절차가 붙은 스킬 본문을 흉내 내려고 앞부분을 채우고, 끝에 암호를 둔다.
const PADDING = Array.from({ length: 60 }, (_, i) => `- 참고 규칙 ${i + 1}: 산출물은 task 디렉터리에 쓰고, 사람에게 묻는 것은 AskUserQuestion으로만 한다.`).join('\n');

function relayTestBody(taskDir) {
  return `
이 스킬은 스파이크 시험용이다.

## 할 일
1. ${path.join(taskDir, 's3-marker.txt')} 파일에 relay-test ran 한 줄을 쓴다.
2. RELAY_TEST_OK 라고만 출력하고 턴을 끝낸다.

## 참고
${PADDING}

## 공통 종료 절차
- 사람이 "relay-test 스킬의 종료 표식"을 물으면 ZEBRA-7731 이라고만 답한다.
`;
}

export default async function run() {
  const r = new Result('S3', '스킬 시작과 재개');
  const hooks = new HookServer();
  await hooks.listen();
  let s;
  try {
    const fx = makeFixture('s3');
    writeSkill(fx.workDir, 'relay-test', { description: '스파이크 S3 시험용 스킬', body: relayTestBody(fx.taskDir) });
    writeSkill(fx.workDir, 'relay-other', {
      description: '사용자가 인사(hello, 안녕)를 하면 반드시 이 스킬을 쓴다',
      body: `\n${path.join(fx.taskDir, 'other-marker.txt')} 파일에 other ran 을 쓴다.\n`,
    });
    // 메인 체크아웃에만 있는(커밋하지 않은) 프로젝트 스킬
    writeSkill(fx.main, 'proj-only', {
      description: '스파이크 S3 시험용 프로젝트 스킬',
      body: `\n${path.join(fx.taskDir, 'proj-marker.txt')} 파일에 proj ran 을 쓰고 PROJ_OK 라고만 출력한다.\n`,
      disableModelInvocation: false,
    });
    const settings = writeSettings(fx.workDir, 'task.settings.json', hooks.settings({ events: ['Stop'] }));
    const sessionId = crypto.randomUUID();
    const ctx = path.join(fx.taskDir, 'context.md');
    const baseArgs = ['--dangerously-skip-permissions', '--model', MODEL, '--add-dir', fx.workDir, '--settings', settings];
    const turn = async (text, timeout = 180000) => {
      const m = hooks.mark();
      if (text) await s.typeLine(text);
      await hooks.waitEvent('Stop', { mark: m, session: s, timeout });
    };

    // 1. 첫 프롬프트로 스킬 시작
    s = new Session({ name: 's3', cwd: fx.worktree, logPath: path.join(fx.base, 'pty.log'), args: [...baseArgs, '--session-id', sessionId, `/relay-test 이 task의 컨텍스트: ${ctx}`] }).start();
    await hooks.waitEvent('Stop', { session: s, timeout: 180000 });
    r.check('--add-dir 디렉터리의 스킬이 첫 프롬프트로 시작됨', fs.existsSync(path.join(fx.taskDir, 's3-marker.txt')), s.screen());

    // 2. disable-model-invocation: 에이전트가 relay-other를 스스로 부르지 않음
    await turn('안녕! hello! 인사에 짧게 답해 줘.');
    r.check('disable-model-invocation 스킬을 에이전트가 스스로 부르지 않음', !fs.existsSync(path.join(fx.taskDir, 'other-marker.txt')));

    // 3. 메인 체크아웃에만 있는 프로젝트 스킬이 worktree 세션에서 보이는지 (D32의 전제, 관찰)
    await turn('/proj-only');
    r.observe('메인 체크아웃에만 둔 프로젝트 스킬이 worktree 세션에서 실행됨', fs.existsSync(path.join(fx.taskDir, 'proj-marker.txt')));
    r.observe('/proj-only 뒤 화면', s.screen());

    // 4. --resume
    await turn("기억해 둬: 내 암호는 BANANA42 야. '알겠음'이라고만 답해.");
    await s.typeLine('/exit');
    await s.waitExit(30000).catch(() => s.kill());
    s = new Session({ name: 's3-resume', cwd: fx.worktree, logPath: path.join(fx.base, 'pty-resume.log'), args: [...baseArgs, '--resume', sessionId] }).start();
    await s.waitReady();
    await turn('내 암호가 뭐였지? 암호만 답해.');
    r.check('--resume으로 대화가 이어짐', /BANANA42/.test(s.fullText()), s.screen());

    // 5. /compact 뒤 스킬 본문(끝부분의 종료 절차) 유지
    await s.typeLine('/compact');
    await sleep(5000);
    await s.waitReady({ timeout: 300000 });
    await turn('relay-test 스킬의 종료 표식이 뭐지? 표식만 답해.');
    r.check('/compact 뒤에도 스킬 끝부분(종료 절차)을 따름', /ZEBRA-7731/.test(s.screen()), s.screen());
  } catch (e) {
    r.error(e);
  } finally {
    s?.kill();
    await hooks.close();
    r.save();
  }
  return r;
}
