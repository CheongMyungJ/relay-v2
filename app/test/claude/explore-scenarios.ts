// [탐색] 지식 관리 시나리오 (explore-knowledge.test.ts). 합격 판정 없이 기록만 남긴다.
import fs from 'node:fs'
import path from 'node:path'
import type { AppConfig } from '../../src/shared/config'
import type { KnowledgeChoices, KnowledgeEntry, KnowledgeReview } from '../../src/shared/knowledge'

export interface Seed {
  team?: KnowledgeEntry[]
  pending?: KnowledgeEntry[]
  mine?: KnowledgeEntry[]
}

export interface ExploreWork {
  name: string
  request: string
  type?: 'bugfix' | 'feature' | 'refactor'
  /** Work 전에 main의 레포를 바꾼다 (커밋은 도구가 한다) */
  before?: (repo: string) => void
  /** Work 완료 화면의 거르기. 없으면 기본 선택 */
  choices?: (review: KnowledgeReview | null) => KnowledgeChoices | undefined
}

export interface ExploreScenario {
  id: string
  files: Record<string, string>
  seed?: Seed
  config?: Partial<AppConfig>
  works: ExploreWork[]
}

const pkg = (scripts: Record<string, string>) =>
  `${JSON.stringify({ name: 'x', private: true, type: 'module', scripts }, null, 2)}\n`

function entry(
  over: Partial<KnowledgeEntry> & Pick<KnowledgeEntry, 'id' | 'kind' | 'rule'>,
): KnowledgeEntry {
  return {
    subkind: null,
    status: 'active',
    superseded_by: null,
    paths: [],
    terms: [],
    hashes: {},
    source: { work: 'w-20260901-001', task: 't-01', by: 'human' },
    why: '미리 넣은 지식',
    not_in_code: '사람이 정함',
    incentive: '없음',
    ...over,
  }
}

// ---------- billing: 요청에 적힌 팀 규칙 → 다른 말로 쓴 다음 요청 → 기능 추가 ----------

const BILLING: Record<string, string> = {
  'package.json': pkg({ test: 'node --test' }),
  'src/invoice.js': [
    '// 청구서 금액 계산. 금액은 원 단위 정수',
    'export const VAT_RATE = 0.1',
    '',
    'export function lineAmount(line) {',
    '  return line.price * line.qty - (line.discount ?? 0)',
    '}',
    '',
    'export function invoiceTotal(lines) {',
    '  const supply = lines.reduce((s, l) => s + lineAmount(l), 0)',
    '  const vat = Math.round(supply * VAT_RATE)',
    '  return { supply, vat, total: supply + vat }',
    '}',
    '',
  ].join('\n'),
  'src/refund.js': [
    "import { VAT_RATE } from './invoice.js'",
    '',
    '// 반품 금액. 돌려받는 줄만 받는다',
    'export function refundAmount(lines) {',
    '  let gross = 0',
    '  for (const l of lines) gross += l.price * l.qty',
    '  const promo = lines.reduce((s, l) => s + (l.discount ?? 0), 0)',
    '  const tax = Math.round(gross * VAT_RATE)',
    '  return { supply: gross - promo, tax, total: gross - promo + tax }',
    '}',
    '',
  ].join('\n'),
  'src/export/csv.js': [
    "import { lineAmount } from '../invoice.js'",
    '',
    '// 청구서 줄을 CSV로 내보낸다',
    'export function invoiceCsv(lines) {',
    "  const head = 'name,qty,price,amount'",
    '  const rows = lines.map((l) => [l.name, l.qty, l.price, lineAmount(l)].join(","))',
    "  return [head, ...rows].join('\\n')",
    '}',
    '',
  ].join('\n'),
  'test/invoice.test.js': [
    "import { test } from 'node:test'",
    "import assert from 'node:assert'",
    "import { invoiceTotal } from '../src/invoice.js'",
    '',
    "test('한 줄', () => assert.deepStrictEqual(invoiceTotal([{ price: 1000, qty: 1 }]), { supply: 1000, vat: 100, total: 1100 }))",
    '',
  ].join('\n'),
}

const billing: ExploreScenario = {
  id: 'billing',
  files: BILLING,
  works: [
    {
      name: 'w1-invoice-rule-in-request',
      request: [
        '청구서의 부가세가 회계 시스템 금액과 1~2원씩 다르게 나온다.',
        '예: 1,005원 품목 2줄이면 회계 시스템은 부가세 200원인데 우리는 201원이다.',
        '',
        '회계팀 규칙(앞으로도 계속 지킬 것): 부가세는 품목 줄마다 계산해 원 단위 미만을 버리고 합산한다. 할인은 부가세를 매기기 전에 그 줄에서 뺀다.',
        '',
        '(src/invoice.js의 invoiceTotal)',
        '',
      ].join('\n'),
    },
    {
      name: 'w2-refund-other-words',
      request: [
        'Refund API 응답의 tax 값이 POS 영수증보다 몇 원 크게 나온다는 CS 문의가 계속 들어온다.',
        '프로모션 가격으로 산 상품을 돌려받으면 차이가 더 크다.',
        '',
        '재현: node -e "import(\'./src/refund.js\').then((m) => console.log(m.refundAmount([{ price: 1005, qty: 1, discount: 5 }, { price: 1005, qty: 1 }])))"',
        '',
      ].join('\n'),
    },
    {
      name: 'w3-csv-feature',
      type: 'feature',
      request: [
        '청구서 CSV 내보내기에 줄마다 부가세 열(vat)을 추가해 주세요.',
        '회계팀이 줄별 금액을 회계 시스템과 대조하려고 한다.',
        '',
      ].join('\n'),
    },
  ],
}

// ---------- notify: 미리 넣은 팀 지식이 코드 변경으로 낡고, 공유 대기의 규칙이 틀림 ----------

const NOTIFY: Record<string, string> = {
  'package.json': pkg({ test: 'node --test test/', 'test:int': 'node --test test-int/' }),
  'src/retry.js': [
    '// 웹훅 재시도. 실패하면 times번까지 다시 보낸다',
    'export async function withRetry(fn, { times = 3 } = {}) {',
    '  let last',
    '  for (let i = 0; i < times; i++) {',
    '    try {',
    '      return await fn()',
    '    } catch (e) {',
    '      last = e',
    '    }',
    '  }',
    '  throw last',
    '}',
    '',
  ].join('\n'),
  'src/webhook.js': [
    "import { withRetry } from './retry.js'",
    '',
    '// 파트너사 웹훅. post는 { status }를 돌려주고, 2xx가 아니면 오류를 던진다',
    'export async function sendWebhook(post, event) {',
    '  const payload = { event_type: event.type, order_id: event.orderId, sent_at: event.at }',
    '  return withRetry(async () => {',
    '    const res = await post(payload)',
    '    if (res.status < 200 || res.status >= 300) {',
    '      const e = new Error(`webhook ${res.status}`)',
    '      e.status = res.status',
    '      throw e',
    '    }',
    '    return res',
    '  })',
    '}',
    '',
  ].join('\n'),
  'test/webhook.test.js': [
    "import { test } from 'node:test'",
    "import assert from 'node:assert'",
    "import { sendWebhook } from '../src/webhook.js'",
    '',
    "test('성공하면 한 번', async () => {",
    '  let n = 0',
    '  await sendWebhook(async () => (n++, { status: 200 }), { type: "paid", orderId: 1, at: 0 })',
    '  assert.strictEqual(n, 1)',
    '})',
    '',
  ].join('\n'),
  'test-int/partner.test.js': [
    "import { test } from 'node:test'",
    "test('가짜 파트너 서버', () => {})",
    '',
  ].join('\n'),
}

/** Work 전에 main에서: 재시도를 src/lib/backoff.js로 옮기고, 횟수를 5로, 통합 시험 스크립트 이름을 바꾼다 */
function notifyRefactor(repo: string): void {
  const retry = fs.readFileSync(path.join(repo, 'src/retry.js'), 'utf8')
  fs.mkdirSync(path.join(repo, 'src/lib'), { recursive: true })
  fs.writeFileSync(
    path.join(repo, 'src/lib/backoff.js'),
    retry
      .replace('// 웹훅 재시도.', '// 웹훅 재시도 (파트너 SLA 변경으로 2026-09부터 5회).')
      .replace('times = 3', 'times = 5'),
  )
  fs.rmSync(path.join(repo, 'src/retry.js'))
  const hook = path.join(repo, 'src/webhook.js')
  fs.writeFileSync(
    hook,
    fs.readFileSync(hook, 'utf8').replace("'./retry.js'", "'./lib/backoff.js'"),
  )
  fs.writeFileSync(
    path.join(repo, 'package.json'),
    pkg({ test: 'node --test test/', 'test:integration': 'node --test test-int/' }),
  )
}

const notify: ExploreScenario = {
  id: 'notify',
  files: NOTIFY,
  seed: {
    team: [
      entry({
        id: 'constraint-a0000001',
        kind: 'constraint',
        subkind: 'compat',
        rule: '웹훅 페이로드 필드 이름은 snake_case를 유지한다(파트너사 파서가 고정)',
        paths: ['src/webhook.js'],
        terms: ['웹훅', '페이로드'],
        incentive: 'camelCase로 통일한다',
      }),
      entry({
        id: 'failure-a0000002',
        kind: 'failure',
        rule: '재시도는 src/retry.js의 withRetry 한 곳에서만 정한다. 호출하는 쪽에서 따로 재시도하면 중복 발송된다',
        paths: ['src/retry.js'],
        terms: ['재시도', '중복 발송'],
        source: { work: 'w-20260901-002', task: 't-02', by: 'ai' },
        not_in_code: '중복 발송은 파트너사 로그에서만 보였다',
        incentive: 'sendWebhook 안에서 한 번 더 감싼다',
      }),
      entry({
        id: 'recipe-a0000003',
        kind: 'recipe',
        rule: '통합 시험은 npm run test:int로 돌린다(가짜 파트너 서버를 띄움)',
        paths: ['package.json'],
        terms: ['통합 시험', '웹훅'],
        source: { work: 'w-20260901-002', task: 't-03', by: 'ai' },
        not_in_code: 'README에 없음',
        incentive: 'npm test만 돌리고 끝낸다',
      }),
    ],
    pending: [
      entry({
        id: 'domain-a0000004',
        kind: 'domain',
        rule: '웹훅 재시도는 최대 3회다(파트너 SLA)',
        paths: ['src/retry.js'],
        terms: ['재시도 횟수', '웹훅'],
        why: '파트너 계약서',
        incentive: '재시도를 늘린다',
      }),
    ],
  },
  works: [
    {
      name: 'w1-4xx-retry',
      before: notifyRefactor,
      request: [
        '파트너사 웹훅이 400 Bad Request를 돌려줄 때도 우리가 계속 다시 보내서, 파트너사가 차단하겠다고 연락이 왔다.',
        '4xx 응답은 다시 보내지 말아야 한다. 429(요청 과다)는 예외로 다시 보낸다.',
        '',
      ].join('\n'),
    },
    {
      name: 'w2-webhook-again',
      request: [
        '웹훅 발송이 파트너 서버가 느릴 때 같은 주문으로 두 번 가는 일이 있다고 한다. 확인해 주세요.',
        '',
      ].join('\n'),
    },
  ],
}

// ---------- shop: 기능 추가 → 리팩터링 → 버그 수정. 후보의 양과 다음 Work의 다시 올림 ----------

const SHOP: Record<string, string> = {
  'package.json': pkg({ test: 'node --test' }),
  'src/catalog.js': [
    '// 상품 목록. 가격은 원, stock은 재고 수량',
    'export const PRODUCTS = [',
    "  { id: 1, name: '사과', price: 3000, stock: 5, category: 'fruit' },",
    "  { id: 2, name: '배', price: 5000, stock: 0, category: 'fruit' },",
    "  { id: 3, name: '우유', price: 2500, stock: 12, category: 'dairy' },",
    "  { id: 4, name: '치즈', price: 9000, stock: 2, category: 'dairy' },",
    ']',
    '',
    '// 목록 화면에 보일 상품. 재고가 없는 상품도 보인다(품절 표시는 화면이 한다)',
    'export function listProducts(products, { category } = {}) {',
    '  return products.filter((p) => !category || p.category === category)',
    '}',
    '',
  ].join('\n'),
  'src/cart.js': [
    "import { PRODUCTS } from './catalog.js'",
    '',
    'export function addToCart(cart, id, qty) {',
    '  const p = PRODUCTS.find((x) => x.id === id)',
    "  if (!p) throw new Error('없는 상품')",
    '  const item = cart.find((c) => c.id === id)',
    '  if (item) item.qty += qty',
    '  else cart.push({ id, qty, price: p.price })',
    '  return cart',
    '}',
    '',
    'export function cartTotal(cart) {',
    '  let t = 0',
    '  for (const c of cart) t += c.price * c.qty',
    '  return t',
    '}',
    '',
  ].join('\n'),
  'test/catalog.test.js': [
    "import { test } from 'node:test'",
    "import assert from 'node:assert'",
    "import { PRODUCTS, listProducts } from '../src/catalog.js'",
    '',
    "test('분류', () => assert.strictEqual(listProducts(PRODUCTS, { category: 'dairy' }).length, 2))",
    '',
  ].join('\n'),
}

const shop: ExploreScenario = {
  id: 'shop',
  files: SHOP,
  works: [
    {
      name: 'w1-price-filter',
      type: 'feature',
      request: [
        '상품 목록에 가격 범위 필터(minPrice, maxPrice)를 추가해 주세요. 품절 상품을 숨기는 옵션(inStockOnly)도 필요합니다.',
        '(src/catalog.js의 listProducts)',
        '',
      ].join('\n'),
    },
    {
      name: 'w2-cart-refactor',
      type: 'refactor',
      request: [
        'src/cart.js가 catalog의 PRODUCTS를 직접 import해서 시험에서 상품을 바꿔 끼우기 어렵다. 상품 조회를 인자로 받도록 바꿔 주세요. 동작은 그대로.',
        '',
      ].join('\n'),
    },
    {
      name: 'w3-cart-stock-bug',
      request: [
        '장바구니에 재고보다 많은 수량을 담을 수 있다. 재고가 2개인 치즈를 5개 담아도 막지 않는다.',
        '',
      ].join('\n'),
    },
  ],
}

// ---------- stats: 질문으로 정한 규칙 → 같은 말의 다음 요청 ----------

const stats: ExploreScenario = {
  id: 'stats',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/stats.js': [
      '// 대시보드의 응답 시간 통계 (밀리초)',
      'export function average(values) {',
      '  return values.reduce((a, b) => a + b, 0) / values.length',
      '}',
      '',
      'export function median(values) {',
      '  const s = [...values].sort((a, b) => a - b)',
      '  const m = Math.floor(s.length / 2)',
      '  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2',
      '}',
      '',
    ].join('\n'),
    'test/stats.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { average, median } from '../src/stats.js'",
      "test('평균', () => assert.strictEqual(average([1, 2, 3]), 2))",
      "test('중앙값', () => assert.strictEqual(median([3, 1, 2]), 2))",
      '',
    ].join('\n'),
  },
  works: [
    {
      name: 'w1-average-empty',
      request:
        '대시보드에서 요청이 없던 날의 평균 응답 시간이 NaN으로 보인다. 빈 날을 어떻게 보일지는 정해진 적이 없다. (src/stats.js의 average)\n',
    },
    {
      name: 'w2-median-empty',
      request:
        '같은 대시보드에서 요청이 없던 날의 응답 시간 중앙값도 이상하게 나온다. (src/stats.js의 median)\n',
    },
  ],
}

// ---------- mailer: 원인이 둘인 중복 발송 → 같은 모양의 다른 코드 ----------

const MAIL_UTIL = [
  '// 제한 시간 안에 끝나지 않으면 "timeout"을 돌려준다. 늦게 끝난 호출도 실제로는 메일을 보낸다',
  'export function withTimeout(p, ms) {',
  "  return Promise.race([p, new Promise((r) => setTimeout(() => r('timeout'), ms))])",
  '}',
  '',
].join('\n')

const mailer: ExploreScenario = {
  id: 'mailer',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/timeout.js': MAIL_UTIL,
    'src/paid-mail.js': [
      "import { withTimeout } from './timeout.js'",
      '',
      '// 결제 완료 메일. 웹훅이 같은 주문을 다시 보내면 receivedAt만 다르다',
      'export async function notifyPaid(order, deps) {',
      '  const key = `${order.id}:${order.receivedAt}`',
      "  if (deps.sent.has(key)) return 'skip'",
      '  for (let i = 0; i < 2; i++) {',
      '    const r = await withTimeout(deps.mail(order), deps.timeoutMs)',
      "    if (r === 'timeout') continue",
      '    deps.sent.add(key)',
      "    return 'sent'",
      '  }',
      "  return 'failed'",
      '}',
      '',
    ].join('\n'),
    'src/digest.js': [
      "import { withTimeout } from './timeout.js'",
      '',
      '// 일일 요약 메일. run은 실행마다 새 id를 가진다',
      'export async function sendDigest(user, day, run, deps) {',
      '  const key = `${user.id}:${day}:${run.id}`',
      "  if (deps.sent.has(key)) return 'skip'",
      '  for (let i = 0; i < 2; i++) {',
      '    const r = await withTimeout(deps.mail(user), deps.timeoutMs)',
      "    if (r === 'timeout') continue",
      '    deps.sent.add(key)',
      "    return 'sent'",
      '  }',
      "  return 'failed'",
      '}',
      '',
    ].join('\n'),
    'test/paid-mail.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { notifyPaid } from '../src/paid-mail.js'",
      "test('한 번 보냄', async () => {",
      '  let n = 0',
      '  const deps = { sent: new Set(), timeoutMs: 50, mail: async () => { n++ } }',
      "  assert.strictEqual(await notifyPaid({ id: 1, receivedAt: 't1' }, deps), 'sent')",
      '  assert.strictEqual(n, 1)',
      '})',
      '',
    ].join('\n'),
  },
  works: [
    {
      name: 'w1-paid-mail-twice',
      request:
        '결제 완료 메일이 가끔 같은 주문으로 두 번 간다는 문의가 있다. 로그를 보면 주문 id가 같다. (src/paid-mail.js)\n',
    },
    {
      name: 'w2-digest-twice',
      request: '일일 요약 메일을 같은 날 두 번 받았다는 사람이 있다. (src/digest.js)\n',
    },
  ],
}

// ---------- ledger: 증상(보고서)과 원인(금액 해석)이 다른 모듈 → 같은 원인의 다른 증상 ----------

const ledger: ExploreScenario = {
  id: 'ledger',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/parse.js': [
      '// CSV에서 읽은 금액 글자("1,234원")를 숫자로',
      'export function parseAmount(text) {',
      "  return parseFloat(String(text).replace('원', ''))",
      '}',
      '',
    ].join('\n'),
    'src/report.js': [
      "import { parseAmount } from './parse.js'",
      '',
      '// 월간 보고서 합계. rows는 CSV 줄 { amount: "1,234원" }',
      'export function monthlyTotal(rows) {',
      '  return rows.reduce((s, r) => s + parseAmount(r.amount), 0)',
      '}',
      '',
    ].join('\n'),
    'src/list.js': [
      "import { parseAmount } from './parse.js'",
      '',
      '// 주문 목록 화면의 금액 표시',
      'export function listRows(rows) {',
      "  return rows.map((r) => `${r.name} ${parseAmount(r.amount).toLocaleString('ko-KR')}원`)",
      '}',
      '',
    ].join('\n'),
    'test/report.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { monthlyTotal } from '../src/report.js'",
      "test('작은 금액', () => assert.strictEqual(monthlyTotal([{ amount: '500원' }, { amount: '300원' }]), 800))",
      '',
    ].join('\n'),
  },
  works: [
    {
      name: 'w1-report-total',
      request: '월간 보고서 합계가 실제보다 훨씬 작게 나온다. (src/report.js)\n',
    },
    {
      name: 'w2-list-amount',
      request: '주문 목록 화면에서 12,000원짜리 주문이 12원으로 보인다. (src/list.js)\n',
    },
  ],
}

// ---------- mobile-api: 외부 호환(모바일 앱이 금액을 문자열로 파싱) → 같은 응답의 버그 ----------

const mobileApi: ExploreScenario = {
  id: 'mobileapi',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/api/order.js': [
      '// 주문 API 응답. 모바일 앱이 이 모양을 그대로 읽는다',
      'export function toResponse(order) {',
      '  const total = order.items.reduce((s, i) => s + i.price * i.qty, 0) * (1 - order.discountRate)',
      '  return { order_id: String(order.id), total: String(total), item_count: String(order.items.length) }',
      '}',
      '',
    ].join('\n'),
    'test/order.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { toResponse } from '../src/api/order.js'",
      "test('응답', () => assert.deepStrictEqual(toResponse({ id: 7, discountRate: 0, items: [{ price: 1000, qty: 2 }] }), { order_id: '7', total: '2000', item_count: '1' }))",
      '',
    ].join('\n'),
  },
  works: [
    {
      name: 'w1-add-shipping',
      type: 'feature',
      request: [
        '주문 API 응답에 배송비(shipping_fee)를 추가해 주세요. 주문의 shippingFee 값이다.',
        '모바일 앱(구버전 포함)이 응답의 숫자 필드를 문자열로 받아 파싱하므로 지금 응답 형식을 지켜야 합니다.',
        '',
      ].join('\n'),
    },
    {
      name: 'w2-total-decimal',
      request:
        '할인 주문에서 주문 API의 total이 "1999.9999999999998"처럼 나온다. 원 단위로 나와야 한다.\n',
    },
  ],
}

// ---------- flaky: 사람이 알려 준 금지 규칙(덮지 않기) → 다른 가끔 실패 ----------

const flaky: ExploreScenario = {
  id: 'flaky',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/export.js': [
      "import fs from 'node:fs'",
      "import os from 'node:os'",
      "import path from 'node:path'",
      '',
      '// 보고서를 임시 파일에 쓰고 제 이름으로 옮긴다',
      'export function saveReport(dir, name, text) {',
      '  const tmp = path.join(os.tmpdir(), `report-${Date.now()}.tmp`)',
      '  fs.writeFileSync(tmp, text)',
      '  fs.renameSync(tmp, path.join(dir, name))',
      '}',
      '',
    ].join('\n'),
    'src/counter.js': [
      '// 작업 번호. 모듈 전역',
      'let next = 1',
      'export function nextJobId() {',
      '  return next++',
      '}',
      '',
    ].join('\n'),
    'test/export.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import fs from 'node:fs'",
      "import os from 'node:os'",
      "import path from 'node:path'",
      "import { saveReport } from '../src/export.js'",
      "const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-'))",
      "test('여럿을 함께 저장', { concurrency: true }, async (t) => {",
      '  await Promise.all([1, 2, 3].map((i) => t.test(`r${i}`, () => {',
      '    saveReport(dir, `r${i}.txt`, `내용 ${i}`)',
      '    assert.strictEqual(fs.readFileSync(path.join(dir, `r${i}.txt`), "utf8"), `내용 ${i}`)',
      '  })))',
      '})',
      '',
    ].join('\n'),
    'test/counter.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { nextJobId } from '../src/counter.js'",
      "test('첫 번호는 1', () => assert.strictEqual(nextJobId(), 1))",
      "test('다음 번호는 2', () => assert.strictEqual(nextJobId(), 2))",
      '',
    ].join('\n'),
  },
  works: [
    {
      name: 'w1-export-flaky',
      request: [
        'CI에서 test/export.test.js가 가끔 실패한다(내용이 다른 보고서의 것으로 바뀜).',
        '팀 규칙: 가끔 실패하는 시험을 재시도, skip, 시간 늘리기로 덮지 않는다. 원인을 고친다.',
        '',
      ].join('\n'),
    },
    {
      name: 'w2-counter-flaky',
      request: 'test/counter.test.js가 시험 순서를 섞어 돌리면 가끔 실패한다고 한다.\n',
    },
  ],
}

// ---------- typo: 후보가 없어야 할 작은 Work 둘 ----------

const typo: ExploreScenario = {
  id: 'typo',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/messages.js': [
      'export const MESSAGES = {',
      "  invalidEmail: '이메일 형식이 올바르지 않습니다. (Invaild email)',",
      "  required: '필수 항목입니다.',",
      "  tooLong: '너무 깁니다. 최대 {max}자 입니다.',",
      '}',
      '',
    ].join('\n'),
    'test/messages.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { MESSAGES } from '../src/messages.js'",
      "test('있음', () => assert.ok(MESSAGES.required))",
      '',
    ].join('\n'),
  },
  works: [
    { name: 'w1-typo', request: "src/messages.js의 'Invaild email' 오타를 고쳐 주세요.\n" },
    {
      name: 'w2-spacing',
      request: "src/messages.js의 '최대 {max}자 입니다'를 '최대 {max}자입니다'로 붙여 써 주세요.\n",
    },
  ],
}

// ---------- rates: 설계에서 기각한 대안(오래된 환율) → 기각한 안이 끌리는 다음 기능 ----------

const rates: ExploreScenario = {
  id: 'rates',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/rates.js': [
      '// 환율. fetchRate(currency)는 외부 API를 부른다(느리고 호출마다 요금이 나간다)',
      'export function createRates(fetchRate) {',
      '  return {',
      '    async get(currency) {',
      '      return fetchRate(currency)',
      '    },',
      '  }',
      '}',
      '',
    ].join('\n'),
    'test/rates.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { createRates } from '../src/rates.js'",
      "test('조회', async () => assert.strictEqual(await createRates(async () => 1300).get('USD'), 1300))",
      '',
    ].join('\n'),
  },
  works: [
    {
      name: 'w1-rates-fast',
      type: 'feature',
      request: [
        '결제 화면에서 환율 조회가 느리다. 같은 통화를 연달아 조회할 때 빨라지게 해 주세요.',
        '환율은 결제 금액에 쓰이므로 1분이 넘은 값을 쓰면 안 됩니다(재무팀 규칙).',
        '',
      ].join('\n'),
    },
    {
      name: 'w2-rates-cost',
      type: 'feature',
      request: '환율 API 요금이 너무 많이 나온다. 호출 수를 크게 줄여 주세요.\n',
    },
  ],
}

// ---------- noisy: 짧은 용어와 관계없는 도메인 규칙이 많은 저장소 ----------

const noisy: ExploreScenario = {
  id: 'noisy',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/login.js': [
      '// 로그인 화면의 오류 문구',
      'export function loginError(code) {',
      "  if (code === 'WRONG_PASSWORD') return ''",
      "  if (code === 'LOCKED') return '계정이 잠겼습니다.'",
      "  return '알 수 없는 오류'",
      '}',
      '',
    ].join('\n'),
    'src/log.js': 'export const log = (msg) => console.log(new Date().toISOString(), msg)\n',
    'test/login.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { loginError } from '../src/login.js'",
      "test('잠김', () => assert.strictEqual(loginError('LOCKED'), '계정이 잠겼습니다.'))",
      '',
    ].join('\n'),
  },
  seed: {
    team: [
      entry({
        id: 'constraint-n0000001',
        kind: 'constraint',
        rule: '로그는 한 줄 JSON으로 남긴다(수집기가 줄 단위로 파싱)',
        paths: ['src/log.js'],
        terms: ['로그'],
      }),
      entry({
        id: 'domain-n0000002',
        kind: 'domain',
        rule: '시간은 서버에서 UTC로 저장하고 화면에서만 KST로 보인다',
        terms: ['시간'],
      }),
      entry({
        id: 'domain-n0000003',
        kind: 'domain',
        rule: '회원 id는 숫자가 아니라 문자열이다(외부 제휴 id 포함)',
        terms: ['id'],
      }),
      entry({
        id: 'domain-n0000004',
        kind: 'domain',
        rule: '환불은 결제 후 7일 안에만 된다',
        terms: ['환불'],
      }),
      entry({
        id: 'domain-n0000005',
        kind: 'domain',
        rule: '쿠폰은 한 주문에 하나만 쓴다',
        terms: ['쿠폰'],
      }),
      entry({
        id: 'domain-n0000006',
        kind: 'domain',
        rule: '배송비는 3만 원 이상이면 무료다',
        terms: ['배송비'],
      }),
      entry({
        id: 'domain-n0000007',
        kind: 'domain',
        rule: '탈퇴한 회원의 주문 기록은 5년 보관한다',
        terms: ['탈퇴'],
      }),
      entry({
        id: 'domain-n0000008',
        kind: 'domain',
        rule: '포인트는 결제 금액의 1%이고 원 단위 버림이다',
        terms: ['포인트'],
      }),
      entry({
        id: 'domain-n0000009',
        kind: 'domain',
        rule: '비밀번호 오류가 5번이면 계정을 30분 잠근다',
        terms: ['비밀번호', '잠금'],
      }),
      entry({
        id: 'domain-n0000010',
        kind: 'domain',
        rule: '오류 문구에는 원인 코드를 사용자에게 보이지 않는다(보안팀)',
        terms: ['오류 문구', '에러 메시지'],
      }),
    ],
  },
  works: [
    {
      name: 'w1-login-message',
      request: '로그인 화면에서 비밀번호가 틀렸을 때 아무 문구도 안 보인다. (src/login.js)\n',
    },
  ],
}

// ---------- plugin: 리팩터링이 지켜야 할 팀 지식(외부 플러그인이 import) ----------

const plugin: ExploreScenario = {
  id: 'plugin',
  files: {
    'package.json': pkg({ test: 'node --test' }),
    'src/utils.js': [
      '// 여러 곳에서 쓰는 도구 모음',
      'export function formatDate(d) {',
      '  return d.toISOString().slice(0, 10)',
      '}',
      '',
      'export function addDays(d, n) {',
      '  return new Date(d.getTime() + n * 86400000)',
      '}',
      '',
      'export function slug(s) {',
      "  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-')",
      '}',
      '',
      'export function clamp(x, lo, hi) {',
      '  return Math.min(hi, Math.max(lo, x))',
      '}',
      '',
    ].join('\n'),
    'test/utils.test.js': [
      "import { test } from 'node:test'",
      "import assert from 'node:assert'",
      "import { formatDate, slug } from '../src/utils.js'",
      "test('날짜', () => assert.strictEqual(formatDate(new Date('2026-01-02T00:00:00Z')), '2026-01-02'))",
      "test('slug', () => assert.strictEqual(slug('A B'), 'a-b'))",
      '',
    ].join('\n'),
  },
  seed: {
    team: [
      entry({
        id: 'constraint-p0000001',
        kind: 'constraint',
        subkind: 'compat',
        rule: 'src/utils.js의 formatDate와 addDays는 외부 플러그인이 이 경로에서 import한다. 옮기면 utils.js에서 다시 export한다',
        paths: ['src/utils.js'],
        terms: ['utils', '플러그인', '날짜'],
      }),
      entry({
        id: 'decision-p0000002',
        kind: 'decision',
        subkind: 'non_goal',
        rule: '날짜 계산에 외부 라이브러리(dayjs 등)를 들이지 않는다',
        paths: ['src/utils.js'],
        terms: ['날짜', '라이브러리'],
        why: '번들 크기',
      }),
    ],
  },
  works: [
    {
      name: 'w1-split-date',
      type: 'refactor',
      request:
        'src/utils.js가 커졌다. 날짜 함수들(formatDate, addDays)을 src/date.js로 나눠 주세요. 동작은 그대로.\n',
    },
  ],
}

export const EXPLORE_SCENARIOS: readonly ExploreScenario[] = [
  billing,
  notify,
  shop,
  stats,
  mailer,
  ledger,
  mobileApi,
  flaky,
  typo,
  rates,
  noisy,
  plugin,
]
