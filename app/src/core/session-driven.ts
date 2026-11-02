// 세션이 하고 앱은 보는 Work (docs/design.md D557~D561, docs/session-driven.md)의 앱 쪽 값

/** Work 브랜치 push마다 앱이 저절로 돌리는 독립 리뷰의 상한 (D559, (기본값)). 그 뒤는 사람이 [독립 리뷰]를 누른다 */
export const SESSION_AUTO_REVIEWS = 2

/** 앱이 돌린 독립 리뷰의 기록. task 디렉터리에 둔다 (D559) */
export const SESSION_REVIEWS_FILE = 'session-reviews.json'
