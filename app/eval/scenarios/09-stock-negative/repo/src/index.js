import { loadConfig } from './config/index.js'
import { createLogger } from './log/logger.js'
import { createClock } from './util/clock.js'
import { createLru } from './cache/lru.js'
import { createStockTable } from './store/tables.js'
import { createCatalog } from './catalog/products.js'
import { createInventory } from './inventory/index.js'
import { createNotifier } from './notify/notifier.js'
import { createOrders } from './orders/index.js'
import { stockReport } from './reports/stock.js'
import { salesSummary } from './reports/sales.js'
import { SEED_PRODUCTS, SEED_PROMOTIONS, SEED_STOCK, loadStock } from './seed.js'

/**
 * 서비스 조립.
 * - now: 고정 시각(시험용). 주지 않으면 실제 시계
 * - seed: 샘플 상품, 재고, 프로모션을 넣는다(기본 true)
 * - config: 설정 덮어쓰기, env: 환경 변수(기본 process.env)
 * - logSink, transports: 로그와 알림을 받을 곳
 */
export function createService({ now, seed = true, config: overrides, env, logSink, transports, products, stock, promotions } = {}) {
  const config = loadConfig({ overrides, env })
  const clock = createClock(now)
  const log = createLogger({ level: config.log.level, sink: logSink, clock })
  const cache = createLru({
    maxEntries: config.cache.maxEntries,
    ttlMs: config.cache.ttlSeconds * 1000,
    now: () => clock.ms(),
  })

  const stockTable = createStockTable()
  const catalog = createCatalog(products ?? (seed ? SEED_PRODUCTS : []))
  loadStock(stockTable, stock ?? (seed ? SEED_STOCK : []), clock.iso())

  const inventory = createInventory({ stockTable, cache, clock, log })
  const notifier = createNotifier({ config: config.notify, clock, log: log.child('notify'), transports })
  const orders = createOrders({
    catalog,
    inventory,
    notifier,
    clock,
    log,
    config,
    promotions: promotions ?? (seed ? SEED_PROMOTIONS : []),
  })

  const reports = {
    stock: () => stockReport({ stockTable, catalog, clock, config }),
    sales: () => salesSummary({ orders, catalog, clock }),
  }

  return { config, clock, log, cache, stockTable, catalog, inventory, notifier, orders, reports }
}
