import test from "node:test";
import assert from "node:assert/strict";
import { parseReference } from "../src/bible/reference-parser.js";

test("parses a single verse reference", () => {
  assert.deepEqual(parseReference("Please show John 3:16"), {
    book: "John",
    chapter: 3,
    startVerse: 16,
    endVerse: 16
  });
});

test("parses a verse range", () => {
  assert.deepEqual(parseReference("Romans 8:28-30"), {
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 30
  });
});

test("parses a whole chapter reference", () => {
  assert.deepEqual(parseReference("Genesis 1"), {
    book: "Genesis",
    chapter: 1,
    startVerse: null,
    endVerse: null
  });
});
