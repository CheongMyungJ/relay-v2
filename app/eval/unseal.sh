#!/usr/bin/env bash
# 봉인한 hold-out을 푼다 (docs/knowledge-experiment/protocol.md 6절, docs/extract-eval.md 7절). 개발이 끝나고 결과를 고정한
# 뒤에만 쓴다. 열쇠는 사람이 마지막 비교를 시킬 때 준다. 열쇠 없이 풀거나, 열쇠를 찾으려 하지 않는다.
#   HOLDOUT_KEY='<열쇠>' bash eval/unseal.sh [이름]
# 이름은 sealed/<이름>.tar.gz.enc의 <이름>이다(기본 holdout: 지식 실험의 hold-out). 봉인할 때 적은 해시
# (sealed/<이름>.SHA256SUMS, sealed/<이름>.PLAIN.SHA256SUMS)와 맞는지 확인한 뒤 eval/ 아래에 그대로 꺼낸다.
# 봉인은 eval/seal.sh가 한다.
set -euo pipefail
EVAL="$(cd "$(dirname "$0")" && pwd)"
NAME="${1:-holdout}"
: "${HOLDOUT_KEY:?HOLDOUT_KEY에 열쇠를 주세요}"
case "$NAME" in
  */* | .* | '') echo "이름이 이상합니다: $NAME" >&2; exit 2 ;;
esac
cd "$EVAL/sealed"
sha256sum -c --quiet "$NAME.SHA256SUMS"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:HOLDOUT_KEY \
  -in "$NAME.tar.gz.enc" -out "$tmp/$NAME.tar.gz"
(cd "$tmp" && sha256sum -c --quiet "$EVAL/sealed/$NAME.PLAIN.SHA256SUMS")
tar -xzf "$tmp/$NAME.tar.gz" -C "$EVAL"
echo "풀었다:"
tar -tzf "$tmp/$NAME.tar.gz" | grep -E '^((extract/)?scenarios/[^/]+/|guides/[^/]+)$' | sort -u
