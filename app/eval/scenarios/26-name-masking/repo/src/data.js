export const customers = [
  { id: 'C-1', name: '홍길동', email: 'hong.gd@example.com', phone: '010-1234-5678' },
  { id: 'C-2', name: '남궁민수', email: 'namgung@example.co.kr', phone: '010-987-6543' },
  { id: 'C-3', name: '이수', email: 'ls@example.com', phone: '010-5555-0101' },
]

export const orders = [
  { id: 'O-501', customerId: 'C-1', date: '2026-09-28', total: 36000 },
  { id: 'O-502', customerId: 'C-2', date: '2026-09-29', total: 9000 },
  { id: 'O-503', customerId: 'C-3', date: '2026-09-30', total: 12500 },
]

export const reviews = [
  { id: 'R-1', productId: 'P-100', customerId: 'C-1', rating: 5, text: '튼튼해요', createdAt: '2026-09-30' },
  { id: 'R-2', productId: 'P-100', customerId: 'C-2', rating: 3, text: '뚜껑이 헐거워요', createdAt: '2026-10-01' },
  { id: 'R-3', productId: 'P-200', customerId: 'C-3', rating: 4, text: '색이 예뻐요', createdAt: '2026-10-01' },
]
