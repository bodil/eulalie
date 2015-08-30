# eulalie

[![Build Status](https://travis-ci.org/bodil/eulalie.svg)](https://travis-ci.org/bodil/eulalie)

ES6 flavoured parser combinators.

## Usage

Eulalie works on the principle of constructing parsers from smaller
parsers using various combinator functions.

A parser is a function which takes an input `Stream`, and returns a
`ParseResult` object if it matched the provided input, or a
`ParseError` object if it didn't.

### Data Types

The `Stream` object just contains a string, and an index into this
string. We use this structure instead of passing strings around as
input because string operations are expensive, while any operation on
the `Stream` object can be performed in linear time, and while many
`Stream` objects will be created during a parse operation, we only
ever keep a single copy of the string they wrap.

A `ParseResult` contains four properties: the `value` we parsed (an
arbitrary value), the `next` input to be parsed (a `Stream`), the
point in the stream where we `start`ed parsing (also a `Stream`), and
the substring that was `matched` by this parser (a string).

Finally, a `ParseError` simply contains an `input` property (a
`Stream`) which points to the exact position where the parsing failed,
and an optional `message` (a string).

### Parser Combinators

The most basic parsers form the building blocks from which you can
assemble more complex parsers:

  * `unit(value)` makes a parser which doesn't consume input, just
    returns the provided `value` wrapped in a `ParseResult`.
  * `fail` is a parser which consumes no input and returns a
    `ParseError`.
  * `item` is a parser which consumes one arbitrary character and
    returns it as a `ParseResult`.

The two fundamental parser combinators are:

  * `seq(parser, next)` is used to combine multiple parsers in a
    sequence. It takes a parser, and a function `next(value)` which
    will be called with the result of the parser if it succeeded, and
    must return another parser, which will be run on the remaining
    input. The result of the combined parser will be the result of
    this last parser, or the first error encountered.

  * `either(parser1, parser2)` makes a parser which will first try the
    first provided parser, and returns its result if it succeeds. If
    it fails, it will run the second parser on the same input, and
    return its result directly, whether or not it succeeded.

Using these, you can construct more advanced parser combinators. Some particularly useful combinators are predefined:

  * `sat(predicate)` makes a parser which will match one character
    only if the provided `predicate` function returns `true` for it.
  * `char(c)` makes a parser which matches the single character `c`.
  * `many(parser)` makes a parser which will match the provided
    `parser` zero or more times.
  * `many1(parser)` works just like `many`, but requires at minimum
    one match.
  * `string(s)` makes a parser which matches the literal string `s`.

Other predefined parsers are `digit`, `space`, `alphanum`, `letter`,
`upper` and `lower`, which match one character of their respective
types, and their inverse counterparts, `notDigit`, `notSpace`,
`notAlphanum`, `notLetter`, `notUpper` and `notLower`. There are also
whitespace matchers `spaces` and `spaces1`, and their opposites,
`notSpaces` and `notSpaces1`.

### Generator Functions

The basic combinators `seq` and `either` can also take a single
generator function, which helps keep callback chains to a minimum. The
job of this function is to `yield` parsers, which will pass their
`ParseResult`s back to the generator. The final result value of the
parser will be what you `return` from the generator function. This
becomes very useful for the `seq` combinator:

```js
// without generators:
p.seq(p.notSpaces1, (left) =>
  p.seq(p.spaces1, () =>
    p.seq(p.notSpaces1, (right) =>
      p.unit({left, right}))));

// with generators:
p.seq(function*() {
  const {value: left} = yield p.notSpaces1;
  yield p.spaces1;
  const {value: right} = yield p.notSpaces1;
  return {left, right};
});
```

While you could also pass a generator to `either`, it will, unlike
`seq`, accept any iterable, and just passing an array of parsers to
try in sequence is generally better:

```js
p.either([
  p.string("omg"),
  p.string("wtf"),
  p.string("bbq")
]);
```

The result will be the result of the first parser to succeed.

If you do provide a generator function to `either`, `yield` will not
receive any values, and what you `return` will be ignored in favour of
the result of the first parser you `yield` to succeed. But, seriously,
just use arrays instead.

### A Working Example

This is how you might write a parser for the first line of an HTTP
request:

```js
import * as p from "eulalie";

// Combine a sequence of parsers into a bigger parser using a generator
const parser = p.seq(function*() {
  // Parse a sequence of 1 or more upper case letters
  const {value: method} = yield p.many1(p.upper);
  // Consume 1 or more spaces
  yield p.spaces1;
  // Parse a sequence of 1 or more non-whitespace characters
  const {value: path} = yield p.notSpaces1;
  // Consume 1 or more spaces
  yield p.spaces1;
  // Match the string "HTTP/"
  yield p.string("HTTP/");
  // Parse a new sequence
  const {value: version} = yield p.seq(function*() {
    // Parse 1 or more digits
    const {value: left} = yield p.many1(p.digit);
    // Match a period
    yield p.char(".");
    // Parse 1 or more digits
    const {value: right} = yield p.many1(p.digit);
    // Assemble the parsed values
    return `${left}.${right}`;
  });
  // Return the final parsed value
  return {method, path, version};
});

const result = p.parse(parser, p.stream("GET /lol.gif HTTP/1.0"));

assert.deepEqual(result.value, {
  method: "GET",
  path: "/lol.gif",
  version: "1.0"
});
```

## Licence

Copyright 2015 Bodil Stokke

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public
License along with this program. If not, see
<http://www.gnu.org/licenses/>.
