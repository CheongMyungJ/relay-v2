// S5. 첫 실행 창: 권한 확인 끈 모드 경고와 폴더 신뢰 창이 언제 뜨는지, 창을 수락한 뒤 첫 프롬프트가 실행되는지.
// 깨끗한 사용자 프로필(러너의 첫 실행)에서 가장 먼저 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Session } from './lib/session.mjs';
import { HookServer } from './lib/hooks.mjs';
import { makeFixture, writeSkill, writeSettings, git, Result, MODEL } from './lib/util.mjs';

const MARK_SKILL = `
이 스킬은 스파이크 시험용이다. 다음만 하고 턴을 끝낸다.
1. 첫 프롬프트에 적힌 context.md 경로와 같은 디렉터리에 marker.txt 파일을 만들고 내용으로 S5-OK 한 줄을 쓴다.
2. S5-DONE 이라고만 출력한다.
`;

async function runOnce(label, fx, cwd, hooks) {
  const settings = writeSettings(fx.workDir, `settings-${label}.json`, hooks.settings({ events: ['Stop'] }));
  const ctx = path.join(fx.taskDir, 'context.md');
  const s = new Session({
    name: `s5-${label}`,
    cwd,
    logPath: path.join(fx.base, `pty-${label}.log`),
    args: [
      '--dangerously-skip-permissions',
      '--model', MODEL,
      '--session-id', crypto.randomUUID(),
      '--add-dir', fx.workDir,
      '--settings', settings,
      `/relay-mark 이 task의 컨텍스트: ${ctx}`,
    ],
  }).start();
  const mark = hooks.mark();
  let stopped = true;
  try {
    await hooks.waitEvent('Stop', { mark, session: s, timeout: 180000 });
  } catch (e) {
    stopped = false;
  }
  const marker = path.join(fx.taskDir, 'marker.txt');
  const ran = fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').includes('S5-OK');
  const out = { dialogs: s.dialogs.map((d) => d.name), dialogScreens: s.dialogs.map((d) => d.screen), stopped, firstPromptRan: ran, finalScreen: s.screen() };
  s.kill();
  if (fs.existsSync(marker)) fs.rmSync(marker);
  return out;
}

export default async function run() {
  const r = new Result('S5', '첫 실행 창');
  const hooks = new HookServer();
  await hooks.listen();
  try {
    const fx = makeFixture('s5');
    writeSkill(fx.workDir, 'relay-mark', { description: '스파이크 S5 시험용 스킬', body: MARK_SKILL });

    const first = await runOnce('first', fx, fx.worktree, hooks);
    r.observe('첫 실행에서 뜬 창(순서대로)', first.dialogs);
    for (const [i, scr] of first.dialogScreens.entries()) r.observe(`첫 실행 창 ${i + 1} 화면`, scr);
    r.check('첫 실행: 창을 수락한 뒤 첫 프롬프트(스킬)가 실행됨', first.firstPromptRan, first.firstPromptRan ? '' : first.finalScreen);

    const again = await runOnce('same-worktree', fx, fx.worktree, hooks);
    r.observe('같은 worktree 두 번째 실행에서 뜬 창', again.dialogs);
    r.check('같은 worktree 두 번째 실행: 첫 프롬프트 실행', again.firstPromptRan, again.finalScreen);

    const wt2 = path.join(fx.base, 'wt2');
    git(fx.main, 'worktree', 'add', '-b', `${fx.branch}-2`, wt2);
    const second = await runOnce('new-worktree', fx, wt2, hooks);
    r.observe('새 worktree(두 번째 Work)에서 뜬 창', second.dialogs);
    for (const [i, scr] of second.dialogScreens.entries()) r.observe(`새 worktree 창 ${i + 1} 화면`, scr);
    r.check('새 worktree: 첫 프롬프트 실행', second.firstPromptRan, second.finalScreen);
    r.observe('폴더 신뢰 창이 새 worktree마다 뜸', second.dialogs.includes('folder_trust'));
  } catch (e) {
    r.error(e);
  } finally {
    await hooks.close();
    r.save();
  }
  return r;
}
