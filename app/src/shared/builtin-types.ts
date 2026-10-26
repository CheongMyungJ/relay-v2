// 기본 유형의 정의 (5.6.15, D506, D511). 원본은 skills/types/<id>/type.json이고, core와 화면이 파일 없이 유형 설정을 알도록 같은
// 값을 여기 둔다. 둘이 같은지 [단위] 시험(test/unit/builtin-types.test.ts)이 본다. 유형 설정을 고르는 함수는 core/builtin-types다
import type { BuiltinWorkType, CustomTypeDef } from './work'

const step = (
  id: string,
  title: string,
  sections: string[],
  lead: string[],
  questionMode: 'draft_first' | null = 'draft_first',
) => ({
  id,
  title,
  sections,
  lead,
  question_mode: questionMode,
  auto_approve: false,
  step_base: false,
})

/** 기본 유형 다섯의 정의 (skills/types/<id>/type.json과 같다) */
export const BUILTIN_TYPES: Readonly<Record<BuiltinWorkType, CustomTypeDef>> = {
  bugfix: {
    id: 'bugfix',
    name: '버그 수정',
    description: '지금 동작이 틀린 것을 재현하고 원인을 찾아 고치는 일',
    request_hint: '버그 설명, 로그, 이슈 내용을 붙여 넣으세요',
    branch_prefix: 'fix',
    check_method: false,
    target: 'code',
    steps: [
      step(
        'fix',
        '원인 분석과 수정',
        ['재현', '원인', '변경 요약', '재현 테스트', '테스트 실행'],
        ['원인'],
      ),
    ],
  },
  feature: {
    id: 'feature',
    name: '기능 추가·변경',
    description: '새 동작을 더하거나, 의도대로 도는 지금 동작을 바꾸거나 없애는 일',
    request_hint: '만들 기능이나 바꾸거나 없앨 동작, 쓰는 흐름, 참고할 이슈 내용을 붙여 넣으세요',
    branch_prefix: 'feat',
    check_method: false,
    target: 'code',
    steps: [
      step(
        'design',
        '설계와 계획',
        [
          '유저 시나리오',
          '요구사항',
          '접근',
          '바뀌는 곳',
          '기존 동작 영향',
          '구현 계획',
          '테스트 계획',
          '위험',
        ],
        ['유저 시나리오', '요구사항'],
      ),
      step(
        'implement',
        '구현',
        ['변경 요약', '계획과 달라진 점', '새 동작 테스트', '테스트 실행'],
        ['계획과 달라진 점'],
      ),
    ],
  },
  refactor: {
    id: 'refactor',
    name: '리팩터링',
    description: '동작은 그대로 두고 구조를 바꾸는 일',
    request_hint:
      '바꿀 구조(예: 어느 계산을 한 모듈로 모을지), 바꿀 곳, 지켜야 할 동작을 적어 주세요',
    branch_prefix: 'refactor',
    check_method: false,
    target: 'code',
    steps: [
      step(
        'refactor',
        '계획과 리팩터링',
        ['계획', '안전망 테스트', '변경 요약', '찾은 버그와 받아들인 차이', '테스트 실행'],
        ['계획', '찾은 버그와 받아들인 차이'],
      ),
    ],
  },
  spec: {
    id: 'spec',
    name: '설계',
    description: '큰 일을 만들기 전에 설계만 정해 레포의 설계 문서에 쓰는 일',
    request_hint: '무엇을 설계할지, 정해야 할 것, 설계 문서를 둘 곳이나 고칠 문서를 적어 주세요',
    branch_prefix: 'spec',
    check_method: false,
    target: 'document',
    steps: [
      step(
        'spec',
        '설계 문답',
        ['주제 목록', '문답 기록', '확인한 것', '문서 변경'],
        ['주제 목록'],
        null,
      ),
    ],
  },
  general: {
    id: 'general',
    name: '일반',
    description: '다른 유형에 맞지 않는 일: 설정, CI, 문서, 의존성 올리기, 섞인 일 등',
    request_hint: '할 일과 끝났다고 볼 조건을 적어 주세요(무엇을 바꾸고 어떻게 확인할지)',
    branch_prefix: 'chore',
    check_method: true,
    target: 'code',
    steps: [
      step(
        'execute',
        '실행',
        ['계획', '변경 요약', '완료조건별 자체 확인', '테스트 실행'],
        ['계획', '완료조건별 자체 확인'],
      ),
    ],
  },
}

/**
 * 기본 유형 단계의 산출물 이름이 `<단계 id>.md`와 다른 것 (D512). 커스텀 유형으로 복사할 때 글에서 이 이름을 `<단계 id>.md`로
 * 바꾼다: 커스텀 단계의 산출물은 늘 `<단계 id>.md`다 (D453)
 */
export const BUILTIN_ARTIFACT_NAMES: Readonly<Record<string, string>> = {
  execute: 'execution.md',
}

/** 커스텀 유형의 기본 요청 입력 안내 (D511) */
export const CUSTOM_REQUEST_HINT =
  '이 유형에 맞는 할 일과 끝났다고 볼 조건을 적어 주세요(무엇을 바꾸고 어떻게 확인할지)'
