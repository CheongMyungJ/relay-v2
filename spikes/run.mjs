// 스파이크 실행기. 인자로 스파이크 id를 주면 그것만 돌린다(예: node run.mjs S2 S3).
// S5는 깨끗한 사용자 프로필이 필요하므로 가장 먼저 돌린다.
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS, MODEL, sh } from './lib/util.mjs';
import { resolveClaude } from './lib/session.mjs';

const ALL = {
  S5: './s5-first-run.mjs',
  S1: './s1-terminal.mjs',
  S2: './s2-hooks.mjs',
  S3: './s3-skills.mjs',
  S3B: './s3b-compact.mjs',
  S4: './s4-permissions.mjs',
  S6: './s6-resume.mjs',
};
const wanted = process.argv.slice(2).map((a) => a.toUpperCase());
const ids = Object.keys(ALL).filter((id) => wanted.length === 0 || wanted.includes(id));

fs.mkdirSync(RESULTS, { recursive: true });
let version = '';
try {
  version = sh(resolveClaude(), ['--version']);
} catch (e) {
  version = `알 수 없음 (${e.message})`;
}
const env = { date: new Date().toISOString(), claudeVersion: version, os: `${process.platform} ${process.env.ImageOS || ''} ${process.env.ImageVersion || ''}`.trim(), model: MODEL, effort: process.env.CLAUDE_CODE_EFFORT_LEVEL || '(기본)' };

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
  `- Claude Code 버전: ${env.claudeVersion}`,
  `- OS: ${env.os}`,
  `- 모델: ${env.model}`,
  `- effort: ${env.effort}`,
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
