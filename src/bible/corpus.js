import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CANONICAL_BOOKS } from "./books.js";
import { parseReference } from "./reference-parser.js";

const DEFAULT_LIMIT = 25;

export class BibleCorpus {
  constructor(rootDir) {
    this.rootDir = rootDir;
    this.versions = [];
    this.verses = [];
    this.versionById = new Map();
  }

  async load() {
    this.versions = [];
    this.verses = [];
    this.versionById = new Map();

    let entries = [];
    try {
      entries = await readdir(this.rootDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const entry of entries.filter((item) => item.isDirectory())) {
      await this.loadVersion(entry.name);
    }
  }

  async loadVersion(versionDirName) {
    const versionDir = path.join(this.rootDir, versionDirName);
    const metadataPath = path.join(versionDir, "metadata.json");
    const versesPath = path.join(versionDir, "verses.jsonl");

    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    const rawVerses = await readFile(versesPath, "utf8");
    const checksum = createHash("sha256").update(rawVerses).digest("hex");
    const version = { ...metadata, checksum };

    this.versions.push(version);
    this.versionById.set(version.id, version);

    for (const [index, line] of rawVerses.split(/\r?\n/).entries()) {
      if (!line.trim()) {
        continue;
      }

      const verse = JSON.parse(line);
      this.verses.push({
        id: `${verse.version}:${verse.book}:${verse.chapter}:${verse.verse}`,
        line: index + 1,
        abbreviation: version.abbreviation,
        ...verse
      });
    }
  }

  listVersions() {
    return this.versions.map(({ id, name, abbreviation, language, license, source, sourceUrl, checksum, copyrightNotice, copyrightUrl, verseLimit, selectionMethod }) => ({
      id,
      name,
      abbreviation,
      language,
      license,
      source,
      sourceUrl,
      checksum,
      copyrightNotice,
      copyrightUrl,
      verseLimit,
      selectionMethod
    }));
  }

  listReferenceIndex() {
    return this.versions.map((version) => {
      const versionVerses = this.verses.filter((verse) => verse.version === version.id);
      const books = new Map();

      for (const verse of versionVerses) {
        const chapters = books.get(verse.book) ?? new Map();
        const verses = chapters.get(verse.chapter) ?? [];
        verses.push(verse.verse);
        chapters.set(verse.chapter, verses);
        books.set(verse.book, chapters);
      }

      return {
        id: version.id,
        name: version.name,
        abbreviation: version.abbreviation,
        count: versionVerses.length,
        books: Array.from(books.entries())
          .toSorted(([bookA], [bookB]) => bookOrder(bookA) - bookOrder(bookB) || bookA.localeCompare(bookB))
          .map(([book, chapters]) => {
            const chapterList = Array.from(chapters.entries())
              .toSorted(([chapterA], [chapterB]) => chapterA - chapterB)
              .map(([chapter, verses]) => ({
                chapter,
                verses: Array.from(new Set(verses)).toSorted((a, b) => a - b)
              }));
            const firstChapter = chapterList[0];
            const lastChapter = chapterList.at(-1);

            return {
              name: book,
              count: chapterList.reduce((total, chapter) => total + chapter.verses.length, 0),
              first: `${book} ${firstChapter.chapter}:${firstChapter.verses[0]}`,
              last: `${book} ${lastChapter.chapter}:${lastChapter.verses.at(-1)}`,
              chapters: chapterList
            };
          })
      };
    });
  }

  hasReference(query, translation) {
    const reference = parseReference(query);
    if (!reference || reference.startVerse === null) {
      return { exists: false, recognizedReference: Boolean(reference), normalizedReference: null, versions: [] };
    }

    const matchingVersions = this.versions.filter((version) => versionMatchesTranslation(version, translation));
    const matchedVersions = matchingVersions.filter((version) => this.verses.some((verse) => (
      verse.version === version.id
      && verse.book === reference.book
      && verse.chapter === reference.chapter
      && verse.verse >= reference.startVerse
      && verse.verse <= reference.endVerse
    )));
    const normalizedReference = reference.endVerse > reference.startVerse
      ? `${reference.book} ${reference.chapter}:${reference.startVerse}-${reference.endVerse}`
      : `${reference.book} ${reference.chapter}:${reference.startVerse}`;

    return {
      exists: matchedVersions.length > 0,
      recognizedReference: true,
      normalizedReference,
      versions: matchedVersions.map(({ id, abbreviation, name }) => ({ id, abbreviation, name }))
    };
  }

  search(query, options = {}) {
    const selectedVersions = new Set(options.versions?.length ? options.versions : this.versions.map((version) => version.id));
    const limit = Math.min(Number(options.limit) || DEFAULT_LIMIT, 100);
    const reference = parseReference(query);
    const candidateVerses = this.verses.filter((verse) => selectedVersions.has(verse.version));

    if (reference) {
      const referenceMatches = candidateVerses
        .filter((verse) => verse.book === reference.book && verse.chapter === reference.chapter)
        .filter((verse) => reference.startVerse === null || (verse.verse >= reference.startVerse && verse.verse <= reference.endVerse));

      if (reference.startVerse === null || reference.endVerse > reference.startVerse) {
        return groupPassageResults(referenceMatches, reference);
      }

      return referenceMatches.slice(0, limit);
    }

    const tokens = tokenize(query);
    if (tokens.length === 0) {
      return [];
    }

    return candidateVerses
      .map((verse) => ({ verse, score: scoreVerse(verse, tokens) }))
      .filter((match) => match.score > 0)
      .toSorted((a, b) => b.score - a.score || a.verse.book.localeCompare(b.verse.book) || a.verse.chapter - b.verse.chapter || a.verse.verse - b.verse.verse)
      .slice(0, limit)
      .map((match) => match.verse);
  }
}

function bookOrder(book) {
  const index = CANONICAL_BOOKS.indexOf(book);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function versionMatchesTranslation(version, translation) {
  const requested = normalizeTranslation(translation);
  if (!requested) {
    return false;
  }

  return [version.id, version.abbreviation, version.name].some((value) => {
    const normalized = normalizeTranslation(value);
    return normalized === requested || normalized.startsWith(requested) || requested.startsWith(normalized);
  });
}

function normalizeTranslation(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function tokenize(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function scoreVerse(verse, tokens) {
  const haystack = `${verse.book} ${verse.chapter} ${verse.verse} ${verse.text}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function groupPassageResults(verses, reference) {
  const grouped = new Map();

  for (const verse of verses) {
    const existing = grouped.get(verse.version) ?? {
      id: passageId(verse.version, reference),
      type: "passage",
      abbreviation: verse.abbreviation,
      version: verse.version,
      book: reference.book,
      chapter: reference.chapter,
      startVerse: reference.startVerse,
      endVerse: reference.endVerse,
      isWholeChapter: reference.startVerse === null,
      verses: []
    };

    existing.verses.push(verse);
    grouped.set(verse.version, existing);
  }

  return Array.from(grouped.values()).map((passage) => ({
    ...passage,
    verses: passage.verses.toSorted((a, b) => a.verse - b.verse)
  }));
}

function passageId(version, reference) {
  if (reference.startVerse === null) {
    return `${version}:${reference.book}:${reference.chapter}`;
  }

  return `${version}:${reference.book}:${reference.chapter}:${reference.startVerse}-${reference.endVerse}`;
}
