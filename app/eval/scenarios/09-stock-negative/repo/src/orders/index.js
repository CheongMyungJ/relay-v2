import { createOrderStore } from './order-store.js'
import { placeOrder } from './place.js'
import { cancelOrder } from './cancel.js'
import { shipOrder } from './fulfill.js'

export function createOrders({ catalog, inventory, notifier, clock, log, config, promotions = [] }) {
  const orderStore = createOrderStore()
  const deps = { catalog, inventory, orderStore, notifier, clock, config, promotions, log: log.child('orders') }

  return {
    place: (input) => placeOrder(deps, input),
    cancel: (orderId, reason) => cancelOrder(deps, orderId, reason),
    ship: (orderId) => shipOrder(deps, orderId),
    get: (orderId) => orderStore.get(orderId),
    list: (filter) => orderStore.list(filter),
  }
}
