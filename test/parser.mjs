/* eslint-env node, mocha */
/* global check, gen */

import test from "tape";
import assert from "assert";
import testcheck from "testcheck";
import jsesc from "jsesc";
import * as p from "../index";

const gen = testcheck.gen;
const property = testcheck.property;
const check = testcheck.check;

test("yields values in sequence, then throws an error", t => {
  const s1 = p.stream("omg");
  t.equal(s1.get(), "o");
  t.ok(!s1.atEnd(), "s1 is at end");
  const s2 = s1.next();
  t.equal(s2.get(), "m");
  t.ok(!s2.atEnd(), "s2 is at end");
  const s3 = s2.next();
  t.equal(s3.get(), "g");
  t.ok(!s3.atEnd(), "s3 is at end");
  const s4 = s3.next();
  t.ok(s4.atEnd(), "s4 isn't at end");
  t.throws(() => s4.get(), Error);
  t.throws(() => s4.next(), Error);
  t.end();
});

test("item", t => {
  const input = p.stream("hi");
  const result = p.parse(p.item, input);
  t.ok(p.isResult(result), "parser output is not ParseResult");
  t.equal(result.matched, "h");
  t.equal(result.value, "h");
  t.equal(result.next.get(), "i");
  t.end();
});
test("seq", t => {
  const input = p.stream("hi");
  const two = p.seq(p.item, first =>
    p.seq(p.item, second => p.unit(first + second))
  );
  const result = p.parse(two, input);
  t.ok(p.isResult(result), "parser output is not ParseResult");
  t.equal(result.matched, "hi");
  t.equal(result.value, "hi");
  t.equal(result.start.cursor, 0);
  t.equal(result.next.cursor, 2);
  t.ok(result.next.atEnd(), "result isn't at end");
  t.end();
});
test("sat", t => {
  const input = p.stream("hi");
  const isH = s => s === "h";
  const res1 = p.parse(p.sat(isH), input);
  t.ok(p.isResult(res1), "parser output is not ParseResult");
  t.equal(res1.matched, "h");
  t.equal(res1.value, "h");
  t.equal(res1.start.cursor, 0);
  t.equal(res1.next.cursor, 1);
  t.ok(!res1.next.atEnd(), "res1 is at end");
  const res2 = p.parse(p.sat(isH), res1.next);
  t.ok(p.isError(res2), "parser output is not ParseError");
  t.equal(
    res2.input.cursor,
    1,
    "start of failing parser isn't where it should be"
  );
  t.end();
});
test("either", t => {
  const input = p.stream("hi");
  const isH = s => s === "h";
  const isI = s => s === "i";
  const p1 = p.either(p.sat(isH), p.sat(isI));
  const p2 = p.either(p.sat(isI), p.sat(isH));
  const r1 = p.parse(p1, input);
  const r2 = p.parse(p2, input);
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.equal(r1.matched, "h");
  t.equal(r1.value, "h");
  t.deepEqual(r1, r2);
  t.end();
});
test("eof", t => {
  const r1 = p.parse(p.eof, p.stream(""));
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.equal(r1.matched, "");
  t.equal(r1.value, null);
  const r2 = p.parse(p.eof, p.stream("ohai"));
  t.ok(p.isError(r2), "parser output is not ParseError");
  t.deepEqual([...r2.expected], ["end of file"]);
  t.end();
});

test("matches a string", t => {
  const input = p.stream("ohai lol");
  const result = p.parse(p.string("ohai"), input);
  t.ok(p.isResult(result), "parser output is not ParseResult");
  t.equal(result.matched, "ohai");
  t.equal(result.value, "ohai");
  t.equal(result.start.cursor, 0);
  t.equal(result.next.cursor, 4);
  t.end();
});
test("matches a sequence of characters", t => {
  const input = p.stream("ohai lol");
  const result = p.parse(
    p.seq(p.char("o"), () =>
      p.seq(p.char("h"), () =>
        p.seq(p.char("a"), () => p.seq(p.char("i"), () => p.unit("lol")))
      )
    ),
    input
  );
  t.ok(p.isResult(result), "parser output is not ParseResult");
  t.equal(result.matched, "ohai");
  t.equal(result.value, "lol");
  t.equal(result.start.cursor, 0);
  t.equal(result.next.cursor, 4);
  t.end();
});

test("successful seq parse with generator", t => {
  const input = p.stream("omg");
  const result = p.parse(
    p.seq(function*() {
      const { value: a } = yield p.item;
      const { value: b } = yield p.item;
      const { value: c } = yield p.item;
      return a + b + c;
    }),
    input
  );
  t.ok(p.isResult(result), "parser output is not ParseResult");
  t.equal(result.matched, "omg");
  t.equal(result.value, "omg");
  t.equal(result.start.cursor, 0);
  t.equal(result.next.cursor, 3);
  t.end();
});
test("failed seq parse with generator", t => {
  const input = p.stream("omg");
  const result = p.parse(
    p.seq(function*() {
      yield p.item;
      yield p.item;
      yield p.sat(i => i === "l");
    }),
    input
  );
  t.ok(p.isError(result), "parser output is not ParseError");
  t.equal(result.input.cursor, 2);
  t.end();
});
test("an HTTP parser", t => {
  const data = "GET /lol.gif HTTP/1.0";
  const input = p.stream(data);
  const parser = p.seq(function*() {
    const { value: method } = yield p.many1(p.upper);
    yield p.spaces1;
    const { value: path } = yield p.notSpaces1;
    yield p.spaces1;
    yield p.string("HTTP/");
    const { value: version } = yield p.seq(function*() {
      const { value: left } = yield p.many1(p.digit);
      yield p.char(".");
      const { value: right } = yield p.many1(p.digit);
      return `${left}.${right}`;
      t.end();
    });
    return { method, path, version };
    t.end();
  });
  const result = p.parse(parser, input);
  t.ok(p.isResult(result), "parser output is not ParseResult");
  t.deepEqual(result.value, {
    method: "GET",
    path: "/lol.gif",
    version: "1.0"
  });
  t.equal(result.matched, data);
  t.end();
});
test("list of eithers", t => {
  const parser = p.either([p.string("omg"), p.string("wtf"), p.string("bbq")]);

  const r1 = p.parse(parser, p.stream("omg"));
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.equal(r1.value, "omg");

  const r2 = p.parse(parser, p.stream("wtf"));
  t.ok(p.isResult(r2), "parser output is not ParseResult");
  t.equal(r2.value, "wtf");

  const r3 = p.parse(parser, p.stream("bbq"));
  t.ok(p.isResult(r3), "parser output is not ParseResult");
  t.equal(r3.value, "bbq");

  const r4 = p.parse(parser, p.stream("lol"));
  t.ok(p.isError(r4), "parser output is not ParseError");
  t.end();
});

test("manyA yields a list of results", t => {
  const parser = p.manyA(p.string("omg"));

  const r1 = p.parse(parser, p.stream("omgwtfbbq"));
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.deepEqual(r1.value, ["omg"]);

  const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
  t.ok(p.isResult(r2), "parser output is not ParseResult");
  t.deepEqual(r2.value, ["omg", "omg", "omg", "omg"]);

  const r3 = p.parse(parser, p.stream("wtfbbq"));
  t.ok(p.isResult(r3), "parser output is not ParseResult");
  t.deepEqual(r3.value, []);
  t.end();
});
test("many1A yields a non-empty list of results", t => {
  const parser = p.many1A(p.string("omg"));

  const r1 = p.parse(parser, p.stream("omgwtfbbq"));
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.deepEqual(r1.value, ["omg"]);

  const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
  t.ok(p.isResult(r2), "parser output is not ParseResult");
  t.deepEqual(r2.value, ["omg", "omg", "omg", "omg"]);

  const r3 = p.parse(parser, p.stream("wtfbbq"));
  t.ok(p.isError(r3), "parser output is not ParseError");
  t.end();
});
test("many yields a string of results", t => {
  const parser = p.many(p.string("omg"));

  const r1 = p.parse(parser, p.stream("omgwtfbbq"));
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.equal(r1.value, "omg");

  const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
  t.ok(p.isResult(r2), "parser output is not ParseResult");
  t.equal(r2.value, "omgomgomgomg");

  const r3 = p.parse(parser, p.stream("wtfbbq"));
  t.ok(p.isResult(r3), "parser output is not ParseResult");
  t.deepEqual(r3.value, "");
  t.end();
});
test("many1 yields a non-empty string of results", t => {
  const parser = p.many1(p.string("omg"));

  const r1 = p.parse(parser, p.stream("omgwtfbbq"));
  t.ok(p.isResult(r1), "parser output is not ParseResult");
  t.equal(r1.value, "omg");

  const r2 = p.parse(parser, p.stream("omgomgomgomgwtfbbq"));
  t.ok(p.isResult(r2), "parser output is not ParseResult");
  t.equal(r2.value, "omgomgomgomg");

  const r3 = p.parse(parser, p.stream("wtfbbq"));
  t.ok(p.isError(r3), "parser output is not ParseError");
  t.end();
});

test("parse an integer", t => {
  t.ok(
    check(
      property([gen.intWithin(-99999999, 99999999)], num => {
        const s = `${num}`;
        const r = p.parse(p.int, p.stream(s));
        assert(p.isResult(r), "parser output is not ParseResult");
        return r.value === num;
      })
    )
  );
  t.end();
});

test("parse a float", t => {
  t.ok(
    check(
      property([gen.intWithin(-99999999, 99999999)], int => {
        const num = int / 10000;
        const s = `${num}`;
        const r = p.parse(p.float, p.stream(s));
        assert(p.isResult(r), "parser output is not ParseResult");
        return r.value === num;
      })
    )
  );
  t.end();
});

test("parse a string", t => {
  t.ok(
    check(
      property([gen.asciiString], s => {
        const qs = `"${jsesc(s, { quotes: "double" })}"`;
        const r = p.parse(p.quotedString, p.stream(qs));
        assert(
          p.isResult(r),
          `parser output is not ParseResult, s '${s}' qs '${qs}'`
        );
        return r.value === s;
      })
    )
  );
  t.end();
});

test("produces useful errors", t => {
  const parser = p.seq(function*() {
    const { value: method } = yield p.expected(
      p.many1(p.upper),
      "an upper case HTTP verb"
    );
    yield p.spaces1;
    const { value: path } = yield p.expected(
      p.notSpaces1,
      "a URL path component"
    );
    yield p.spaces1;
    yield p.expected(p.string("HTTP/"), 'the string "HTTP/"');
    const { value: version } = yield p.expected(
      p.seq(function*() {
        const { value: left } = yield p.many1(p.digit);
        yield p.char(".");
        const { value: right } = yield p.many1(p.digit);
        return `${left}.${right}`;
      }),
      "a HTTP version number"
    );
    return { method, path, version };
    t.end();
  });

  const r1 = p.parse(parser, p.stream("lol"));
  t.ok(p.isError(r1), "parser output is not ParseError");
  t.deepEqual([...r1.expected], ["an upper case HTTP verb"]);
  t.equal(r1.input.cursor, 0);

  const r2 = p.parse(parser, p.stream("GET lol"));
  t.ok(p.isError(r2), "parser output is not ParseError");
  t.deepEqual([...r2.expected], ["whitespace"]);
  t.equal(r2.input.cursor, 7);

  const r3 = p.parse(parser, p.stream("GET lol omg"));
  t.ok(p.isError(r3), "parser output is not ParseError");
  t.deepEqual([...r3.expected], ['the string "HTTP/"']);
  t.equal(r3.input.cursor, 8);

  const r4 = p.parse(parser, p.stream("GET lol HTTP/lol"));
  t.ok(p.isError(r4), "parser output is not ParseError");
  t.deepEqual([...r4.expected], ["a HTTP version number"]);
  t.equal(r4.input.cursor, 13);

  const r5 = p.parse(parser, p.stream("OMG"));
  t.ok(p.isError(r5), "parser output is not ParseError");
  t.deepEqual([...r5.expected], ["whitespace"]);
  t.equal(r5.input.cursor, 3);
  t.end();
});
test("prints a nice error message", t => {
  const pl = p.str([p.string("omg"), p.spaces1]);
  const parser = p.str([pl, pl, pl, pl, pl]);

  const r1 = p.parse(parser, p.stream("omg\nomg\nomg\nlol\nomg\n"));
  t.ok(p.isError(r1), "parser output is not ParseError");
  t.equal(
    r1.print(),
    `At line 4, column 0:

lol
^
|
ERROR: Expected "omg", saw "lol"`
  );

  const r2 = p.parse(parser, p.stream("omg\nomg\nomg\n"));
  t.ok(p.isError(r2), "parser output is not ParseError");
  t.equal(
    r2.print(),
    `At line 4, column 0:

ERROR: Expected "omg", saw EOF`
  );

  const r3 = p.parse(parser, p.stream("omg\nomg\nomg\nlololololol\nomg\n"));
  t.ok(p.isError(r3), "parser output is not ParseError");
  t.equal(
    r3.print(),
    `At line 4, column 0:

lololololol
^
|
ERROR: Expected "omg", saw "lololo..."`
  );

  const r4 = p.parse(parser, p.stream("omg\nomg omg lol"));
  t.ok(p.isError(r4), "parser output is not ParseError");
  t.equal(
    r4.print(),
    `At line 2, column 8:

omg omg lol
        ^
        |
ERROR: Expected "omg", saw "lol"`
  );
  t.end();
});

test("escalates errors past a cut", t => {
  const p1 = p.cut(p.string("hai"), function*() {
    yield p.spaces;
    yield p.quotedString;
    return 0;
    t.end();
  });
  const p2 = p.cut(p.string("lol"), function*() {
    yield p.spaces;
    yield p.quotedString;
    return 0;
    t.end();
  });
  const parser = p.either(p1, p2);
  const r1 = p.parse(parser, p.stream("hai omg"));
  t.ok(p.isError(r1), "parser output is not ParseError");
  t.equal(r1.fatal, true, "error is not fatal");
  t.deepEqual([...r1.expected], ["a quoted string"]);
  t.end();
});
test("reports all errors from a failed either", t => {
  const parser = p.either(p.string("hai"), p.string("lol"));
  const r1 = p.parse(parser, p.stream("wat"));
  t.ok(p.isError(r1), "parser output is not ParseError");
  t.deepEqual([...r1.expected], [`"hai"`, `"lol"`]);
  t.equal(
    r1.print(),
    `At line 1, column 0:

wat
^
|
ERROR: Expected "hai" or "lol", saw "wat"`
  );
  t.end();
});
