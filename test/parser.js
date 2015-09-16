/* eslint-env node, mocha */
/* global check, gen */

import assert from "assert";
import jsesc from "jsesc";
import * as p from "../src/index";

import mochaTestcheck from "mocha-testcheck";
mochaTestcheck.install();

describe("stream", () => {
  it("yields values in sequence, then throws an error", () => {
    const s1 = p.stream("omg");
    assert.equal(s1.get(), "o");
    assert(!s1.atEnd(), "s1 is at end");
    const s2 = s1.next();
    assert.equal(s2.get(), "m");
    assert(!s2.atEnd(), "s2 is at end");
    const s3 = s2.next();
    assert.equal(s3.get(), "g");
    assert(!s3.atEnd(), "s3 is at end");
    const s4 = s3.next();
    assert(s4.atEnd(), "s4 isn't at end");
    assert.throws(() => s4.get(), Error);
    assert.throws(() => s4.next(), Error);
  });
});

describe("basic combinators", () => {
  it("item", () => {
    const input = p.stream("hi");
    const result = p.parse(p.item, input);
    assert(p.isResult(result), "parser output is not ParseResult");
    assert.equal(result.matched, "h");
    assert.equal(result.value, "h");
    assert.equal(result.next.get(), "i");
  });
  it("seq", () => {
    const input = p.stream("hi");
    const two = p.seq(p.item, (first) => p.seq(p.item, (second) => p.unit(first + second)));
    const result = p.parse(two, input);
    assert(p.isResult(result), "parser output is not ParseResult");
    assert.equal(result.matched, "hi");
    assert.equal(result.value, "hi");
    assert.equal(result.start.cursor, 0);
    assert.equal(result.next.cursor, 2);
    assert(result.next.atEnd(), "result isn't at end");
  });
  it("sat", () => {
    const input = p.stream("hi");
    const isH = (s) => s === "h";
    const res1 = p.parse(p.sat(isH), input);
    assert(p.isResult(res1), "parser output is not ParseResult");
    assert.equal(res1.matched, "h");
    assert.equal(res1.value, "h");
    assert.equal(res1.start.cursor, 0);
    assert.equal(res1.next.cursor, 1);
    assert(!res1.next.atEnd(), "res1 is at end");
    const res2 = p.parse(p.sat(isH), res1.next);
    assert(p.isError(res2), "parser output is not ParseError");
    assert.equal(res2.input.cursor, 1, "start of failing parser isn't where it should be");
  });
  it("either", () => {
    const input = p.stream("hi");
    const isH = (s) => s === "h";
    const isI = (s) => s === "i";
    const p1 = p.either(p.sat(isH), p.sat(isI));
    const p2 = p.either(p.sat(isI), p.sat(isH));
    const r1 = p.parse(p1, input);
    const r2 = p.parse(p2, input);
    assert(p.isResult(r1), "parser output is not ParseResult");
    assert.equal(r1.matched, "h");
    assert.equal(r1.value, "h");
    assert.deepEqual(r1, r2);
  });
});

describe("string matching", () => {
  it("matches a string", () => {
    const input = p.stream("ohai lol");
    const result = p.parse(p.string("ohai"), input);
    assert(p.isResult(result), "parser output is not ParseResult");
    assert.equal(result.matched, "ohai");
    assert.equal(result.value, "ohai");
    assert.equal(result.start.cursor, 0);
    assert.equal(result.next.cursor, 4);
  });
  it("matches a sequence of characters", () => {
    const input = p.stream("ohai lol");
    const result = p.parse(p.seq(p.char("o"), () => p.seq(p.char("h"), () => p.seq(p.char("a"), () => p.seq(p.char("i"), () => p.unit("lol"))))), input);
    assert(p.isResult(result), "parser output is not ParseResult");
    assert.equal(result.matched, "ohai");
    assert.equal(result.value, "lol");
    assert.equal(result.start.cursor, 0);
    assert.equal(result.next.cursor, 4);
  });
});

describe("alternate seq/either syntax", () => {
  it("successful seq parse with generator", () => {
    const input = p.stream("omg");
    const result = p.parse(p.seq(function*() {
      const {value: a} = yield p.item;
      const {value: b} = yield p.item;
      const {value: c} = yield p.item;
      return a + b + c;
    }), input);
    assert(p.isResult(result), "parser output is not ParseResult");
    assert.equal(result.matched, "omg");
    assert.equal(result.value, "omg");
    assert.equal(result.start.cursor, 0);
    assert.equal(result.next.cursor, 3);
  });
  it("failed seq parse with generator", () => {
    const input = p.stream("omg");
    const result = p.parse(p.seq(function*() {
      yield p.item;
      yield p.item;
      yield p.sat((i) => i === "l");
    }), input);
    assert(p.isError(result), "parser output is not ParseError");
    assert.equal(result.input.cursor, 2);
  });
  it("an HTTP parser", () => {
    const data = "GET /lol.gif HTTP/1.0";
    const input = p.stream(data);
    const parser = p.seq(function*() {
      const {value: method} = yield p.many1(p.upper);
      yield p.spaces1;
      const {value: path} = yield p.notSpaces1;
      yield p.spaces1;
      yield p.string("HTTP/");
      const {value: version} = yield p.seq(function*() {
        const {value: left} = yield p.many1(p.digit);
        yield p.char(".");
        const {value: right} = yield p.many1(p.digit);
        return `${left}.${right}`;
      });
      return {method, path, version};
    });
    const result = p.parse(parser, input);
    assert(p.isResult(result), "parser output is not ParseResult");
    assert.deepEqual(result.value, {
      method: "GET",
      path: "/lol.gif",
      version: "1.0"
    });
    assert.equal(result.matched, data);
  });
  it("list of eithers", () => {
    const parser = p.either([p.string("omg"), p.string("wtf"), p.string("bbq")]);

    const r1 = p.parse(parser, p.stream("omg"));
    assert(p.isResult(r1), "parser output is not ParseResult");
    assert.equal(r1.value, "omg");

    const r2 = p.parse(parser, p.stream("wtf"));
    assert(p.isResult(r2), "parser output is not ParseResult");
    assert.equal(r2.value, "wtf");

    const r3 = p.parse(parser, p.stream("bbq"));
    assert(p.isResult(r3), "parser output is not ParseResult");
    assert.equal(r3.value, "bbq");

    const r4 = p.parse(parser, p.stream("lol"));
    assert(p.isError(r4), "parser output is not ParseError");
  });
});

describe("many* combinators", () => {
  it("manyA yields a list of results", () => {
    const parser = p.manyA(p.string("omg"));

    const r1 = p.parse(parser, p.stream("omgwtfbbq"));
    assert(p.isResult(r1), "parser output is not ParseResult");
    assert.deepEqual(r1.value, ["omg"]);

    const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
    assert(p.isResult(r2), "parser output is not ParseResult");
    assert.deepEqual(r2.value, ["omg", "omg", "omg", "omg"]);

    const r3 = p.parse(parser, p.stream("wtfbbq"));
    assert(p.isResult(r3), "parser output is not ParseResult");
    assert.deepEqual(r3.value, []);
  });
  it("many1A yields a non-empty list of results", () => {
    const parser = p.many1A(p.string("omg"));

    const r1 = p.parse(parser, p.stream("omgwtfbbq"));
    assert(p.isResult(r1), "parser output is not ParseResult");
    assert.deepEqual(r1.value, ["omg"]);

    const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
    assert(p.isResult(r2), "parser output is not ParseResult");
    assert.deepEqual(r2.value, ["omg", "omg", "omg", "omg"]);

    const r3 = p.parse(parser, p.stream("wtfbbq"));
    assert(p.isError(r3), "parser output is not ParseError");
  });
  it("many yields a string of results", () => {
    const parser = p.many(p.string("omg"));

    const r1 = p.parse(parser, p.stream("omgwtfbbq"));
    assert(p.isResult(r1), "parser output is not ParseResult");
    assert.equal(r1.value, "omg");

    const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
    assert(p.isResult(r2), "parser output is not ParseResult");
    assert.equal(r2.value, "omgomgomgomg");

    const r3 = p.parse(parser, p.stream("wtfbbq"));
    assert(p.isResult(r3), "parser output is not ParseResult");
    assert.deepEqual(r3.value, "");
  });
  it("many1 yields a non-empty string of results", () => {
    const parser = p.many1(p.string("omg"));

    const r1 = p.parse(parser, p.stream("omgwtfbbq"));
    assert(p.isResult(r1), "parser output is not ParseResult");
    assert.equal(r1.value, "omg");

    const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
    assert(p.isResult(r2), "parser output is not ParseResult");
    assert.equal(r2.value, "omgomgomgomg");

    const r3 = p.parse(parser, p.stream("wtfbbq"));
    assert(p.isError(r3), "parser output is not ParseError");
  });
});

describe("complex parsers", () => {
  check.it("parse an integer", [gen.intWithin(-99999999, 99999999)], (num) => {
    const s = `${num}`;
    const r = p.parse(p.int, p.stream(s));
    assert(p.isResult(r), "parser output is not ParseResult");
    assert.equal(r.value, num);
  });
  check.it("parse a float", [gen.intWithin(-99999999, 99999999)], (int) => {
    const num = int / 10000;
    const s = `${num}`;
    const r = p.parse(p.float, p.stream(s));
    assert(p.isResult(r), "parser output is not ParseResult");
    assert.equal(r.value, num);
  });
  check.it("parse a string", [gen.asciiString], (s) => {
    const qs = `"${jsesc(s, {quotes: "double"})}"`;
    const r = p.parse(p.quotedString, p.stream(qs));
    assert(p.isResult(r), `parser output is not ParseResult, s '${s}' qs '${qs}'`);
    assert.equal(r.value, s, `'${r.value}' did not match '${s}' - string was '${qs}'`);
  });
});

describe("error reporting", () => {
  it("produces useful errors", () => {
    const parser = p.seq(function*() {
      const {value: method} = yield p.expected(p.many1(p.upper), "an upper case HTTP verb");
      yield p.spaces1;
      const {value: path} = yield p.expected(p.notSpaces1, "a URL path component");
      yield p.spaces1;
      yield p.expected(p.string("HTTP/"), "the string \"HTTP/\"");
      const {value: version} = yield p.expected(p.seq(function*() {
        const {value: left} = yield p.many1(p.digit);
        yield p.char(".");
        const {value: right} = yield p.many1(p.digit);
        return `${left}.${right}`;
      }), "a HTTP version number");
      return {method, path, version};
    });

    const r1 = p.parse(parser, p.stream("lol"));
    assert(p.isError(r1), "parser output is not ParseError");
    assert.deepEqual([...r1.expected], ["an upper case HTTP verb"]);
    assert.equal(r1.input.cursor, 0);

    const r2 = p.parse(parser, p.stream("GET lol"));
    assert(p.isError(r2), "parser output is not ParseError");
    assert.deepEqual([...r2.expected], ["whitespace"]);
    assert.equal(r2.input.cursor, 7);

    const r3 = p.parse(parser, p.stream("GET lol omg"));
    assert(p.isError(r3), "parser output is not ParseError");
    assert.deepEqual([...r3.expected], ["the string \"HTTP/\""]);
    assert.equal(r3.input.cursor, 8);

    const r4 = p.parse(parser, p.stream("GET lol HTTP/lol"));
    assert(p.isError(r4), "parser output is not ParseError");
    assert.deepEqual([...r4.expected], ["a HTTP version number"]);
    assert.equal(r4.input.cursor, 13);

    const r5 = p.parse(parser, p.stream("OMG"));
    assert(p.isError(r5), "parser output is not ParseError");
    assert.deepEqual([...r5.expected], ["whitespace"]);
    assert.equal(r5.input.cursor, 3);
  });
  it("prints a nice error message", () => {
    const pl = p.str([p.string("omg"), p.spaces1]);
    const parser = p.str([pl, pl, pl, pl, pl]);

    const r1 = p.parse(parser, p.stream("omg\nomg\nomg\nlol\nomg\n"));
    assert(p.isError(r1), "parser output is not ParseError");
    assert.equal(r1.print(), `At line 3, column 0:

lol
^
|
Error: expected "omg", saw "lol"`);

    const r2 = p.parse(parser, p.stream("omg\nomg\nomg\n"));
    assert(p.isError(r2), "parser output is not ParseError");
    assert.equal(r2.print(), `At line 3, column 0:

Error: expected "omg", saw EOF`);

    const r3 = p.parse(parser, p.stream("omg\nomg\nomg\nlololololol\nomg\n"));
    assert(p.isError(r3), "parser output is not ParseError");
    assert.equal(r3.print(), `At line 3, column 0:

lololololol
^
|
Error: expected "omg", saw "lololo..."`);
  });
  it("escalates errors past a cut", () => {
    const p1 = p.cut(p.string("hai"), function*() {
      yield p.spaces;
      yield p.quotedString;
      return 0;
    });
    const p2 = p.cut(p.string("lol"), function*() {
      yield p.spaces;
      yield p.quotedString;
      return 0;
    });
    const parser = p.either(p1, p2);
    const r1 = p.parse(parser, p.stream("hai omg"));
    assert(p.isError(r1), "parser output is not ParseError");
    assert.equal(r1.fatal, true, "error is not fatal");
    assert.deepEqual([...r1.expected], ["a quoted string"]);
  });
  it("reports all errors from a failed either", () => {
    const parser = p.either(p.string("hai"), p.string("lol"));
    const r1 = p.parse(parser, p.stream("wat"));
    assert(p.isError(r1), "parser output is not ParseError");
    assert.deepEqual([...r1.expected], [`"hai"`, `"lol"`]);
    assert.equal(r1.print(), `At line 0, column 0:

wat
^
|
Error: expected "hai" or "lol", saw "wat"`);
  });
});
