// 스파이크 공통 도구: 테스트용 레포와 worktree, Work 디렉터리, 프로세스 조회, 결과 기록.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const WORK = path.join(ROOT, 'work');
export const RESULTS = path.join(ROOT, 'results');
export const MODEL = process.env.SPIKE_MODEL || 'sonnet';

export function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

export function git(cwd, ...args) {
  return sh('git', args, { cwd });
}

export function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

// Windows 경로를 Claude Code 권한 규칙의 절대 경로(//c/...)로 바꾼다.
export function ruleAbs(p) {
  const posix = p.replace(/\\/g, '/');
  const m = posix.match(/^([A-Za-z]):\/(.*)$/);
  return m ? `//${m[1].toLowerCase()}/${m[2]}` : `/${posix}`;
}

// 테스트용 레포: main 체크아웃, relay 브랜치 worktree, 로컬 bare 원격, Work 디렉터리.
export function makeFixture(id) {
  const base = path.join(WORK, id);
  fs.rmSync(base, { recursive: true, force: true });
  const main = path.join(base, 'repo');
  const remote = path.join(base, 'remote.git');
  const worktree = path.join(base, 'wt');
  const workDir = path.join(base, 'works', 'w-test');
  fs.mkdirSync(main, { recursive: true });
  fs.mkdirSync(path.join(workDir, 'tasks', '01-test'), { recursive: true });
  sh('git', ['init', '--bare', remote]);
  git(main, 'init', '-b', 'main');
  git(main, 'config', 'user.email', 'spike@example.com');
  git(main, 'config', 'user.name', 'spike');
  git(main, 'config', 'core.longpaths', 'true');
  fs.writeFileSync(path.join(main, 'README.md'), '# spike fixture\n');
  git(main, 'add', '.');
  git(main, 'commit', '-m', 'init');
  git(main, 'remote', 'add', 'origin', remote);
  git(main, 'push', '-u', 'origin', 'main');
  git(main, 'worktree', 'add', '-b', 'relay/w-test', worktree);
  const taskDir = path.join(workDir, 'tasks', '01-test');
  fs.writeFileSync(path.join(taskDir, 'context.md'), '# context\n이 task는 스파이크 시험용이다.\n');
  return { base, main, remote, worktree, workDir, taskDir };
}

export function writeSkill(dir, name, { description, body, disableModelInvocation = true }) {
  const d = path.join(dir, '.claude', 'skills', name);
  fs.mkdirSync(d, { recursive: true });
  const fm = ['---', `name: ${name}`, `description: ${description}`];
  if (disableModelInvocation) fm.push('disable-model-invocation: true');
  fm.push('---', '');
  fs.writeFileSync(path.join(d, 'SKILL.md'), fm.join('\n') + body + '\n');
}

export function writeSettings(dir, name, obj) {
  const f = path.join(dir, name);
  writeJson(f, obj);
  return f;
}

// Windows 프로세스 목록 (ProcessId, ParentProcessId, Name, CreationDate)
export function processes() {
  if (process.platform !== 'win32') return [];
  const out = sh('powershell', [
    '-NoProfile',
    '-Command',
    'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,@{n="Created";e={$_.CreationDate.ToString("o")}} | ConvertTo-Json -Compress',
  ], { maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

export function descendants(pid, list = processes()) {
  const out = [];
  const walk = (p) => {
    for (const c of list.filter((x) => x.ParentProcessId === p)) {
      out.push(c);
      walk(c.ProcessId);
    }
  };
  const self = list.find((x) => x.ProcessId === pid);
  if (self) out.push(self);
  walk(pid);
  return out;
}

export function isAlive(pid, created, list = processes()) {
  return list.some((x) => x.ProcessId === pid && (!created || x.Created === created));
}

export function killTree(pid) {
  try {
    sh('taskkill', ['/PID', String(pid), '/T', '/F']);
    return true;
  } catch {
    return false;
  }
}

// 결과 기록: checks의 status는 pass | fail | observe(판정 없이 관찰만)
export class Result {
  constructor(id, title) {
    this.id = id;
    this.title = title;
    this.checks = [];
    this.observations = {};
    this.startedAt = new Date().toISOString();
  }
  check(name, ok, detail = '') {
    this.checks.push({ name, status: ok ? 'pass' : 'fail', detail: String(detail).slice(0, 2000) });
  }
  observe(name, value) {
    this.checks.push({ name, status: 'observe', detail: typeof value === 'string' ? value.slice(0, 2000) : JSON.stringify(value).slice(0, 2000) });
  }
  error(e) {
    this.checks.push({ name: 'harness_error', status: 'error', detail: String(e?.stack || e).slice(0, 4000) });
  }
  save() {
    this.finishedAt = new Date().toISOString();
    writeJson(path.join(RESULTS, `${this.id}.json`), this);
  }
}
