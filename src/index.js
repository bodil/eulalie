import isGeneratorFunction from "is-generator-function";
import isIterable from "is-iterable";
import isIteratorLike from "is-iterator-like";

function isGen(v) {
  if (regeneratorRuntime) {
    /* global regeneratorRuntime */
    return regeneratorRuntime.isGeneratorFunction(v);
  }
  return isGeneratorFunction(v);
}

export class Stream {
  constructor(buffer, cursor) {
    this.buffer = buffer;
    this.cursor = typeof cursor === "number" ? cursor : 0;
    Object.freeze(this);
  }

  get() {
    if (this.atEnd()) {
      throw new Error("Cannot step past end of buffer.");
    }
    return this.buffer[this.cursor];
  }

  next() {
    if (this.atEnd()) {
      throw new Error("Cannot step past end of buffer.");
    }
    return new Stream(this.buffer, this.cursor + 1);
  }

  atEnd() {
    return this.cursor >= this.buffer.length;
  }
}

export class ParseError {
  constructor(input, message) {
    this.input = input;
    this.message = message;
    Object.freeze(this);
  }
}

export class ParseResult {
  constructor(value, next, start, matched) {
    this.value = value;
    this.next = next;
    this.start = start;
    this.matched = matched;
    Object.freeze(this);
  }
}

export function error(input, message) {
  return new ParseError(input, message);
}

export function result(value, next, start, matched) {
  return new ParseResult(value, next, start, matched);
}

export function stream(s) {
  return new Stream(s);
}



export function parse(parser, input) {
  return parser(input);
}



function badValue(v) {
  return new Error(`Parser returned unexpected value: ${v}`);
}



export function seq(parser, callback) {
  if (isGen(parser)) {
    return (start) => {
      const iter = parser();
      const runP = (input, res) => {
        const next = iter.next(res !== undefined ? res : null);
        if (next.done) {
          return result(next.value, input, res.start, res.matched);
        }
        const out = parse(next.value, input);
        if (out instanceof ParseResult) {
          const matched = res === undefined ? out.matched : res.matched + out.matched;
          return runP(out.next, result(out.value, out.next, start, matched));
        }
        if (out instanceof ParseError) {
          return out;
        }
        throw badValue(out);
      };
      return runP(start);
    };
  }

  return (input) => {
    const out = parse(parser, input);
    if (out instanceof ParseResult) {
      const next = parse(callback(out.value, input), out.next);
      if (next instanceof ParseResult) {
        return result(next.value, next.next, input, out.matched + next.matched);
      }
      if (next instanceof ParseError) {
        return next;
      }
      throw badValue(next);
    }
    if (out instanceof ParseError) {
      return out;
    }
    throw badValue(out);
  };
}

export function either(p1, p2) {
  if (isGen(p1)) {
    return either(p1());
  }
  if (isIteratorLike(p1)) {
    const {value, done} = p1.next();
    return done ? value : either(value, either(p1));
  }
  if (isIterable(p1)) {
    return either(p1[Symbol.iterator]());
  }
  return (input) => {
    const r1 = parse(p1, input);
    if (r1 instanceof ParseResult) {
      return r1;
    }
    if (r1 instanceof ParseError) {
      const r2 = parse(p2, input);
      if (r2 instanceof ParseResult || r2 instanceof ParseError) {
        return r2;
      }
      throw badValue(r2);
    }
    throw badValue(r1);
  };
}

export function unit(value, matched = "") {
  return (input) => result(value, input, input, matched);
}

export function fail(input) {
  return error(input);
}

export function item(input) {
  return input.atEnd() ? error(input) : result(input.get(), input.next(), input, input.get());
}

export function sat(predicate) {
  return seq(item, (value, start) => predicate(value) ? unit(value) : () => error(start));
}



export function many(parser) {
  return either(many1(parser), unit(""));
}

export function many1(parser) {
  return seq(parser, (head) => seq(many(parser), (tail) => unit(head + tail)));
}



export function char(c) {
  return sat((i) => i === c);
}

export function string(s) {
  if (s.length > 0) {
    return seq(char(s[0]), () => seq(string(s.slice(1)), () => unit(s)));
  }
  return unit("");
}



export const isDigit = (c) => /^\d$/.test(c);
export const isSpace = (c) => /^\s$/.test(c);
export const isAlphanum = (c) => /^\w$/.test(c);
export const isLetter = (c) => /^[a-zA-Z]$/.test(c);
export const isUpper = (c) => isLetter(c) && c == c.toUpperCase();
export const isLower = (c) => isLetter(c) && c == c.toLowerCase();
export const not = (f) => (c) => !f(c);

export const digit = sat(isDigit);
export const space = sat(isSpace);
export const alphanum = sat(isAlphanum);
export const letter = sat(isLetter);
export const upper = sat(isUpper);
export const lower = sat(isLower);

export const notDigit = sat(not(isDigit));
export const notSpace = sat(not(isSpace));
export const notAlphanum = sat(not(isAlphanum));
export const notLetter = sat(not(isLetter));
export const notUpper = sat(not(isUpper));
export const notLower = sat(not(isLower));

export const spaces = many(space);
export const spaces1 = many1(space);

export const notSpaces = many(sat(not(isSpace)));
export const notSpaces1 = many1(sat(not(isSpace)));
