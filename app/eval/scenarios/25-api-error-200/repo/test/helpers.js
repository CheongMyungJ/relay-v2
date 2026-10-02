import { createDb } from '../src/db.js'

export function seed() {
  return createDb({
    products: [
      { id: 'P-100', name: '텀블러', price: 18000 },
      { id: 'P-200', name: '머그컵', price: 9000 },
      { id: 'P-300', name: '단종 컵', price: 5000, hidden: true },
    ],
    orders: [
      { id: 'O-1', userId: 'u1', status: 'paid', items: [{ productId: 'P-100', price: 18000, qty: 2 }] },
      { id: 'O-2', userId: 'u2', status: 'shipped', items: [{ productId: 'P-200', price: 9000, qty: 1 }] },
    ],
  })
}

export const user = { id: 'u1' }
