#!/usr/bin/env bash
# 견줄 relay 빌드를 따로 만든다 (docs/knowledge-experiment/protocol.md 6절). 커밋을 git worktree로 꺼내 의존성을 깔고 빌드한다.
#   bash eval/ref-app.sh <이름> <커밋> [뿌리 폴더]
#   예: bash eval/ref-app.sh base 0247049      → /tmp/relay-ref/base/app
#       bash eval/ref-app.sh m17 aa39d16       → /tmp/relay-ref/m17/app
# 평가에서는 --app <이름>=<뿌리>/<이름>/app 으로 쓴다. 평가 도구(eval/)는 지금 체크아웃의 것을 쓰고, 꺼낸 빌드의 eval/는 쓰지 않는다.
set -euo pipefail
name="${1:?이름}"
commit="${2:?커밋}"
root="${3:-/tmp/relay-ref}"
repo="$(cd "$(dirname "$0")/../.." && pwd)"
dest="$root/$name"
mkdir -p "$root"
if [ -d "$dest" ]; then
  echo "이미 있음: $dest (다시 만들려면 git -C $repo worktree remove --force $dest)"
else
  git -C "$repo" fetch -q origin "$commit" 2>/dev/null || true
  git -C "$repo" worktree add -q --detach "$dest" "$commit"
fi
cd "$dest/app"
if [ ! -f node_modules/node-pty/build/Release/pty.node ] && [ ! -d node_modules/node-pty/prebuilds ]; then
  npm ci --no-audit --no-fund
fi
[ -x node_modules/electron/dist/electron ] || node node_modules/electron/install.js
npm run build --silent >/dev/null
test -f out/main/index.js
echo "빌드 끝: $dest/app ($(git rev-parse --short HEAD))"
