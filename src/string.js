function findLineStart(s, i) {
  let pos = i;
  while (pos >= 0 && s[pos] !== "\n") {
    pos--;
  }
  pos++;
  return {index: pos, column: i - pos};
}

function findLineEnd(s, i) {
  let pos = i;
  while (pos < s.length && s[pos] !== "\n") {
    pos++;
  }
  return pos;
}

function findLineNumber(s, i) {
  let pos = i, l = 0;
  while (pos >= 0) {
    pos--;
    if (s[pos] === "\n") {
      l++;
    }
  }
  return l;
}

/**
 * Given a string and an index, return the line number, column position, and
 * the whole line at that index.
 * @arg s - The string to look into.
 * @arg i - The index into the string.
 * @returns {object} - An object containing the line, row and column.
 */
export function findLine(s, i) {
  const pos = i > s.length ? s.length - 1 : i;
  const {index: start, column} = findLineStart(s, pos);
  const end = findLineEnd(s, pos);
  const row = findLineNumber(s, pos);
  return {row, column, line: s.slice(start, end)};
}

/**
 * Repeat a string `n` times.
 */
export function repeat(n, s) {
  return n > 0 ? s + repeat(n - 1, s) : "";
}

/**
 * Returns the next `n` characters from the string, starting at index `i`,
 * or until a newline. Include a concatenation marker if we didn't hit a
 * newline.
 */
export function nextOnLine(n, s, i) {
  let ct = 0, pos = i, out = "";
  while (ct < n && s[pos] !== "\n" && pos < s.length) {
    out += s[pos];
    pos++;
    ct++;
  }
  if (s[pos] !== "\n" && pos < s.length) {
    out += "...";
  }
  return out;
}
