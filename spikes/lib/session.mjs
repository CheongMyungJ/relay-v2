// Claude Code를 PTY(ConPTY)로 띄우고, 출력을 xterm headless로 재구성해 화면 글자를 읽는다.
// 첫 실행 창(권한 확인 끈 모드 경고, 폴더 신뢰, API 키 승인 등)은 자동으로 수락하고 화면을 기록한다(S5).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import pty from 'node-pty';
import xtermHeadless from '@xterm/headless';

const { Terminal } = xtermHeadless;
// 화면의 빈 줄을 빼고 끝부분만 보여 준다(로그용).
export function tail(text, n = 15) {
  return text.split('\n').filter((l) => l.trim()).slice(-n).map((l) => `    | ${l}`).join('\n');
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 수락할 창의 판별 규칙. 문구는 Claude Code 버전에 따라 바뀔 수 있으므로 넓게 잡고, 본 화면은 모두 기록한다.
// 첫 실행 창 판별. 문구는 Claude Code 버전에 따라 바뀔 수 있으므로 이름 붙이기에만 쓰고,
// 처리는 화면 모양(선택 목록, "Enter를 누르라"는 안내)으로 한다. 본 화면은 모두 기록한다(S5).
const DIALOG_NAMES = [
  { name: 'bypass_permissions_warning', match: /bypass permissions/i },
  { name: 'folder_trust', match: /trust (the files in )?this folder|do you trust|trust this/i },
  { name: 'api_key_approval', match: /api key/i },
  { name: 'theme_or_onboarding', match: /text style|theme/i },
  { name: 'security_notes', match: /security notes/i },
  { name: 'terminal_setup', match: /terminal setup|shift\s*\+\s*enter/i },
  { name: 'login', match: /select login method|log in|login/i },
];
// 선택 목록의 현재 항목 표시. macOS·Linux는 "❯ 1.", Windows 콘솔은 "> 1."로 그린다.
const SELECT_CURSOR = /(?:^|\s)[❯>]\s*\d+\.\s/m;
// 수락 항목(1. Yes, 2. Yes, I accept, 1. Yes, proceed …)
const ACCEPT_OPTION = /(?:^|[\s│❯>])(\d)\.\s*(yes|i accept|accept|proceed|trust)/i;
const PRESS_ENTER = /press enter|enter to (continue|confirm)/i;

export function resolveClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform === 'win32') {
    const candidates = [
      `${process.env.USERPROFILE}\\.local\\bin\\claude.exe`,
      `${process.env.APPDATA}\\npm\\claude.cmd`,
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
  }
  return 'claude';
}

export class Session {
  constructor({ args = [], cwd, env = {}, cols = 120, rows = 40, logPath, name = 'session' }) {
    this.name = name;
    this.args = args;
    this.cwd = cwd;
    this.env = { ...process.env, ...env };
    this.cols = cols;
    this.rows = rows;
    this.logPath = logPath;
    this.dialogs = []; // { name, screen, at }
    this.exit = null;
    this.lastDataAt = Date.now();
  }

  start() {
    const bin = resolveClaude();
    let file = bin;
    let args = this.args;
    if (bin.endsWith('.cmd')) {
      file = 'cmd.exe';
      args = ['/d', '/s', '/c', bin, ...this.args];
    }
    this.term = new Terminal({ cols: this.cols, rows: this.rows, allowProposedApi: true, scrollback: 5000 });
    this.log = this.logPath ? fs.createWriteStream(this.logPath) : null;
    this.p = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.cwd,
      env: this.env,
      useConpty: true,
    });
    this.pid = this.p.pid;
    this.p.onData((d) => {
      this.term.write(d);
      this.log?.write(d);
      this.lastDataAt = Date.now();
    });
    this.p.onExit((e) => {
      this.exit = e;
      console.log(`[${this.name}] 프로세스 종료 ${JSON.stringify(e)}\n${tail(this.screen())}`);
      this.log?.end();
    });
    return this;
  }

  // 현재 화면(보이는 영역)의 글자
  screen() {
    const buf = this.term.buffer.active;
    const lines = [];
    for (let i = 0; i < this.term.rows; i++) {
      const line = buf.getLine(buf.viewportY + i);
      lines.push(line ? line.translateToString(true) : '');
    }
    return lines.join('\n');
  }

  // 스크롤백을 포함한 전체 글자
  fullText() {
    const buf = this.term.buffer.active;
    const lines = [];
    for (let i = 0; i < buf.length; i++) lines.push(buf.getLine(i)?.translateToString(true) ?? '');
    return lines.join('\n');
  }

  write(s) {
    this.p.write(s);
  }

  async typeLine(text) {
    this.p.write(text);
    await sleep(300);
    this.p.write('\r');
  }

  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.p.resize(cols, rows);
    this.term.resize(cols, rows);
  }

  alive() {
    return this.exit === null;
  }

  // 보이는 창이 첫 실행 창(선택 목록이나 Enter 안내)이면 수락한다. 수락했으면 true.
  async handleDialogs() {
    const scr = this.screen();
    const isSelect = SELECT_CURSOR.test(scr);
    const isEnter = PRESS_ENTER.test(scr);
    if (!isSelect && !isEnter) return false;
    if (this.lastDialogScreen === scr && Date.now() - this.lastDialogAt < 3000) return false;
    const name = (DIALOG_NAMES.find((d) => d.match.test(scr)) || { name: 'unknown' }).name;
    this.dialogs.push({ name, screen: scr, at: Date.now() });
    const opt = isSelect ? scr.split('\n').map((l) => l.match(ACCEPT_OPTION)).find(Boolean) : null;
    console.log(`[${this.name}] 첫 실행 창 감지: ${name} → ${opt ? `${opt[1]}번(${opt[2]}) 선택` : 'Enter'}\n${tail(scr, 30)}`);
    if (opt) {
      this.p.write(opt[1]);
      await sleep(800);
      if (this.screen() === scr) this.p.write('\r');
    } else {
      // 기본 항목을 고른다. 권한 확인 끈 모드 경고는 기본이 "종료"라 위의 수락 항목으로 처리된다.
      this.p.write('\r');
    }
    this.lastDialogScreen = scr;
    this.lastDialogAt = Date.now();
    await sleep(1500);
    return true;
  }

  // 조건이 참이 될 때까지 기다린다. 기다리는 동안 첫 실행 창을 처리한다.
  async waitUntil(pred, { timeout = 60000, label = 'condition' } = {}) {
    const end = Date.now() + timeout;
    let nextDump = Date.now() + 30000;
    while (Date.now() < end) {
      if (Date.now() > nextDump) {
        // 오래 기다리면 화면을 로그에 남겨 어디서 멈췄는지 볼 수 있게 한다.
        console.log(`[${this.name}] ${label} 기다리는 중 (alive=${this.alive()})\n${tail(this.screen())}`);
        nextDump = Date.now() + 30000;
      }
      if (await pred()) return true;
      await this.handleDialogs();
      if (!this.alive()) return !!(await pred());
      await sleep(250);
    }
    throw new Error(`[${this.name}] timeout waiting for ${label}\n--- screen ---\n${this.screen()}`);
  }

  waitForText(re, opts = {}) {
    return this.waitUntil(() => re.test(this.fullText()), { label: String(re), ...opts });
  }

  // 출력이 quietMs 동안 없으면 끝난 것으로 본다.
  async waitIdle({ quietMs = 3000, timeout = 60000 } = {}) {
    return this.waitUntil(() => Date.now() - this.lastDataAt > quietMs, { label: 'idle', timeout });
  }

  async waitExit(timeout = 30000) {
    return this.waitUntil(() => !this.alive(), { label: 'exit', timeout });
  }

  kill() {
    if (!this.alive()) return;
    // Windows에서 node-pty의 kill()은 이미 끝난 콘솔에 붙으려다 보조 프로세스가 죽는 일이 있어 트리 종료를 쓴다.
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/PID', String(this.pid), '/T', '/F'], { stdio: 'ignore' });
        return;
      } catch {}
    }
    try {
      this.p.kill();
    } catch {}
  }
}
