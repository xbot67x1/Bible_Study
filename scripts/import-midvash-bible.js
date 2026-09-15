import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_BOOKS } from "../src/bible/books.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const versionSlug = process.argv[2] ?? "kjv";
const sourceVersionDir = path.resolve(process.argv[3] ?? path.join(rootDir, "imports", "bible-data", "versions", "en", versionSlug));
const outputDir = path.join(rootDir, "data", "bibles", versionSlug);
const canonicalBookSet = new Set(CANONICAL_BOOKS);

const metadata = JSON.parse(await readFile(path.join(sourceVersionDir, "metadata.json"), "utf8"));
const bible = JSON.parse(await readFile(path.join(sourceVersionDir, `${versionSlug}.json`), "utf8"));
const verses = extractVerses(bible);

if (Number.isInteger(metadata.stats?.verses) && verses.length !== metadata.stats.verses) {
  throw new Error(`Expected ${metadata.stats.verses} verses from metadata, imported ${verses.length}.`);
}

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "metadata.json"), `${JSON.stringify({
  id: metadata.slug,
  name: metadata.name,
  abbreviation: metadata.shortName,
  language: metadata.language,
  license: metadata.licenseNote ?? metadata.license,
  source: "midvash/bible-data",
  sourceUrl: `https://github.com/midvash/bible-data/tree/main/versions/en/${metadata.slug}`,
  importedAt: new Date().toISOString()
}, null, 2)}\n`);
await writeFile(path.join(outputDir, "verses.jsonl"), `${verses.map((verse) => JSON.stringify(verse)).join("\n")}\n`);

console.log(`Imported ${verses.length} ${metadata.shortName} verses into ${outputDir}`);

function extractVerses(bible) {
  const records = [];

  for (const book of bible.books ?? []) {
    const bookName = book.englishName;
    if (!canonicalBookSet.has(bookName)) {
      throw new Error(`Unsupported book name: ${bookName}`);
    }

    for (const chapter of book.chapters ?? []) {
      for (const verse of chapter.verses ?? []) {
        records.push({
          version: versionSlug,
          book: bookName,
          chapter: chapter.chapter,
          verse: verse.number,
          text: verse.text
        });
      }
    }
  }

  return records;
}
