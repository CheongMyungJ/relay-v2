// Claude Code를 PTY(ConPTY)로 띄우고, 출력을 xterm headless로 재구성해 화면 글자를 읽는다.
// 첫 실행 창(권한 확인 끈 모드 경고, 폴더 신뢰, API 키 승인 등)은 자동으로 수락하고 화면을 기록한다(S5).
import fs from 'node:fs';
import pty from 'node-pty';
import xtermHeadless from '@xterm/headless';

const { Terminal } = xtermHeadless;
// 화면의 빈 줄을 빼고 끝부분만 보여 준다(로그용).
export function tail(text, n = 15) {
  return text.split('\n').filter((l) => l.trim()).slice(-n).map((l) => `    | ${l}`).join('\n');
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 수락할 창의 판별 규칙. 문구는 Claude Code 버전에 따라 바뀔 수 있으므로 넓게 잡고, 본 화면은 모두 기록한다.
const DIALOG_RULES = [
  { name: 'bypass_permissions_warning', match: /bypass permissions/i },
  { name: 'folder_trust', match: /trust (the files in )?this folder|do you trust/i },
  { name: 'api_key_approval', match: /use this api key|custom api key/i },
  { name: 'theme_or_onboarding', match: /choose the text style|text style|select a theme/i },
  { name: 'press_enter', match: /press enter to continue/i },
];
const ACCEPT_OPTION = /^\s*[❯>]?\s*(\d)\.\s*(yes|i accept|accept|proceed|trust)/i;

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

  // 보이는 창이 첫 실행 창이면 수락한다. 수락했으면 true.
  async handleDialogs() {
    const scr = this.screen();
    for (const rule of DIALOG_RULES) {
      if (!rule.match.test(scr)) continue;
      const last = this.dialogs[this.dialogs.length - 1];
      if (last && last.name === rule.name && Date.now() - last.at < 3000) return false;
      this.dialogs.push({ name: rule.name, screen: scr, at: Date.now() });
      console.log(`[${this.name}] 첫 실행 창 감지: ${rule.name}\n${tail(scr)}`);
      const opt = scr.split('\n').map((l) => l.match(ACCEPT_OPTION)).find(Boolean);
      if (opt) {
        this.p.write(opt[1]);
        await sleep(800);
        if (this.screen() === scr) this.p.write('\r');
      } else {
        this.p.write('\r');
      }
      await sleep(1500);
      return true;
    }
    return false;
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
    try {
      this.p.kill();
    } catch {}
  }
}
