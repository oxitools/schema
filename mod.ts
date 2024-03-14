/**
 * The `@oxi/schema` library offers a comprehensive and flexible system for data validation in JavaScript and TypeScript applications. It provides a rich set of built-in validators for common data types and structures, as well as the ability to define custom validation logic tailored to specific requirements. The library is designed to be both powerful and easy to use, with a focus on type safety and composability.
 *
 * ## Features
 *
 * - **Type Safety**: Built with TypeScript, offering compile-time type checks and inference to ensure your data matches specified schemas.
 * - **Composable Schemas**: Construct complex validation schemas from simple, reusable pieces, enabling clear and maintainable validation logic.
 * - **Customizable Validation**: Extend the library with custom validation functions, giving you the flexibility to implement any validation rule needed for your application.
 * - **Detailed Error Reporting**: Get comprehensive error information when validation fails, making it easier to diagnose and fix issues.
 * - **Coercion Capabilities**: Automatically coerce data types (e.g., from string to number) as part of the validation process, simplifying data handling.
 *
 * ## Installation
 *
 * Install `@oxi/schema` using jsr
 *
 * ```bash
 * npx jsr add @oxi/core
 * ```
 *
 * ## Usage
 *
 * Import the library and use it to define and apply validation schemas:
 *
 * ```ts
 * import * as s from '@oxi/schema';
 *
 * // Define a simple schema
 * const userSchema = s.obj({
 *   name: s.str(),
 *   age: s.num(),
 * });
 *
 * // Validate data against the schema
 * const result = userSchema.parse({ name: 'Jane Doe', age: 30 });
 * if (result.isOk()) {
 *   console.log('Valid data:', result.unwrap());
 * } else {
 *   console.log('Validation error:', result.unwrapErr().message);
 * }
 * ```
 *
 * ## API Reference
 *
 * The library provides a variety of built-in functions and types for defining validation schemas:
 *
 * - `str()`: Defines a schema for string validation.
 * - `num()`: Defines a schema for number validation.
 * - `bool()`: Defines a schema for boolean validation.
 * - `date()`: Defines a schema for Date object validation.
 * - `obj()`: Defines a schema for object validation with specified properties.
 * - `array()`, `list()`: Define schemas for array and list validation, respectively.
 * - `tuple()`: Defines a schema for tuple validation.
 * - `union()`, `oneOf()`: Define schemas for values that can match any one of the provided schemas.
 * - `lit()`: Defines a schema for literal value validation.
 * - `notEmpty()`, `minLen()`, `maxLen()`: Utility functions for string and list validation.
 * - `min()`, `max()`, `clamp()`: Utility functions for number validation.
 *
 * Explore the detailed API documentation in the source code for more functions and features.
 *
 * @module
 */

// deno-lint-ignore-file no-explicit-any

import {
  getTypeOf,
  isArray,
  isBoolean,
  isDate,
  isNil,
  isNumber,
  isPlainObject,
  isString,
  omit,
  pick,
} from "@oxi/core";
import { List } from "@oxi/list";
import { Option } from "@oxi/option";
import { Result } from "@oxi/result";

/**
 * Represents a schema for data validation. Each schema is associated with a specific type `T`, and provides a method to parse and validate input data, returning a `Result` that either contains a valid value of type `T` or a `ParseError` if validation fails.
 *
 * @template T - The type of data the schema validates.
 */
export interface Schema<T> {
  /**
   * The type identifier for the schema, used for error messages and debugging.
   */
  readonly type: string;

  /**
   * An optional default message provided for parse errors related to this schema.
   */
  readonly message?: string;

  /**
   * Parses and validates the input data, returning a `Result` containing the validated data or a `ParseError`.
   *
   * @param {unknown} data - The input data to validate.
   * @returns {Result<T, ParseError>} The result of the validation, either containing the validated data or an error.
   */
  parse(data: unknown): Result<T, ParseError>;
}

/**
 * Represents an error encountered during the parsing and validation process by a schema. Contains detailed information about the error, including the actual and expected types, a custom error message, the path to the erroneous data in nested structures, and the invalid value itself.
 */
export interface ParseError {
  /**
   * The actual type of the input data that led to the error, derived from its value.
   */
  readonly actual: string;

  /**
   * The expected type or format of the data, as defined by the schema.
   */
  readonly expected: string;

  /**
   * A custom error message explaining why the validation failed.
   */
  readonly message: string;

  /**
   * An array representing the path to the erroneous data within a nested data structure. Each element in the array corresponds to a property name or array index.
   */
  readonly path: string[];

  /**
   * The input data value that caused the validation failure.
   */
  readonly value: unknown;
}

export type Infer<T> = T extends Schema<infer U> ? U : never;

type InferTuple<T> = T extends [Schema<infer A>, ...infer Rest]
  ? [A, ...InferTuple<Rest>]
  : [];

type UnionToIntersection<U> = (
  U extends any ? (k: U) => void : never
) extends (k: infer I) => void ? I
  : never;

function err(expected: string, value: unknown, message?: string): ParseError {
  const actual = getTypeOf(value);
  return {
    actual,
    expected,
    message: message || `Expected ${expected}, but got ${actual}`,
    path: [],
    value,
  };
}

function pre<T>(
  schema: Schema<T>,
  hook: (data: unknown) => unknown,
): Schema<T> {
  return {
    ...schema,
    parse(data) {
      return schema.parse(hook(data));
    },
  };
}

function tryNum(data: unknown) {
  return Number(data);
}

function tryStr(data: unknown) {
  return String(data);
}

function tryBool(data: unknown) {
  if (isString(data)) {
    return ["true", "1", "yes", "on"].includes(data.toLowerCase());
  }
  return Boolean(data);
}

function tryDate(data: unknown) {
  if (isString(data) || isNumber(data)) {
    return new Date(data);
  }
  return data;
}

/**
 * Transforms a schema to coerce input data into the target type of the schema before performing validation. This function is useful for pre-processing data, such as converting string input to numbers, booleans, or dates, based on the schema's type.
 *
 * @template T - The target type of the schema, limited to `number`, `string`, `boolean`, or `Date`.
 * @param {Schema<T>} schema - The original schema to which the coercion will be applied.
 * @returns {Schema<T>} A new schema that first attempts to coerce the input data into the target type before applying the original schema's validation.
 *
 * @example
 * ```ts
 * // Coercing string input to a number before validation
 * const numericSchema = as(num());
 * const result = numericSchema.parse("42");
 * if (result.isOk()) {
 *   console.log("Coerced number:", result.unwrap()); // Outputs 42 as a number
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Coercing string input to a boolean before validation
 * const booleanSchema = as(bool());
 * const result = booleanSchema.parse("true");
 * if (result.isOk()) {
 *   console.log("Coerced boolean:", result.unwrap()); // Outputs true as a boolean
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 *
 * @throws {Error} Throws an error if attempting to coerce a type that is not `number`, `string`, `boolean`, or `Date`.
 */
export function as<T extends number | string | boolean | Date>(
  schema: Schema<T>,
): Schema<T> {
  switch (schema.type) {
    case "number":
      return pre(schema, tryNum);
    case "string":
      return pre(schema, tryStr);
    case "boolean":
      return pre(schema, tryBool);
    case "date":
      return pre(schema, tryDate);
    default:
      throw new Error(`Cannot coerce "${schema.type}" to a primitive type`);
  }
}

/**
 * Creates a schema that accepts any input data without performing any validation, effectively bypassing the validation step. This schema is useful in scenarios where the input data's type or structure is completely unknown or irrelevant, and no validation is required.
 *
 * @returns {Schema<unknown>} A schema that accepts any input data, returning it as-is without validation.
 *
 * @example
 * ```ts
 * // Accepting any input data without validation
 * const anySchema = any();
 * const result = anySchema.parse({ key: "value" });
 * if (result.isOk()) {
 *   console.log("Accepted data:", result.unwrap()); // Outputs the original object
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function any(): Schema<unknown> {
  return {
    type: "unknown",
    parse(data) {
      return Result.Ok(data);
    },
  };
}

/**
 * Creates a schema for validating strings. This schema checks if the provided data is a string and optionally matches a custom error message if validation fails.
 *
 * @param {string} [message] - Optional custom error message to display if validation fails.
 * @returns {Schema<string>} A schema object for string validation.
 *
 * @example
 * ```ts
 * // Basic string validation
 * const nameSchema = str();
 * const result = nameSchema.parse("John Doe");
 * if (result.isOk()) {
 *   console.log("Valid string:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // String validation with custom error message
 * const ageSchema = str("Age must be a string");
 * const ageResult = ageSchema.parse(30); // This will fail validation
 * if (ageResult.isOk()) {
 *   console.log("Valid string:", ageResult.unwrap());
 * } else {
 *   console.log("Validation error:", ageResult.unwrapErr().message);
 * }
 * ```
 */
export function str(message?: string): Schema<string> {
  const type = "string";
  return {
    type,
    message,
    parse(data) {
      if (isString(data)) {
        return Result.Ok(data);
      } else {
        return Result.Err(err(type, data, message));
      }
    },
  };
}

/**
 * Creates a schema for validating numbers. This schema verifies if the provided data is of type number and allows specifying a custom error message for failed validations.
 *
 * @param {string} [message] - Optional custom error message for validation failures.
 * @returns {Schema<number>} A schema object for number validation.
 *
 * @example
 * ```ts
 * // Basic number validation
 * const ageSchema = num();
 * const ageResult = ageSchema.parse(25);
 * if (ageResult.isOk()) {
 *   console.log("Valid number:", ageResult.unwrap());
 * } else {
 *   console.log("Validation error:", ageResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Number validation with custom error message
 * const quantitySchema = num("Quantity must be a number");
 * const quantityResult = quantitySchema.parse("100"); // This will fail validation
 * if (quantityResult.isOk()) {
 *   console.log("Valid number:", quantityResult.unwrap());
 * } else {
 *   console.log("Validation error:", quantityResult.unwrapErr().message);
 * }
 * ```
 */
export function num(message?: string): Schema<number> {
  const type = "number";
  return {
    type,
    message,
    parse(data) {
      if (isNumber(data)) {
        return Result.Ok(data);
      } else {
        return Result.Err(err(type, data, message));
      }
    },
  };
}

/**
 * Creates a schema for validating boolean values. This schema checks if the provided data is a boolean and supports a custom error message for validation failures.
 *
 * @param {string} [message] - Optional custom error message for when validation fails.
 * @returns {Schema<boolean>} A schema object for boolean validation.
 *
 * @example
 * ```ts
 * // Basic boolean validation
 * const activeSchema = bool();
 * const activeResult = activeSchema.parse(true);
 * if (activeResult.isOk()) {
 *   console.log("Valid boolean:", activeResult.unwrap());
 * } else {
 *   console.log("Validation error:", activeResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Boolean validation with custom error message
 * const isAdminSchema = bool("isAdmin flag must be a boolean");
 * const isAdminResult = isAdminSchema.parse("true"); // This will fail validation
 * if (isAdminResult.isOk()) {
 *   console.log("Valid boolean:", isAdminResult.unwrap());
 * } else {
 *   console.log("Validation error:", isAdminResult.unwrapErr().message);
 * }
 * ```
 */
export function bool(message?: string): Schema<boolean> {
  const type = "boolean";
  return {
    type,
    message,
    parse(data) {
      if (isBoolean(data)) {
        return Result.Ok(data);
      } else {
        return Result.Err(err(type, data, message));
      }
    },
  };
}

/**
 * Creates a schema for validating Date objects. This schema verifies if the provided data is a valid date. An optional custom error message can be specified for validation failures.
 *
 * @param {string} [message] - Optional custom error message for validation failures.
 * @returns {Schema<Date>} A schema object for Date validation.
 *
 * @example
 * ```ts
 * // Basic Date validation
 * const birthDateSchema = date();
 * const result = birthDateSchema.parse(new Date("1990-01-01"));
 * if (result.isOk()) {
 *   console.log("Valid date:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Date validation with custom error message
 * const appointmentDateSchema = date("Appointment date must be a valid date");
 * const appointmentResult = appointmentDateSchema.parse("not a date"); // This will fail validation
 * if (appointmentResult.isOk()) {
 *   console.log("Valid date:", appointmentResult.unwrap());
 * } else {
 *   console.log("Validation error:", appointmentResult.unwrapErr().message);
 * }
 * ```
 */
export function date(message?: string): Schema<Date> {
  const type = "date";
  return {
    type,
    message,
    parse(data) {
      if (isDate(data)) {
        return Result.Ok(new Date(data));
      } else {
        return Result.Err(err(type, data, message));
      }
    },
  };
}

export interface ListSchema<T> extends Schema<List<T>> {
  readonly schema: Schema<T>;
}

/**
 * Creates a schema for validating arrays (lists) of items, where each item conforms to a specified schema. This is useful for validating homogeneous arrays. An optional custom error message can be provided for validation failures.
 *
 * @param {Schema<T>} schema - The schema that each element of the array should conform to.
 * @param {string} [message] - Optional custom error message for validation failures.
 * @returns {ListSchema<T>} A schema object for list validation, ensuring each item in the list conforms to the provided schema.
 *
 * @example
 * ```ts
 * // Validating an array of numbers
 * const numberListSchema = list(num(), "Each item must be a number");
 * const numberListResult = numberListSchema.parse([1, 2, 3, 4, 5]);
 * if (numberListResult.isOk()) {
 *   console.log("Valid number list:", numberListResult.unwrap().toArray());
 * } else {
 *   console.log("Validation error:", numberListResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Validating an array of strings with a custom error message
 * const stringListSchema = list(str(), "Each item must be a string");
 * const stringListResult = stringListSchema.parse(["hello", "world", 123]); // This will fail validation
 * if (stringListResult.isOk()) {
 *   console.log("Valid string list:", stringListResult.unwrap().toArray());
 * } else {
 *   console.log("Validation error:", stringListResult.unwrapErr().message);
 * }
 * ```
 */
export function list<T>(schema: Schema<T>, message?: string): ListSchema<T> {
  const type = "list";
  return {
    type,
    message,
    schema,
    parse(data) {
      if (!isArray(data)) {
        return Result.Err(err(type, data, message));
      }
      const arr: T[] = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        const result = schema.parse(data[i]);
        if (result.isErr()) {
          const err = result.unwrapErr();
          return Result.Err({ ...err, path: [i.toString(), ...err.path] });
        }
        arr[i] = result.unwrap();
      }
      return Result.Ok(List.from(arr));
    },
  };
}

type PlainObject = { [key: string]: unknown };
type ObjectProps<T extends PlainObject> = { [K in keyof T]: Schema<T[K]> };

export interface ObjectSchema<T extends PlainObject = PlainObject>
  extends Schema<T> {
  readonly props: { [K in keyof T]: Schema<T[K]> };
}

/**
 * Creates a schema for validating plain objects with specified properties. Each property in the object can have its own schema, allowing for complex object validation. Supports specifying a custom error message for validation failures.
 *
 * @param {ObjectProps<T>} props - An object specifying schemas for each property that should be validated within the object.
 * @param {string} [message] - Optional custom error message for when object validation fails.
 * @returns {ObjectSchema<T>} A schema object for object validation, where each property conforms to its specified schema.
 *
 * @example
 * ```ts
 * // Validating a user object with string and number properties
 * const userSchema = obj({
 *   name: str("Name must be a string"),
 *   age: num("Age must be a number"),
 * });
 * const userResult = userSchema.parse({ name: "Jane Doe", age: 30 });
 * if (userResult.isOk()) {
 *   console.log("Valid user object:", userResult.unwrap());
 * } else {
 *   console.log("Validation error:", userResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Object validation with nested schemas and custom error messages
 * const productSchema = obj({
 *   id: num("Product ID must be a number"),
 *   details: obj({
 *     name: str("Product name must be a string"),
 *     price: num("Product price must be a number"),
 *   }, "Product details are invalid"),
 * }, "Invalid product object");
 * const productResult = productSchema.parse({
 *   id: 101,
 *   details: { name: "Widget", price: 9.99 }
 * });
 * if (productResult.isOk()) {
 *   console.log("Valid product object:", productResult.unwrap());
 * } else {
 *   console.log("Validation error:", productResult.unwrapErr().message);
 * }
 * ```
 */
export function obj<T extends PlainObject>(
  props: ObjectProps<T>,
  message?: string,
): ObjectSchema<T> {
  const type = "object";
  return {
    type,
    message,
    props,
    parse(data) {
      if (!isPlainObject(data)) {
        return Result.Err(err(type, data, message));
      }
      const obj = Object.create(null) as T;
      for (const key in props) {
        const result = props[key].parse((data as PlainObject)[key]);
        if (result.isErr()) {
          const err = result.unwrapErr();
          return Result.Err({ ...err, path: [key, ...err.path] });
        }
        obj[key] = result.unwrap();
      }
      return Result.Ok(obj);
    },
  };
}

/**
 * Creates a schema for validating objects that represent a record, where each key-value pair needs to conform to specified key and value schemas. This is useful for dynamic objects where keys follow a certain pattern and values have a specific type.
 *
 * @param {Schema<K>} key - The schema for validating the keys of the record.
 * @param {Schema<V>} value - The schema for validating the values of the record.
 * @param {string} [message] - Optional custom error message for when the record validation fails.
 * @returns {Schema<Record<K, V>>} A schema object for record validation, ensuring each key-value pair in the object matches the specified key and value schemas.
 *
 * @example
 * ```ts
 * // Validating a simple record where keys are strings and values are numbers
 * const inventorySchema = record(str(), num(), "Inventory record is invalid");
 * const inventoryResult = inventorySchema.parse({ apples: 10, oranges: 20 });
 * if (inventoryResult.isOk()) {
 *   console.log("Valid inventory record:", inventoryResult.unwrap());
 * } else {
 *   console.log("Validation error:", inventoryResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Record validation with more complex key and value schemas
 * const userSettingsSchema = record(str("Key must be a string"), bool(), "User settings record is invalid");
 * const userSettingsResult = userSettingsSchema.parse({ darkMode: true, notificationsEnabled: false });
 * if (userSettingsResult.isOk()) {
 *   console.log("Valid user settings record:", userSettingsResult.unwrap());
 * } else {
 *   console.log("Validation error:", userSettingsResult.unwrapErr().message);
 * }
 * ```
 */
export function record<K extends string, V>(
  key: Schema<K>,
  value: Schema<V>,
  message?: string,
): Schema<Record<K, V>> {
  const type = "record";
  return {
    type,
    message,
    parse(data) {
      if (!isPlainObject(data)) {
        return Result.Err(err(type, data, message));
      }
      const obj = Object.create(null) as Record<K, V>;
      for (const k in data) {
        const keyResult = key.parse(k);
        if (keyResult.isErr()) {
          const err = keyResult.unwrapErr();
          return Result.Err({ ...err, path: [k, ...err.path] });
        }
        const valueResult = value.parse(data[k]);
        if (valueResult.isErr()) {
          const err = valueResult.unwrapErr();
          return Result.Err({ ...err, path: [k, ...err.path] });
        }
        obj[keyResult.unwrap()] = valueResult.unwrap();
      }
      return Result.Ok(obj);
    },
  };
}

type AnySchema = Schema<any>;

/**
 * Creates a schema for validating values that may conform to any one of a specified set of schemas. This is useful for data that can be of multiple types, such as strings or numbers. The validation passes if at least one schema is satisfied.
 *
 * @param {readonly [A, ...B]} schemas - An array of schemas, where the value must match at least one schema to pass validation.
 * @param {string} [message] - Optional custom error message for when none of the schemas match.
 * @returns {Schema<Infer<A> | Infer<B[number]>>} A schema object for union type validation, allowing values that match any one of the provided schemas.
 *
 * @example
 * ```ts
 * // Validating a value that can be either a string or a number
 * const stringOrNumberSchema = union([str(), num()], "Value must be a string or a number");
 * const stringResult = stringOrNumberSchema.parse("hello");
 * const numberResult = stringOrNumberSchema.parse(123);
 * console.log("String validation result:", stringResult.isOk() ? "Valid" : "Invalid");
 * console.log("Number validation result:", numberResult.isOk() ? "Valid" : "Invalid");
 * ```
 *
 * @example
 * ```ts
 * // Union validation with more complex schemas
 * const contactInfoSchema = union([
 *   obj({ phone: num("Phone number must be a number") }),
 *   obj({ email: str("Email must be a string") })
 * ], "Contact info must be either a phone number or an email address");
 * const phoneResult = contactInfoSchema.parse({ phone: 1234567890 });
 * const emailResult = contactInfoSchema.parse({ email: "example@example.com" });
 * if (phoneResult.isOk()) {
 *   console.log("Valid phone contact info:", phoneResult.unwrap());
 * } else {
 *   console.log("Validation error:", phoneResult.unwrapErr().message);
 * }
 * if (emailResult.isOk()) {
 *   console.log("Valid email contact info:", emailResult.unwrap());
 * } else {
 *   console.log("Validation error:", emailResult.unwrapErr().message);
 * }
 * ```
 */
export function union<A extends AnySchema, B extends readonly AnySchema[]>(
  schemas: readonly [A, ...B],
  message?: string,
): Schema<Infer<A> | Infer<B[number]>> {
  const type = "union";
  return {
    type,
    message,
    parse(data) {
      for (const schema of schemas) {
        const result = schema.parse(data);
        if (result.isOk()) {
          return result;
        }
      }
      return Result.Err(
        err(schemas.map((s) => s.type).join(" | "), data, message),
      );
    },
  };
}

/**
 * Creates a schema for validating tuples, which are fixed-size arrays where each element has its own schema. This function ensures that an array matches the specified structure, with each element conforming to the corresponding schema in the tuple definition.
 *
 * @param {readonly [A, ...B]} schemas - An array of schemas corresponding to each element of the tuple. The length of this array defines the expected length of the tuple.
 * @param {string} [message] - Optional custom error message for when the tuple validation fails.
 * @returns {Schema<InferTuple<[A, ...B]>>} A schema object for tuple validation, ensuring that the array matches the structure and types defined by the provided schemas.
 *
 * @example
 * ```ts
 * // Validating a simple tuple of [string, number]
 * const nameAndAgeSchema = tuple([str(), num()], "Name and age tuple is invalid");
 * const nameAndAgeResult = nameAndAgeSchema.parse(["John Doe", 30]);
 * if (nameAndAgeResult.isOk()) {
 *   console.log("Valid tuple:", nameAndAgeResult.unwrap());
 * } else {
 *   console.log("Validation error:", nameAndAgeResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Tuple validation with more complex structures
 * const userSchema = tuple([
 *   str("First name must be a string"),
 *   str("Last name must be a string"),
 *   num("Age must be a number")
 * ], "User tuple is invalid");
 * const userResult = userSchema.parse(["Jane", "Doe", 28]);
 * if (userResult.isOk()) {
 *   console.log("Valid user tuple:", userResult.unwrap());
 * } else {
 *   console.log("Validation error:", userResult.unwrapErr().message);
 * }
 * ```
 */
export function tuple<A extends AnySchema, B extends readonly AnySchema[]>(
  schemas: readonly [A, ...B],
  message?: string,
): Schema<InferTuple<[A, ...B]>> {
  const type = "tuple";
  return {
    type,
    message,
    parse(data) {
      if (!isArray(data) || data.length !== schemas.length) {
        return Result.Err(err(type, data, message));
      }
      const arr = new Array(schemas.length);
      for (let i = 0; i < schemas.length; i++) {
        const result = schemas[i].parse(data[i]);
        if (result.isErr()) {
          const err = result.unwrapErr();
          return Result.Err({ ...err, path: [i.toString(), ...err.path] });
        }
        arr[i] = result.unwrap();
      }
      return Result.Ok(arr as InferTuple<[A, ...B]>);
    },
  };
}

interface Enum {
  [key: string]: string | number;
  [index: number]: string | number;
}

/**
 * Creates a schema for validating enum-like structures, where the value must be one of the specified enum values. This is useful for variables that can only take on a limited set of known values, such as status codes or predefined categories.
 *
 * @param {Enum} e - The enum-like structure containing the possible valid values.
 * @param {string} [message] - Optional custom error message for when the value does not match any of the enum values.
 * @returns {Schema<E[keyof E]>} A schema object for enum validation, ensuring the value matches one of the predefined enum values.
 *
 * @example
 * ```ts
 * // Defining and validating a simple enum for user roles
 * const UserRole = {
 *   Admin: 'admin',
 *   User: 'user',
 *   Guest: 'guest',
 * };
 * const userRoleSchema = enum(UserRole, "Invalid user role");
 * const userRoleResult = userRoleSchema.parse("admin");
 * if (userRoleResult.isOk()) {
 *   console.log("Valid user role:", userRoleResult.unwrap());
 * } else {
 *   console.log("Validation error:", userRoleResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Enum validation with numeric values
 * const StatusCode = {
 *   OK: 200,
 *   NotFound: 404,
 *   Error: 500,
 * };
 * const statusCodeSchema = enum(StatusCode, "Invalid status code");
 * const statusCodeResult = statusCodeSchema.parse(404);
 * if (statusCodeResult.isOk()) {
 *   console.log("Valid status code:", statusCodeResult.unwrap());
 * } else {
 *   console.log("Validation error:", statusCodeResult.unwrapErr().message);
 * }
 * ```
 */
function _enum<E extends Enum>(
  e: E,
  message?: string,
): Schema<E[keyof E]> {
  const type = "enum";
  const values = Object.values(e);
  return {
    type,
    message,
    parse(data) {
      if (values.includes(data as E[keyof E])) {
        return Result.Ok(data as E[keyof E]);
      }
      return Result.Err(err(type, data, message));
    },
  };
}

export { _enum as enum };

/**
 * Creates a schema for validating values against a specific set of allowed values. This function ensures that the data matches one of the predefined values, making it useful for scenarios where only certain discrete values are permitted.
 *
 * @template T
 * @param {readonly T[]} values - An array of allowed values.
 * @param {string} [message] - Optional custom error message for when the value does not match any of the allowed values. Defaults to a message listing the allowed values and the received value.
 * @returns {Schema<T[number]>} A schema object for validation against the specified set of allowed values.
 *
 * @example
 * ```ts
 * // Validating a value to be one of the predefined colors
 * const colorSchema = oneOf(["red", "green", "blue"], "Invalid color");
 * const colorResult = colorSchema.parse("red");
 * if (colorResult.isOk()) {
 *   console.log("Valid color:", colorResult.unwrap());
 * } else {
 *   console.log("Validation error:", colorResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Using oneOf without a custom error message
 * const directionSchema = oneOf(["north", "south", "east", "west"]);
 * const directionResult = directionSchema.parse("upward");
 * if (directionResult.isOk()) {
 *   console.log("Valid direction:", directionResult.unwrap());
 * } else {
 *   console.log("Validation error:", directionResult.unwrapErr().message);
 * }
 * ```
 */
export function oneOf<const T extends readonly string[]>(
  values: T,
  message?: string,
): Schema<T[number]> {
  const type = "oneOf";
  return {
    type,
    message,
    parse(data) {
      if (values.includes(data as T[number])) {
        return Result.Ok(data as T[number]);
      }
      message ??= `Expected one of ${JSON.stringify(values)}, but got ${
        JSON.stringify(data)
      }`;
      return Result.Err(err(type, data, message));
    },
  };
}

/**
 * Creates a schema for validating a literal value. This function ensures that the data exactly matches the specified literal value, making it useful for constant or unchanging values in validation scenarios.
 *
 * @template T
 * @param {T} value - The literal value to validate against.
 * @param {string} [message] - Optional custom error message for when the data does not match the literal value. Defaults to a message showing the expected literal value and the received value.
 * @returns {Schema<T>} A schema object for literal value validation.
 *
 * @example
 * ```ts
 * // Validating a boolean literal
 * const trueSchema = lit(true, "Value must be true");
 * const trueResult = trueSchema.parse(true);
 * if (trueResult.isOk()) {
 *   console.log("Value is true");
 * } else {
 *   console.log("Validation error:", trueResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Validating a string literal without a custom error message
 * const helloSchema = lit("hello");
 * const helloResult = helloSchema.parse("hello");
 * if (helloResult.isOk()) {
 *   console.log("Valid string literal");
 * } else {
 *   console.log("Validation error:", helloResult.unwrapErr().message);
 * }
 * ```
 */
export function lit<T extends string | number | boolean>(
  value: T,
  message?: string,
): Schema<T> {
  const type = "literal";
  return {
    type,
    message,
    parse(data) {
      if (data === value) {
        return Result.Ok(value);
      }
      message ??= `Expected ${JSON.stringify(value)}, but got ${
        JSON.stringify(data)
      }`;
      return Result.Err(err(type, data, message));
    },
  };
}

// deno-lint-ignore ban-types
type Pretty<T> = { [K in keyof T]: T[K] } & {};

/**
 * Creates a schema by extending multiple object schemas, effectively merging their properties. This is useful for combining schemas to form a new schema that includes all properties from the input schemas. In case of overlapping properties, the last schema's properties take precedence.
 *
 * @template A, B
 * @param {readonly [A, ...B]} schemas - An array of object schemas to be merged into a new schema.
 * @param {string} [message] - Optional custom error message for when the extended object validation fails.
 * @returns {ObjectSchema<Pretty<UnionToIntersection<Infer<A> | Infer<B[number]>>>>} A new object schema that combines properties from all provided schemas.
 *
 * @example
 * ```ts
 * // Extending two object schemas
 * const baseSchema = obj({ name: str(), age: num() });
 * const addressSchema = obj({ street: str(), city: str() });
 * const userSchema = extend([baseSchema, addressSchema], "User object is invalid");
 * const userResult = userSchema.parse({ name: "John Doe", age: 30, street: "123 Main St", city: "Anytown" });
 * if (userResult.isOk()) {
 *   console.log("Valid extended object:", userResult.unwrap());
 * } else {
 *   console.log("Validation error:", userResult.unwrapErr().message);
 * }
 * ```
 */
export function extend<
  A extends ObjectSchema,
  B extends readonly ObjectSchema[],
>(
  schemas: readonly [A, ...B],
  message?: string,
): ObjectSchema<Pretty<UnionToIntersection<Infer<A> | Infer<B[number]>>>> {
  const props = Object.assign({}, ...schemas.map((s) => s.props)) as any;
  return obj(props, message);
}

/**
 * Creates a new object schema by selecting a subset of properties from an existing object schema. This is useful for creating a schema that validates only specified properties of an object, ignoring the rest.
 *
 * @template T, K
 * @param {ObjectSchema<T>} schema - The original object schema.
 * @param {readonly K[]} keys - An array of keys representing the properties to include in the new schema.
 * @param {string} [message] - Optional custom error message for when the selected object validation fails.
 * @returns {ObjectSchema<Pretty<Pick<T, K>>>} A new object schema that includes only the selected properties from the original schema.
 *
 * @example
 * ```ts
 * // Selecting a subset of properties from an object schema
 * const userSchema = obj({ name: str(), age: num(), email: str() });
 * const nameAndEmailSchema = select(userSchema, ["name", "email"], "Name and email object is invalid");
 * const result = nameAndEmailSchema.parse({ name: "Jane Doe", email: "jane@example.com" });
 * if (result.isOk()) {
 *   console.log("Valid selected object:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function select<T extends PlainObject, K extends keyof T>(
  schema: ObjectSchema<T>,
  keys: readonly K[],
  message?: string,
): ObjectSchema<Pretty<Pick<T, K>>> {
  const props = pick(schema.props, keys as unknown as K[]);
  return obj(props as ObjectProps<Pick<T, K>>, message);
}

/**
 * Creates a new object schema by excluding a set of properties from an existing object schema. This function is useful for creating a schema that validates an object while ignoring certain properties.
 *
 * @template T, K
 * @param {ObjectSchema<T>} schema - The original object schema.
 * @param {readonly K[]} keys - An array of keys representing the properties to exclude from the new schema.
 * @param {string} [message] - Optional custom error message for when the object with excluded properties fails validation.
 * @returns {ObjectSchema<Pretty<Omit<T, K>>>} A new object schema that omits the specified properties from the original schema.
 *
 * @example
 * ```ts
 * // Excluding properties from an object schema
 * const userSchema = obj({ name: str(), age: num(), password: str() });
 * const publicUserSchema = exclude(userSchema, ["password"], "Public user object is invalid");
 * const result = publicUserSchema.parse({ name: "Jane Doe", age: 30 });
 * if (result.isOk()) {
 *   console.log("Valid object with excluded properties:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function exclude<T extends PlainObject, K extends keyof T>(
  schema: ObjectSchema<T>,
  keys: readonly K[],
  message?: string,
): ObjectSchema<Pretty<Omit<T, K>>> {
  const props = omit(schema.props, keys as unknown as K[]);
  return obj(props as ObjectProps<Omit<T, K>>, message);
}

export interface OptionalSchema<T> extends Schema<Option<T>> {
  readonly schema: Schema<T>;
}

/**
 * Creates a schema for optional values, allowing the value to be either of the specified type or `null` or `undefined`. This is useful for validating properties that may or may not be present, without requiring a default value.
 *
 * @template T
 * @param {Schema<T>} schema - The schema to apply when the value is not `undefined`.
 * @param {string} [message] - Optional custom error message for when the value is present but fails the provided schema's validation.
 * @returns {OptionalSchema<T>} A schema object that allows the value to be either of the specified type or `undefined`.
 *
 * @example
 * ```ts
 * // Optional string value
 * const optionalNameSchema = opt(str("Name must be a string"));
 * const result1 = optionalNameSchema.parse("Jane Doe");
 * const result2 = optionalNameSchema.parse(undefined);
 * console.log("Result 1 (valid string):", result1.isOk() ? "Valid" : "Invalid");
 * console.log("Result 2 (undefined):", result2.isOk() ? "Valid" : "Invalid");
 * ```
 *
 * @example
 * ```ts
 * // Optional number value with custom error message
 * const optionalAgeSchema = opt(num(), "Age must be a number if provided");
 * const result = optionalAgeSchema.parse(null); // Assuming null is treated as undefined in your implementation
 * if (result.isOk()) {
 *   console.log("Valid or undefined age");
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function opt<T>(
  schema: Schema<T>,
): OptionalSchema<T> {
  const type = "optional";
  return {
    type,
    schema,
    parse(data) {
      if (isNil(data)) {
        return Result.Ok(Option.None);
      }
      return schema.parse(data).map(Option.Some);
    },
  };
}

/**
 * Creates a schema with a default value, which is used when the input is `null` or `undefined`. This is useful for ensuring that a value always conforms to a certain type, using a default when none is provided.
 *
 * @template T
 * @param {Schema<T>} schema - The schema to validate the provided value against.
 * @param {T} defaultValue - The default value to use when the input is `undefined`.
 * @param {string} [message] - Optional custom error message for when the provided value fails the schema's validation.
 * @returns {Schema<T>} A schema object that ensures a value always conforms to the specified type, using the provided default when necessary.
 *
 * @example
 * ```ts
 * // Number value with a default
 * const defaultAgeSchema = def(num("Age must be a number"), 18);
 * const result1 = defaultAgeSchema.parse(25);
 * const result2 = defaultAgeSchema.parse(undefined);
 * console.log("Result 1 (valid number):", result1.isOk() ? "Valid" : "Invalid");
 * console.log("Result 2 (default value used):", result2.isOk() ? result2.unwrap() : "Invalid");
 * ```
 *
 * @example
 * ```ts
 * // String value with a default and custom error message
 * const defaultGreetingSchema = def(str(), "Hello, world!", "Greeting must be a string");
 * const result = defaultGreetingSchema.parse(null); // Assuming null is treated as undefined in your implementation
 * if (result.isOk()) {
 *   console.log("Greeting:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function def<T>(
  schema: Schema<T>,
  defaultValue: T,
  message?: string,
): Schema<T> {
  const type = "default";
  return {
    type,
    message,
    parse(data) {
      if (isNil(data)) {
        return Result.Ok(defaultValue);
      }
      return schema.parse(data);
    },
  };
}

// Transformations

/**
 * Represents a function that processes data of type `T` and returns a `Result` with the processed data of the same type or an error message.
 *
 * @template T - The type of the input data to the pipe function, and also the type of the output data if the operation is successful.
 * @param {T} data - The input data to be processed by the pipe function.
 * @returns {Result<T, string>} A `Result` object containing either the processed data of type `T` or an error message as a string.
 */
export type Pipe<T> = (data: T) => Result<T, string>;

/**
 * Represents an array of `Pipe` functions that are applied in sequence to process data. Each pipe in the pipeline takes the result of the previous pipe as its input, forming a chain of operations.
 *
 * @template T - The type of the data that flows through the pipeline, being processed by each pipe function in sequence.
 */
export type Pipeline<T> = ReadonlyArray<Pipe<T>>;

/**
 * Composes a schema with a pipeline of functions, where each function in the pipeline processes the data in sequence, passing the result to the next function. Useful for adding custom processing or validation logic to an existing schema.
 *
 * @template T
 * @param {Schema<T>} schema - The initial schema to validate the input data.
 * @param {...Pipeline<T>} pipeline - A sequence of pipe functions that further process or validate the data after it passes the initial schema validation.
 * @returns {Schema<T>} A new schema that incorporates the original schema validation followed by the pipeline of processing functions.
 *
 * @example
 * ```ts
 * // Adding custom processing to a string schema
 * const trimmedLowerCaseSchema = pipe(
 *   str("Must be a string"),
 *   trim(),
 *   lowcase()
 * );
 * const result = trimmedLowerCaseSchema.parse("  SOME TEXT  ");
 * if (result.isOk()) {
 *   console.log("Processed text:", result.unwrap()); // Outputs "some text"
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function pipe<T>(
  schema: Schema<T>,
  ...pipeline: Pipeline<T>
): Schema<T> {
  const type = "pipe";
  return {
    type,
    parse(data) {
      return schema.parse(data).andThen((value) => {
        let acc = value;
        for (const pipe of pipeline) {
          const result = pipe(acc).mapErr((message) => err(type, acc, message));
          if (result.isErr()) {
            return result;
          }
          acc = result.unwrap();
        }
        return Result.Ok(acc);
      });
    },
  };
}

/**
 * Transforms the result of a schema using a mapping function. This allows for converting the validated and possibly transformed data from one type to another, enabling more complex data processing and transformation chains.
 *
 * @template T, U
 * @param {Schema<T>} schema - The schema to validate and process the input data.
 * @param {(data: T) => Result<U, string>} mapper - A function that transforms the validated data of type `T` to a new type `U`, encapsulated in a `Result`.
 * @returns {Schema<U>} A new schema that applies the transformation defined by the mapper function to the data after it has been validated by the initial schema.
 *
 * @example
 * ```ts
 * // Converting a validated numeric string into a number
 * const numericStringSchema = str("Must be a string representing a number");
 * const numberSchema = map(numericStringSchema, (str) => {
 *   const num = parseFloat(str);
 *   return isNaN(num) ? Result.Err("Invalid number") : Result.Ok(num);
 * });
 * const result = numberSchema.parse("123.45");
 * if (result.isOk()) {
 *   console.log("Converted number:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function map<T, U>(
  schema: Schema<T>,
  mapper: (data: T) => Result<U, string>,
): Schema<U> {
  const type = schema.type;
  return {
    type,
    parse(data) {
      return schema.parse(data).andThen((value) => {
        return mapper(value).mapErr((message) => err(type, value, message));
      });
    },
  };
}

// Utility functions

/**
 * Creates a pipe function for validating the minimum length of a string. The function checks if the string meets a specified minimum length requirement.
 *
 * @param {number} min - The minimum length the string should have.
 * @param {string} [message] - Optional custom error message for when the string's length is below the minimum. Defaults to a message indicating the minimum length requirement and the actual length.
 * @returns {Pipe<string>} A pipe function that validates the minimum length of a string.
 *
 * @example
 * ```ts
 * // Enforcing a minimum string length
 * const schema = pipe(str(), minLen(10, "String must be at least 10 characters long"));
 * const result = schema.parse("hello");
 * if (result.isOk()) {
 *   console.log("Valid string:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function minLen(min: number, message?: string): Pipe<string> {
  return function (data) {
    if (data.length < min) {
      const msg = message ??
        `Expected length to be at least ${min}, but got ${data.length}`;
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating the maximum length of a string. The function checks if the string does not exceed a specified maximum length.
 *
 * @param {number} max - The maximum length the string can have.
 * @param {string} [message] - Optional custom error message for when the string's length is above the maximum. Defaults to a message indicating the maximum length requirement and the actual length.
 * @returns {Pipe<string>} A pipe function that validates the maximum length of a string.
 *
 * @example
 * ```ts
 * // Enforcing a maximum string length
 * const schema = pipe(str(), maxLen(5, "String must be no more than 5 characters long"));
 * const result = schema.parse("hello world");
 * if (result.isOk()) {
 *   console.log("Valid string:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function maxLen(max: number, message?: string): Pipe<string> {
  return function (data) {
    if (data.length > max) {
      const msg = message ??
        `Expected length to be at most ${max}, but got ${data.length}`;
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for trimming whitespace from both ends of a string. This function is used to preprocess strings by removing leading and trailing whitespace before further validation or processing.
 *
 * @returns {Pipe<string>} A pipe function that trims a string, removing leading and trailing whitespace.
 *
 * @example
 * ```ts
 * // Trimming whitespace from a string
 * const schema = pipe(str(), trim());
 * const result = schema.parse("  hello world  ");
 * if (result.isOk()) {
 *   console.log("Trimmed string:", `"${result.unwrap()}"`); // Outputs "hello world"
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function trim(): Pipe<string> {
  return function (data) {
    return Result.Ok(data.trim());
  };
}

/**
 * Creates a pipe function for converting a string to uppercase. This function is used to preprocess strings by converting all characters to their uppercase equivalents.
 *
 * @returns {Pipe<string>} A pipe function that converts a string to uppercase.
 *
 * @example
 * ```ts
 * // Converting a string to uppercase
 * const schema = pipe(str(), upcase());
 * const result = schema.parse("hello world");
 * if (result.isOk()) {
 *   console.log("Uppercase string:", result.unwrap()); // Outputs "HELLO WORLD"
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function upcase(): Pipe<string> {
  return function (data) {
    return Result.Ok(data.toUpperCase());
  };
}

/**
 * Creates a pipe function for converting a string to lowercase. This function is used to preprocess strings by converting all characters to their lowercase equivalents.
 *
 * @returns {Pipe<string>} A pipe function that converts a string to lowercase.
 *
 * @example
 * ```ts
 * // Converting a string to lowercase
 * const schema = pipe(str(), lowcase());
 * const result = schema.parse("HELLO WORLD");
 * if (result.isOk()) {
 *   console.log("Lowercase string:", result.unwrap()); // Outputs "hello world"
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function lowcase(): Pipe<string> {
  return function (data) {
    return Result.Ok(data.toLowerCase());
  };
}

/**
 * Creates a pipe function for validating a string against a regular expression pattern. This function checks if the string matches the provided regex pattern, which is useful for enforcing specific formats (e.g., email, URL, phone number).
 *
 * @param {RegExp} regex - The regular expression pattern the string must match.
 * @param {string} [message] - Optional custom error message for when the string does not match the pattern. Defaults to a message indicating the expected pattern.
 * @returns {Pipe<string>} A pipe function that validates a string against the specified regular expression pattern.
 *
 * @example
 * ```ts
 * // Validating a string against an email pattern
 * const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
 * const schema = pipe(str(), pattern(emailPattern, "Invalid email format"));
 * const result = schema.parse("user@example.com");
 * if (result.isOk()) {
 *   console.log("Valid email:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function pattern(regex: RegExp, message?: string): Pipe<string> {
  const msg = message ?? `Expected value to match pattern ${regex}`;
  return function (data) {
    if (!regex.test(data)) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a string or a List is not empty. This function ensures that the data has at least one element or character.
 *
 * @template T - The type of the input, constrained to either a string or a List.
 * @param {string} [message] - Optional custom error message for when the input is empty. Defaults to a generic non-empty value message.
 * @returns {Pipe<T>} A pipe function that validates non-emptiness of a string or List.
 *
 * @example
 * ```ts
 * // Validating a non-empty string
 * const nonEmptyStringSchema = pipe(str(), notEmpty("String cannot be empty"));
 * const stringResult = nonEmptyStringSchema.parse("");
 * if (stringResult.isOk()) {
 *   console.log("Non-empty string:", stringResult.unwrap());
 * } else {
 *   console.log("Validation error:", stringResult.unwrapErr().message);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Validating a non-empty List
 * const nonEmptyListSchema = pipe(list(str()), notEmpty("List cannot be empty"));
 * const listResult = nonEmptyListSchema.parse(List.from([]));
 * if (listResult.isOk()) {
 *   console.log("Non-empty list");
 * } else {
 *   console.log("Validation error:", listResult.unwrapErr().message);
 * }
 * ```
 */
export function notEmpty<T extends string | List<unknown>>(
  message?: string,
): Pipe<T> {
  const msg = message ?? "Expected value to be non-empty";
  return function (data) {
    if (List.isList(data) ? data.isEmpty() : data.length === 0) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a number meets or exceeds a specified minimum value.
 *
 * @param {number} min - The minimum value the number must have.
 * @param {string} [message] - Optional custom error message for when the number is below the minimum. Defaults to a message indicating the minimum value requirement.
 * @returns {Pipe<number>} A pipe function that validates the minimum value of a number.
 *
 * @example
 * ```ts
 * // Enforcing a minimum number value
 * const minAgeSchema = pipe(num(), min(18, "Age must be at least 18"));
 * const ageResult = minAgeSchema.parse(16);
 * if (ageResult.isOk()) {
 *   console.log("Valid age:", ageResult.unwrap());
 * } else {
 *   console.log("Validation error:", ageResult.unwrapErr().message);
 * }
 * ```
 */
export function min(min: number, message?: string): Pipe<number> {
  const msg = message ?? `Expected value to be at least ${min}`;
  return function (data) {
    if (data < min) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a number does not exceed a specified maximum value.
 *
 * @param {number} max - The maximum value the number can have.
 * @param {string} [message] - Optional custom error message for when the number is above the maximum. Defaults to a message indicating the maximum value requirement.
 * @returns {Pipe<number>} A pipe function that validates the maximum value of a number.
 *
 * @example
 * ```ts
 * // Enforcing a maximum number value
 * const maxPriceSchema = pipe(num(), max(100, "Price must be no more than 100"));
 * const priceResult = maxPriceSchema.parse(150);
 * if (priceResult.isOk()) {
 *   console.log("Valid price:", priceResult.unwrap());
 * } else {
 *   console.log("Validation error:", priceResult.unwrapErr().message);
 * }
 * ```
 */
export function max(max: number, message?: string): Pipe<number> {
  const msg = message ?? `Expected value to be at most ${max}`;
  return function (data) {
    if (data > max) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for clamping a number within a specified range. The function ensures that the number is not lower than the minimum value and not higher than the maximum value specified.
 *
 * @param {number} min - The minimum value of the range.
 * @param {number} max - The maximum value of the range.
 * @returns {Pipe<number>} A pipe function that clamps a number within the specified range.
 *
 * @example
 * ```ts
 * // Clamping a number within a range
 * const schema = pipe(num(), clamp(10, 20));
 * const result = schema.parse(25);
 * if (result.isOk()) {
 *   console.log("Clamped value:", result.unwrap()); // Outputs 20
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function clamp(min: number, max: number): Pipe<number> {
  return function (data) {
    return Result.Ok(Math.min(Math.max(data, min), max));
  };
}

/**
 * Creates a pipe function for validating that a number is an integer. This function checks if the given number is an integer and not a floating-point number.
 *
 * @param {string} [message] - Optional custom error message for when the number is not an integer. Defaults to a generic message about the integer expectation.
 * @returns {Pipe<number>} A pipe function that validates an integer number.
 *
 * @example
 * ```ts
 * // Validating an integer
 * const schema = pipe(num(), int("Value must be an integer"));
 * const result = schema.parse(3.14);
 * if (result.isOk()) {
 *   console.log("Valid integer:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function int(message?: string): Pipe<number> {
  const msg = message ?? "Expected value to be an integer";
  return function (data) {
    if (!Number.isInteger(data)) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a number is positive. This function ensures the number is greater than zero.
 *
 * @param {string} [message] - Optional custom error message for when the number is not positive. Defaults to a message indicating the positive value requirement.
 * @returns {Pipe<number>} A pipe function that validates a positive number.
 *
 * @example
 * ```ts
 * // Validating a positive number
 * const schema = pipe(num(), positive("Value must be positive"));
 * const result = schema.parse(-10);
 * if (result.isOk()) {
 *   console.log("Valid positive number:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function positive(message?: string): Pipe<number> {
  const msg = message ?? "Expected value to be positive";
  return min(0, msg);
}

/**
 * Creates a pipe function for validating that a number is negative. This function ensures the number is less than zero.
 *
 * @param {string} [message] - Optional custom error message for when the number is not negative. Defaults to a message indicating the negative value requirement.
 * @returns {Pipe<number>} A pipe function that validates a negative number.
 *
 * @example
 * ```ts
 * // Validating a negative number
 * const schema = pipe(num(), negative("Value must be negative"));
 * const result = schema.parse(5);
 * if (result.isOk()) {
 *   console.log("Valid negative number:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function negative(message?: string): Pipe<number> {
  const msg = message ?? "Expected value to be negative";
  return max(0, msg);
}

/**
 * Creates a pipe function for validating that a number falls within a specified range, inclusive of the minimum and maximum values.
 *
 * @param {number} min - The minimum value of the range.
 * @param {number} max - The maximum value of the range.
 * @param {string} [message] - Optional custom error message for when the number is outside the specified range. Defaults to a message indicating the expected range and the actual value.
 * @returns {Pipe<number>} A pipe function that validates a number is within the specified range.
 *
 * @example
 * ```ts
 * // Validating a number within a range
 * const ageSchema = pipe(num(), range(18, 65, "Age must be between 18 and 65"));
 * const result = ageSchema.parse(70);
 * if (result.isOk()) {
 *   console.log("Valid age:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function range(
  min: number,
  max: number,
  message?: string,
): Pipe<number> {
  return function (data) {
    if (data < min || data > max) {
      const msg = message ??
        `Expected value to be in range ${min} - ${max}, but got ${data}`;
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a Date object represents a date before a specified date.
 *
 * @param {Date} date - The date that the input date must be before.
 * @param {string} [message] - Optional custom error message for when the input date is not before the specified date. Defaults to a message indicating the expected constraint and the specified date.
 * @returns {Pipe<Date>} A pipe function that validates a Date object is before the specified date.
 *
 * @example
 * ```ts
 * // Validating a date is before another date
 * const deadline = new Date('2023-12-31');
 * const dateSchema = pipe(date(), before(deadline, "Date must be before the end of 2023"));
 * const result = dateSchema.parse(new Date('2024-01-01'));
 * if (result.isOk()) {
 *   console.log("Valid date:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function before(date: Date, message?: string): Pipe<Date> {
  const msg = message ?? `Expected date to be before ${date.toISOString()}`;
  return function (data) {
    if (data >= date) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a Date object represents a date after a specified date.
 *
 * @param {Date} date - The date that the input date must be after.
 * @param {string} [message] - Optional custom error message for when the input date is not after the specified date. Defaults to a message indicating the expected constraint and the specified date.
 * @returns {Pipe<Date>} A pipe function that validates a Date object is after the specified date.
 *
 * @example
 * ```ts
 * // Validating a date is after another date
 * const releaseDate = new Date('2023-01-01');
 * const dateSchema = pipe(date(), after(releaseDate, "Date must be after the release date"));
 * const result = dateSchema.parse(new Date('2022-12-31'));
 * if (result.isOk()) {
 *   console.log("Valid date:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function after(date: Date, message?: string): Pipe<Date> {
  const msg = message ?? `Expected date to be after ${date.toISOString()}`;
  return function (data) {
    if (data <= date) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

/**
 * Creates a pipe function for validating that a Date object falls between two specified dates, inclusive of the start and end dates.
 *
 * @param {Date} start - The start date of the permissible range.
 * @param {Date} end - The end date of the permissible range.
 * @param {string} [message] - Optional custom error message for when the date does not fall within the specified range. Defaults to a message indicating the expected date range.
 * @returns {Pipe<Date>} A pipe function that validates a Date object falls within the specified range.
 *
 * @example
 * ```ts
 * // Validating a date is within a specific range
 * const startDate = new Date('2023-01-01');
 * const endDate = new Date('2023-12-31');
 * const dateSchema = pipe(date(), between(startDate, endDate, "Date must be within the year 2023"));
 * const result = dateSchema.parse(new Date('2023-06-15'));
 * if (result.isOk()) {
 *   console.log("Valid date:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function between(
  start: Date,
  end: Date,
  message?: string,
): Pipe<Date> {
  const msg = message ??
    `Expected date to be between ${start.toISOString()} and ${end.toISOString()}`;
  return function (data) {
    if (data < start || data > end) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Creates a pipe function for validating that a string is a well-formed email address. This function checks the string against a regular expression pattern that conforms to most common email address formats.
 *
 * @param {string} [message] - Optional custom error message for when the string is not a valid email address. Defaults to a generic message about email address expectations.
 * @returns {Pipe<string>} A pipe function that validates an email address format.
 *
 * @example
 * ```ts
 * // Validating an email address
 * const emailSchema = pipe(str(), email("Invalid email format"));
 * const result = emailSchema.parse("user@example.com");
 * if (result.isOk()) {
 *   console.log("Valid email:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function email(message?: string): Pipe<string> {
  const msg = message ?? "Expected value to be a valid email address";
  return function (data) {
    if (data.length > 320 || !EMAIL_REGEX.test(data)) {
      return Result.Err(msg);
    }
    return Result.Ok(data);
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Creates a pipe function for validating that a string is a well-formed UUID (Universally Unique Identifier). This function checks the string against a regular expression pattern for UUID format.
 *
 * @param {string} [message] - Optional custom error message for when the string is not a valid UUID. Defaults to a generic message about UUID format expectations.
 * @returns {Pipe<string>} A pipe function that validates a UUID format.
 *
 * @example
 * ```ts
 * // Validating a UUID
 * const uuidSchema = pipe(str(), uuid("Invalid UUID format"));
 * const result = uuidSchema.parse("123e4567-e89b-12d3-a456-426614174000");
 * if (result.isOk()) {
 *   console.log("Valid UUID:", result.unwrap());
 * } else {
 *   console.log("Validation error:", result.unwrapErr().message);
 * }
 * ```
 */
export function uuid(message?: string): Pipe<string> {
  const msg = message ?? "Expected value to be a valid UUID";
  return pattern(UUID_REGEX, msg);
}
