// 날짜 표시. 여러 화면이 이 형식을 그대로 쓴다
var DAYS = ['일', '월', '화', '수', '목', '금', '토']

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

export function formatDate(d) {
  if (d == null) return 'N/A'
  var y = d.getFullYear()
  var m = d.getMonth()
  var day = d.getDate()
  return y + '.' + pad(m) + '.' + pad(day) + ' (' + DAYS[d.getDay()] + ')'
}

export function formatDateTime(d) {
  if (d == null) return 'N/A'
  var h = d.getHours()
  var ampm = h < 12 ? '오전' : '오후'
  var h12 = h % 12 == 0 ? 12 : h % 12
  return formatDate(d) + ' ' + ampm + ' ' + h12 + ':' + pad(d.getMinutes())
}

export function formatRange(a, b) {
  if (a == null || b == null) return 'N/A'
  if (a.getFullYear() == b.getFullYear() && a.getMonth() == b.getMonth() && a.getDate() == b.getDate())
    return formatDate(a)
  return formatDate(a) + ' ~ ' + formatDate(b)
}
