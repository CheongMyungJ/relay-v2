// 테스트 파일 모양 (D202). PR 대응(core/respond)과 자율 진행의 관문(core/autonomy, D537)이 같이 쓴다

const TEST_DIRS: readonly string[] = ['test', 'tests', '__tests__', 'spec']

/**
 * 테스트 파일 모양인가 (D202, 기본값): 경로에 test, tests, __tests__, spec 폴더가 있거나 이름이 *.test.*, *.spec.*,
 * *_test.*, test_*.*다
 */
export function isTestPath(file: string): boolean {
  const parts = file.replace(/\\/g, '/').split('/').filter(Boolean)
  const name = parts.pop() ?? ''
  if (parts.some((d) => TEST_DIRS.includes(d.toLowerCase()))) return true
  return (
    /\.(test|spec)\.[^.]+/i.test(name) ||
    /_test\.[^.]+$/i.test(name) ||
    /^test_.+\.[^.]+$/i.test(name)
  )
}
