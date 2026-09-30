import { builtinModules } from 'node:module'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['out/', 'dist/', 'src/shared/generated/', 'eval/scenarios/', 'eval/results/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // 평가 도구의 relay 쪽은 렌더러에서 돌릴 함수(page.evaluate)를 함께 둔다 (docs/eval.md)
    files: ['eval/lib/relay-arm.mjs'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // core는 순수 로직이라 Node와 Electron API를 쓰지 않는다 (I9).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: builtinModules,
          patterns: ['node:*', 'electron', 'electron/*', '**/adapters/**', '**/main/**'],
        },
      ],
    },
  },
)
