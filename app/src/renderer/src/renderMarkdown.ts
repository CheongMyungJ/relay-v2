// 산출물 Markdown의 변환 (D83, I2). 에이전트가 쓴 파일이라 HTML은 글자로 두고, markdown-it의 링크 검사가
// javascript:, vbscript:, file:, data:(이미지 밖) 링크를 만들지 않는다.
import MarkdownIt from 'markdown-it'

const md = new MarkdownIt({ html: false, linkify: false, breaks: false })

export function renderMarkdown(text: string): string {
  return md.render(text)
}
