import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_BOOKS } from "../src/bible/books.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceJsonDir = path.resolve(process.argv[2] ?? path.join(rootDir, "imports", "world-english-bible", "json"));
const outputDir = path.join(rootDir, "data", "bibles", "web");
const canonicalBookSet = new Set(CANONICAL_BOOKS);

await mkdir(outputDir, { recursive: true });

const metadata = {
  id: "web",
  name: "World English Bible",
  abbreviation: "WEB",
  language: "en",
  license: "Public Domain; World English Bible is a trademark of eBible.org",
  source: "TehShrike/world-english-bible JSON files derived from eBible.org World English Bible",
  sourceUrl: "https://github.com/TehShrike/world-english-bible",
  importedAt: new Date().toISOString()
};

const verses = [];
const files = await readdir(sourceJsonDir);

for (const book of CANONICAL_BOOKS) {
  const fileName = `${book.toLowerCase().replaceAll(" ", "")}.json`;
  if (!files.includes(fileName)) {
    throw new Error(`Missing expected WEB source file: ${fileName}`);
  }

  const source = JSON.parse(await readFile(path.join(sourceJsonDir, fileName), "utf8"));
  verses.push(...extractVerses(book, source));
}

await writeFile(path.join(outputDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(path.join(outputDir, "verses.jsonl"), `${verses.map((verse) => JSON.stringify(verse)).join("\n")}\n`);

console.log(`Imported ${verses.length} WEB verses into ${outputDir}`);

function extractVerses(book, source) {
  if (!canonicalBookSet.has(book)) {
    return [];
  }

  const verseParts = new Map();

  for (const item of source) {
    if (!isVerseText(item)) {
      continue;
    }

    const key = `${item.chapterNumber}:${item.verseNumber}`;
    const existing = verseParts.get(key) ?? {
      version: "web",
      book,
      chapter: item.chapterNumber,
      verse: item.verseNumber,
      text: "",
      sourceSections: []
    };

    existing.text += item.value;
    existing.sourceSections.push(item.sectionNumber);
    verseParts.set(key, existing);
  }

  return Array.from(verseParts.values()).map((verse) => ({
    ...verse,
    isOmitted: verse.text.trim() === "",
    sourceSections: Array.from(new Set(verse.sourceSections))
  }));
}

function isVerseText(item) {
  return (item.type === "paragraph text" || item.type === "line text")
    && Number.isInteger(item.chapterNumber)
    && Number.isInteger(item.verseNumber)
    && typeof item.value === "string";
}
