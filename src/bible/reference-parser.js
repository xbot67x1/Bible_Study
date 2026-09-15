import { BOOK_ALIASES, CANONICAL_BOOKS } from "./books.js";

const BOOK_PATTERN = CANONICAL_BOOKS
  .toSorted((a, b) => b.length - a.length)
  .map((book) => book.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");

const REFERENCE_PATTERN = new RegExp(`\\b(${BOOK_PATTERN}|Psalm|Song of Songs|Revelations)\\s+(\\d{1,3})(?::(\\d{1,3})(?:-(\\d{1,3}))?)?\\b`, "i");

export function parseReference(query) {
  const match = query.match(REFERENCE_PATTERN);
  if (!match) {
    return null;
  }

  const book = BOOK_ALIASES.get(match[1].toLowerCase());
  if (!book) {
    return null;
  }

  return {
    book,
    chapter: Number(match[2]),
    startVerse: match[3] ? Number(match[3]) : null,
    endVerse: match[4] ? Number(match[4]) : match[3] ? Number(match[3]) : null
  };
}
