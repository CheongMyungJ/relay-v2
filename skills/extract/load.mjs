// extract run 조립의 원본을 레포에서 읽는다 (run.mjs는 읽지 않는 순수 함수만 둔다).
// 기본 스키마: docs/contracts/extract-<kind>.v0.schema.json. 점검표: skills/extract/lenses/<lens>.md의 ## Checklist.
// 지시 층: contract.md(L1), kinds/<kind>.md(L2), 렌즈 카드의 trace 절(L2b).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, LENSES, layerText, lensLayer, parseChecklist } from './run.mjs';

/** 레포 뿌리 (이 파일은 skills/extract/에 있다) */
export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function baseSchemaPath(kind, root = REPO) {
  if (!KINDS.includes(kind)) throw new Error(`모르는 run 종류: ${kind}`);
  return path.join(root, 'docs', 'contracts', `extract-${kind}.v0.schema.json`);
}

export function loadBase(kind, root = REPO) {
  return JSON.parse(fs.readFileSync(baseSchemaPath(kind, root), 'utf8'));
}

export function lensCardPath(lens, root = REPO) {
  if (!LENSES.includes(lens)) throw new Error(`모르는 렌즈: ${lens}`);
  return path.join(root, 'skills', 'extract', 'lenses', `${lens}.md`);
}

export function loadChecklist(lens, root = REPO) {
  return parseChecklist(fs.readFileSync(lensCardPath(lens, root), 'utf8'));
}

export function contractPath(root = REPO) {
  return path.join(root, 'skills', 'extract', 'contract.md');
}

export function kindPath(kind, root = REPO) {
  if (!KINDS.includes(kind)) throw new Error(`모르는 run 종류: ${kind}`);
  return path.join(root, 'skills', 'extract', 'kinds', `${kind}.md`);
}

/**
 * 지시 층의 원본(16.2): L1 고정 계약, L2 종류 절차, L2b 렌즈 카드(trace만). 조립은 run.mjs의 buildRun이 한다
 * @returns {{ contract: string, kind: string, lens?: string }}
 */
export function loadLayers(kind, lens = null, root = REPO) {
  const read = (p) => fs.readFileSync(p, 'utf8');
  const out = { contract: layerText(read(contractPath(root))), kind: layerText(read(kindPath(kind, root))) };
  if (lens) out.lens = lensLayer(read(lensCardPath(lens, root)));
  return out;
}
