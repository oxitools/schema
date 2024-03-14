import { assert, isDefined, pick } from "@oxi/core";
import { List } from "@oxi/list";
import { Result } from "@oxi/result";
import { assertEquals } from "https://deno.land/std@0.218.0/assert/mod.ts";
import * as s from "./mod.ts";

function assertPartial<T>(value: T, expected: Partial<T>) {
  const keys = Object.keys(expected) as (keyof T)[];
  assertEquals(pick(value, keys), expected);
}

function assertOk<T>(
  actual: unknown,
  value?: T,
): asserts actual is Result<T, unknown> {
  assert(Result.isResult(actual), "Expected a Result");
  assert(actual.isOk(), "Expected an Ok result");

  if (isDefined(value)) {
    if (List.isList(value)) {
      value = value.toArray() as T;
    }
    let unwrapped = actual.unwrap();
    if (List.isList(unwrapped)) {
      unwrapped = unwrapped.toArray() as T;
    }
    assertEquals(unwrapped, value);
  }
}

function assertErr<E>(
  actual: unknown,
  value?: E,
): asserts actual is Result<unknown, E> {
  assert(Result.isResult(actual), "Expected a Result");
  assert(actual.isErr(), "Expected an Err result");

  if (isDefined(value)) {
    assertEquals(actual.unwrapErr(), value);
  }
}

Deno.test("Schema.str (default error)", () => {
  const schema = s.str();

  assertOk(schema.parse("hello"), "hello");
  assertErr(schema.parse(123));
  assertPartial(schema.parse(123).unwrapErr(), {
    message: "Expected string, but got number",
  });
});

Deno.test("Schema.str (custom error)", () => {
  const schema = s.str("Invalid string");
  assertPartial(schema.parse(123).unwrapErr(), {
    message: "Invalid string",
  });
});

Deno.test("Schema.num (default error)", () => {
  const schema = s.num();

  assertOk(schema.parse(123), 123);
  assertErr(schema.parse("hello"));
  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Expected number, but got string",
  });
});

Deno.test("Schema.num (custom error)", () => {
  const schema = s.num("Invalid number");
  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Invalid number",
  });
});

Deno.test("Schema.bool (default error)", () => {
  const schema = s.bool();

  assertOk(schema.parse(true), true);
  assertErr(schema.parse("hello"));
  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Expected boolean, but got string",
  });
});

Deno.test("Schema.bool (custom error)", () => {
  const schema = s.bool("Invalid boolean");
  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Invalid boolean",
  });
});

Deno.test("Schema.date (default error)", () => {
  const schema = s.date();

  assertOk(schema.parse(new Date("2022-01-01")), new Date("2022-01-01"));
  assertErr(schema.parse(new Date("invalid date")));
  assertErr(schema.parse("2022-01-01"));
  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Expected date, but got string",
  });
});

Deno.test("Schema.date (custom error)", () => {
  const schema = s.date("Invalid date");
  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Invalid date",
  });
});

Deno.test("Schema.list (default error)", () => {
  const schema = s.list(s.str());

  assertOk(schema.parse(["hello", "world"]), List.of("hello", "world"));
  assertErr(schema.parse({}));
  assertPartial(schema.parse({}).unwrapErr(), {
    message: "Expected list, but got object",
  });
  assertPartial(schema.parse(["hello", 2]).unwrapErr(), {
    path: ["1"],
    message: "Expected string, but got number",
  });
});

Deno.test("Schema.list (custom error)", () => {
  const schema = s.list(s.str(), "Invalid list");
  assertPartial(schema.parse({}).unwrapErr(), {
    message: "Invalid list",
  });
});

Deno.test("Schema.obj (default error)", () => {
  const schema = s.obj({
    name: s.str(),
    age: s.num(),
  });

  assertOk(schema.parse({ name: "John", age: 30 }), { name: "John", age: 30 });
  assertErr(schema.parse({ name: "John" }));
  assertPartial(schema.parse({ name: "John" }).unwrapErr(), {
    path: ["age"],
    message: "Expected number, but got undefined",
  });
  assertPartial(schema.parse({ name: "John", age: "30" }).unwrapErr(), {
    path: ["age"],
    message: "Expected number, but got string",
  });
});

Deno.test("Schema.obj (custom error)", () => {
  const schema = s.obj({ name: s.str(), age: s.num() }, "Invalid object");
  assertPartial(schema.parse([]).unwrapErr(), {
    message: "Invalid object",
  });
});

Deno.test("Schema.as(string)", () => {
  const schema = s.as(s.str());
  assertOk(schema.parse("hello"), "hello");
  assertOk(schema.parse(123), "123");
});

Deno.test("Schema.as(number)", () => {
  const schema = s.as(s.num());
  assertOk(schema.parse(123), 123);
  assertOk(schema.parse("123"), 123);
});

Deno.test("Schema.as(date)", () => {
  const schema = s.as(s.date());
  assertOk(schema.parse(new Date("2022-01-01")), new Date("2022-01-01"));
  assertOk(schema.parse("2022-01-01"), new Date("2022-01-01"));
});

Deno.test("Schema.as(bool)", () => {
  const schema = s.as(s.bool());
  assertOk(schema.parse(true), true);
  assertOk(schema.parse("true"), true);
  assertOk(schema.parse("yes"), true);
  assertOk(schema.parse("on"), true);
  assertOk(schema.parse("1"), true);
  assertOk(schema.parse("TRUE"), true);
  assertOk(schema.parse("YES"), true);
  assertOk(schema.parse("ON"), true);
  assertOk(schema.parse("1"), true);

  assertOk(schema.parse(false), false);
  assertOk(schema.parse("false"), false);
  assertOk(schema.parse("no"), false);
  assertOk(schema.parse("off"), false);
  assertOk(schema.parse("0"), false);
  assertOk(schema.parse("FALSE"), false);
  assertOk(schema.parse("NO"), false);
  assertOk(schema.parse("OFF"), false);
  assertOk(schema.parse("0"), false);
});

Deno.test("Schema.record (default error)", () => {
  const schema = s.record(s.str(), s.num());

  assertOk(schema.parse({ name: 123 }), { name: 123 });
  assertErr(schema.parse({ name: "John" }));

  assertPartial(schema.parse({ name: "John" }).unwrapErr(), {
    path: ["name"],
    message: "Expected number, but got string",
  });

  assertPartial(schema.parse({ name: 123, age: "30" }).unwrapErr(), {
    path: ["age"],
    message: "Expected number, but got string",
  });
});

Deno.test("Schema.record (custom error)", () => {
  const schema = s.record(s.str(), s.num(), "Invalid record");
  assertPartial(schema.parse([]).unwrapErr(), {
    message: "Invalid record",
  });
});

Deno.test("Schema.union (default error)", () => {
  const schema = s.union([s.str(), s.num()]);

  assertOk(schema.parse("hello"), "hello");
  assertOk(schema.parse(123), 123);
  assertErr(schema.parse(true));

  assertPartial(schema.parse(true).unwrapErr(), {
    message: "Expected string | number, but got boolean",
  });
});

Deno.test("Schema.union (custom error)", () => {
  const schema = s.union([s.str(), s.num()], "Invalid union");
  assertPartial(schema.parse(true).unwrapErr(), {
    message: "Invalid union",
  });
});

Deno.test("Schema.tuple (default error)", () => {
  const schema = s.tuple([s.str(), s.num()]);

  assertOk(schema.parse(["hello", 123]), ["hello", 123]);
  assertErr(schema.parse(["hello", true]));

  assertPartial(schema.parse(["hello", true]).unwrapErr(), {
    path: ["1"],
    message: "Expected number, but got boolean",
  });
});

Deno.test("Schema.tuple (custom error)", () => {
  const schema = s.tuple([s.str(), s.num()], "Invalid tuple");
  assertPartial(schema.parse([]).unwrapErr(), {
    message: "Invalid tuple",
  });
});

Deno.test("Schema.enum (default error)", () => {
  enum User {
    Admin,
    User,
  }

  const schema = s.enum(User);

  assertOk(schema.parse(User.Admin), User.Admin);
  assertOk(schema.parse("Admin"), "Admin");

  assertErr(schema.parse("Superuser"));
  assertPartial(schema.parse("Superuser").unwrapErr(), {
    message: "Expected enum, but got string",
  });
});

Deno.test("Schema.enum (custom error)", () => {
  enum User {
    Admin,
    User,
  }

  const schema = s.enum(User, "Invalid enum");
  assertPartial(schema.parse("Superuser").unwrapErr(), {
    message: "Invalid enum",
  });
});

Deno.test("Schema.oneOf (default error)", () => {
  const schema = s.oneOf(["foo", "bar", "baz"]);

  assertOk(schema.parse("foo"), "foo");
  assertErr(schema.parse("qux"));

  assertPartial(schema.parse("qux").unwrapErr(), {
    message: 'Expected one of ["foo","bar","baz"], but got "qux"',
  });
});

Deno.test("Schema.oneOf (custom error)", () => {
  const schema = s.oneOf(["foo", "bar", "baz"], "Invalid value");
  assertPartial(schema.parse("qux").unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.lit (default error)", () => {
  const schema = s.lit("hello");

  assertOk(schema.parse("hello"), "hello");
  assertErr(schema.parse("world"));

  assertPartial(schema.parse("world").unwrapErr(), {
    message: 'Expected "hello", but got "world"',
  });
});

Deno.test("Schema.lit (custom error)", () => {
  const schema = s.lit("hello", "Invalid value");
  assertPartial(schema.parse("world").unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.extend (default error)", () => {
  const a = s.obj({ id: s.num() });
  const b = s.obj({ name: s.str() });
  const c = s.extend([a, b]);

  assertOk(c.parse({ id: 123, name: "John" }), { id: 123, name: "John" });
  assertErr(c.parse({ id: 123 }));

  assertPartial(c.parse({ id: 123 }).unwrapErr(), {
    path: ["name"],
    message: "Expected string, but got undefined",
  });
});

Deno.test("Schema.extend (custom error)", () => {
  const a = s.obj({ id: s.num() });
  const b = s.obj({ name: s.str() });
  const c = s.extend([a, b], "Invalid object");

  assertPartial(c.parse([]).unwrapErr(), {
    message: "Invalid object",
  });
});

Deno.test("Schema.select (default error)", () => {
  const schema = s.obj({ id: s.num(), name: s.str() });
  const select = s.select(schema, ["name"]);

  assertOk(select.parse({ name: "John" }), { name: "John" });
  assertErr(select.parse({ id: 123 }));

  assertPartial(select.parse({ id: 123 }).unwrapErr(), {
    path: ["name"],
    message: "Expected string, but got undefined",
  });
});

Deno.test("Schema.select (custom error)", () => {
  const schema = s.obj({ id: s.num(), name: s.str() });
  const select = s.select(schema, ["name"], "Invalid object");

  assertPartial(select.parse([]).unwrapErr(), {
    message: "Invalid object",
  });
});

Deno.test("Schema.exclude (default error)", () => {
  const schema = s.obj({ id: s.num(), name: s.str() });
  const exclude = s.exclude(schema, ["id"]);

  assertOk(exclude.parse({ name: "John" }), { name: "John" });
  assertErr(exclude.parse({ id: 123 }));

  assertPartial(exclude.parse({ id: 123 }).unwrapErr(), {
    path: ["name"],
    message: "Expected string, but got undefined",
  });
});

Deno.test("Schema.exclude (custom error)", () => {
  const schema = s.obj({ id: s.num(), name: s.str() });
  const exclude = s.exclude(schema, ["id"], "Invalid object");

  assertPartial(exclude.parse([]).unwrapErr(), {
    message: "Invalid object",
  });
});

Deno.test("Schema.opt", () => {
  const schema = s.opt(s.str());

  assertOk(schema.parse("hello"));
  assertEquals(schema.parse("hello").unwrap().unwrap(), "hello");
  assertOk(schema.parse(undefined));
  assertOk(schema.parse(null));
  assertErr(schema.parse(123));

  assertPartial(schema.parse(123).unwrapErr(), {
    message: "Expected string, but got number",
  });
});

Deno.test("Schema.def", () => {
  const schema = s.def(s.num(), 0);

  assertOk(schema.parse(123), 123);
  assertOk(schema.parse(undefined), 0);

  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Expected number, but got string",
  });
});

Deno.test("Schema.pipe (no errors)", () => {
  const schema = s.pipe(s.str(), (v) => Result.Ok(v.trim()));
  assertOk(schema.parse("  hello  "), "hello");
  assertErr(schema.parse(123));
});

Deno.test("Schema.pipe (with errors)", () => {
  const schema = s.pipe(s.str(), () => Result.Err("Invalid string"));

  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Invalid string",
  });
});

Deno.test("Schema.map (no errors)", () => {
  const schema = s.map(s.str(), (v) => Result.Ok(Number(v)));

  assertOk(schema.parse("123"), 123);
  assertErr(schema.parse(1));

  assertPartial(schema.parse(1).unwrapErr(), {
    message: "Expected string, but got number",
  });
});

Deno.test("Schema.map (with errors)", () => {
  const schema = s.map(s.str(), () => Result.Err("Invalid string"));

  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Invalid string",
  });
});

Deno.test("Schema.minLen (default error)", () => {
  const schema = s.pipe(s.str(), s.minLen(3));

  assertOk(schema.parse("hello"), "hello");
  assertErr(schema.parse("hi"));

  assertPartial(schema.parse("hi").unwrapErr(), {
    message: "Expected length to be at least 3, but got 2",
  });
});

Deno.test("Schema.minLen (custom error)", () => {
  const schema = s.pipe(s.str(), s.minLen(3, "Invalid length"));

  assertPartial(schema.parse("hi").unwrapErr(), {
    message: "Invalid length",
  });
});

Deno.test("Schema.maxLen (default error)", () => {
  const schema = s.pipe(s.str(), s.maxLen(3));

  assertOk(schema.parse("hi"), "hi");
  assertErr(schema.parse("hello"));

  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Expected length to be at most 3, but got 5",
  });
});

Deno.test("Schema.maxLen (custom error)", () => {
  const schema = s.pipe(s.str(), s.maxLen(3, "Invalid length"));

  assertPartial(schema.parse("hello").unwrapErr(), {
    message: "Invalid length",
  });
});

Deno.test("Schema.trim", () => {
  const schema = s.pipe(s.str(), s.trim());
  assertOk(schema.parse("  hello  "), "hello");
  assertOk(schema.parse("hello"), "hello");
});

Deno.test("Schema.upcase", () => {
  const schema = s.pipe(s.str(), s.upcase());
  assertOk(schema.parse("hello"), "HELLO");
  assertOk(schema.parse("Hello"), "HELLO");
  assertOk(schema.parse("HELLO"), "HELLO");
});

Deno.test("Schema.lowcase", () => {
  const schema = s.pipe(s.str(), s.lowcase());
  assertOk(schema.parse("hello"), "hello");
  assertOk(schema.parse("Hello"), "hello");
  assertOk(schema.parse("HELLO"), "hello");
});

Deno.test("Schema.notEmpty(string)", () => {
  const schema = s.pipe(s.str(), s.notEmpty());
  assertOk(schema.parse("hello"), "hello");
  assertErr(schema.parse(""));
  assertPartial(schema.parse("").unwrapErr(), {
    message: "Expected value to be non-empty",
  });
});

Deno.test("Schema.notEmpty(list)", () => {
  const schema = s.pipe(s.list(s.str()), s.notEmpty());
  assertOk(schema.parse(["hello"]), List.of("hello"));
  assertErr(schema.parse([]));
  assertPartial(schema.parse([]).unwrapErr(), {
    message: "Expected value to be non-empty",
  });
});

Deno.test("Schema.min (default error)", () => {
  const schema = s.pipe(s.num(), s.min(3));

  assertOk(schema.parse(3), 3);
  assertErr(schema.parse(2));

  assertPartial(schema.parse(2).unwrapErr(), {
    message: "Expected value to be at least 3",
  });
});

Deno.test("Schema.min (custom error)", () => {
  const schema = s.pipe(s.num(), s.min(3, "Invalid value"));

  assertPartial(schema.parse(2).unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.max (default error)", () => {
  const schema = s.pipe(s.num(), s.max(3));

  assertOk(schema.parse(3), 3);
  assertErr(schema.parse(4));

  assertPartial(schema.parse(4).unwrapErr(), {
    message: "Expected value to be at most 3",
  });
});

Deno.test("Schema.max (custom error)", () => {
  const schema = s.pipe(s.num(), s.max(3, "Invalid value"));

  assertPartial(schema.parse(4).unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.clamp", () => {
  const schema = s.pipe(s.num(), s.clamp(3, 5));

  assertOk(schema.parse(3), 3);
  assertOk(schema.parse(4), 4);
  assertOk(schema.parse(5), 5);
  assertOk(schema.parse(2), 3);
  assertOk(schema.parse(6), 5);
});

Deno.test("Schema.pattern (default error)", () => {
  const schema = s.pipe(s.str(), s.pattern(/^hello$/));

  assertOk(schema.parse("hello"), "hello");
  assertErr(schema.parse("world"));

  assertPartial(schema.parse("world").unwrapErr(), {
    message: "Expected value to match pattern /^hello$/",
  });
});

Deno.test("Schema.pattern (custom error)", () => {
  const schema = s.pipe(s.str(), s.pattern(/^hello$/, "Invalid value"));

  assertPartial(schema.parse("world").unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.int (default error)", () => {
  const schema = s.pipe(s.num(), s.int());

  assertOk(schema.parse(123), 123);
  assertErr(schema.parse(123.45));

  assertPartial(schema.parse(123.45).unwrapErr(), {
    message: "Expected value to be an integer",
  });
});

Deno.test("Schema.int (custom error)", () => {
  const schema = s.pipe(s.num(), s.int("Invalid value"));

  assertPartial(schema.parse(123.45).unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.positive (default error)", () => {
  const schema = s.pipe(s.num(), s.positive());

  assertOk(schema.parse(123), 123);
  assertErr(schema.parse(-123));

  assertPartial(schema.parse(-123).unwrapErr(), {
    message: "Expected value to be positive",
  });
});

Deno.test("Schema.positive (custom error)", () => {
  const schema = s.pipe(s.num(), s.positive("Invalid value"));

  assertPartial(schema.parse(-123).unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.negative (default error)", () => {
  const schema = s.pipe(s.num(), s.negative());

  assertOk(schema.parse(-123), -123);
  assertErr(schema.parse(123));

  assertPartial(schema.parse(123).unwrapErr(), {
    message: "Expected value to be negative",
  });
});

Deno.test("Schema.negative (custom error)", () => {
  const schema = s.pipe(s.num(), s.negative("Invalid value"));

  assertPartial(schema.parse(123).unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.range (default error)", () => {
  const schema = s.pipe(s.num(), s.range(3, 5));

  assertOk(schema.parse(3), 3);
  assertOk(schema.parse(4), 4);
  assertOk(schema.parse(5), 5);
  assertErr(schema.parse(2));
  assertErr(schema.parse(6));

  assertPartial(schema.parse(2).unwrapErr(), {
    message: "Expected value to be in range 3 - 5, but got 2",
  });

  assertPartial(schema.parse(6).unwrapErr(), {
    message: "Expected value to be in range 3 - 5, but got 6",
  });
});

Deno.test("Schema.range (custom error)", () => {
  const schema = s.pipe(s.num(), s.range(3, 5, "Invalid value"));

  assertPartial(schema.parse(2).unwrapErr(), {
    message: "Invalid value",
  });
});

Deno.test("Schema.before (default error)", () => {
  const schema = s.pipe(s.date(), s.before(new Date("2022-01-01")));

  assertOk(schema.parse(new Date("2021-12-31")), new Date("2021-12-31"));
  assertErr(schema.parse(new Date("2022-01-01")));

  assertPartial(schema.parse(new Date("2022-01-01")).unwrapErr(), {
    message: "Expected date to be before 2022-01-01T00:00:00.000Z",
  });
});

Deno.test("Schema.before (custom error)", () => {
  const schema = s.pipe(
    s.date(),
    s.before(new Date("2022-01-01"), "Invalid date"),
  );

  assertPartial(schema.parse(new Date("2022-01-01")).unwrapErr(), {
    message: "Invalid date",
  });
});

Deno.test("Schema.after (default error)", () => {
  const schema = s.pipe(s.date(), s.after(new Date("2022-01-01")));

  assertOk(schema.parse(new Date("2022-01-02")), new Date("2022-01-02"));
  assertErr(schema.parse(new Date("2022-01-01")));

  assertPartial(schema.parse(new Date("2022-01-01")).unwrapErr(), {
    message: "Expected date to be after 2022-01-01T00:00:00.000Z",
  });
});

Deno.test("Schema.after (custom error)", () => {
  const schema = s.pipe(
    s.date(),
    s.after(new Date("2022-01-01"), "Invalid date"),
  );

  assertPartial(schema.parse(new Date("2022-01-01")).unwrapErr(), {
    message: "Invalid date",
  });
});

Deno.test("Schema.between (default error)", () => {
  const schema = s.pipe(
    s.date(),
    s.between(new Date("2022-01-01"), new Date("2022-01-31")),
  );

  assertOk(schema.parse(new Date("2022-01-15")), new Date("2022-01-15"));
  assertErr(schema.parse(new Date("2021-12-31")));

  assertPartial(schema.parse(new Date("2021-12-31")).unwrapErr(), {
    message:
      "Expected date to be between 2022-01-01T00:00:00.000Z and 2022-01-31T00:00:00.000Z",
  });

  assertPartial(schema.parse(new Date("2022-02-01")).unwrapErr(), {
    message:
      "Expected date to be between 2022-01-01T00:00:00.000Z and 2022-01-31T00:00:00.000Z",
  });
});

Deno.test("Schema.email (default error)", () => {
  const schema = s.pipe(s.str(), s.email());

  assertOk(schema.parse("john@doe.com"), "john@doe.com");
  assertErr(schema.parse("johndoe"));

  assertPartial(schema.parse("johndoe").unwrapErr(), {
    message: "Expected value to be a valid email address",
  });
});

Deno.test("Schema.email (custom error)", () => {
  const schema = s.pipe(s.str(), s.email("Invalid email"));

  assertPartial(schema.parse("johndoe").unwrapErr(), {
    message: "Invalid email",
  });
});

Deno.test("Schema.uuid (default error)", () => {
  const schema = s.pipe(s.str(), s.uuid());
  const id = crypto.randomUUID();

  assertOk(schema.parse(id), id);
  assertErr(schema.parse("123"));

  assertPartial(schema.parse("123").unwrapErr(), {
    message: "Expected value to be a valid UUID",
  });
});

Deno.test("Schema.uuid (custom error)", () => {
  const schema = s.pipe(s.str(), s.uuid("Invalid uuid"));

  assertPartial(schema.parse("123").unwrapErr(), {
    message: "Invalid uuid",
  });
});

Deno.test("Schema.partial", () => {
  const schema = s.partial(s.obj({ name: s.str(), age: s.num() }));

  assertOk(schema.parse({ name: "John" }));
  assertOk(schema.parse({ age: 30 }));
  assertOk(schema.parse({ name: "John", age: 30 }));
  assertOk(schema.parse({}));

  assertErr(schema.parse({ name: 123 }));
  assertErr(schema.parse({ age: "30" }));
});

Deno.test("Schema.required", () => {
  const original = s.obj({ name: s.opt(s.str()), age: s.opt(s.num()) });
  const schema = s.required(original);

  assertOk(schema.parse({ name: "John", age: 30 }));
  assertErr(schema.parse({ name: "John" }));
  assertErr(schema.parse({ age: 30 }));
  assertErr(schema.parse({}));
});
