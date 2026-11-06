// 서비스를 엮는다. 시험과 서버가 같은 조립을 쓴다.
import { createClock } from './clock.js'
import { createStore } from './store.js'
import { createBus } from './shared/events.js'
import { createIds } from './shared/ids.js'
import { createCatalog } from './catalog/products.js'
import { createCoupons } from './catalog/coupons.js'
import { createBundles } from './catalog/bundles.js'
import { createCustomers } from './customers/customers.js'
import { createAddresses } from './customers/addresses.js'
import { createPoints } from './customers/points.js'
import { createSegments } from './customers/segments.js'
import { createCart } from './orders/cart.js'
import { createOrders } from './orders/orders.js'
import { createWishlist } from './orders/wishlist.js'
import { createSalesReports } from './reports/sales.js'
import { createPayments } from './billing/payments.js'
import { createBilling } from './billing/invoices.js'
import { createEmailChannel, createSmsChannel } from './notifications/channels.js'
import { createPreferences } from './notifications/preferences.js'
import { createNotifier } from './notifications/notifier.js'
import { createCampaigns } from './notifications/campaigns.js'

/**
 * @param {{ now?: string }} options now는 시작 시각(ISO, UTC)
 */
export function createShop({ now = '2026-03-02T01:00:00Z' } = {}) {
  const clock = createClock(now)
  const store = createStore()
  const bus = createBus()
  const ids = createIds()
  const catalog = createCatalog(store)
  const coupons = createCoupons(store, clock)
  const customers = createCustomers(store)
  const payments = createPayments(store, ids, clock)
  const channels = { email: createEmailChannel(clock), sms: createSmsChannel(clock) }
  const preferences = createPreferences(store)
  // 구독 차례: 청구가 알림보다 먼저 듣는다(송장 번호가 알림에 들어간다)
  const billing = createBilling({ store, bus, clock, ids, customers })
  const notifier = createNotifier({ store, bus, clock, customers, channels, preferences })
  const points = createPoints({ store, bus, clock, customers })
  const orders = createOrders({ store, catalog, coupons, customers, payments, bus, clock, ids })
  const addresses = createAddresses(store, customers)
  const wishlist = createWishlist({ store, catalog, customers, clock })
  const reports = createSalesReports({ orders, catalog })
  const bundles = createBundles({ store, catalog })
  const segments = createSegments({ customers, orders, clock })
  const campaigns = createCampaigns({ store, clock, segments, notifier, ids })
  return {
    clock,
    store,
    bus,
    catalog,
    coupons,
    bundles,
    customers,
    segments,
    addresses,
    points,
    payments,
    orders,
    wishlist,
    billing,
    reports,
    channels,
    preferences,
    notifier,
    campaigns,
    newCart: () => createCart(catalog),
  }
}
