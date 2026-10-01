// 시나리오의 업무 유형(relay D236)에 따른 낱말. scenario.json의 type이 없으면 버그 수정이다 (relay I62)
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
}

export function scenarioType(scenario) {
  return scenario.type === 'feature' ? 'feature' : 'bugfix'
}

export function words(scenario) {
  return WORDS[scenarioType(scenario)]
}
