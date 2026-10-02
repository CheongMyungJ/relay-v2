/** 상품 상세의 리뷰 목록 API 응답. 최신순 */
export function listReviews(productId, { reviews, customers }) {
  const byId = new Map(customers.map((c) => [c.id, c]))
  return reviews
    .filter((r) => r.productId === productId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => {
      const c = byId.get(r.customerId)
      return { id: r.id, rating: r.rating, text: r.text, createdAt: r.createdAt, author: { name: c.name, email: c.email } }
    })
}
