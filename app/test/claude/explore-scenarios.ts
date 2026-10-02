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

export const EXPLORE_SCENARIOS: readonly ExploreScenario[] = [billing, notify, shop]
