// 재고 품목: { sku, name, qty }

export function find(items, sku) {
  return items.find((i) => i.sku === sku) ?? null
}
