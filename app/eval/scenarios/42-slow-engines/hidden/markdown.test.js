import { test } from 'node:test'
import assert from 'node:assert'
import { renderMarkdown as render } from '../src/markdown.js'

// 요청은 블록 사이만 줄바꿈 하나로 정했다. 태그 사이의 줄바꿈(목록 안, 인용 안)과 인용 안의 <p>는 정하지 않아 보지 않는다
const squash = (html) =>
  html
    .replace(/>\s*\n\s*</g, '><')
    .replace(/<blockquote><p>/g, '<blockquote>')
    .replace(/<\/p><\/blockquote>/g, '</blockquote>')
    .trim()
const renderMarkdown = (text) => squash(render(text))
const eq = (actual, expected) => assert.strictEqual(actual, squash(expected))

test('제목 여섯 단계와 문단(빈 줄로 나누고 줄은 공백으로 이음)', () => {
  eq(renderMarkdown('# 하나\n\n###### 여섯'), '<h1>하나</h1>\n<h6>여섯</h6>')
  eq(renderMarkdown('첫 줄\n둘째 줄\n\n다음 문단'), '<p>첫 줄 둘째 줄</p>\n<p>다음 문단</p>')
})

test('굵게, 기울임, 코드, 링크', () => {
  eq(
    renderMarkdown('**굵게** *기울임* `a < b` [링크](https://x.kr/?a=1&b=2)'),
    '<p><strong>굵게</strong> <em>기울임</em> <code>a &lt; b</code> <a href="https://x.kr/?a=1&amp;b=2">링크</a></p>',
  )
})

test('글의 HTML은 바꾼다', () => {
  eq(renderMarkdown('<script> & "x"'), '<p>&lt;script&gt; &amp; &quot;x&quot;</p>')
})

test('목록: 순서 없는 목록과 순서 있는 목록', () => {
  eq(renderMarkdown('- 하나\n- **둘**'), '<ul>\n<li>하나</li>\n<li><strong>둘</strong></li>\n</ul>')
  eq(renderMarkdown('1. 첫째\n2. 둘째'), '<ol>\n<li>첫째</li>\n<li>둘째</li>\n</ol>')
})

test('코드 블록: 안은 꾸미지 않고 바꾸기만, 언어 표시', () => {
  eq(
    renderMarkdown('```js\nconst a = 1 < 2 && **b**\n\nx\n```'),
    '<pre><code class="language-js">const a = 1 &lt; 2 &amp;&amp; **b**\n\nx</code></pre>',
  )
  eq(renderMarkdown('```\nplain\n```'), '<pre><code>plain</code></pre>')
})

test('인용', () => {
  eq(renderMarkdown('> 인용 *글*\n> 둘째 줄'), '<blockquote><p>인용 <em>글</em> 둘째 줄</p></blockquote>')
})

test('여러 블록이 섞임', () => {
  eq(
    renderMarkdown('## 제목\n문단\n\n- a\n- b\n\n끝'),
    '<h2>제목</h2>\n<p>문단</p>\n<ul>\n<li>a</li>\n<li>b</li>\n</ul>\n<p>끝</p>',
  )
})
