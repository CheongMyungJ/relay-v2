// S8. 단계 절차를 시스템 프롬프트에 두기 (D440~D446): 스킬(지금), --agent, --append-system-prompt-file이
// 모델에 가는 요청을 어떻게 바꾸는지, 재개·압축·/clear 뒤에 절차가 남는지 본다.
// 가짜 API(lib/mockapi.mjs)로 요청 본문만 보므로 모델과 인증이 필요 없다. 절차에는 표식을 넣어 요청에서 찾는다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Session, sleep } from './lib/session.mjs';
import { MockApi, systemText, messagesText } from './lib/mockapi.mjs';
import { makeFixture, writeSkill, writeSettings, writeJson, Result } from './lib/util.mjs';

const V1 = 'MARKER_PROCEDURE_7731';
const V2 = 'MARKER_V2_9902';
const procedure = (marker) => `# relay-test 절차\n${marker}: 컨텍스트 파일을 읽고 handoff.md를 쓴다.\n`;

// 이 프로세스의 인증과 Claude Code 환경 변수(웹 세션 등)를 넘기지 않는다. 바깥으로 나가지 않게 프록시도 뺀다.
function cleanEnv(cfg, apiUrl) {
  const keep = Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC_|CLAUDE_|https?_proxy$)/i.test(k));
  return {
    ...Object.fromEntries(keep),
    ...(process.platform === 'win32' ? {} : { HOME: cfg }),
    CLAUDE_CONFIG_DIR: cfg,
    ANTHROPIC_BASE_URL: apiUrl,
    ANTHROPIC_AUTH_TOKEN: 'spike',
    DISABLE_AUTOUPDATER: '1',
    TERM: 'xterm-256color',
  };
}

// 첫 실행 창을 건너뛰는 설정 폴더. 남은 창은 Session이 수락한다
function prepareConfig(cfg, worktree) {
  fs.rmSync(cfg, { recursive: true, force: true });
  writeJson(path.join(cfg, '.claude.json'), {
    hasCompletedOnboarding: true,
    theme: 'dark',
    bypassPermissionsModeAccepted: true,
    projects: { [worktree]: { hasTrustDialogAccepted: true } },
  });
  writeJson(path.join(cfg, 'settings.json'), { skipDangerousModePermissionPrompt: true });
}

const has = (body, marker) => ({ 시스템: systemText(body).includes(marker), 메시지: messagesText(body).includes(marker) });
const kept = (body, marker) => systemText(body).includes(marker) || messagesText(body).includes(marker);

export default async function run() {
  const r = new Result('S8', '단계 절차를 시스템 프롬프트에 두기');
  const fx = makeFixture('s8');
  const agentFile = path.join(fx.workDir, '.claude', 'agents', 'relay-test.md');
  try {
    writeSkill(fx.workDir, 'relay-test', { description: 'relay 시험 단계', body: procedure(V1) });
    fs.mkdirSync(path.dirname(agentFile), { recursive: true });
    fs.writeFileSync(agentFile, `---\nname: relay-test\ndescription: relay 시험 단계\n---\n${procedure(V1)}`);
    const proc1 = path.join(fx.taskDir, 'instructions.md');
    const proc2 = path.join(fx.taskDir, 'instructions-v2.md');
    fs.writeFileSync(proc1, procedure(V1));
    fs.writeFileSync(proc2, procedure(V2));
    const settings = writeSettings(fx.workDir, 'task.settings.json', { permissions: { deny: [] }, autoMemoryEnabled: false });
    const ctx = path.join(fx.taskDir, 'context.md');
    const common = ['--dangerously-skip-permissions', '--add-dir', fx.workDir, '--settings', settings];
    const prompt = `이 task의 컨텍스트: ${ctx}`;
    const SKILL = [`/relay-test ${prompt}`];
    const AGENT = ['--agent', 'relay-test', prompt];
    const APPEND = ['--append-system-prompt-file', proc1, prompt];

    // 경우마다 가짜 API와 설정 폴더를 따로 둔다. 세션은 같은 대화를 재개할 수 있게 경우 안에서 이어 쓴다
    const scenario = async (name, fn) => {
      const api = new MockApi();
      await api.listen();
      const cfg = path.join(fx.base, `cfg-${name}`);
      prepareConfig(cfg, fx.worktree);
      const sessions = [];
      const open = async (args) => {
        const m = api.mark();
        const s = new Session({
          name: `s8-${name}`,
          cwd: fx.worktree,
          args: [...common, ...args],
          env: cleanEnv(cfg, api.url),
          inheritEnv: false,
          logPath: path.join(fx.base, `${name}-${sessions.length}.log`),
        }).start();
        sessions.push(s);
        const body = await api.waitMain(m, s);
        await s.waitReady();
        return { s, body };
      };
      const turn = async (s, text) => {
        const m = api.mark();
        await s.typeLine(text);
        const body = await api.waitMain(m, s);
        await s.waitReady();
        return body;
      };
      const compact = async (s) => {
        await turn(s, '/compact');
        await sleep(1000);
        await s.waitReady();
      };
      const clear = async (s) => {
        await s.typeLine('/clear');
        await sleep(2000);
        await s.waitReady();
      };
      const end = async (s) => {
        s.kill();
        await s.waitExit(30000);
      };
      try {
        return await fn({ open, turn, compact, clear, end });
      } finally {
        for (const s of sessions) s.kill();
        await api.close();
      }
    };

    // 1. 첫 요청: 기본, --agent, append
    const plain = await scenario('plain', async ({ open }) => (await open([prompt])).body);
    const agent = await scenario('agent', async ({ open }) => (await open(AGENT)).body);
    const append = await scenario('append', async ({ open }) => (await open(APPEND)).body);
    const blocks = (b) => (Array.isArray(b.system) ? b.system : [{ text: b.system }]).map((x) => x.text);
    const lost = blocks(plain).filter((t) => !blocks(agent).includes(t));
    r.observe('시스템 블록 글자 수 (기본 / --agent / append)', { 기본: blocks(plain).map((t) => t.length), agent: blocks(agent).map((t) => t.length), append: blocks(append).map((t) => t.length) });
    r.observe('--agent: 도구 정의가 기본과 같음', JSON.stringify(agent.tools) === JSON.stringify(plain.tools));
    r.observe('--agent: 메시지가 기본과 같음', messagesText(agent) === messagesText(plain));
    r.observe('--agent: 절차가 시스템 프롬프트에 있음', has(agent, V1));
    r.observe('--agent가 빼는 기본 시스템 프롬프트', lost.join('\n---\n'));
    r.observe('--agent: 그 에이전트가 서브에이전트 목록에도 있음', /- relay-test: /.test(messagesText(agent)));
    r.check(
      'append: 기본 시스템 프롬프트를 모두 지키고 절차를 붙임',
      blocks(plain).every((t) => systemText(append).includes(t.trimEnd())) && has(append, V1).시스템,
      systemText(append).slice(-400),
    );
    r.observe('append: 도구 정의와 메시지가 기본과 같음', JSON.stringify(append.tools) === JSON.stringify(plain.tools) && messagesText(append) === messagesText(plain));

    // 2. 같은 프로세스에서 압축
    for (const [name, args, check] of [['skill-compact', SKILL, false], ['agent-compact', AGENT, false], ['append-compact', APPEND, true]]) {
      const after = await scenario(name, async ({ open, turn, compact }) => {
        const { s } = await open(args);
        await compact(s);
        return turn(s, 'after compact');
      });
      (check ? r.check.bind(r) : r.observe.bind(r))(`${name}: 같은 프로세스에서 압축한 뒤 절차가 남음`, check ? kept(after, V1) : has(after, V1));
    }

    // 3. 재개한 프로세스에서 압축. relay의 재개(resumeArgs)처럼 같은 인자에 --resume을 붙이고 첫 프롬프트는 뺀다
    const resumed = async (name, firstArgs, resumeArgs, before) => {
      const id = crypto.randomUUID();
      return scenario(name, async ({ open, turn, compact, end }) => {
        const first = await open(['--session-id', id, ...firstArgs]);
        await end(first.s);
        before?.();
        const { s, body: beforeCompact } = await open(['--resume', id, ...resumeArgs, '재개 입력']);
        await compact(s);
        const afterCompact = await turn(s, 'after compact');
        return { beforeCompact, afterCompact };
      });
    };
    const both = (x, marker) => ({ 압축_전: has(x.beforeCompact, marker), 압축_뒤: has(x.afterCompact, marker) });

    const skillResume = await resumed('skill-resume', SKILL, []);
    r.observe('스킬: 재개한 프로세스에서 압축한 뒤 절차가 남음', both(skillResume, V1));

    const agentResume = await resumed('agent-resume', AGENT, []);
    r.observe('--agent: --agent 없이 재개해도 에이전트가 이어지고 압축 뒤 남음', both(agentResume, V1));

    const backup = `${agentFile}.bak`;
    const agentGone = await resumed('agent-gone', AGENT, [], () => fs.renameSync(agentFile, backup));
    fs.renameSync(backup, agentFile);
    r.observe('--agent: 재개 전에 에이전트 파일을 지우면 (압축 전 / 뒤)', both(agentGone, V1));

    const appendResume = await resumed('append-resume', APPEND, APPEND.slice(0, 2));
    r.check('append: 같은 플래그로 재개하고 압축한 뒤 절차가 남음', kept(appendResume.beforeCompact, V1) && kept(appendResume.afterCompact, V1), JSON.stringify(both(appendResume, V1)));

    const appendNoFlag = await resumed('append-noflag', APPEND, []);
    r.observe('append: 플래그 없이 재개하면 (압축 전 / 뒤)', both(appendNoFlag, V1));

    const appendChanged = await resumed('append-changed', APPEND, ['--append-system-prompt-file', proc2]);
    r.observe('append: 다른 파일로 재개하면 v1 (압축 전 / 뒤)', both(appendChanged, V1));
    r.observe('append: 다른 파일로 재개하면 v2 (압축 전 / 뒤)', both(appendChanged, V2));

    // 곁·기본 세션(D446): --system-prompt-snapshot off로 열고 다른 안내로 다시 열면 압축 전에도 새 안내다
    const SNAP = ['--system-prompt-snapshot', 'off'];
    const snapChanged = await resumed('snapshot-off', [...SNAP, ...APPEND], [...SNAP, '--append-system-prompt-file', proc2]);
    r.check(
      'snapshot off: 다른 안내로 다시 열면 압축 전부터 새 안내만 있음 (D446)',
      has(snapChanged.beforeCompact, V2).시스템 && !kept(snapChanged.beforeCompact, V1) && has(snapChanged.afterCompact, V2).시스템,
      JSON.stringify({ v1: both(snapChanged, V1), v2: both(snapChanged, V2) }),
    );

    // 4. /clear (D110: 같은 프로세스가 새 대화로 계속 돈다)
    for (const [name, args, check] of [['skill-clear', SKILL, false], ['append-clear', APPEND, true]]) {
      const after = await scenario(name, async ({ open, turn, clear }) => {
        const { s } = await open(args);
        await clear(s);
        return turn(s, 'after clear');
      });
      (check ? r.check.bind(r) : r.observe.bind(r))(`${name}: /clear 뒤 절차가 남음`, check ? kept(after, V1) : has(after, V1));
    }
  } catch (e) {
    r.error(e);
  } finally {
    r.save();
  }
  return r;
}
