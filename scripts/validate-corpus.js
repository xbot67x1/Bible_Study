import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_BOOKS } from "../src/bible/books.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const bibleRoot = path.join(rootDir, "data", "bibles");
const manifestPath = path.join(rootDir, "data", "checksums.json");
const canonicalBookSet = new Set(CANONICAL_BOOKS);

const manifest = {
  generatedAt: new Date().toISOString(),
  versions: []
};

let failures = 0;

try {
  const entries = await readdir(bibleRoot, { withFileTypes: true });
  const versionDirs = entries.filter((entry) => entry.isDirectory());

  for (const entry of versionDirs) {
    await validateVersion(entry.name);
  }

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
} catch (error) {
  fail(error.message);
}

if (failures > 0) {
  console.error(`Corpus validation failed with ${failures} issue${failures === 1 ? "" : "s"}.`);
  process.exit(1);
}

console.log(`Corpus validation passed for ${manifest.versions.length} version${manifest.versions.length === 1 ? "" : "s"}.`);

async function validateVersion(dirName) {
  const versionDir = path.join(bibleRoot, dirName);
  const metadataPath = path.join(versionDir, "metadata.json");
  const versesPath = path.join(versionDir, "verses.jsonl");

  const metadata = await readJson(metadataPath);
  const rawVerses = await readFile(versesPath, "utf8");
  const checksum = createHash("sha256").update(rawVerses).digest("hex");
  const seen = new Set();
  let verseCount = 0;

  requireString(metadata.id, `${dirName}/metadata.json id`);
  requireString(metadata.name, `${dirName}/metadata.json name`);
  requireString(metadata.abbreviation, `${dirName}/metadata.json abbreviation`);
  requireString(metadata.license, `${dirName}/metadata.json license`);
  requireString(metadata.source, `${dirName}/metadata.json source`);

  for (const [index, line] of rawVerses.split(/\r?\n/).entries()) {
    if (!line.trim()) {
      continue;
    }

    let verse;
    try {
      verse = JSON.parse(line);
    } catch (error) {
      fail(`${dirName}/verses.jsonl:${index + 1} is not valid JSON: ${error.message}`);
      continue;
    }

    verseCount += 1;
    validateVerse(dirName, index + 1, metadata.id, verse, seen);
  }

  if (Number.isInteger(metadata.verseLimit) && verseCount > metadata.verseLimit) {
    fail(`${dirName} contains ${verseCount} verses, exceeding declared limit ${metadata.verseLimit}.`);
  }

  manifest.versions.push({
    id: metadata.id,
    abbreviation: metadata.abbreviation,
    verseCount,
    checksum
  });
}

function validateVerse(dirName, line, versionId, verse, seen) {
  const prefix = `${dirName}/verses.jsonl:${line}`;

  if (verse.version !== versionId) {
    fail(`${prefix} version must match metadata id "${versionId}".`);
  }

  if (!canonicalBookSet.has(verse.book)) {
    fail(`${prefix} book "${verse.book}" is not a canonical Protestant book name.`);
  }

  if (!Number.isInteger(verse.chapter) || verse.chapter < 1) {
    fail(`${prefix} chapter must be a positive integer.`);
  }

  if (!Number.isInteger(verse.verse) || verse.verse < 1) {
    fail(`${prefix} verse must be a positive integer.`);
  }

  if (typeof verse.text !== "string") {
    fail(`${prefix} text must be a string.`);
  }

  if (typeof verse.text === "string" && verse.text.trim() === "" && verse.isOmitted !== true) {
    fail(`${prefix} empty text must be marked with isOmitted: true.`);
  }

  const id = `${verse.version}:${verse.book}:${verse.chapter}:${verse.verse}`;
  if (seen.has(id)) {
    fail(`${prefix} duplicate verse id ${id}.`);
  }
  seen.add(id);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${label} must be a non-empty string.`);
  }
}

function fail(message) {
  failures += 1;
  console.error(message);
}
