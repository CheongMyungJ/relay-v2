// 터미널을 만든 Work (D143). 앱을 켤 때 모든 Work의 터미널을 만들지 않고, 사람이 고른 적 있는 Work만 만든다.
// 터미널은 처음 붙을 때 main에서 지금까지의 출력을 받으므로(terminals.ts) 늦게 만들어도 잃는 출력이 없다.

/** 고른 Work를 더한 집합. 이미 있거나 고른 것이 없으면 같은 집합을 돌려준다 */
export function withOpened(
  opened: ReadonlySet<string>,
  selected: string | null,
): ReadonlySet<string> {
  if (selected === null || opened.has(selected)) return opened
  return new Set([...opened, selected])
}
