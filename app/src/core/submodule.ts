// 서브모듈 Work (D413~D417): 서브모듈 레포만 다루는 Work와 그 메인 통합 검증 worktree의 순수 규칙.
// 서브모듈의 기본 브랜치 고르기, 에이전트 세션의 git 설정 보호, 메인 worktree의 변경 거르기를 맡는다.
// git에서 읽는 것은 main이 넘긴다.

/**
 * 서브모듈 프로젝트의 기본 브랜치 (D413). 서브모듈 체크아웃은 보통 분리된 HEAD라 현재 브랜치로 채울 수 없다:
 * origin/HEAD, `.gitmodules`의 branch, origin의 main·master, origin의 첫 브랜치 차례로 고른다. 없으면 null
 */
export function submoduleDefaultBranch(input: {
  remoteHead: string | null
  configured: string | null
  remote: readonly string[]
}): string | null {
  if (input.remoteHead) return input.remoteHead
  // `.gitmodules`의 branch = .은 메인 레포와 같은 이름이라는 뜻이다(git 문서 gitmodules). 그 이름은 여기서 모른다
  if (input.configured && input.configured !== '.' && input.remote.includes(input.configured))
    return input.configured
  for (const name of ['main', 'master']) if (input.remote.includes(name)) return name
  return input.remote[0] ?? null
}

/**
 * 메인 통합 검증 worktree에서 에이전트가 하는 git의 보호 (D415): `submodule.<이름>.update=none`을 환경 변수 설정
 * (GIT_CONFIG_COUNT, GIT_CONFIG_KEY_<n>, GIT_CONFIG_VALUE_<n>, git 문서 git-config ENVIRONMENT)으로 더한다. 그러면
 * `git submodule update`가 그 서브모듈을 건너뛰어(실행), 서브모듈 Work의 worktree를 기준 커밋으로 되돌리거나 서브모듈
 * 저장소의 core.worktree를 바꿔 쓰지 않는다. 레포의 설정 파일은 건드리지 않는다. 이미 있는 환경 변수 설정 뒤에 붙인다.
 * 더할 환경 변수를 돌려준다
 */
export function submoduleGuardEnv(
  env: Readonly<Record<string, string | undefined>>,
  names: readonly string[],
): Record<string, string> {
  if (names.length === 0) return {}
  const raw = env['GIT_CONFIG_COUNT']
  const count = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : 0
  const out: Record<string, string> = {}
  names.forEach((name, i) => {
    out[`GIT_CONFIG_KEY_${count + i}`] = `submodule.${name}.update`
    out[`GIT_CONFIG_VALUE_${count + i}`] = 'none'
  })
  out['GIT_CONFIG_COUNT'] = String(count + names.length)
  return out
}

/**
 * 메인 통합 검증 worktree의 커밋 안 된 변경 가운데 메인 쪽 변경 (D414): git status --porcelain=v1 줄에서 서브모듈
 * Work의 자리(그 서브모듈이 가리키는 커밋이 바뀐 것)를 뺀다. 이 변경은 전달되지 않는다
 */
export function mainSideChanges(lines: readonly string[], submodulePath: string): string[] {
  return lines.filter((l) => statusPath(l) !== submodulePath)
}

/** porcelain v1 한 줄의 경로. 이름을 바꾼 줄은 새 이름이다. 따옴표로 감싼 이름은 그대로 둔다 */
function statusPath(line: string): string {
  const rest = line.slice(3)
  const arrow = rest.indexOf(' -> ')
  return arrow >= 0 ? rest.slice(arrow + 4) : rest
}
