// 시나리오의 업무 유형(relay D236, D261, D303, D353, D447, D533)에 따른 낱말. scenario.json의 type이 없으면 버그 수정이다 (relay I62, I67, I92, I112)
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
  // 자율(relay D533)은 의도만 정하고 진행 방식은 에이전트가 고른다. 교차 비교의 relay@auto 쪽으로 쓴다
  auto: {
    label: '자율',
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
  // 커스텀 유형(relay D447)은 팀이 정한 단계로 일반과 같은 일을 한다. 어느 유형인지는 scenario.customType이다
  custom: {
    label: '커스텀',
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
 * 만든다. 붙지 않았으면 null. 커스텀은 유형마다 버튼 이름이 달라 쪽 이름으로 고르지 않는다(시나리오의 customType, relay D463)
 */
export function armType(arm) {
  const t = /@([a-z]+)$/.exec(String(arm ?? ''))?.[1]
  return t && t !== 'custom' && Object.hasOwn(WORDS, t) ? t : null
}

/** 쪽 이름에서 `@<유형>`을 뗀 것. 앱 빌드와 지식 끔(-off)은 이 이름으로 가린다 */
export const armBase = (arm) => String(arm ?? '').replace(/@[a-z]+$/, '')

/**
 * relay-v3 앱의 쪽과 그 앱에 더 줄 환경 변수(env), 띄울 체크아웃(build). 모두 같은 운전자(relay3-arm.mjs), 같은 품질 기준
 * 덧씌우기, 같은 리뷰 세기를 쓴다. v3에는 업무 유형이 없어 `@<유형>`을 붙이지 않는다.
 * - M2 규약(relay-v3 docs/experiments/m2/protocol.md 2절): relay3는 앱 기본(질문은 결정마다 확인, 리뷰는 모두),
 *   relay3-noreview는 같은 빌드에서 평가용 환경 변수로 독립 리뷰를 끈 것이다(제품 설정이 아님). M2 결과를 다시 모으려고 둔다
 * - M2.1 규약(relay-v3 docs/m2.1-design.md 14절): relay3-m21은 M2.1을 만든 빌드(RELAY3_APP), relay3-m2p는 M2 빌드에 미룬
 *   고침을 합친 빌드(RELAY3_M2P_APP, 같은 날 도는 기준). 화면 흐름이 다르다(m2p는 M2의 [끝 확정]과 [고쳐 달라고 하기]):
 *   사람 역할의 설명서는 쪽 이름의 설명서가 있으면 그것이다(human.mjs guideName, guides/relay3-m2p.md)
 */
const RELAY3_ARMS = {
  relay3: { env: {}, build: 'main' },
  'relay3-noreview': { env: { RELAY_ABLATE: 'review' }, build: 'main' },
  'relay3-m21': { env: {}, build: 'main' },
  'relay3-m2p': { env: {}, build: 'm2p' },
}

/** relay-v3 앱의 쪽인가 */
export const isRelay3 = (arm) => Object.hasOwn(RELAY3_ARMS, String(arm ?? ''))

/** relay-v3 쪽이 앱에 더 줄 환경 변수 */
export const relay3Env = (arm) => ({ ...(RELAY3_ARMS[String(arm ?? '')]?.env ?? {}) })

/**
 * relay-v3 쪽이 띄울 체크아웃: main(RELAY3_APP)이나 m2p(RELAY3_M2P_APP). relay-v3 쪽이 아니면 null. 폴더는
 * relay3-arm.mjs relay3AppOf가 고른다
 */
export const relay3Build = (arm) => RELAY3_ARMS[String(arm ?? '')]?.build ?? null

/** relay-v3 쪽 이름들 */
export const RELAY3 = Object.keys(RELAY3_ARMS)

/** 유형의 화면 이름 (relay 새 Work 대화상자의 버튼) */
export const typeLabel = (type) => WORDS[type]?.label ?? type

function scenarioType(scenario) {
  return Object.hasOwn(WORDS, scenario.type ?? '') ? scenario.type : 'bugfix'
}

export function words(scenario) {
  return WORDS[scenarioType(scenario)]
}
