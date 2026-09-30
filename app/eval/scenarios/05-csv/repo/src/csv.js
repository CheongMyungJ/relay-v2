// CSV 한 줄을 칸으로
export function parseLine(line) {
  return line.split(',')
}

// CSV 글을 줄과 칸으로
export function parseCsv(text) {
  return text.trim().split('\n').map(parseLine)
}
