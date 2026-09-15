import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_BOOKS } from "../src/bible/books.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const abbreviation = process.argv[2] ?? "KJV";
const sourceFile = path.resolve(process.argv[3] ?? path.join(rootDir, "imports", "bible-data-en-eng", "data", "en___eng___eng", `${abbreviation}_vid_1.json`));
const outputId = process.argv[4] ?? `${abbreviation.toLowerCase()}-mrk214`;
const outputDir = path.join(rootDir, "data", "bibles", outputId);
const canonicalBookSet = new Set(CANONICAL_BOOKS);

const bible = JSON.parse(await readFile(sourceFile, "utf8"));

if (abbreviation !== "KJV") {
  throw new Error("This importer is currently limited to KJV. Other translations in this source repo need explicit rights review before local corpus import.");
}

const verses = extractVerses(bible, outputId);

await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, "metadata.json"), `${JSON.stringify({
  id: outputId,
  name: `${bible.local_title} (mrk214 source)`,
  abbreviation: "KJV-MRK",
  language: bible.language?.iso_639_1 ?? "en",
  license: bible.copyright?.text ?? "KJV rights vary by jurisdiction; source repository license is MIT.",
  source: "mrk214/bible-data-en-eng",
  sourceUrl: "https://github.com/mrk214/bible-data-en-eng",
  importedAt: new Date().toISOString()
}, null, 2)}\n`);
await writeFile(path.join(outputDir, "verses.jsonl"), `${verses.map((verse) => JSON.stringify(verse)).join("\n")}\n`);

console.log(`Imported ${verses.length} ${abbreviation} verses into ${outputDir}`);

function extractVerses(bible, version) {
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
          version,
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

function normalizeBookName(bookName) {
  if (bookName === "Psalm") {
    return "Psalms";
  }

  if (bookName === "Song of Songs") {
    return "Song of Solomon";
  }

  return bookName;
}
