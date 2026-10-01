// 주문 받기. 주문을 저장한 뒤 적립금을 쌓고 확인 메일을 보낸다
import { all, save } from './db.js'
import { sendEmail } from './email.js'
import { addPoints } from './points.js'

let nextId = 1

export function placeOrder({ customer, email, items }) {
  if (!items?.length) throw new Error('order: no items')
  const amount = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const order = { id: nextId++, customer, email, amount }
  save(order)
  addPoints(customer, amount)
  sendEmail(email, `주문 ${order.id} 확인`)
  return order
}

export function listOrders() {
  return all()
}
