// S6. 강제 종료 뒤 재개: [즉시 중단]처럼 프로세스 트리째 끝낸 세션을 같은 옵션과 --resume <세션 id>로 열면
// 대화가 이어지는지 (docs/spikes.md S6, 시나리오 3-4). S3는 /exit로 끝낸 세션만 확인했다.
// 강제 종료는 Windows는 taskkill /T /F, Linux는 프로세스 그룹에 SIGKILL이다(lib/session.mjs forceKill).
// 다시 열 때는 --session-id와 첫 프롬프트를 빼고 나머지 옵션(--dangerously-skip-permissions, --add-dir,
// --settings)을 다시 준다. --settings, --add-dir, 권한 확인 끈 모드는 --resume이 복원하지 않는다
// (Claude Code 문서 sessions "What a resumed session restores").
// 표식은 화면이 아니라 Stop 훅 본문의 last_assistant_message로 본다. 다시 연 화면에는 앞의 대화가 보이기 때문이다.
// 자동 메모리는 끈다(CLAUDE_CODE_DISABLE_AUTO_MEMORY=1). 켜 두면 에이전트가 표식을 메모리 파일에 적고, 다시 연
// 세션이 대화가 아니라 메모리에서 표식을 읽을 수 있다(2026-09-26 첫 실행에서 관찰). 끝에 메모리 파일을 찾아 기록한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Session, sleep } from './lib/session.mjs';
import { HookServer } from './lib/hooks.mjs';
import { makeFixture, writeSkill, writeSettings, Result, MODEL, processTree, survivors } from './lib/util.mjs';

const MARK_1 = 'MANGO-5823';
const MARK_2 = 'PLUM-3071';
// 작업 중 종료에서 에이전트가 실행하는 긴 명령. 이 시간 안에 강제 종료한다.
// `sleep 25` 이상을 첫 명령으로 쓰면 Claude Code가 막을 수 있어(2.1.283 실행 파일의 Bash 도구 검사
// "Blocked: standalone sleep") node로 기다린다.
const LONG_COMMAND = 'node -e "setTimeout(() => {}, 120000)"';
const NO_MEMORY = { CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };

// 설정 폴더의 자동 메모리 파일 중 표식이 든 것 (Claude Code 문서 memory: <설정 폴더>/projects/<project>/memory/)
function memoriesWith(marks) {
  const projects = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
  const found = [];
  for (const p of fs.existsSync(projects) ? fs.readdirSync(projects) : []) {
    const dir = path.join(projects, p, 'memory');
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
      const text = fs.readFileSync(path.join(dir, f), 'utf8');
      if (marks.some((m) => text.includes(m))) found.push(path.join(p, 'memory', f));
    }
  }
  return found;
}

function skillBody() {
  return `
이 스킬은 스파이크 S6 시험용이다.

## 할 일
S6_READY 라고만 출력하고 턴을 끝낸다.
`;
}

// 프로세스 트리를 보기 좋게 줄인다
const brief = (tree) => tree.map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, pgid: p.Pgid, name: p.Name, state: p.State, cmd: p.Cmd }));

export default async function run() {
  const r = new Result('S6', '강제 종료 뒤 재개');
  const hooks = new HookServer();
  await hooks.listen();
  const sessions = [];
  const open = (name, args, logName) => {
    const s = new Session({ name, cwd: fx.worktree, logPath: path.join(fx.base, logName), args, env: NO_MEMORY }).start();
    sessions.push(s);
    return s;
  };
  let fx;
  // 강제 종료하고, 종료 전의 트리와 종료 뒤에 남은 프로세스를 기록한다. 남은 것은 치운다.
  const forceKill = async (s, label) => {
    const before = processTree(s.pid);
    const m = hooks.mark();
    const how = s.forceKill();
    await s.waitExit(30000);
    await sleep(1500);
    const left = survivors(before);
    r.observe(`${label}: 강제 종료 방법`, how);
    r.observe(`${label}: 종료 전 프로세스 트리`, brief(before));
    r.observe(`${label}: 종료 뒤 남은 프로세스`, brief(left));
    r.observe(`${label}: 종료 뒤 받은 훅`, hooks.since(m).map((e) => e.event));
    for (const p of left) {
      try {
        process.kill(p.ProcessId, 'SIGKILL');
      } catch {}
    }
    return { before, left };
  };
  // 한 턴을 보내고 Stop까지 기다린다. Stop 본문의 마지막 답과 그동안 받은 훅을 돌려준다.
  const turn = async (s, text, timeout = 180000) => {
    const m = hooks.mark();
    await s.typeLine(text);
    await hooks.waitEvent('Stop', { mark: m, session: s, timeout });
    const got = hooks.since(m);
    const stop = got.filter((e) => e.event === 'Stop').at(-1);
    return { answer: String(stop?.body?.last_assistant_message ?? ''), hooks: got };
  };

  try {
    fx = makeFixture('s6');
    writeSkill(fx.workDir, 'relay-s6', { description: '스파이크 S6 시험용 스킬', body: skillBody() });
    // 앱과 같은 훅 여섯 가지 (시나리오 2-3). PreToolUse·PostToolUse는 AskUserQuestion만 받는다.
    const settings = writeSettings(
      fx.workDir,
      'task.settings.json',
      hooks.settings({ matchers: { PreToolUse: 'AskUserQuestion', PostToolUse: 'AskUserQuestion' } }),
    );
    const ctx = path.join(fx.taskDir, 'context.md');
    const baseArgs = ['--dangerously-skip-permissions', '--model', MODEL, '--add-dir', fx.workDir, '--settings', settings];
    const startArgs = (id) => [...baseArgs, '--session-id', id, `/relay-s6 이 task의 컨텍스트: ${ctx}`];
    const resumeArgs = (id) => [...baseArgs, '--resume', id];

    // 0. 대화가 없는 세션 (관찰): 첫 프롬프트 없이 띄워 첫 실행 창이 뜨거나 입력을 받을 수 있게 되면
    //    강제 종료한다. 앱에서는 첫 실행 창이 떠 있을 때 [즉시 중단]한 경우에 해당한다.
    {
      const id = crypto.randomUUID();
      const s = open('s6-empty', [...baseArgs, '--session-id', id], 'pty-empty.log');
      let state = '시간 초과';
      const end = Date.now() + 120000;
      while (Date.now() < end && s.alive()) {
        const scr = s.screen();
        if (s.isDialogScreen(scr)) {
          state = '첫 실행 창';
          break;
        }
        if (/for agents|for shortcuts|shift\+tab to cycle/i.test(scr)) {
          state = '입력 대기';
          break;
        }
        await sleep(250);
      }
      await sleep(1500);
      r.observe('0. 대화 없이 강제 종료할 때의 화면', `${state}\n${s.screen()}`);
      await forceKill(s, '0. 대화 없음');
      const again = open('s6-empty-resume', resumeArgs(id), 'pty-empty-resume.log');
      let outcome = '시간 초과';
      try {
        await again.waitUntil(() => !again.alive() || again.isDialogScreen(again.screen()) === false && /for agents|for shortcuts|shift\+tab to cycle/i.test(again.screen()), {
          timeout: 90000,
          label: 'resume(대화 없음)',
        });
        outcome = again.alive() ? '열림(입력 대기)' : `끝남 ${JSON.stringify(again.exit)}`;
      } catch (e) {
        outcome = again.alive() ? `시간 초과: ${e.message.split('\n')[0]}` : `끝남 ${JSON.stringify(again.exit)}`;
      }
      r.observe('0. 대화가 없는 세션 id로 --resume', `${outcome}\n${again.fullText().split('\n').filter((l) => l.trim()).slice(-15).join('\n')}`);
      if (again.alive()) await forceKill(again, '0. 대화 없음 재개');
    }

    // 1. 턴이 끝난 뒤(Stop) 강제 종료하고 다시 연다
    const id = crypto.randomUUID();
    let s = open('s6', startArgs(id), 'pty-1.log');
    await hooks.waitEvent('Stop', { session: s, timeout: 180000 });
    r.check('relay 방식으로 시작한 세션에서 스킬이 끝까지 돎(Stop)', hooks.count('Stop') >= 1, s.screen());
    const first = await turn(s, `기억해 둬: 표식은 ${MARK_1} 이야. '알겠음'이라고만 답해.`);
    r.observe('1. 표식을 준 턴의 답', first.answer);
    const firstSession = hooks.events.find((e) => e.event === 'UserPromptSubmit')?.body ?? {};
    await sleep(500);
    await forceKill(s, '1. 턴이 끝난 뒤');

    let m = hooks.mark();
    let t0 = Date.now();
    s = open('s6-resume-1', resumeArgs(id), 'pty-1-resume.log');
    await s.waitReady({ timeout: 120000 });
    r.observe('1. 다시 열어 입력을 받기까지 걸린 시간(ms)', Date.now() - t0);
    r.observe('1. 다시 연 화면', s.screen());
    const ask1 = await turn(s, '내가 알려 준 표식이 뭐였지? 표식만 답해.');
    r.check('턴이 끝난 뒤 강제 종료한 세션을 --resume으로 열면 표식을 답함', ask1.answer.includes(MARK_1), ask1.answer);
    const resumed = hooks.since(m);
    r.check(
      '다시 연 세션에서 UserPromptSubmit과 Stop 훅이 옴',
      resumed.some((e) => e.event === 'UserPromptSubmit') && resumed.some((e) => e.event === 'Stop'),
      JSON.stringify(resumed.map((e) => e.event)),
    );
    const body = resumed.find((e) => e.event === 'UserPromptSubmit')?.body ?? {};
    r.observe('1. 다시 연 세션의 훅 session_id가 처음과 같음', { first: firstSession.session_id, resumed: body.session_id, given: id, same: body.session_id === id });
    r.observe('1. 다시 연 세션의 transcript_path가 처음과 같음', body.transcript_path === firstSession.transcript_path);
    r.observe('1. 다시 연 세션의 permission_mode', body.permission_mode);

    // 2. 작업 중(턴이 끝나기 전) 강제 종료하고 다시 연다. 에이전트가 긴 명령을 돌리는 동안 끝낸다.
    const progress = path.join(fx.taskDir, 's6-progress.txt');
    m = hooks.mark();
    await s.typeLine(
      `새 표식은 ${MARK_2} 야. 이제 Bash 도구로 두 명령을 차례로, 포그라운드로(run_in_background 없이) 실행해: 먼저 \`echo started > ${progress}\`, 그다음 \`${LONG_COMMAND}\`. 두 명령이 끝나면 '완료'라고만 답해.`,
    );
    await s.waitUntil(() => fs.existsSync(progress), { timeout: 180000, label: 'echo started' });
    // 긴 명령이 시작될 때까지 조금 더 기다린다. 트리에서 node를 찾으면 바로 끝낸다(claude 자신은 node가 아니다).
    const waitEnd = Date.now() + 30000;
    let running = null;
    while (Date.now() < waitEnd && !running) {
      running = processTree(s.pid).find((p) => /^node(\.exe)?$/i.test(p.Name) || (p.Cmd ?? '').includes('setTimeout')) ?? null;
      if (!running) await sleep(500);
    }
    r.observe('2. 강제 종료 때 돌던 긴 명령', running ? brief([running]) : '트리에서 찾지 못함(30초 기다림)');
    const beforeKill = hooks.since(m).map((e) => e.event);
    r.observe('2. 종료 전 이 턴에 받은 훅', beforeKill);
    r.check('턴이 끝나기 전에 강제 종료함(종료 전에 Stop이 오지 않음)', !beforeKill.includes('Stop'), JSON.stringify(beforeKill));
    r.observe('2. 종료 직전 화면', s.screen());
    await forceKill(s, '2. 작업 중');

    m = hooks.mark();
    t0 = Date.now();
    s = open('s6-resume-2', resumeArgs(id), 'pty-2-resume.log');
    let opened = false;
    try {
      await s.waitReady({ timeout: 120000 });
      opened = true;
    } catch (e) {
      r.observe('2. 다시 열기 실패', e.message);
    }
    r.check('작업 중에 강제 종료한 세션도 --resume으로 열림', opened, s.screen());
    if (opened) {
      r.observe('2. 다시 열어 입력을 받기까지 걸린 시간(ms)', Date.now() - t0);
      // 사람이 아무것도 보내지 않았을 때 에이전트가 끊긴 턴을 스스로 잇는지 본다
      await sleep(8000);
      r.observe('2. 다시 연 뒤 입력 없이 받은 훅(스스로 이어서 작업했는가)', hooks.since(m).map((e) => e.event));
      r.observe('2. 다시 연 화면', s.screen());
      const ask2 = await turn(s, '지금까지 내가 알려 준 표식을 모두 말하고, 마지막으로 실행하던 명령이 무엇이었고 어떻게 됐는지 짧게 답해. 명령을 다시 실행하지는 마.');
      r.observe('2. 끊긴 턴에서 남은 것(표식과 명령에 대한 답)', {
        answer: ask2.answer,
        mark1: ask2.answer.includes(MARK_1),
        mark2: ask2.answer.includes(MARK_2),
        sleep: /sleep/i.test(ask2.answer),
      });
      r.check('작업 중 종료 뒤 다시 연 세션도 앞 턴의 표식을 답함', ask2.answer.includes(MARK_1), ask2.answer);
    }
    r.observe('자동 메모리 파일 중 표식이 든 것(없어야 답이 대화에서 나온 것)', memoriesWith([MARK_1, MARK_2]));
  } catch (e) {
    r.error(e);
  } finally {
    for (const s of sessions) s.kill();
    await hooks.close();
    r.save();
  }
  return r;
}
