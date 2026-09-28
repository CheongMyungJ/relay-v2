// 렌더러 격리, 외부 주소, 산출물 Markdown의 안전 (I2, A15)
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { WEB_PREFERENCES, externalUrl } from '../../src/main/security'
import { renderMarkdown } from '../../src/renderer/src/markdown'

describe('창의 격리 (I2)', () => {
  it('contextIsolation과 sandbox를 켜고 nodeIntegration을 끈다', () => {
    expect(WEB_PREFERENCES).toEqual({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    })
  })

  it('CSP는 스크립트를 앱 안의 것만 허용한다', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../src/renderer/index.html'), 'utf8')
    const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1]
    expect(csp).toBe("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'")
  })
})

describe('외부 주소 (I2)', () => {
  it('http와 https만 연다', () => {
    expect(externalUrl('https://github.com/o/r/pull/1')).toBe('https://github.com/o/r/pull/1')
    expect(externalUrl('http://example.com/a b')).toBe('http://example.com/a%20b')
    for (const bad of [
      'file:///C:/Windows/System32/calc.exe',
      'javascript:alert(1)',
      'ms-settings:',
      'a',
    ]) {
      expect(() => externalUrl(bad)).toThrow()
    }
  })
})

describe('산출물 Markdown (D83)', () => {
  it('HTML은 글자로 남긴다', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">\n\n<script>alert(1)</script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img')
  })

  it('javascript:와 file: 링크는 링크로 만들지 않는다', () => {
    const html = renderMarkdown(
      '[a](javascript:alert(1)) [b](file:///etc/passwd) [c](https://x.dev)',
    )
    expect(html).not.toMatch(/href="(javascript|file):/)
    expect(html).toContain('href="https://x.dev"')
  })
})
