#!/usr/bin/env bash
# 봉인한 hold-out을 푼다 (docs/knowledge-experiment/protocol.md 6절). 개발이 끝나고 결과를 고정한 뒤에만 쓴다.
# 열쇠는 사람이 마지막 비교를 시킬 때 준다. 열쇠 없이 풀거나, 열쇠를 찾으려 하지 않는다.
#   HOLDOUT_KEY='<열쇠>' bash eval/unseal.sh
# 하는 일: sealed/holdout.tar.gz.enc를 풀어 scenarios/의 hold-out 시나리오와 guides/의 견줄 빌드 설명서를 꺼내고,
# 봉인할 때 적은 해시(sealed/SHA256SUMS)와 맞는지 확인한다.
set -euo pipefail
EVAL="$(cd "$(dirname "$0")" && pwd)"
: "${HOLDOUT_KEY:?HOLDOUT_KEY에 열쇠를 주세요}"
cd "$EVAL/sealed"
sha256sum -c --quiet SHA256SUMS
tmp="$(mktemp -d)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:HOLDOUT_KEY \
  -in holdout.tar.gz.enc -out "$tmp/holdout.tar.gz"
(cd "$tmp" && sha256sum -c --quiet "$EVAL/sealed/PLAIN.SHA256SUMS")
tar -xzf "$tmp/holdout.tar.gz" -C "$EVAL"
rm -rf "$tmp"
echo "풀었다:"
tar -tzf <(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:HOLDOUT_KEY -in "$EVAL/sealed/holdout.tar.gz.enc") | grep -E '^(scenarios/[^/]+/|guides/[^/]+)$' | sort -u
