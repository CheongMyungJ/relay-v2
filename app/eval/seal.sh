#!/usr/bin/env bash
# hold-out을 봉인한다 (docs/extract-eval.md 7절). 만든 세션이 시나리오를 확인한 뒤 한 번 쓴다.
#   HOLDOUT_KEY='<열쇠>' bash eval/seal.sh <이름> <경로>...
# <경로>는 eval/ 기준(예: extract/scenarios/h1-x). 그 경로들을 tar.gz로 묶어(이름순, 고정 시각·소유자라 같은 내용이면
# 같은 바이트) AES-256-CBC(PBKDF2, 200,000번, SHA-256)로 암호화해 sealed/<이름>.tar.gz.enc에 두고, 평문 묶음과 암호문의
# 해시를 sealed/<이름>.PLAIN.SHA256SUMS, sealed/<이름>.SHA256SUMS에 적는다. 끝에 같은 열쇠로 풀어 원본과 같은지 본다.
# 열쇠는 레포·문서·커밋에 남기지 않는다. 평문 경로가 git에 들어 있으면 멈춘다(.gitignore로 빼 둔다).
set -euo pipefail
EVAL="$(cd "$(dirname "$0")" && pwd)"
NAME="${1:?봉인 이름을 주세요}"
shift
[ $# -gt 0 ] || { echo "봉인할 경로를 주세요" >&2; exit 2; }
: "${HOLDOUT_KEY:?HOLDOUT_KEY에 열쇠를 주세요}"
case "$NAME" in
  */* | .* | '') echo "이름이 이상합니다: $NAME" >&2; exit 2 ;;
esac
cd "$EVAL"
for p in "$@"; do
  [ -e "$p" ] || { echo "없는 경로: $p" >&2; exit 2; }
  if [ -n "$(git ls-files -- "$p")" ]; then
    echo "git에 들어 있는 경로는 봉인하지 않는다(평문이 남는다): $p" >&2
    exit 2
  fi
done
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar --sort=name --mtime='2026-01-01 00:00:00Z' --owner=0 --group=0 --numeric-owner \
  --exclude='__pycache__' -cf - "$@" | gzip -n -9 > "$tmp/$NAME.tar.gz"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -md sha256 -pass env:HOLDOUT_KEY \
  -in "$tmp/$NAME.tar.gz" -out "sealed/$NAME.tar.gz.enc"
(cd "$tmp" && sha256sum "$NAME.tar.gz") > "sealed/$NAME.PLAIN.SHA256SUMS"
(cd sealed && sha256sum "$NAME.tar.gz.enc") > "sealed/$NAME.SHA256SUMS"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -pass env:HOLDOUT_KEY \
  -in "sealed/$NAME.tar.gz.enc" -out "$tmp/check.tar.gz"
cmp -s "$tmp/$NAME.tar.gz" "$tmp/check.tar.gz" || { echo "풀어 본 내용이 다르다" >&2; exit 1; }
echo "봉인했다: sealed/$NAME.tar.gz.enc ($(tar -tzf "$tmp/$NAME.tar.gz" | grep -c -v '/$')개 파일)"
