// S7. GitHub 연동: PR 진행(설계 시나리오 10)이 쓰는 GitHub 동작을 gh로 할 수 있는지, 결과가 설계의 가정
// (D157~D161, D172, D175~D179, D193, D194)과 같은지 시험용 레포에서 확인한다 (docs/spikes.md S7, implementation.md I42, I43).
//
// 다른 계정의 코멘트(절차 3)는 사람이 달아야 해서 단계를 나눈다. 단계는 환경 변수 S7_PHASE로 고른다.
// - start: 시험 PR을 만들고 절차 1, 2, 3(소유자와 봇), 4, 5, 7, 8, 9를 한다. 끝나면 사람이 코멘트를 달 수 있게 PR을
//   열어 두고, 할 일을 results/S7-human.md와 실행 요약에 적는다. 도중에 실패하면 만든 것을 치운다.
// - finish (S7_PR=<번호>): 사람이 단 코멘트의 작성자 관계를 읽고(절차 3), 머지와 원격 브랜치 삭제를 하고(절차 6),
//   이 시험이 만든 브랜치와 PR을 모두 치운다.
// - cleanup: 남은 s7/ 브랜치와 열린 시험 PR을 치운다. S7_PR을 주면 그 PR의 시험(run)만 치운다.
// 레포는 RELAY_TEST_GH_REPO(owner/repo)이고, 인증은 GH_TOKEN(러너에서는 RELAY_TEST_GH_TOKEN)이나 gh 로그인이다.
// git push도 gh의 자격 증명을 쓴다(이 프로세스의 git에만 credential.helper를 준다).
// 레포의 main은 건드리지 않는다. main에서 임시 기준 브랜치 s7/<run>/base를 만들고 그 브랜치에 PR을 연다.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WORK, RESULTS, Result, redact, writeJson } from './lib/util.mjs';

const REPO = process.env.RELAY_TEST_GH_REPO || '';
const PHASE = (process.env.S7_PHASE || 'start').trim().toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// gh는 질문과 새 버전 안내를 끄고 부른다(implementation.md 3절 "gh 환경 변수").
const GH_ENV = { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' };
const GIT_ENV = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'credential.helper',
  GIT_CONFIG_VALUE_0: '',
  GIT_CONFIG_KEY_1: 'credential.helper',
  GIT_CONFIG_VALUE_1: '!gh auth git-credential',
};
// 앱이 PR을 읽을 때마다 쓸 필드(시나리오 10-2의 "늘 읽는 것")
const PR_FIELDS = ['number', 'url', 'state', 'closed', 'isDraft', 'headRefName', 'headRefOid', 'baseRefName', 'baseRefOid', 'mergeable', 'mergeStateStatus', 'reviewDecision', 'latestReviews', 'statusCheckRollup', 'mergedAt', 'mergeCommit'];
const TAG = 'relay가 게시한 답글입니다 (S7 시험).'; // D173의 표시 문구 자리
// PR이 파일 끝에 더하는 함수와, 충돌을 만들려고 기준 브랜치가 같은 자리에 더하는 함수
const HEAD_CODE = '\n/**\n * 수량의 합 (S7 시험 변경).\n * @param {{ qty: number }[]} items\n * @returns {number}\n */\nexport function count(items) {\n  return items.reduce((sum, item) => sum + item.qty, 0);\n}\n';
const BASE_CODE = '\n/**\n * 장바구니가 비었는가 (S7 기준 브랜치 변경).\n * @param {unknown[]} items\n * @returns {boolean}\n */\nexport function isEmpty(items) {\n  return items.length === 0;\n}\n';

function exec(cmd, args, { cwd, input, env = {}, timeout = 180000 } = {}) {
  const res = spawnSync(cmd, args, { cwd, input, encoding: 'utf8', env: { ...process.env, ...env }, timeout, maxBuffer: 64 * 1024 * 1024 });
  return { code: res.status ?? -1, stdout: (res.stdout || '').trim(), stderr: `${(res.stderr || '').trim()}${res.error ? `\n${res.error.message}` : ''}` };
}
const gh = (args, opts = {}) => exec('gh', args, { ...opts, env: { ...GH_ENV, ...(opts.env || {}) } });
const show = (res) => `종료 코드 ${res.code}\n${res.stdout}${res.stderr ? `\n[stderr] ${res.stderr}` : ''}`;
function ok(res, what) {
  if (res.code !== 0) throw new Error(`${what}: ${show(res)}`);
  return res.stdout;
}
const ghJson = (args, opts) => JSON.parse(ok(gh(args, opts), `gh ${args.slice(0, 3).join(' ')}`) || 'null');
// REST 호출. 본문은 표준 입력의 JSON으로 준다. 실패해도 던지지 않는다.
function api(method, endpoint, body, extra = []) {
  const args = ['api', '-X', method, endpoint, ...extra];
  if (body !== undefined) args.push('--input', '-');
  return gh(args, { input: body === undefined ? undefined : JSON.stringify(body) });
}
const apiJson = (method, endpoint, body, extra) => JSON.parse(ok(api(method, endpoint, body, extra), `${method} ${endpoint}`) || 'null');
const list = (endpoint) => apiJson('GET', endpoint, undefined, ['--paginate', '--slurp']).flat();
const git = (cwd, ...args) => ok(exec('git', args, { cwd, env: GIT_ENV }), `git ${args.join(' ')}`);
const gitTry = (cwd, ...args) => exec('git', args, { cwd, env: GIT_ENV });
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const enc = encodeURIComponent;

async function waitFor(what, fn, { timeout = 300000, interval = 5000 } = {}) {
  const until = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > until) throw new Error(`기다리다 시간 초과: ${what}`);
    await sleep(interval);
  }
}

// GH_DEBUG=api가 찍는 "* Request to <URL>" 줄로 gh가 보낸 HTTP 요청을 세고(절차 9), 응답 머리글의
// X-Ratelimit-Resource와 X-Ratelimit-Used로 요청마다 어느 한도를 얼마나 썼는지 본다(go-gh의 httpretty 출력).
function counted(args, opts = {}) {
  const res = gh(args, { ...opts, env: { GH_DEBUG: 'api' } });
  const urls = [...res.stderr.matchAll(/^\* Request to (\S+)/gm)].map((m) => m[1].replace('https://api.github.com', ''));
  const resources = [...res.stderr.matchAll(/^< X-Ratelimit-Resource: (\S+)/gim)].map((m) => m[1]);
  const used = [...res.stderr.matchAll(/^< X-Ratelimit-Used: (\d+)/gim)].map((m) => Number(m[1]));
  const limits = [...res.stderr.matchAll(/^< X-Ratelimit-Limit: (\d+)/gim)].map((m) => Number(m[1]));
  return { code: res.code, stdout: res.stdout, urls, rate: resources.map((r, i) => ({ resource: r, used: used[i], limit: limits[i] })), head: urls.length ? '' : redact(res.stderr.split('\n').slice(0, 5).join('\n')) };
}

const prView = (n, fields = PR_FIELDS) => ghJson(['pr', 'view', String(n), '--repo', REPO, '--json', fields.join(',')]);
const rollup = (p) => (p.statusCheckRollup || []).map((c) => (c.__typename === 'CheckRun' ? `${c.workflowName}/${c.name}: ${c.status} ${c.conclusion || ''}`.trim() : `${c.context}: ${c.state}`));
const brief = (p) => ({ state: p.state, head: p.headRefOid?.slice(0, 7), base: `${p.baseRefName}@${p.baseRefOid?.slice(0, 7)}`, mergeable: p.mergeable, mergeStateStatus: p.mergeStateStatus, reviewDecision: p.reviewDecision, checks: rollup(p) });
const branches = (id) => ({ base: `s7/${id}/base`, head: `s7/${id}/head`, head2: `s7/${id}/head2`, head3: `s7/${id}/head3` });

// head 커밋의 체크가 모두 끝날 때까지 기다린다. 다시 실행한 체크는 새 시도가 끝날 때까지 기다린다.
async function waitChecks(n, sha, what) {
  return waitFor(what, () => {
    const p = prView(n);
    if (p.headRefOid !== sha) return null;
    const runs = (p.statusCheckRollup || []).filter((c) => c.__typename === 'CheckRun');
    return runs.length && runs.every((c) => c.status === 'COMPLETED') ? p : null;
  }, { timeout: 600000, interval: 5000 });
}

// push 직후 새 head 커밋의 체크 목록이 비어 있는 동안을 잰다(D176 "체크가 없으면 통과로 봄"과 관련).
async function checksAppear(n, sha) {
  const t0 = Date.now();
  const samples = [];
  await waitFor('체크가 나타남', () => {
    const p = prView(n, ['headRefOid', 'statusCheckRollup', 'mergeable', 'mergeStateStatus']);
    const len = p.headRefOid === sha ? (p.statusCheckRollup || []).length : -1;
    samples.push(`${((Date.now() - t0) / 1000).toFixed(1)}s:${p.headRefOid.slice(0, 7)}:${len}:${p.mergeable}/${p.mergeStateStatus}`);
    return len > 0;
  }, { timeout: 180000, interval: 1000 });
  return samples;
}

function prepare(r) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(REPO)) throw new Error('RELAY_TEST_GH_REPO(owner/repo)가 필요합니다');
  r.observe('gh auth status', show(gh(['auth', 'status'])));
  const login = apiJson('GET', 'user').login;
  const rest = apiJson('GET', `repos/${REPO}`);
  const view = ghJson(['repo', 'view', REPO, '--json', 'mergeCommitAllowed,squashMergeAllowed,rebaseMergeAllowed,deleteBranchOnMerge,viewerPermission,viewerDefaultMergeMethod,visibility,defaultBranchRef']);
  r.observe('토큰의 계정과 레포 주인', { login, owner: rest.owner?.login, ownerType: rest.owner?.type });
  r.observe('레포 설정 (REST GET repos/{repo})', { visibility: rest.visibility, default_branch: rest.default_branch, allow_merge_commit: rest.allow_merge_commit, allow_squash_merge: rest.allow_squash_merge, allow_rebase_merge: rest.allow_rebase_merge, delete_branch_on_merge: rest.delete_branch_on_merge, permissions: rest.permissions });
  r.observe('레포 설정 (gh repo view --json)', view);
  return { login, rest, view };
}

function cloneRepo(dir, defaultBranch) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const main = path.join(dir, 'repo');
  git(dir, 'clone', `https://github.com/${REPO}.git`, main);
  git(main, 'config', 'user.name', 'relay-s7');
  git(main, 'config', 'user.email', 's7@example.com');
  git(main, 'checkout', defaultBranch);
  return main;
}

// 이 시험(run)이 만든 열린 PR을 닫고 브랜치를 지운다. 기준 브랜치는 PR을 닫은 뒤 마지막에 지운다.
function cleanupRun(r, id) {
  const prefix = id ? `s7/${id}/` : 's7/';
  const open = ghJson(['pr', 'list', '--repo', REPO, '--state', 'open', '--limit', '200', '--json', 'number,headRefName']).filter((p) => p.headRefName.startsWith(prefix));
  for (const p of open) gh(['pr', 'close', String(p.number), '--repo', REPO, '--comment', 'S7 시험을 마쳐 닫습니다.']);
  const refs = list(`repos/${REPO}/git/matching-refs/heads/${prefix}`).map((x) => x.ref);
  refs.sort((a, b) => a.endsWith('/base') - b.endsWith('/base'));
  const failed = refs.filter((ref) => api('DELETE', `repos/${REPO}/git/${ref}`).code !== 0);
  const leftRefs = list(`repos/${REPO}/git/matching-refs/heads/${prefix}`).map((x) => x.ref);
  const leftPrs = ghJson(['pr', 'list', '--repo', REPO, '--state', 'open', '--limit', '200', '--json', 'number,headRefName']).filter((p) => p.headRefName.startsWith(prefix));
  r.check(`정리: ${prefix} 브랜치와 열린 시험 PR이 남지 않았다`, leftRefs.length === 0 && leftPrs.length === 0, JSON.stringify({ closed: open.map((p) => p.number), deleted: refs, failed, leftRefs, leftPrs }));
}

function readComments(n) {
  return {
    reviews: list(`repos/${REPO}/pulls/${n}/reviews?per_page=100`),
    inline: list(`repos/${REPO}/pulls/${n}/comments?per_page=100`),
    convo: list(`repos/${REPO}/issues/${n}/comments?per_page=100`),
  };
}
const who = (x) => ({ id: x.id, login: x.user?.login, type: x.user?.type, association: x.author_association, reply_to: x.in_reply_to_id, review: x.pull_request_review_id, state: x.state, body: (x.body || '').slice(0, 50) });
const keys = (c) => new Set([...c.reviews.map((x) => `review:${x.id}`), ...c.inline.map((x) => `inline:${x.id}`), ...c.convo.map((x) => `convo:${x.id}`)]);

async function dispatchBot(n, kind, body) {
  const since = new Date(Date.now() - 10000).toISOString();
  const res = gh(['workflow', 'run', 'bot-comment.yml', '--repo', REPO, '-f', `pr=${n}`, '-f', `kind=${kind}`, '-f', `body=${body}`]);
  ok(res, `bot-comment ${kind}`);
  const found = res.stdout.match(/\/actions\/runs\/(\d+)/);
  const id = found ? found[1] : await waitFor('봇 코멘트 실행 찾기', () => {
    const runs = ghJson(['run', 'list', '--repo', REPO, '--workflow', 'bot-comment.yml', '--event', 'workflow_dispatch', '--limit', '10', '--json', 'databaseId,createdAt']);
    return runs.filter((x) => x.createdAt >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.databaseId;
  }, { timeout: 60000, interval: 3000 });
  const done = await waitFor('봇 코멘트 실행', () => {
    const v = ghJson(['run', 'view', String(id), '--repo', REPO, '--json', 'status,conclusion']);
    return v.status === 'completed' ? v : null;
  }, { timeout: 300000, interval: 5000 });
  if (done.conclusion !== 'success') throw new Error(`봇 코멘트 실행 ${id}: ${done.conclusion}`);
  return { stdout: res.stdout, id };
}

async function startPhase(r) {
  const ctx = prepare(r);
  const id = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  const B = branches(id);
  const dir = path.join(WORK, 's7', id);
  const raw = { id };
  let n = 0;
  let done = false;
  try {
    const main = cloneRepo(dir, ctx.rest.default_branch);
    git(main, 'push', 'origin', `refs/remotes/origin/${ctx.rest.default_branch}:refs/heads/${B.base}`);
    git(main, 'fetch', 'origin');
    const wt = path.join(dir, 'wt');
    git(main, 'worktree', 'add', '--no-track', '-b', B.head, wt, `origin/${B.base}`);
    const cart = path.join(wt, 'src', 'cart.mjs');
    fs.appendFileSync(cart, HEAD_CODE);
    fs.writeFileSync(path.join(wt, 'ci-flaky'), '');
    git(wt, 'add', '-A');
    git(wt, 'commit', '-m', 's7: 시험 변경 (ci-flaky 켬)');
    git(wt, 'push', '--set-upstream', 'origin', `${B.head}:${B.head}`);
    const sha1 = git(wt, 'rev-parse', 'HEAD');

    // 1. PR 만들기. --head를 주면 gh는 push하지 않는다(implementation.md 3절).
    const bodyFile = path.join(dir, 'pr-body.md');
    fs.writeFileSync(bodyFile, `relay-v2 스파이크 S7이 만든 시험 PR이다 (${id}). 시험이 끝나면 머지하거나 닫고 브랜치를 지운다.\n`);
    const created = gh(['pr', 'create', '--repo', REPO, '--base', B.base, '--head', B.head, '--title', `S7 시험 ${id}`, '--body-file', bodyFile], { cwd: wt });
    const url = (created.stdout.match(/https:\/\/\S+\/pull\/\d+/) || [])[0];
    n = url ? Number(url.split('/').pop()) : 0;
    r.check('1. gh pr create로 PR을 만들고 주소를 받는다', created.code === 0 && n > 0, show(created));
    if (!n) throw new Error('PR을 만들지 못해 멈춘다');
    console.log(`S7 시험 PR: ${url}`);

    // 2. 상태 읽기: 만든 직후, 체크가 나타나기까지, 첫 시도(ci-flaky로 실패)가 끝난 뒤
    r.observe('2. 만든 직후의 PR 상태 (gh pr view --json)', brief(prView(n)));
    const noChecks = gh(['pr', 'checks', String(n), '--repo', REPO]);
    const noChecksJson = gh(['pr', 'checks', String(n), '--repo', REPO, '--json', 'name,bucket']);
    r.observe('2. 체크가 아직 없을 때 gh pr checks (표 출력 / --json)', `${show(noChecks)}\n---\n${show(noChecksJson)}`);
    r.observe('2. PR을 만든 뒤 체크 목록 길이 (경과:head:길이:mergeable/mergeStateStatus)', await checksAppear(n, sha1));
    const failedPr = await waitChecks(n, sha1, 'CI 첫 시도');
    r.observe('2. 첫 시도가 끝난 뒤의 PR 상태', brief(failedPr));
    r.observe('2. statusCheckRollup 원본 (첫 시도 뒤)', failedPr.statusCheckRollup);
    const checks = gh(['pr', 'checks', String(n), '--repo', REPO, '--json', 'name,state,bucket,link,workflow,event,startedAt,completedAt,description']);
    r.observe('2. gh pr checks --json (첫 시도 뒤)', show(checks));
    const failed = checks.code === 0 ? JSON.parse(checks.stdout).find((c) => c.bucket === 'fail') : null;
    r.check('2. 실패한 체크의 이름과 링크를 읽는다', !!failed, show(checks));
    const [, runId, jobId] = failed?.link.match(/\/actions\/runs\/(\d+)\/job\/(\d+)/) || [];
    r.check('2. 체크 링크에서 워크플로 실행 id와 작업 id를 얻는다', !!(runId && jobId), failed?.link || '');
    if (!runId) throw new Error('실패한 체크의 실행을 찾지 못해 멈춘다');

    // 2. 실패한 스텝의 로그 끝부분. 작업 로그 전체의 끝에는 정리 단계가 온다.
    // 스텝의 스크립트도 로그에 찍히므로, 실패는 스위치가 낸 오류 줄(##[error]ci-flaky …)로 본다.
    const cleanupRe = /Post job cleanup|Cleaning up orphan processes/;
    const errorRe = /##\[error\]ci-flaky/;
    const logFailed = counted(['run', 'view', runId, '--repo', REPO, '--log-failed']);
    const lfLines = logFailed.stdout.split('\n');
    r.observe('2. gh run view --log-failed: 스텝 이름 칸과 줄 수', { steps: [...new Set(lfLines.map((l) => l.split('\t')[1]))], lines: lfLines.length, requests: logFailed.urls });
    r.observe('2. gh run view --log-failed: 끝 12줄', lfLines.slice(-12).join('\n'));
    r.check('2. gh run view --log-failed가 실패한 스텝의 로그만 준다(끝에 정리 단계가 없음)', logFailed.code === 0 && errorRe.test(logFailed.stdout) && !cleanupRe.test(logFailed.stdout), `오류 줄 ${errorRe.test(logFailed.stdout)}, 정리 단계 ${cleanupRe.test(logFailed.stdout)}`);
    const jobLogFailed = gh(['run', 'view', '--job', jobId, '--repo', REPO, '--log-failed']);
    r.observe('2. gh run view --job <작업> --log-failed: 끝 6줄', show({ ...jobLogFailed, stdout: jobLogFailed.stdout.split('\n').slice(-6).join('\n') }));
    const job = apiJson('GET', `repos/${REPO}/actions/jobs/${jobId}`);
    r.observe('2. 작업의 스텝 (REST actions/jobs/{id})', job.steps.map((s) => `${s.number} ${s.name}: ${s.conclusion} ${s.started_at}~${s.completed_at}`));
    // 로그에 색 제어 문자가 있어 gh api는 --allow-escape-sequences 없이는 출력하지 않는다(첫 실행에서 관찰).
    const jobLogRes = api('GET', `repos/${REPO}/actions/jobs/${jobId}/logs`, undefined, ['--allow-escape-sequences']);
    const jobLog = jobLogRes.stdout.split('\n');
    r.observe('2. 작업 로그 전체의 끝 6줄 (REST actions/jobs/{id}/logs)', jobLogRes.code === 0 ? jobLog.slice(-6).join('\n') : show(jobLogRes));
    const cut = jobLog.findIndex((l) => cleanupRe.test(l));
    const beforeCleanup = (cut < 0 ? jobLog : jobLog.slice(0, cut)).slice(-8);
    r.check('2. 작업 로그를 정리 단계 앞에서 자르면 끝에 실패한 스텝의 오류가 있다', cut > 0 && beforeCleanup.some((l) => errorRe.test(l)), beforeCleanup.join('\n'));
    r.observe('2. 체크의 annotation (REST check-runs/{id}/annotations)', show(api('GET', `repos/${REPO}/check-runs/${jobId}/annotations`)));

    // 5. 실패한 체크 다시 실행 (D175). ci-flaky는 두 번째 시도에서 통과한다.
    const rerun = counted(['run', 'rerun', runId, '--repo', REPO, '--failed']);
    r.check('5. gh run rerun --failed로 실패한 작업을 다시 실행한다', rerun.code === 0, `종료 코드 ${rerun.code}, 요청 ${rerun.urls.join(' ')}`);
    const again = await waitFor('다시 실행', () => {
      const v = ghJson(['run', 'view', runId, '--repo', REPO, '--json', 'status,conclusion,attempt,headSha']);
      return v.attempt >= 2 && v.status === 'completed' ? v : null;
    }, { timeout: 600000, interval: 5000 });
    r.check('5. 다시 실행한 시도가 통과한다', again.conclusion === 'success', JSON.stringify(again));
    const rerunPr = await waitChecks(n, sha1, '다시 실행 뒤 체크');
    r.observe('5. 다시 실행한 뒤 statusCheckRollup 원본 (시도가 둘이면 둘 다 오는지)', rerunPr.statusCheckRollup);
    r.observe('5. 다시 실행한 뒤 gh pr checks --json', show(gh(['pr', 'checks', String(n), '--repo', REPO, '--json', 'name,state,bucket,link'])));

    // 3. 코멘트: 소유자(토큰의 계정)와 봇. 다른 계정은 finish 단계에서 읽는다.
    const line = fs.readFileSync(cart, 'utf8').split('\n').findIndex((l) => l.startsWith('export function count')) + 1;
    const ownerConvo = gh(['pr', 'comment', String(n), '--repo', REPO, '--body', '소유자 대화 코멘트 (S7)']);
    r.observe('3. gh pr comment의 출력 (코멘트 주소)', show(ownerConvo));
    const review = apiJson('POST', `repos/${REPO}/pulls/${n}/reviews`, { commit_id: sha1, event: 'COMMENT', body: '소유자 리뷰 본문 (S7)', comments: [{ path: 'src/cart.mjs', line, side: 'RIGHT', body: '소유자 인라인 코멘트 (S7)' }] });
    const ownerInline = list(`repos/${REPO}/pulls/${n}/reviews/${review.id}/comments`)[0];
    apiJson('POST', `repos/${REPO}/pulls/${n}/comments/${ownerInline.id}/replies`, { body: '소유자 답글 (기존 스레드, S7)' });
    const bot1 = await dispatchBot(n, 'conversation', '봇 대화 코멘트 (S7)');
    const bot2 = await dispatchBot(n, 'review', '봇 리뷰 본문 (S7)');
    r.observe('3. gh workflow run의 출력 (TTY가 아닐 때)', `${bot1.stdout} / ${bot2.stdout}`);
    const c1 = readComments(n);
    raw.comments1 = c1;
    r.observe('3. 리뷰 (REST pulls/{n}/reviews)', c1.reviews.map(who));
    r.observe('3. 인라인 코멘트와 답글 (REST pulls/{n}/comments)', c1.inline.map(who));
    r.observe('3. 대화 코멘트 (REST issues/{n}/comments)', c1.convo.map(who));
    const all1 = [...c1.reviews, ...c1.inline, ...c1.convo];
    const owners = all1.filter((x) => x.user.login === ctx.login);
    const bots = all1.filter((x) => x.user.type === 'Bot');
    r.check('3. 소유자가 단 리뷰·인라인·답글·대화 코멘트의 작성자 관계가 OWNER다', owners.length >= 4 && owners.every((x) => x.author_association === 'OWNER'), JSON.stringify(owners.map(who)));
    r.check('3. 봇(github-actions)의 코멘트는 REST user.type이 Bot이다', bots.length >= 3 && bots.every((x) => x.user.login.endsWith('[bot]')), JSON.stringify(bots.map(who)));
    r.check('3. 기존 스레드의 답글은 in_reply_to_id로 스레드의 첫 코멘트를 가리킨다', c1.inline.some((x) => x.in_reply_to_id === ownerInline.id), JSON.stringify(c1.inline.map(who)));
    const gql = ghJson(['pr', 'view', String(n), '--repo', REPO, '--json', 'author,comments,reviews,latestReviews']);
    raw.graphql1 = gql;
    r.observe('3. gh pr view --json comments (GraphQL): 작성자, 관계, viewerDidAuthor', gql.comments.map((x) => ({ login: x.author?.login, association: x.authorAssociation, viewerDidAuthor: x.viewerDidAuthor, url: x.url })));
    r.observe('3. gh pr view --json reviews (GraphQL)', gql.reviews.map((x) => ({ login: x.author?.login, association: x.authorAssociation, state: x.state, body: x.body })));

    // 3. 새 항목 가리기: id로 가린다. 코멘트를 고쳐도 id는 그대로고 updated_at만 바뀐다.
    const seen = keys(c1);
    const convo1 = c1.convo.find((x) => x.user.login === ctx.login);
    const since = new Date().toISOString();
    await sleep(1500);
    const edited = apiJson('PATCH', `repos/${REPO}/issues/comments/${convo1.id}`, { body: '소유자 대화 코멘트 (S7, 고침)' });
    r.observe('3. 고친 대화 코멘트의 id, created_at, updated_at', { before: convo1.id, after: edited.id, created_at: edited.created_at, updated_at: edited.updated_at });
    r.observe('3. issues/{n}/comments?since=<고치기 직전>이 돌려준 코멘트', list(`repos/${REPO}/issues/${n}/comments?per_page=100&since=${enc(since)}`).map(who));

    // 4. 답글 게시와 보이지 않는 표시 (D172, D194). 표시: <!-- relay:<work-id>/<항목 id>/<라운드> -->
    const work = `w-s7-${id}`;
    const botInline = c1.inline.find((x) => x.user.type === 'Bot' && !x.in_reply_to_id);
    const botConvo = c1.convo.find((x) => x.user.type === 'Bot');
    const mark1 = `<!-- relay:${work}/${botInline.id}/1 -->`;
    const mark2 = `<!-- relay:${work}/${botConvo.id}/1 -->`;
    const reply1 = apiJson('POST', `repos/${REPO}/pulls/${n}/comments/${botInline.id}/replies`, { body: `인라인 코멘트에 답합니다.\n\n_${TAG}_\n${mark1}` });
    const reply2 = apiJson('POST', `repos/${REPO}/issues/${n}/comments`, { body: `대화 코멘트에 답합니다.\n\n_${TAG}_\n${mark2}` });
    r.check('4. 인라인 스레드 답글과 대화 코멘트를 게시하고 응답에서 바로 코멘트 id를 받는다', !!(reply1.id && reply2.id) && reply1.in_reply_to_id === botInline.id, JSON.stringify({ reply1: who(reply1), reply2: who(reply2) }));
    const c2 = readComments(n);
    raw.comments2 = c2;
    const byMark1 = c2.inline.filter((x) => x.body.includes(mark1)).map((x) => x.id);
    const byMark2 = c2.convo.filter((x) => x.body.includes(mark2)).map((x) => x.id);
    r.check('4. API로 읽은 본문에 표시가 그대로 있고, 표시로 게시한 답글을 찾는다', byMark1.join() === String(reply1.id) && byMark2.join() === String(reply2.id), JSON.stringify({ byMark1, byMark2 }));
    const html1 = apiJson('GET', `repos/${REPO}/pulls/comments/${reply1.id}`, undefined, ['-H', 'Accept: application/vnd.github.full+json']);
    const html2 = apiJson('GET', `repos/${REPO}/issues/comments/${reply2.id}`, undefined, ['-H', 'Accept: application/vnd.github.full+json']);
    r.check('4. 웹이 그리는 본문(body_html, body_text)에 표시가 없다', ![html1.body_html, html1.body_text, html2.body_html, html2.body_text].some((s) => (s || '').includes('relay:')), JSON.stringify({ html1: html1.body_html, text2: html2.body_text }));
    const gql2 = ghJson(['pr', 'view', String(n), '--repo', REPO, '--json', 'comments']);
    r.observe('4. GraphQL(gh pr view --json comments)의 본문에도 표시가 있다', gql2.comments.some((x) => x.body.includes(mark2)));
    // 스레드 답글을 게시하면 본문이 빈 리뷰가 하나 더 생긴다(첫 실행에서 관찰). 본문이 빈 리뷰는 항목(리뷰 본문)이 아니다.
    const appIds = new Set([`inline:${reply1.id}`, `convo:${reply2.id}`]);
    const isApp = (key, x) => appIds.has(key) || /<!-- relay:w-s7-/.test(x.body || '');
    const emptyReview = (key, x) => key.startsWith('review:') && !(x.body || '').trim();
    const fresh = [...c2.reviews.map((x) => [`review:${x.id}`, x]), ...c2.inline.map((x) => [`inline:${x.id}`, x]), ...c2.convo.map((x) => [`convo:${x.id}`, x])].filter(([key]) => !seen.has(key));
    r.observe('4. 답글을 게시한 뒤 새로 생긴 것 (종류:id, 본문 앞부분, 인라인 답글의 pull_request_review_id)', { fresh: fresh.map(([key, x]) => `${key} ${JSON.stringify((x.body || '').slice(0, 20))}`), reply1Review: reply1.pull_request_review_id });
    r.check('4. 다음 읽기에서 새로 생긴 것을 적어 둔 id·표시와 "본문이 빈 리뷰는 항목이 아님"으로 모두 가려낸다', fresh.some(([key]) => key === `inline:${reply1.id}`) && fresh.some(([key]) => key === `convo:${reply2.id}`) && fresh.every(([key, x]) => isApp(key, x) || emptyReview(key, x)), JSON.stringify(fresh.map(([key]) => key)));

    // 7. 충돌: 기준 브랜치의 같은 자리(파일 끝)에 다른 내용을 GitHub에서 커밋한다.
    const baseFile = apiJson('GET', `repos/${REPO}/contents/src/cart.mjs?ref=${enc(B.base)}`);
    const baseText = Buffer.from(baseFile.content, 'base64').toString('utf8');
    const basePut = apiJson('PUT', `repos/${REPO}/contents/src/cart.mjs`, { message: 's7: 기준 브랜치 변경 (충돌)', content: b64(baseText + BASE_CODE), sha: baseFile.sha, branch: B.base });
    const conflictSamples = [];
    const conflicted = await waitFor('충돌 판정', () => {
      const p = prView(n, ['mergeable', 'mergeStateStatus', 'baseRefOid', 'headRefOid']);
      conflictSamples.push(`${p.mergeable}/${p.mergeStateStatus}/base ${p.baseRefOid.slice(0, 7)}`);
      return p.mergeable === 'CONFLICTING' ? p : null;
    }, { timeout: 180000, interval: 3000 });
    r.check('7. 기준 브랜치와 충돌하면 mergeable CONFLICTING, mergeStateStatus DIRTY로 보인다', conflicted.mergeStateStatus === 'DIRTY', conflictSamples.join(' → '));
    const restPr = apiJson('GET', `repos/${REPO}/pulls/${n}`);
    r.observe('7. 충돌 때 REST pulls/{n}', { mergeable: restPr.mergeable, mergeable_state: restPr.mergeable_state, base_sha: restPr.base.sha, base_branch_head: basePut.commit.sha, graphql_baseRefOid: conflicted.baseRefOid });

    // 7. 푼다: 기준 브랜치를 병합하고(D181) ci-flaky를 끈 뒤 일반 push
    git(wt, 'fetch', 'origin', B.base);
    r.observe('7. 기준 브랜치 병합 (충돌)', show(gitTry(wt, 'merge', '--no-edit', `origin/${B.base}`)));
    // 두 쪽의 함수를 모두 남긴다. 충돌 표시만 지우면 git이 공통 줄을 충돌 밖으로 빼 둬 주석이 깨질 수 있다.
    fs.writeFileSync(cart, git(wt, 'show', `origin/${B.base}:src/cart.mjs`) + '\n' + HEAD_CODE);
    git(wt, 'add', 'src/cart.mjs');
    git(wt, 'commit', '--no-edit');
    git(wt, 'rm', '-q', 'ci-flaky');
    git(wt, 'commit', '-m', 's7: ci-flaky 끔');
    const pushMerged = gitTry(wt, 'push', 'origin', `${B.head}:${B.head}`);
    r.check('7. 기준 브랜치를 병합한 커밋은 일반 push로 올라간다', pushMerged.code === 0, show(pushMerged));
    const sha2 = git(wt, 'rev-parse', 'HEAD');
    r.observe('7. push 뒤 새 head의 체크 목록 길이 (경과:head:길이:mergeable/mergeStateStatus)', await checksAppear(n, sha2));
    const resolved = await waitFor('충돌이 풀림', () => {
      const p = prView(n, ['mergeable', 'mergeStateStatus', 'headRefOid']);
      return p.headRefOid === sha2 && p.mergeable === 'MERGEABLE' ? p : null;
    }, { timeout: 180000, interval: 3000 });
    r.check('7. 병합해 푼 뒤 mergeable이 MERGEABLE이 된다', true, JSON.stringify(resolved));

    // 8. 원격 PR 브랜치가 앞서 나감 (D193). (a) GitHub에서 한 커밋(웹 편집과 같음)
    const web1 = apiJson('PUT', `repos/${REPO}/contents/s7-web-edit.txt`, { message: 's7: GitHub에서 더한 커밋 (웹 편집)', content: b64('웹 편집\n'), branch: B.head });
    git(wt, 'fetch', 'origin', B.head);
    const aheadOnly = gitTry(wt, 'merge-base', '--is-ancestor', 'HEAD', `origin/${B.head}`).code;
    const cleanTree = git(wt, 'status', '--porcelain') === '';
    const ff1 = gitTry(wt, 'merge', '--ff-only', `origin/${B.head}`);
    r.check('8. 원격만 앞서면(로컬 HEAD가 원격 head의 조상) fetch 뒤 merge --ff-only로 받는다', aheadOnly === 0 && cleanTree && ff1.code === 0 && git(wt, 'rev-parse', 'HEAD') === web1.commit.sha, show(ff1));

    // 8. (b) GitHub의 [Update branch](update-branch API): 받은 커밋에 기준 브랜치 병합이 있는지 가린다(D181, D193)
    const base2 = apiJson('PUT', `repos/${REPO}/contents/s7-base-2.txt`, { message: 's7: 기준 브랜치 두 번째 변경', content: b64('기준\n'), branch: B.base });
    await sleep(3000);
    const update = await waitFor('update-branch', () => {
      const res = api('PUT', `repos/${REPO}/pulls/${n}/update-branch`, { expected_head_sha: web1.commit.sha });
      return res.code === 0 ? res : null;
    }, { timeout: 60000, interval: 5000 });
    r.observe('8. update-branch 응답', show(update));
    const sha3 = await waitFor('update-branch 뒤 head', () => {
      const p = prView(n, ['headRefOid']);
      return p.headRefOid !== web1.commit.sha ? p.headRefOid : null;
    }, { timeout: 120000, interval: 3000 });
    git(wt, 'fetch', 'origin', B.head);
    const ff2 = gitTry(wt, 'merge', '--ff-only', `origin/${B.head}`);
    const received = git(wt, 'rev-list', '--parents', `${web1.commit.sha}..${sha3}`).split('\n');
    const baseMerge = received.find((l) => l.split(' ').slice(2).includes(base2.commit.sha));
    r.check('8. update-branch로 생긴 병합 커밋을 fast-forward로 받고, 두 번째 부모가 기준 브랜치 커밋인 것으로 가린다', ff2.code === 0 && !!baseMerge, JSON.stringify({ received, base: base2.commit.sha }));

    // 8. (c) 로컬에도 커밋이 있으면 갈라진다. fetch 전과 뒤의 push 거절 모양을 기록한다.
    fs.writeFileSync(path.join(wt, 's7-local.txt'), '로컬\n');
    git(wt, 'add', '-A');
    git(wt, 'commit', '-m', 's7: 로컬 커밋');
    const webFile = apiJson('GET', `repos/${REPO}/contents/s7-web-edit.txt?ref=${enc(B.head)}`);
    apiJson('PUT', `repos/${REPO}/contents/s7-web-edit.txt`, { message: 's7: GitHub에서 더한 두 번째 커밋', content: b64('웹 편집 2\n'), sha: webFile.sha, branch: B.head });
    const push1 = gitTry(wt, 'push', '--porcelain', 'origin', `${B.head}:${B.head}`);
    git(wt, 'fetch', 'origin', B.head);
    const localInRemote = gitTry(wt, 'merge-base', '--is-ancestor', 'HEAD', `origin/${B.head}`).code;
    const remoteInLocal = gitTry(wt, 'merge-base', '--is-ancestor', `origin/${B.head}`, 'HEAD').code;
    const push2 = gitTry(wt, 'push', '--porcelain', 'origin', `${B.head}:${B.head}`);
    r.observe('8. 갈라졌을 때 push (fetch 전)', show(push1));
    r.observe('8. 갈라졌을 때 push (fetch 뒤)', show(push2));
    r.check('8. 로컬에도 커밋이 있으면 일반 push가 거절된다', push1.code !== 0 && push2.code !== 0, `${show(push1)}\n${show(push2)}`);
    r.check('8. fetch 뒤 두 방향 조상 검사가 모두 아니면(1, 1) 갈라짐이다', localInRemote === 1 && remoteInLocal === 1, `${localInRemote} ${remoteInLocal}`);
    git(wt, 'merge', '--no-edit', `origin/${B.head}`);
    const push3 = gitTry(wt, 'push', 'origin', `${B.head}:${B.head}`);
    r.check('8. 원격 PR 브랜치를 병합한 뒤 일반 push가 된다', push3.code === 0, show(push3));
    const sha4 = git(wt, 'rev-parse', 'HEAD');

    // 9. PR 하나를 한 번 읽는 데 드는 요청 수와 한도 (D158)
    // 같은 읽기를 두 번 하고, 응답 머리글의 X-Ratelimit-Used가 한 번 읽기에 얼마나 느는지 한도(resource)마다 본다.
    const readOnce = () => [
      ['pr', 'view', String(n), '--repo', REPO, '--json', PR_FIELDS.join(',')],
      ['api', `repos/${REPO}/pulls/${n}/reviews?per_page=100`, '--paginate', '--slurp'],
      ['api', `repos/${REPO}/pulls/${n}/comments?per_page=100`, '--paginate', '--slurp'],
      ['api', `repos/${REPO}/issues/${n}/comments?per_page=100`, '--paginate', '--slurp'],
    ].map((args) => ({ cmd: args.slice(0, 3).join(' '), ...counted(args) }));
    const read1 = readOnce();
    const read2 = readOnce();
    const lastUsed = (reads) => Object.fromEntries(reads.flatMap((x) => x.rate).map((x) => [x.resource, x.used]));
    const u1 = lastUsed(read1);
    const u2 = lastUsed(read2);
    const perRead = Object.fromEntries(Object.keys(u2).map((k) => [k, u2[k] - (u1[k] ?? u2[k])]));
    const limits = Object.fromEntries(read2.flatMap((x) => x.rate).map((x) => [x.resource, x.limit]));
    const requests = read2.flatMap((x) => x.urls);
    const usage = { requests: requests.length, graphqlRequests: requests.filter((u) => u.startsWith('/graphql')).length, perRead, limits, perHour: Object.fromEntries(Object.keys(perRead).map((k) => [k, perRead[k] * 30])) };
    r.observe('9. 한 번 읽기의 명령별 요청과 응답 머리글의 한도 (두 번째 읽기)', read2.map((x) => ({ cmd: x.cmd, code: x.code, requests: x.urls, rate: x.rate, debugHead: x.head })));
    r.observe('9. 한 번 읽기가 쓰는 한도, 2분 주기의 시간당 사용량', usage);
    r.check('9. PR 하나를 2분마다 읽어도 한도 안이다 (시간당 사용량 < 한도의 10%)', [...read1, ...read2].every((x) => x.code === 0) && requests.length > 0 && Object.keys(perRead).length > 0 && Object.keys(perRead).every((k) => perRead[k] >= 0 && usage.perHour[k] < limits[k] / 10), JSON.stringify(usage));

    // 사람의 코멘트를 받을 수 있게 CI가 끝난 상태로 PR을 남긴다.
    const final = await waitChecks(n, sha4, '마지막 head의 CI');
    r.observe('2. 체크가 통과한 뒤의 PR 상태', brief(final));
    r.observe('사람이 할 일', humanSteps(n, url, ctx.login));
    done = true;
  } finally {
    writeJson(path.join(RESULTS, 'S7-start-raw.json'), JSON.parse(redact(JSON.stringify(raw))));
    if (!done) cleanupRun(r, id);
  }
}

function humanSteps(n, url, owner) {
  const text = [
    `## S7 사람이 할 일 (PR #${n})`,
    '',
    url,
    '',
    `다른 GitHub 계정 둘로 이 PR에 코멘트를 단다. 토큰의 계정(${owner})은 쓰지 않는다.`,
    '',
    '- 계정 A: 이 레포의 협업자(레포 Settings → Collaborators에서 초대하고, 계정 A가 초대를 수락함)',
    '- 계정 B: 협업자가 아닌 계정',
    '',
    '계정마다 다음을 한다.',
    '',
    '1. Conversation 탭 맨 아래에 대화 코멘트를 단다(예: "A 대화 코멘트").',
    '2. Files changed 탭에서 `src/cart.mjs`의 더한 줄(초록 줄) 하나에 인라인 코멘트를 적고 [Start a review]를 누른다. [Submit review](또는 [Review changes])에서 본문을 적고 [Comment]로 제출한다.',
    `3. Conversation 탭에서 "${'소유자 인라인 코멘트 (S7)'}" 스레드에 [Reply]로 답글을 단다.`,
    '4. (계정 A만, 할 수 있으면) 리뷰를 [Approve]로 한 번 더 제출한다.',
    '',
    `아무 계정으로나 PR 화면에서 "${TAG}"가 붙은 답글 둘에 \`<!-- relay:\` 글자가 보이지 않는지도 본다(절차 4).`,
    '',
    `다 달았으면 spikes 워크플로를 spikes=S7, s7=finish, s7_pr=${n}으로 돌린다. finish가 머지와 정리까지 한다.`,
    '코멘트를 달지 않고 끝내려면 s7=cleanup으로 돌린다.',
  ].join('\n');
  fs.writeFileSync(path.join(RESULTS, 'S7-human.md'), `${text}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n\n`);
  console.log(text);
  return text;
}

// 머지 뒤 브랜치 삭제를 볼 PR을 하나 더 만든다. worktree에 head 브랜치를 체크아웃해 둔다(relay의 Work worktree처럼).
async function extraPr(main, dir, B, id, name) {
  const br = B[name];
  const wt = path.join(dir, name);
  git(main, 'worktree', 'add', '--no-track', '-b', br, wt, `origin/${B.base}`);
  fs.writeFileSync(path.join(wt, `s7-${name}.txt`), `${name}\n`);
  git(wt, 'add', '-A');
  git(wt, 'commit', '-m', `s7: ${name}`);
  git(wt, 'push', '--set-upstream', 'origin', `${br}:${br}`);
  const created = gh(['pr', 'create', '--repo', REPO, '--base', B.base, '--head', br, '--title', `S7 시험 ${id} ${name}`, '--body', 'S7 시험 PR (머지 뒤 브랜치 삭제를 본다)'], { cwd: wt });
  const n = Number(ok(created, 'pr create').match(/\/pull\/(\d+)/)[1]);
  const sha = git(wt, 'rev-parse', 'HEAD');
  await waitChecks(n, sha, `${name} CI`);
  await waitFor(`${name} mergeable`, () => prView(n, ['mergeable']).mergeable === 'MERGEABLE', { timeout: 120000, interval: 3000 });
  return { br, wt, n, sha };
}

// 로컬 상태: worktree 목록, 브랜치, 각 worktree의 현재 브랜치와 HEAD
const localState = (main) => ({ worktrees: git(main, 'worktree', 'list', '--porcelain').replace(/\n\n/g, ' | '), branches: git(main, 'branch', '--format=%(refname:short)').split('\n') });
const remoteHas = (main, br) => gitTry(main, 'ls-remote', '--exit-code', '--heads', 'origin', br).code === 0;

// S7이 만든 PR의 run id (head 브랜치 s7/<run>/head)
function runOf(n) {
  const m = prView(n, ['headRefName']).headRefName.match(/^s7\/([^/]+)\/head$/);
  if (!m) throw new Error(`S7이 만든 PR이 아닙니다: #${n}`);
  return m[1];
}

async function finishPhase(r) {
  const ctx = prepare(r);
  const n = Number(process.env.S7_PR);
  if (!n) throw new Error('S7_PR(시험 PR 번호)가 필요합니다');
  const id = runOf(n);
  const B = branches(id);
  const raw = { id, n };
  try {
    // 3. 사람이 단 코멘트까지 모두 읽고, 작성자마다 협업자 여부(REST collaborators)와 작성자 관계를 맞춰 본다.
    const c = readComments(n);
    raw.comments = c;
    const items = [...c.reviews.map((x) => ['review', x]), ...c.inline.map((x) => ['inline', x]), ...c.convo.map((x) => ['convo', x])];
    const people = {};
    for (const [kind, x] of items) {
      const login = x.user.login;
      if (!people[login]) {
        const collab = api('GET', `repos/${REPO}/collaborators/${enc(login)}`);
        const perm = x.user.type === 'Bot' ? null : api('GET', `repos/${REPO}/collaborators/${enc(login)}/permission`);
        people[login] = { type: x.user.type, collaborator: collab.code === 0, permission: perm?.code === 0 ? JSON.parse(perm.stdout).role_name : perm?.stderr, associations: {} };
      }
      (people[login].associations[kind] ||= new Set()).add(x.author_association);
    }
    for (const p of Object.values(people)) for (const k of Object.keys(p.associations)) p.associations[k] = [...p.associations[k]];
    r.observe('3. 작성자마다 종류(REST user.type), 협업자 여부, 권한, 코멘트 종류별 작성자 관계', people);
    r.observe('3. 리뷰 (REST)', c.reviews.map(who));
    r.observe('3. 인라인 코멘트와 답글 (REST)', c.inline.map(who));
    r.observe('3. 대화 코멘트 (REST)', c.convo.map(who));
    const humans = Object.entries(people).filter(([login, p]) => p.type === 'User' && login !== ctx.login);
    const collabs = humans.filter(([, p]) => p.collaborator);
    const others = humans.filter(([, p]) => !p.collaborator);
    const assocs = (p) => Object.values(p.associations).flat();
    // 사람이 그 계정으로 코멘트를 달지 않았으면 판정하지 않고 "확인 못 함"으로 남긴다.
    if (collabs.length) r.check('3. 협업자 계정의 코멘트는 작성자 관계가 COLLABORATOR다 (D160)', collabs.every(([, p]) => assocs(p).every((a) => a === 'COLLABORATOR')), JSON.stringify(collabs));
    else r.observe('3. 협업자 계정의 코멘트 (D160)', '없음. 사람 단계를 하지 않아 확인 못 함');
    if (others.length) r.check('3. 협업자가 아닌 계정의 코멘트는 OWNER·MEMBER·COLLABORATOR가 아니다 (D160)', others.every(([, p]) => assocs(p).every((a) => !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(a))), JSON.stringify(others));
    else r.observe('3. 협업자가 아닌 계정의 코멘트 (D160)', '없음. 사람 단계를 하지 않아 확인 못 함');
    // 앱의 거르기를 흉내 낸다: 본문이 빈 리뷰와 앱의 답글(표시)은 항목이 아니고, 사람의 것은 작성자 관계가
    // OWNER·MEMBER·COLLABORATOR일 때만 받는다(D160). 봇은 받을 봇 목록(D161)이 비어 있어 받지 않는다.
    const view = items
      .filter(([kind, x]) => !(kind === 'review' && !(x.body || '').trim()) && !/<!-- relay:/.test(x.body || ''))
      .map(([kind, x]) => `${kind}:${x.id} ${x.user.login} ${x.author_association}${x.in_reply_to_id ? ` (답글 → ${x.in_reply_to_id})` : ''} → ${x.user.type === 'User' && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(x.author_association) ? '받음' : '받지 않음'}`);
    r.observe('3. 앱의 거르기를 흉내 낸 결과 (D157, D160, D161, D194)', view);
    const gql = ghJson(['pr', 'view', String(n), '--repo', REPO, '--json', 'comments,reviews,latestReviews,reviewDecision']);
    raw.graphql = gql;
    r.observe('3. GraphQL(gh pr view --json)의 작성자와 관계', { comments: gql.comments.map((x) => `${x.author?.login}:${x.authorAssociation}`), reviews: gql.reviews.map((x) => `${x.author?.login}:${x.authorAssociation}:${x.state}`), latestReviews: gql.latestReviews.map((x) => `${x.author?.login}:${x.state}`), reviewDecision: gql.reviewDecision });

    // 6. 머지: 허용하는 방식을 읽고, 사람이 본 head가 아니면 머지되지 않는지, 본 head로 머지되는지 본다.
    const methods = { squash: ctx.view.squashMergeAllowed, merge: ctx.view.mergeCommitAllowed, rebase: ctx.view.rebaseMergeAllowed };
    const method = Object.keys(methods).find((k) => methods[k]);
    r.check('6. 레포가 허용하는 머지 방식을 읽는다 (gh repo view --json)', !!method, JSON.stringify({ methods, viewerDefaultMergeMethod: ctx.view.viewerDefaultMergeMethod }));
    const dir = path.join(WORK, 's7', `${id}-finish`);
    const main = cloneRepo(dir, ctx.rest.default_branch);
    const wt = path.join(dir, 'wt');
    git(main, 'worktree', 'add', '--track', '-b', B.head, wt, `origin/${B.head}`);
    const head = prView(n).headRefOid;
    const stale = git(main, 'rev-parse', `${head}^`);
    const bad = gh(['pr', 'merge', String(n), '--repo', REPO, `--${method}`, '--match-head-commit', stale], { cwd: wt });
    r.check('6. --match-head-commit이 지금 head가 아니면 머지되지 않는다 (D176)', bad.code !== 0 && prView(n, ['state']).state === 'OPEN', show(bad));
    r.observe('6. 옛 head로 gh pr merge --match-head-commit을 하면 (출력)', show(bad));
    const badRest = api('PUT', `repos/${REPO}/pulls/${n}/merge`, { sha: stale, merge_method: method });
    r.observe('6. REST pulls/{n}/merge에 옛 sha를 주면', show(badRest));
    const before = localState(main);
    const wtBefore = `${git(wt, 'branch', '--show-current')} ${git(wt, 'rev-parse', 'HEAD')}`;
    const merged = gh(['pr', 'merge', String(n), '--repo', REPO, `--${method}`, '--match-head-commit', head], { cwd: wt });
    const after = prView(n, ['state', 'mergedAt', 'mergeCommit', 'headRefOid', 'closed']);
    r.check('6. 사람이 본 head(--match-head-commit)로 머지된다', merged.code === 0 && after.state === 'MERGED', `${show(merged)}\n${JSON.stringify(after)}`);
    r.observe('6. 머지된 PR을 읽은 값 (밖에서 머지된 것을 읽을 때와 같음, D179)', after);
    const wtAfter = `${git(wt, 'branch', '--show-current')} ${git(wt, 'rev-parse', 'HEAD')}`;
    r.check('6. --repo를 준 머지는 worktree와 로컬 브랜치를 건드리지 않는다', JSON.stringify(before) === JSON.stringify(localState(main)) && wtBefore === wtAfter, JSON.stringify({ before, after: localState(main), wtBefore, wtAfter }));
    r.observe('6. 머지 직후 원격 head 브랜치가 남아 있다 (delete_branch_on_merge)', { exists: remoteHas(main, B.head), delete_branch_on_merge: ctx.rest.delete_branch_on_merge });
    const del = gitTry(main, 'push', 'origin', '--delete', B.head);
    r.check('6. 머지 뒤 원격 브랜치를 git push --delete로 지운다', del.code === 0 && !remoteHas(main, B.head), show(del));

    // 6. --delete-branch를 준 머지가 로컬을 어떻게 하는지 본다. (가) --repo를 주고 그 worktree에서, (나) --repo 없이 메인 체크아웃에서
    const two = await extraPr(main, dir, B, id, 'head2');
    const b2 = localState(main);
    const m2 = gh(['pr', 'merge', String(two.n), '--repo', REPO, `--${method}`, '--delete-branch'], { cwd: two.wt });
    r.observe('6. (가) --repo --delete-branch, worktree에서: 출력, 로컬 전후, 원격 브랜치', { out: show(m2), before: b2, after: localState(main), wtExists: fs.existsSync(two.wt), remote: remoteHas(main, two.br), state: prView(two.n, ['state']).state });
    const three = await extraPr(main, dir, B, id, 'head3');
    gh(['pr', 'close', String(three.n), '--repo', REPO]);
    const closedPr = prView(three.n, ['state', 'closed', 'mergedAt']);
    gh(['pr', 'reopen', String(three.n), '--repo', REPO]);
    const reopened = prView(three.n, ['state', 'closed']);
    r.check('6. 닫힌 PR과 다시 열린 PR을 state로 읽는다 (D179)', closedPr.state === 'CLOSED' && reopened.state === 'OPEN', JSON.stringify({ closedPr, reopened }));
    await waitFor('다시 연 PR mergeable', () => prView(three.n, ['mergeable']).mergeable === 'MERGEABLE', { timeout: 120000, interval: 3000 });
    const b3 = localState(main);
    const m3 = gh(['pr', 'merge', String(three.n), `--${method}`, '--delete-branch'], { cwd: main });
    r.observe('6. (나) --repo 없이 --delete-branch, 메인 체크아웃에서: 출력, 로컬 전후, 원격 브랜치', { out: show(m3), before: b3, after: localState(main), wtExists: fs.existsSync(three.wt), remote: remoteHas(main, three.br), state: prView(three.n, ['state']).state });
  } finally {
    writeJson(path.join(RESULTS, 'S7-finish-raw.json'), JSON.parse(redact(JSON.stringify(raw))));
    cleanupRun(r, id);
  }
}

export default async function run() {
  const r = new Result(`S7-${PHASE}`, `GitHub 연동 (${PHASE})`);
  try {
    r.observe('시험용 레포', REPO);
    if (PHASE === 'start') await startPhase(r);
    else if (PHASE === 'finish') await finishPhase(r);
    else if (PHASE === 'cleanup') cleanupRun(r, process.env.S7_PR ? runOf(Number(process.env.S7_PR)) : '');
    else throw new Error(`S7_PHASE는 start, finish, cleanup 중 하나다: ${PHASE}`);
  } catch (e) {
    r.error(e);
  } finally {
    r.save();
  }
  return r;
}
