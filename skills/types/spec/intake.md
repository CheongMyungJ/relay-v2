- Skim the documents too, only as far as the goals and completion criteria need. Do not settle the design decisions. That is the job of spec.
- Do not write how to decide in the intent. The only exception is the human's suggestions: if the request says how something should be decided, copy it to `제약` when it is a must, otherwise to `추가 의견` with the prefix "(사람 제안)". spec still asks about it.
- **A small request:** `spec` is for big work whose design is settled before it is built. If the request is small enough that `feature` fits better, say why before you write the draft, and ask: keep `spec` / change the type (`blocked`). If they keep it, draft with `spec`.
- **Target document:** settle with the human which design document this goes into, a new one or an existing one, and write it in `제약` as "설계 문서: `<path>` (새 문서 / 기존 문서)". For a new document, if the repo has no convention for design documents, propose `docs/design/<english-name>.md`. The target document is not a document to follow: do not also write "의 결정을 따른다" for it.
- **완료조건:** always start with these default items. No test command item: only the document changes.
  `- [ ] 대상 문서와 지식 파일 밖의 파일을 바꾸지 않는다` / `- [ ] 문서의 서술이 서로, 그리고 지금 코드와 어긋나지 않는다` / `- [ ] 정하지 않고 남긴 것은 문서의 따로 둔 절에 이유와 함께 있다`
- Then add what the design must decide, as "<무엇>을 정한다", one per line (e.g. "PR 머지 조건을 정한다"). Not how to decide it. Agree on this list with the human: it is the scope of this Work.
- No check method (` — 확인: …`) on any line: they are judged by reading the document and the diff.
- **Done when** also: the target document's path is in `제약`.
