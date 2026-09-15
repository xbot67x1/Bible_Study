import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_BOOKS } from "../src/bible/books.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceFile = path.resolve(process.argv[2] ?? path.join(rootDir, "imports", "bible-data-en-eng", "data", "en___eng___eng", "NASB2020_vid_2692.json"));
const outputDir = path.join(rootDir, "data", "bibles", "nasb2020-impact");
const LIMIT = 1000;
const canonicalBookSet = new Set(CANONICAL_BOOKS);

const bible = JSON.parse(await readFile(sourceFile, "utf8"));
const allVerses = extractVerses(bible);

function extractVerses(bible) {
  const records = [];

  for (const book of bible.books ?? []) {
    const bookName = normalizeBookName(book.name);
    if (!canonicalBookSet.has(bookName)) {
      throw new Error(`Unsupported book name: ${book.name}`);
    }

    for (const chapter of book.chapters ?? []) {
      const chapterNumber = Number(chapter.current?.usfm?.split(".")[1] ?? chapter.chapter_usfm?.split(".")[1]);
      const chapterVerses = new Map();

      for (const item of chapter.items ?? []) {
        if (item.type !== "verse") {
          continue;
        }

        const verseNumbers = item.verse_numbers ?? [];
        const text = item.lines?.join(" ") ?? "";
        for (const verseNumber of verseNumbers) {
          const existing = chapterVerses.get(verseNumber);
          chapterVerses.set(verseNumber, existing ? `${existing} ${text}` : text);
        }
      }

      for (const [verseNumber, text] of chapterVerses) {
        records.push({
          version: "nasb2020-impact",
          book: bookName,
          chapter: chapterNumber,
          verse: verseNumber,
          text
        });
      }
    }
  }

  return records;
}

function selectImpactfulVerses(verses) {
  return verses
    .map((verse, index) => ({ verse, index, score: impactScore(verse) }))
    .filter((match) => match.score > 0)
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, LIMIT)
    .map((match) => match.verse)
    .toSorted(compareCanonically);
}

function impactScore(verse) {
  const text = verse.text.toLowerCase();
  const reference = `${verse.book} ${verse.chapter}:${verse.verse}`;
  let score = ANCHOR_REFERENCES.has(reference) ? 100 : 0;

  for (const [word, weight] of KEYWORD_WEIGHTS) {
    if (text.includes(word)) {
      score += weight;
    }
  }

  if (verse.book === "Psalms" || verse.book === "Proverbs" || verse.book === "Isaiah" || verse.book === "John" || verse.book === "Romans") {
    score += 4;
  }

  if (verse.book === "Matthew" || verse.book === "Luke" || verse.book === "Ephesians" || verse.book === "Philippians") {
    score += 3;
  }

  return score;
}

function assertPermissionBounds(selected, allVerses) {
  if (selected.length > LIMIT) {
    throw new Error(`NASB subset exceeds ${LIMIT} verses.`);
  }

  const selectedByBook = countByBook(selected);
  const allByBook = countByBook(allVerses);
  for (const [book, count] of selectedByBook) {
    if (count >= allByBook.get(book)) {
      throw new Error(`NASB subset includes the complete book of ${book}.`);
    }
  }
}

function countByBook(verses) {
  const counts = new Map();
  for (const verse of verses) {
    counts.set(verse.book, (counts.get(verse.book) ?? 0) + 1);
  }
  return counts;
}

function compareCanonically(a, b) {
  return CANONICAL_BOOKS.indexOf(a.book) - CANONICAL_BOOKS.indexOf(b.book)
    || a.chapter - b.chapter
    || a.verse - b.verse;
}

function normalizeBookName(bookName) {
  if (bookName === "Psalm") {
    return "Psalms";
  }

  if (bookName === "Song of Songs") {
    return "Song of Solomon";
  }

  return bookName;
}

const ANCHOR_REFERENCES = new Set([
  "Genesis 1:1",
  "Genesis 1:26",
  "Genesis 1:27",
  "Genesis 12:3",
  "Exodus 20:3",
  "Exodus 20:12",
  "Numbers 6:24",
  "Numbers 6:25",
  "Numbers 6:26",
  "Deuteronomy 6:4",
  "Deuteronomy 6:5",
  "Joshua 1:9",
  "1 Samuel 16:7",
  "2 Chronicles 7:14",
  "Psalms 1:1",
  "Psalms 1:2",
  "Psalms 19:1",
  "Psalms 23:1",
  "Psalms 23:4",
  "Psalms 27:1",
  "Psalms 34:8",
  "Psalms 46:1",
  "Psalms 51:10",
  "Psalms 91:1",
  "Psalms 103:1",
  "Psalms 119:105",
  "Psalms 139:14",
  "Proverbs 3:5",
  "Proverbs 3:6",
  "Proverbs 9:10",
  "Proverbs 31:10",
  "Isaiah 9:6",
  "Isaiah 40:31",
  "Isaiah 53:5",
  "Isaiah 55:8",
  "Isaiah 55:9",
  "Jeremiah 29:11",
  "Micah 6:8",
  "Matthew 5:3",
  "Matthew 5:4",
  "Matthew 5:5",
  "Matthew 5:6",
  "Matthew 5:7",
  "Matthew 5:8",
  "Matthew 5:9",
  "Matthew 5:14",
  "Matthew 5:16",
  "Matthew 6:9",
  "Matthew 6:10",
  "Matthew 6:33",
  "Matthew 11:28",
  "Matthew 22:37",
  "Matthew 22:39",
  "Matthew 28:19",
  "Matthew 28:20",
  "John 1:1",
  "John 1:14",
  "John 3:16",
  "John 8:32",
  "John 10:10",
  "John 11:25",
  "John 14:6",
  "John 15:5",
  "Romans 3:23",
  "Romans 5:8",
  "Romans 6:23",
  "Romans 8:1",
  "Romans 8:28",
  "Romans 10:9",
  "Romans 12:1",
  "1 Corinthians 13:4",
  "1 Corinthians 13:5",
  "1 Corinthians 13:6",
  "1 Corinthians 13:7",
  "2 Corinthians 5:17",
  "Galatians 2:20",
  "Galatians 5:22",
  "Galatians 5:23",
  "Ephesians 2:8",
  "Ephesians 2:9",
  "Ephesians 5:25",
  "Ephesians 5:26",
  "Ephesians 6:10",
  "Philippians 4:6",
  "Philippians 4:7",
  "Philippians 4:13",
  "Colossians 3:23",
  "1 Thessalonians 5:16",
  "1 Thessalonians 5:17",
  "1 Thessalonians 5:18",
  "2 Timothy 3:16",
  "Hebrews 4:12",
  "Hebrews 11:1",
  "Hebrews 12:1",
  "James 1:5",
  "1 Peter 5:7",
  "1 John 1:9",
  "1 John 4:7",
  "1 John 4:8",
  "Revelation 21:4"
]);

const KEYWORD_WEIGHTS = [
  ["jesus", 14],
  ["christ", 14],
  ["lord", 11],
  ["god", 10],
  ["father", 8],
  ["spirit", 8],
  ["holy", 8],
  ["love", 13],
  ["faith", 12],
  ["believe", 12],
  ["grace", 12],
  ["mercy", 10],
  ["forgive", 10],
  ["salvation", 12],
  ["saved", 10],
  ["righteous", 9],
  ["truth", 9],
  ["life", 9],
  ["eternal", 9],
  ["kingdom", 8],
  ["peace", 8],
  ["joy", 7],
  ["hope", 9],
  ["wisdom", 8],
  ["strength", 8],
  ["fear", 5],
  ["heart", 6],
  ["prayer", 7],
  ["pray", 7],
  ["sin", 7],
  ["death", 6],
  ["resurrection", 10],
  ["cross", 8],
  ["church", 6],
  ["word", 7],
  ["commandment", 6],
  ["covenant", 6],
  ["light", 6]
];

const selected = selectImpactfulVerses(allVerses);

assertPermissionBounds(selected, allVerses);

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "metadata.json"), `${JSON.stringify({
  id: "nasb2020-impact",
  name: "New American Standard Bible 2020 Impact Set",
  abbreviation: "NASB 2020",
  language: "en",
  license: "Limited quotation subset under Lockman Foundation quoted-material guidelines. Maximum 1,000 verses stored; not a complete Bible.",
  source: "mrk214/bible-data-en-eng NASB2020 JSON subset",
  sourceUrl: "https://github.com/mrk214/bible-data-en-eng",
  importedAt: new Date().toISOString(),
  verseLimit: LIMIT,
  selectionMethod: "Deterministic impact subset: anchor passages plus keyword scoring, capped at 1,000 verses.",
  copyrightNotice: "Scripture quotations taken from the (NASB®) New American Standard Bible®, Copyright © 2020 by The Lockman Foundation. Used by permission. All rights reserved. www.Lockman.org",
  copyrightUrl: "https://www.lockman.org"
}, null, 2)}\n`);
await writeFile(path.join(outputDir, "verses.jsonl"), `${selected.map((verse) => JSON.stringify(verse)).join("\n")}\n`);

console.log(`Imported ${selected.length} NASB 2020 verses into ${outputDir}`);
