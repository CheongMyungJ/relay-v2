// S1. 터미널 임베드(자동화할 수 있는 부분): ConPTY 실행, 한글 문자 표시, 크기 변경, pty.log 재생,
// 프로세스 트리 종료, 부모(앱)가 죽었을 때 남는 프로세스를 ID와 시작 시각으로 찾아 끝내기.
// 한글 IME 조합 입력은 러너에서 확인할 수 없어 실기에서 사람이 확인한다(docs/spikes.md).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import xtermHeadless from '@xterm/headless';
import { Session, sleep } from './lib/session.mjs';
import { makeFixture, Result, MODEL, processes, descendants, isAlive, killTree, ROOT } from './lib/util.mjs';

const { Terminal } = xtermHeadless;

export default async function run() {
  const r = new Result('S1', '터미널 임베드 (IME 제외)');
  let s;
  try {
    const fx = makeFixture('s1');
    const logPath = path.join(fx.base, 'pty.log');
    s = new Session({ name: 's1', cwd: fx.worktree, logPath, args: ['--model', MODEL] }).start();
    await s.waitReady();
    r.observe('시작 화면', s.screen());

    // 한글 문자 표시 (IME가 아니라 문자열 전송)
    s.write('안녕하세요 한글 시험');
    await sleep(1500);
    r.check('한글 문자열이 입력란에 표시됨', /안녕하세요 한글 시험/.test(s.screen()), s.screen());
    s.write('\x7f');
    await sleep(1000);
    r.check('백스페이스 한 번에 한글 한 글자가 지워짐', /안녕하세요 한글 시(?!험)/.test(s.screen()), s.screen());
    for (let i = 0; i < 20; i++) s.write('\x7f');
    await sleep(800);

    // 크기 변경
    s.resize(80, 24);
    await sleep(1500);
    const small = s.screen();
    s.resize(160, 50);
    await sleep(1500);
    r.check('크기 변경 뒤에도 세션이 살아 있고 화면이 다시 그려짐', s.alive() && s.screen().trim().length > 0, small);

    // 프로세스 트리 종료
    const tree = descendants(s.pid);
    r.observe('세션 프로세스 트리', tree.map((p) => `${p.Name}(${p.ProcessId})`));
    killTree(s.pid);
    await sleep(3000);
    const list = processes();
    const left = tree.filter((p) => isAlive(p.ProcessId, p.Created, list));
    r.check('프로세스 트리 종료 뒤 남은 프로세스 없음', left.length === 0, left.map((p) => p.Name).join(', '));

    // pty.log 재생
    await sleep(500);
    const raw = fs.readFileSync(logPath, 'utf8');
    const t = new Terminal({ cols: 120, rows: 40, allowProposedApi: true });
    await new Promise((res) => t.write(raw, res));
    const buf = t.buffer.active;
    let text = '';
    for (let i = 0; i < buf.length; i++) text += (buf.getLine(i)?.translateToString(true) ?? '') + '\n';
    r.check('pty.log를 다시 재생하면 화면 글자가 나옴', raw.length > 0 && text.trim().length > 0, `log ${raw.length} bytes`);

    // 부모(앱)가 강제 종료될 때: 자식 claude가 남는지, ID와 시작 시각으로 찾아 끝낼 수 있는지
    const pidFile = path.join(fx.base, 'orphan.json');
    const parent = spawn(process.execPath, [path.join(ROOT, 'lib', 'orphan-parent.mjs'), fx.worktree, pidFile, MODEL], { stdio: 'ignore' });
    const end = Date.now() + 60000;
    while (!fs.existsSync(pidFile) && Date.now() < end) await sleep(500);
    await sleep(5000);
    const info = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    const created = processes().find((p) => p.ProcessId === info.pid)?.Created;
    r.observe('앱 역할 프로세스가 기록한 claude', { pid: info.pid, created });
    // 부모만 강제 종료(트리 종료 아님). 앱 충돌과 같은 상황
    try {
      process.kill(parent.pid, 'SIGKILL');
    } catch {}
    await sleep(3000);
    const orphanAlive = isAlive(info.pid, created);
    r.observe('부모 강제 종료 뒤 claude가 남음(고아)', orphanAlive);
    if (orphanAlive) {
      killTree(info.pid);
      await sleep(2000);
      r.check('기록한 ID와 시작 시각으로 고아를 찾아 종료함', !isAlive(info.pid, created));
    }
  } catch (e) {
    r.error(e);
  } finally {
    s?.kill();
    r.save();
  }
  return r;
}
