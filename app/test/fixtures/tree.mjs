// 트리 종료 시험용: 자식 프로세스를 하나 띄우고 둘 다 살아 있는다.
import { spawn } from 'node:child_process'

const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1 << 30)'], { stdio: 'ignore' })
process.stdout.write(`TREE READY ${process.pid} ${child.pid}\r\n`)
setInterval(() => {}, 1 << 30)
