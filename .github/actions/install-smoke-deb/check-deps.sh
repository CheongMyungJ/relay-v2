#!/bin/bash
# .deb의 의존성 확인 (I117, PR #37 리뷰). 깨끗한 컨테이너에 .deb를 설치하고, /opt/relay의 ELF가 못 찾는 공유 라이브러리가
# 없는지 본다. 데스크톱 라이브러리가 다 깔린 러너의 [스모크]는 depends에서 빠진 라이브러리를 잡지 못한다.
#   bash check-deps.sh <.deb 경로>   (root로, apt가 있는 이미지에서)
set -euo pipefail
deb=$(realpath "$1")
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q "$deb"
missing=$(find /opt/relay -type f \( -name '*.so*' -o -name '*.node' -o -perm -u+x \) -print0 |
  xargs -0 -I{} sh -c 'ldd "{}" 2>/dev/null | grep "not found" | sed "s|^|{}: |"' | sort -u)
if [ -n "$missing" ]; then
  echo "::error::못 찾는 공유 라이브러리가 있습니다. electron-builder.yml의 deb.depends에 더하세요"
  echo "$missing"
  exit 1
fi
echo "모든 공유 라이브러리를 찾음"
