// PATH에서 실행 파일 찾기. findClaude, findCodex, 업데이트 설치 판정(main/update)이 함께 쓴다 (PR #37 리뷰).
import fs from 'node:fs'
import path from 'node:path'

/** PATH의 폴더들. Windows는 환경 변수 이름의 대소문자를 가리지 않아 Path도 읽고 ;로 나눈다. 빈 항목은 뺀다 */
export function pathDirs(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const value = env['PATH'] ?? env['Path'] ?? ''
  return value.split(platform === 'win32' ? ';' : ':').filter((dir) => dir !== '')
}

/** 실행할 수 있는 파일인가 */
export function isExecutable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.X_OK)
    return fs.statSync(file).isFile()
  } catch {
    return false
  }
}

/**
 * 명령이 있는가. electron-updater의 LinuxUpdater.hasCommand와 같게 절대 경로인 PATH 항목만 보고 실행 권한을 본다.
 * 그래야 업데이터가 고를 비밀번호 도구를 relay도 똑같이 판정한다
 */
export function hasCommand(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  executable: (file: string) => boolean = isExecutable,
): boolean {
  return pathDirs(env, 'linux')
    .filter((dir) => path.posix.isAbsolute(dir))
    .some((dir) => executable(path.posix.join(dir, name)))
}
