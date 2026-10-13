// 책 저장소 (메모리). 읽으면 복사본이 나오므로 바꾼 뒤에는 saveBook으로 저장한다.
// available: 지금 빌릴 수 있는 권수, priceWon: 정가, holds: 이 책을 기다리는 예약 수
let books = []

export function resetBooks(list = []) {
  books = list.map((b) => ({ ...b }))
}

export function listBooks() {
  return books.map((b) => ({ ...b }))
}

export function getBook(id) {
  const b = books.find((x) => x.id === id)
  return b ? { ...b } : null
}

export function saveBook(book) {
  const i = books.findIndex((x) => x.id === book.id)
  if (i < 0) books.push({ ...book })
  else books[i] = { ...book }
  return { ...book }
}
