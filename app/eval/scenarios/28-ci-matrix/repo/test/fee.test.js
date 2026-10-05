import { test } from 'node:test'
import assert from 'node:assert'
import { shippingFee } from '../src/fee.js'

test('5만 원 이상은 무료', () => assert.strictEqual(shippingFee(50000, 'seoul'), 0))
test('섬 지역', () => assert.strictEqual(shippingFee(10000, 'island'), 6000))
test('모르는 지역', () => assert.strictEqual(shippingFee(10000, 'mars'), 4000))
