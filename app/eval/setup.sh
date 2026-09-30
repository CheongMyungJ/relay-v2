#!/usr/bin/env bash
# relay 대 맨 CLI 사용성 평가의 준비 (docs/eval.md). 새 세션(컨테이너)에서 한 번 돌린다. 다시 돌려도 된다.
# 하는 일: 앱 의존성(Electron 실행 파일 포함) 설치, 앱 빌드, 가상 화면과 claude 점검, 깨끗한 환경에서 claude 호출 점검.
set -euo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP"

step() { printf '\n== %s\n' "$*"; }

step "도구 점검"
for cmd in node npm git claude Xvfb; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "없음: $cmd"
    [ "$cmd" = Xvfb ] && echo "  relay 쪽에는 가상 화면이 필요합니다 (apt-get install -y xvfb)."
    exit 1
  fi
done
node --version
claude --version

step "앱 의존성"
if [ ! -f node_modules/node-pty/build/Release/pty.node ] && [ ! -d node_modules/node-pty/prebuilds ]; then
  npm ci --no-audit --no-fund
fi
if [ ! -x node_modules/electron/dist/electron ]; then
  # ELECTRON_SKIP_BINARY_DOWNLOAD로 설치했으면 실행 파일만 받는다
  node node_modules/electron/install.js
fi
test -x node_modules/electron/dist/electron || { echo "Electron 실행 파일을 받지 못했습니다"; exit 1; }

step "앱 빌드 (out/)"
npm run build --silent >/dev/null
test -f out/main/index.js

step "claude 호출 점검 (평가와 같은 깨끗한 환경)"
node --input-type=module -e "
import { ask } from './eval/lib/ai.mjs'
import { makeClaudeConfig } from './eval/lib/env.mjs'
import os from 'node:os'
import path from 'node:path'
const dir = path.join(os.tmpdir(), 'relay-eval-setup')
const r = await ask({ prompt: 'PONG이라고만 답하라', model: 'haiku', cwd: os.tmpdir(), configDir: makeClaudeConfig(dir), retries: 1, timeoutMs: 120000 })
if (!/PONG/.test(r.text)) { console.error('예상 밖 응답:', r.text); process.exit(1) }
console.log('claude -p 응답 확인')
"

step "시나리오"
node eval/run.mjs --list

printf '\n준비 끝. 예: node eval/run.mjs --scenarios 1 --runs 3\n'
