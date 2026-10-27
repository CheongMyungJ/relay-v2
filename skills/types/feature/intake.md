- Do not design the feature. That is the job of design.
- Do not write how to build the feature in the intent. The only exception is the human's suggestions: if the request says how to build it, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". design decides whether to take it.
- **Changing or removing behavior:** this type also covers changing or removing a behavior that works as intended now. If the current behavior goes against what was intended, it is a bug: that is a type mismatch. Mark each behavior that changes or goes away in `완료조건` (below).
- **완료조건:** always start with this default item.
  `- [ ] 완료조건의 각 동작을 확인하는 테스트가 있다`
- Then add the acceptance criteria: one behavior seen from outside per line, as "<조건>이면 <결과>" (e.g. "빈 검색어로 요청하면 400과 오류 문구를 돌려준다"). No implementation details (which function to add etc.).
- **Changed or removed behavior:** write a behavior that changes as "(바뀜) <조건>이면 <새 결과> (지금: <옛 결과>)", and one that goes away as "(없앰) <조건>이면 <결과> (지금: <옛 결과>)" (e.g. "(없앰) `--legacy`를 주면 알 수 없는 옵션 오류로 끝난다 (지금: 옛 형식으로 출력)"). If it is used outside the repo (exports, HTTP API, CLI arguments, stored formats and schemas), end the line with "(레포 밖 인터페이스)".
