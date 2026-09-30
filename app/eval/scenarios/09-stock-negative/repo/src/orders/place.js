import { allocate } from '../warehouses/allocate.js'
import { warehouseName } from '../warehouses/registry.js'
import { priceOrder } from '../pricing/price.js'
import { ValidationError, assertPositiveInt } from '../util/errors.js'

/** 같은 SKU가 여러 줄이면 합친다. 줄 순서는 처음 나온 순서 */
export function mergeLines(lines) {
  const merged = new Map()
  for (const { sku, qty } of lines) {
    assertPositiveInt(qty, `${sku} 수량`)
    merged.set(sku, (merged.get(sku) ?? 0) + qty)
  }
  return [...merged].map(([sku, qty]) => ({ sku, qty }))
}

function validateInput(input) {
  if (!input?.customer?.id) throw new ValidationError('고객 id가 없음')
  if (!input.customer.region) throw new ValidationError('배송 지역이 없음')
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new ValidationError('주문 줄이 없음')
}

/**
 * 주문 받기.
 * 1. 줄마다 창고별 수량을 나눈다(가용 재고 안에서).
 * 2. 줄마다 예약한다. 중간에 실패하면 앞서 예약한 줄을 푼다.
 * 3. 금액을 계산해 주문을 저장하고 알린다.
 */
export function placeOrder(deps, input) {
  const { catalog, inventory, orderStore, notifier, clock, config, promotions } = deps
  validateInput(input)
  const { customer, coupon = null } = input

  const items = mergeLines(input.lines).map(({ sku, qty }) => {
    const product = catalog.get(sku)
    if (!product.active) throw new ValidationError(`판매 중지 상품: ${sku}`)
    return { product, qty }
  })

  const planned = items.map(({ product, qty }) => ({
    sku: product.sku,
    qty,
    allocations: allocate(inventory.records(product.sku), { sku: product.sku, qty, region: customer.region }),
  }))

  const done = []
  try {
    for (const line of planned) {
      inventory.reserveLine(line)
      done.push(line)
    }
  } catch (err) {
    for (const line of done.reverse()) inventory.releaseLine(line)
    throw err
  }

  const price = priceOrder(items, {
    promotions,
    coupon,
    at: clock.now(),
    taxRate: config.pricing.taxRate,
    roundTo: config.pricing.roundTo,
  })

  const order = orderStore.create({
    customer: { id: customer.id, region: customer.region },
    lines: planned.map((line, i) => ({ ...price.lines[i], allocations: line.allocations })),
    subtotal: price.subtotal,
    discount: price.discount,
    tax: price.tax,
    total: price.total,
    coupon: coupon?.code ?? null,
    status: 'placed',
    placedAt: clock.iso(),
  })

  notifier.send('order.placed', { orderId: order.id, customerId: customer.id, items: order.lines.length, total: order.total })
  warnLowStock(deps, planned)
  return order
}

function warnLowStock({ inventory, notifier, catalog, config }, planned) {
  for (const line of planned) {
    for (const part of line.allocations) {
      const stock = inventory.getStock(line.sku, part.warehouse)
      if (stock && stock.available <= config.stock.lowThreshold) {
        notifier.send('stock.low', {
          sku: line.sku,
          name: catalog.get(line.sku).name,
          warehouseName: warehouseName(part.warehouse),
          available: stock.available,
        })
      }
    }
  }
}
