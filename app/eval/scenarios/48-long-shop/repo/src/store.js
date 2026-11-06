// 메모리 저장소. 서비스마다 자기 표만 고친다.

export function createStore() {
  return {
    products: new Map(),
    coupons: new Map(),
    customers: new Map(),
    orders: new Map(),
    payments: [],
    invoices: [],
    voidedInvoices: [],
    creditNotes: [],
    receipts: [],
    reminders: [],
    preferences: new Map(),
    notifications: [],
    outbox: [],
  }
}
