// extract run 조립의 원본을 레포에서 읽는다 (run.mjs는 읽지 않는 순수 함수만 둔다).
// 기본 스키마: docs/contracts/extract-<kind>.v0.schema.json. 점검표: skills/extract/lenses/<lens>.md의 ## Checklist.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, LENSES, parseChecklist } from './run.mjs';

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
