// 시나리오의 업무 유형(relay D236, D261, D303, D353)에 따른 낱말. scenario.json의 type이 없으면 버그 수정이다 (relay I62, I67, I92, I112)
const WORDS = {
  bugfix: {
    label: '버그 수정',
    task: '버그를 고친다',
    goal: '버그가 고쳐졌다고',
    subject: '고칠 버그 (네가 받은 리포트나 네가 본 것)',
    done: '이 버그를 고친',
    again: '비슷한 버그에',
    report: '버그 리포트',
    same: '같은 버그를',
    did: '고친',
    made: '고쳐졌나',
  },
  feature: {
    label: '기능 추가',
    task: '기능을 만든다',
    goal: '기능이 요구대로 됐다고',
    subject: '만들 기능 (네가 받은 요청)',
    done: '이 기능을 만든',
    again: '비슷한 기능에',
    report: '기능 요청',
    same: '같은 기능을',
    did: '만든',
    made: '만들어졌나',
  },
  refactor: {
    label: '리팩터링',
    task: '코드 구조를 바꾼다(동작은 그대로)',
    goal: '구조가 요구대로 바뀌고 동작이 그대로라고',
    subject: '바꿀 구조 (네가 받은 요청)',
    done: '이 리팩터링을 한',
    again: '비슷한 리팩터링에',
    report: '리팩터링 요청',
    same: '같은 리팩터링을',
    did: '바꾼',
    made: '구조가 바뀌고 동작이 그대로인가',
  },
  // 맨 CLI에는 유형이 없어 요청으로 같은 일을 시킨다: 코드는 아직 바꾸지 않는다 (relay I112)
  spec: {
    label: '설계',
    task: '설계를 정해 문서로 남긴다(코드는 아직 바꾸지 않는다)',
    goal: '설계가 요구대로 정해져 문서에 남았다고',
    subject: '정할 설계 (네가 받은 요청)',
    done: '이 설계를 정한',
    again: '비슷한 설계에',
    report: '설계 요청',
    same: '같은 설계를',
    did: '정한',
    made: '정해져 문서에 남았나',
  },
  general: {
    label: '일반',
    task: '일을 한다',
    goal: '일이 요구대로 됐다고',
    subject: '할 일 (네가 받은 요청)',
    done: '이 일을 한',
    again: '비슷한 일에',
    report: '요청',
    same: '같은 일을',
    did: '한',
    made: '요구대로 됐나',
  },
}

/**
 * 쪽 이름의 유형 (relay I93): `relay@general`처럼 `@<유형>`이 붙은 relay 쪽은 시나리오의 유형 대신 그 유형으로 새 Work를
 * 만든다. 붙지 않았으면 null
 */
export function armType(arm) {
  const t = /@([a-z]+)$/.exec(String(arm ?? ''))?.[1]
  return t && Object.hasOwn(WORDS, t) ? t : null
}

/** 쪽 이름에서 `@<유형>`을 뗀 것. 앱 빌드와 지식 끔(-off)은 이 이름으로 가린다 */
export const armBase = (arm) => String(arm ?? '').replace(/@[a-z]+$/, '')

/** 유형의 화면 이름 (relay 새 Work 대화상자의 버튼) */
export const typeLabel = (type) => WORDS[type]?.label ?? type

function scenarioType(scenario) {
  return Object.hasOwn(WORDS, scenario.type ?? '') ? scenario.type : 'bugfix'
}

export function words(scenario) {
  return WORDS[scenarioType(scenario)]
}
