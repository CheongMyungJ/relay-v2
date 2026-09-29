// 스파이크 실행기. 인자로 스파이크 id를 주면 그것만 돌린다(예: node run.mjs S2 S3).
// S5는 깨끗한 사용자 프로필이 필요하므로 가장 먼저 돌린다.
// S7(GitHub 연동)은 Claude Code를 쓰지 않고 사람의 단계가 있어 "전부"에 넣지 않는다. 이름을 적어야 돈다.
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS, MODEL, sh } from './lib/util.mjs';

const ALL = {
  S5: './s5-first-run.mjs',
  S1: './s1-terminal.mjs',
  S2: './s2-hooks.mjs',
  S3: './s3-skills.mjs',
  S3B: './s3b-compact.mjs',
  S4: './s4-permissions.mjs',
  S6: './s6-resume.mjs',
  S7: './s7-github.mjs',
};
const wanted = process.argv.slice(2).map((a) => a.toUpperCase());
const ids = Object.keys(ALL).filter((id) => (wanted.length === 0 ? id !== 'S7' : wanted.includes(id)));
// S7은 다른 스파이크와 함께 돌리지 않는다(러너 작업과 인증이 다르다). 섞여 있으면 아무것도 돌리기 전에 멈춘다.
if (ids.includes('S7') && ids.length > 1) {
  console.error(`S7은 다른 스파이크와 함께 돌리지 않는다: ${ids.join(' ')}. S7만 따로 돌린다(node run.mjs S7).`);
  process.exit(1);
}
const usesClaude = ids.some((id) => id !== 'S7');

fs.mkdirSync(RESULTS, { recursive: true });
const version = (bin) => {
  try {
    return sh(bin, ['--version']).split('\n')[0];
  } catch (e) {
    return `알 수 없음 (${e.message})`;
  }
};
// node-pty가 필요한 session.mjs는 Claude Code 스파이크를 돌릴 때만 불러온다(S7은 npm ci 없이 돈다).
const claudeVersion = usesClaude ? version((await import('./lib/session.mjs')).resolveClaude()) : null;
const ghVersion = ids.includes('S7') ? version('gh') : null;
const env = { date: new Date().toISOString(), claudeVersion, ghVersion, os: `${process.platform} ${process.env.ImageOS || ''} ${process.env.ImageVersion || ''}`.trim(), model: MODEL, effort: process.env.CLAUDE_CODE_EFFORT_LEVEL || '(기본)' };

const results = [];
for (const id of ids) {
  console.log(`=== ${id}`);
  const mod = await import(ALL[id]);
  const res = await mod.default();
  results.push(res);
  // 화면은 위쪽이 환영 그림이라 끝부분(빈 줄 제외 25줄)을 보여 준다.
  for (const c of res.checks) {
    const lines = (c.detail || '').split('\n').filter((l) => l.trim());
    console.log(`[${c.status}] ${c.name}${c.detail && c.status !== 'pass' ? `\n    ${lines.slice(-25).join('\n    ')}` : ''}`);
  }
}

const icon = { pass: '✅', fail: '❌', observe: '👀', error: '💥' };
const lines = [
  '# relay-v2 스파이크 결과',
  '',
  `- 날짜: ${env.date}`,
  ...(usesClaude ? [`- Claude Code 버전: ${env.claudeVersion}`] : []),
  ...(ghVersion ? [`- gh 버전: ${env.ghVersion}`] : []),
  `- OS: ${env.os}`,
  ...(usesClaude ? [`- 모델: ${env.model}`, `- effort: ${env.effort}`] : []),
  '',
];
for (const r of results) {
  lines.push(`## ${r.id}. ${r.title}`, '', '| 결과 | 항목 | 내용 |', '|---|---|---|');
  for (const c of r.checks) {
    const detail = c.detail.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').slice(0, 600);
    lines.push(`| ${icon[c.status]} | ${c.name} | ${c.status === 'pass' ? '' : detail} |`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(RESULTS, 'summary.md'), lines.join('\n'));
fs.writeFileSync(path.join(RESULTS, 'env.json'), JSON.stringify(env, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
console.log(lines.join('\n'));
// 스파이크 결과(실패 포함)는 관찰 기록이므로 종료 코드로 알리지 않는다. 실행기 자체의 오류만 실패로 끝난다.
process.exit(results.some((r) => r.checks.some((c) => c.status === 'error')) ? 1 : 0);
