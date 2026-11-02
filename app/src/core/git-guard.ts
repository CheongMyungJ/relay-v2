// 세션이 하는 Work의 git·gh 보호 (docs/design.md D558). 세션은 작업 브랜치에 push하고 PR을 열 수 있다. 되돌리기 어려운 것만
// 막는다: 지킬 브랜치(머지 대상, 기준, main, master)에 push, 강제 push, 원격 브랜치 지우기, 모든 브랜치 push, PR 머지.
// 명령 줄의 낱말만 본다. 스크립트나 별칭 안의 명령은 막지 못한다(실수를 막는 장치, D91)

/** git과 gh의 전역 옵션 가운데 값을 다음 낱말로 받는 것 */
const VALUE_OPTIONS: Readonly<Record<'git' | 'gh', readonly string[]>> = {
  git: ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix'],
  gh: ['-R', '--repo', '--hostname'],
}

/** git push의 옵션 가운데 값을 다음 낱말로 받는 것 */
const PUSH_VALUE_OPTIONS = ['-o', '--push-option', '--repo', '--receive-pack', '--exec']

/** 막는 git push 옵션 */
const PUSH_BLOCKED = new Set([
  '-f',
  '--force',
  '--force-with-lease',
  '--force-if-includes',
  '-d',
  '--delete',
  '--mirror',
  '--all',
  '--prune',
])

/** 언제나 지키는 브랜치 이름 */
export const ALWAYS_PROTECTED = ['main', 'master'] as const

const branchName = (ref: string) => ref.replace(/^refs\/heads\//, '')

/**
 * 명령 줄에서 막을 git·gh 동작을 찾는다 (D558). 막을 것이 있으면 까닭을, 없으면 null을 돌려준다. protectedBranches는 이 Work의
 * 머지 대상과 기준 브랜치다(main, master는 늘 더한다)
 */
export function riskyGitCommand(
  command: string,
  protectedBranches: readonly string[],
): string | null {
  const guarded = new Set([...ALWAYS_PROTECTED, ...protectedBranches.map(branchName)])
  for (const part of command.split(/[\n;&|]+/)) {
    const words = part.trim().split(/\s+/).filter(Boolean)
    for (let k = 0; k < words.length; k++) {
      const name = (words[k] ?? '')
        .replace(/^.*[\\/]/, '')
        .replace(/\.exe$/i, '')
        .toLowerCase()
      if (name !== 'git' && name !== 'gh') continue
      let n = k + 1
      while (n < words.length && (words[n] ?? '').startsWith('-')) {
        n += VALUE_OPTIONS[name].includes(words[n] ?? '') ? 2 : 1
      }
      const sub = (words[n] ?? '').toLowerCase()
      if (name === 'gh' && sub === 'pr' && (words[n + 1] ?? '').toLowerCase() === 'merge')
        return 'PR 머지는 사람이 합니다 (relay D558)'
      if (name !== 'git' || sub !== 'push') continue
      const args: string[] = []
      for (let i = n + 1; i < words.length; i++) {
        const w = words[i] ?? ''
        if (w.startsWith('-')) {
          const opt = w.split('=')[0] ?? w
          if (PUSH_BLOCKED.has(opt) || (/^-[a-z]*f/.test(w) && !w.startsWith('--')))
            return `강제 push, 원격 브랜치 지우기, 모든 브랜치 push는 relay가 막습니다 (${w}, D558)`
          if (PUSH_VALUE_OPTIONS.includes(w)) i++
          continue
        }
        args.push(w)
      }
      // 첫 낱말은 원격이고 나머지는 refspec이다
      for (const spec of args.slice(1)) {
        if (spec.startsWith('+')) return `강제 push(${spec})는 relay가 막습니다 (D558)`
        if (spec.startsWith(':')) return `원격 브랜치 지우기(${spec})는 relay가 막습니다 (D558)`
        const dest = branchName(spec.includes(':') ? (spec.split(':')[1] ?? '') : spec)
        if (guarded.has(dest))
          return `${dest}에 바로 push하지 않습니다. 작업 브랜치에 push하고 PR을 여세요 (relay D558)`
      }
    }
  }
  return null
}
