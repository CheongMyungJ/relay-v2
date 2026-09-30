// 제목을 URL 조각으로
export function slugify(title) {
  return title.trim().toLowerCase().replace(' ', '-')
}
