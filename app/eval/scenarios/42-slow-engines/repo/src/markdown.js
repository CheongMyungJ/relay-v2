// Markdown 도구. 지금은 HTML 글자를 바꾸는 것만 있다.

export function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
