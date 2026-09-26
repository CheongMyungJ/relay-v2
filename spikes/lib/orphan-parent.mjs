// S1 보조: 앱 역할 프로세스. claude를 PTY로 띄우고 프로세스 ID를 파일에 쓴 뒤 계속 살아 있는다.
// S1이 이 프로세스만 강제 종료해 앱 충돌을 흉내 낸다.
import fs from 'node:fs';
import { Session } from './session.mjs';

const [cwd, pidFile, model] = process.argv.slice(2);
const s = new Session({ name: 'orphan', cwd, args: ['--model', model] }).start();
fs.writeFileSync(pidFile, JSON.stringify({ pid: s.pid }));
setInterval(() => s.handleDialogs(), 1000);
