#!/usr/bin/env bash
# 세 후보 비교 실행기: 인자로 시나리오, 회차, 결과 이름을 받는다
cd /home/user/kc-harness/app
exec node eval/run.mjs --scenarios "$1" --runs "$2" --arms base,c1,c2,c3 \
  --app base=/home/user/kc-ref/base/app,c1=/home/user/kc-ref/c1/app,c2=/home/user/kc-ref/c2/app,c3=/home/user/kc-ref/c3/app \
  --pairs c1:c2,c2:c3,c1:c3 --parallel "${4:-3}" --out "eval/results/$3" > "eval/results/$3.log" 2>&1 < /dev/null
