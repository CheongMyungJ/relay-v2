// docs/contracts의 스키마를 앱으로 복사하고 TypeScript 타입을 만든다 (I19).
// 원본은 docs/contracts/*.schema.json이다(D84). 결과는 src/shared/generated/에 두고 git에 넣지 않는다.
// dev, build, typecheck, test 스크립트가 먼저 이 스크립트를 부른다.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from 'json-schema-to-typescript'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.resolve(app, '../docs/contracts')
const out = path.join(app, 'src/shared/generated')
const style = JSON.parse(fs.readFileSync(path.join(app, '.prettierrc.json'), 'utf8'))

// handoff.v1.schema.json → Handoff, intent-draft.v1.schema.json → IntentDraft
const typeName = (base) =>
  base
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')

const files = new Map()
for (const file of fs.readdirSync(source).sort()) {
  if (!file.endsWith('.schema.json')) continue
  const text = fs.readFileSync(path.join(source, file), 'utf8')
  const schema = JSON.parse(text)
  const name = typeName(file.split('.')[0])
  const ts = await compile(schema, name, {
    bannerComment: `// docs/contracts/${file}에서 만든 파일이다. 고치지 말고 스키마를 고친 뒤 npm run contracts로 다시 만든다 (I19).`,
    // 스키마의 title이 한국어라 루트 타입 이름은 파일 이름으로 정한다.
    customName: (s) => (s.$id === schema.$id ? name : undefined),
    style,
  })
  files.set(file, text)
  files.set(file.replace(/\.schema\.json$/, '.ts'), ts)
}

fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync(out)) if (!files.has(f)) fs.rmSync(path.join(out, f))
for (const [f, content] of files) {
  const p = path.join(out, f)
  if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== content) fs.writeFileSync(p, content)
}
console.log(`contracts: ${[...files.keys()].join(', ')} → ${path.relative(app, out)}`)
