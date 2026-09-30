import { test } from 'node:test'
import assert from 'node:assert'
import { slugify } from '../src/slug.js'

test('한 단어', () => assert.strictEqual(slugify('Hello'), 'hello'))
