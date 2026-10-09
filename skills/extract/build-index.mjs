// 구성별 빌드 인덱스(16.9 "심볼·구성 활성", 16.10 도구 사실의 다음 단계, AI 결정 87·88). 앱이 구성마다 레포를
// 전처리·컴파일한 결과에서 두 가지 사실을 만든다: 정의된 심볼(강한 정의인지 weak 기본 정의뿐인지)과 전처리 뒤 살아
// 있는 줄. 반영 검사 규칙 config_active(rules.mjs)가 이것으로 inventory 항목의 구성 주장을 본다.
// 여기에는 읽지 않는 순수 함수만 둔다. 컴파일러를 부르는 쪽은 앱(첫 구현은 평가 하네스의 eval/extract/build-index.mjs)이다.
//
// 인덱스 꼴(JSON):
//   { "version": 1, "configs": { "<구성>": { "symbols": { "<이름>": "strong" | "weak" },
//                                           "lines": { "<레포 상대 경로>": [[처음, 끝], ...] } } } }
import path from 'node:path';

/**
 * ELF 목적 파일(32·64비트, 리틀·빅 엔디언)의 심볼 표에서 정의된 함수·객체 심볼을 읽는다.
 * @param {Uint8Array} buf
 * @returns {{ name: string, bind: 'local' | 'global' | 'weak', type: 'func' | 'object' | 'other' }[]}
 */
export function elfSymbols(buf) {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length < 52 || b.readUInt32BE(0) !== 0x7f454c46) throw new Error('ELF 파일이 아니다');
  const is64 = b[4] === 2;
  const le = b[5] === 1;
  const u16 = (o) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const addr = (o) => (is64 ? Number(le ? b.readBigUInt64LE(o) : b.readBigUInt64BE(o)) : u32(o));
  const shoff = addr(is64 ? 0x28 : 0x20);
  const shentsize = u16(is64 ? 0x3a : 0x2e);
  const shnum = u16(is64 ? 0x3c : 0x30);
  const section = (i) => {
    const o = shoff + i * shentsize;
    return {
      type: u32(o + 4),
      offset: addr(o + (is64 ? 0x18 : 0x10)),
      size: addr(o + (is64 ? 0x20 : 0x14)),
      link: u32(o + (is64 ? 0x28 : 0x18)),
      entsize: addr(o + (is64 ? 0x38 : 0x24)),
    };
  };
  const out = [];
  for (let i = 0; i < shnum; i++) {
    const s = section(i);
    if (s.type !== 2) continue; // SHT_SYMTAB
    const strtab = section(s.link);
    const name = (o) => {
      const start = strtab.offset + o;
      const end = b.indexOf(0, start);
      return b.toString('latin1', start, end);
    };
    const ent = s.entsize || (is64 ? 24 : 16);
    for (let o = s.offset + ent; o + ent <= s.offset + s.size; o += ent) {
      const nameOff = u32(o);
      const info = b[o + (is64 ? 4 : 12)];
      const shndx = u16(o + (is64 ? 6 : 14));
      const bind = info >> 4;
      const type = info & 0xf;
      if (shndx === 0 || type === 3 || type === 4) continue; // 정의 없음, SECTION, FILE
      const n = name(nameOff);
      if (!n || n.startsWith('$') || n.startsWith('.')) continue; // ARM 매핑 심볼($t, $d), 지역 레이블
      out.push({
        name: n,
        bind: bind === 0 ? 'local' : bind === 2 ? 'weak' : 'global',
        type: type === 2 ? 'func' : type === 1 ? 'object' : 'other',
      });
    }
  }
  return out;
}

/** 심볼 목록 여럿(구성 하나의 목적 파일들)을 { 이름: strong|weak }로 합친다. 강한 정의가 하나라도 있으면 strong */
export function mergeSymbols(lists) {
  const out = {};
  for (const list of lists)
    for (const s of list) {
      const k = s.bind === 'weak' ? 'weak' : 'strong';
      if (out[s.name] !== 'strong') out[s.name] = k;
    }
  return out;
}

/** 경로를 레포 상대로. 레포 밖(시스템 헤더, <built-in>)이면 null */
function repoPath(file, repo) {
  if (!file || file.startsWith('<')) return null;
  const abs = path.resolve(repo, file);
  const rel = path.relative(repo, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/**
 * 전처리 출력(clang/gcc -E, 줄 표시 있음, -dD 권장)에서 살아 있는 줄을 모은다. 비지 않은 출력 줄의 원래 줄이 살아
 * 있는 줄이다(조건부로 빠진 구간은 줄 표시로 건너뛰므로 들어오지 않는다). 지시문 줄(#if, #include)은 빈 줄로 나와 세지 않는다.
 * @param {string} text
 * @param {string} repo 전처리한 cwd(레포 뿌리). 줄 표시의 상대 경로는 여기 기준이다
 * @returns {Record<string, Set<number>>}
 */
export function activeLines(text, repo) {
  const out = {};
  let file = null;
  let line = 0;
  for (const l of text.split('\n')) {
    const m = /^#\s*(?:line\s+)?(\d+)\s+"((?:[^"\\]|\\.)*)"/.exec(l);
    if (m) {
      file = repoPath(m[2].replace(/\\(.)/g, '$1'), repo);
      line = Number(m[1]);
      continue;
    }
    if (file && l.trim()) (out[file] ??= new Set()).add(line);
    line++;
  }
  return out;
}

/** 줄 집합을 [[처음, 끝], ...]으로 */
export function toRanges(set) {
  const xs = [...set].sort((a, b) => a - b);
  const out = [];
  for (const x of xs) {
    const last = out.at(-1);
    if (last && x === last[1] + 1) last[1] = x;
    else out.push([x, x]);
  }
  return out;
}

/** 여러 번역 단위의 살아 있는 줄을 합쳐 { 경로: 범위 } */
export function mergeLines(maps) {
  const all = {};
  for (const m of maps) for (const [f, s] of Object.entries(m)) for (const x of s) (all[f] ??= new Set()).add(x);
  return Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)).map(([f, s]) => [f, toRanges(s)]));
}

const isIdent = (s) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);

/** 앵커의 줄 범위가 그 구성에서 하나라도 살아 있는가 */
function anchorActive(cfg, a) {
  const ranges = cfg?.lines?.[a.path];
  if (!ranges) return false;
  return ranges.some(([s, e]) => s <= a.end && a.start <= e);
}

/**
 * inventory 항목의 구성 주장을 인덱스와 견준다(규칙 config_active). 인덱스에 있는 구성만 본다.
 * - 이름이 식별자이고 어느 구성에서든 강하게 정의되면: 주장한 구성마다 강한 정의가 있어야 한다(weak 기본 정의만이면 아님).
 * - 아니면 code 앵커 가운데 어느 구성에서든 살아 있는 줄을 가리키는 것만 보고, 주장한 구성마다 그중 하나는 살아 있어야 한다.
 * 가를 수 없는 항목(식별자도 아니고 살아 있는 줄을 가리키는 앵커도 없음)은 넘어간다.
 * @returns {string[]}
 */
export function inventoryProblems(result, index) {
  const configs = index?.configs ?? {};
  const built = Object.keys(configs);
  if (!built.length) return [];
  const out = [];
  for (const item of result?.inventory ?? []) {
    if (!Array.isArray(item?.configs)) continue;
    const claimed = item.configs.includes('all') ? built : item.configs.filter((c) => built.includes(c));
    if (!claimed.length) continue;
    const name = typeof item.name === 'string' ? item.name : '';
    const bySymbol = isIdent(name) && built.some((c) => configs[c].symbols?.[name] === 'strong');
    const judged = (item.anchors ?? []).filter((a) => a?.kind === 'code' && built.some((c) => anchorActive(configs[c], a)));
    for (const c of claimed) {
      if (bySymbol) {
        const s = configs[c].symbols?.[name];
        if (s !== 'strong')
          out.push(`inventory ${item.key} (${name}): configuration ${c} ${s === 'weak' ? 'has only a weak default definition' : 'does not define it'}`);
      } else if (judged.length && !judged.some((a) => anchorActive(configs[c], a))) {
        out.push(`inventory ${item.key} (${name}): in configuration ${c} the cited lines are not compiled (${judged.map((a) => `${a.path}:${a.start}`).join(', ')})`);
      }
    }
  }
  return out;
}
