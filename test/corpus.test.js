import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BibleCorpus } from "../src/bible/corpus.js";

test("loads and searches a local corpus without mutating source records", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bible-corpus-"));
  const versionDir = path.join(root, "demo");
  await mkdir(versionDir);
  await writeFile(path.join(versionDir, "metadata.json"), JSON.stringify({
    id: "demo",
    name: "Demo Version",
    abbreviation: "DMO",
    language: "en",
    license: "Test fixture",
    source: "Unit test"
  }));
  await writeFile(path.join(versionDir, "verses.jsonl"), [
    JSON.stringify({ version: "demo", book: "John", chapter: 3, verse: 16, text: "fixture love text" }),
    JSON.stringify({ version: "demo", book: "John", chapter: 3, verse: 17, text: "fixture sent text" })
  ].join("\n"));

  try {
    const corpus = new BibleCorpus(root);
    await corpus.load();

    assert.equal(corpus.listVersions()[0].abbreviation, "DMO");
    assert.equal(corpus.search("John 3:16")[0].text, "fixture love text");
    assert.equal(corpus.search("sent")[0].verse, 17);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("groups verse range references into one passage result per version", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bible-corpus-"));
  const versionDir = path.join(root, "demo");
  await mkdir(versionDir);
  await writeFile(path.join(versionDir, "metadata.json"), JSON.stringify({
    id: "demo",
    name: "Demo Version",
    abbreviation: "DMO",
    language: "en",
    license: "Test fixture",
    source: "Unit test"
  }));
  await writeFile(path.join(versionDir, "verses.jsonl"), [
    JSON.stringify({ version: "demo", book: "Ephesians", chapter: 5, verse: 25, text: "Husbands, love your wives." }),
    JSON.stringify({ version: "demo", book: "Ephesians", chapter: 5, verse: 26, text: "That he might sanctify and cleanse it." })
  ].join("\n"));

  try {
    const corpus = new BibleCorpus(root);
    await corpus.load();
    const results = corpus.search("Ephesians 5:25-26");

    assert.equal(results.length, 1);
    assert.equal(results[0].type, "passage");
    assert.equal(results[0].startVerse, 25);
    assert.equal(results[0].endVerse, 26);
    assert.deepEqual(results[0].verses.map((verse) => verse.verse), [25, 26]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("groups whole chapter references into one passage result per version", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bible-corpus-"));
  const versionDir = path.join(root, "demo");
  await mkdir(versionDir);
  await writeFile(path.join(versionDir, "metadata.json"), JSON.stringify({
    id: "demo",
    name: "Demo Version",
    abbreviation: "DMO",
    language: "en",
    license: "Test fixture",
    source: "Unit test"
  }));
  await writeFile(path.join(versionDir, "verses.jsonl"), [
    JSON.stringify({ version: "demo", book: "Psalms", chapter: 23, verse: 1, text: "The Lord is my shepherd." }),
    JSON.stringify({ version: "demo", book: "Psalms", chapter: 23, verse: 2, text: "He makes me lie down." }),
    JSON.stringify({ version: "demo", book: "Psalms", chapter: 24, verse: 1, text: "The earth is the Lord's." })
  ].join("\n"));

  try {
    const corpus = new BibleCorpus(root);
    await corpus.load();
    const results = corpus.search("Psalm 23");

    assert.equal(results.length, 1);
    assert.equal(results[0].type, "passage");
    assert.equal(results[0].isWholeChapter, true);
    assert.equal(results[0].startVerse, null);
    assert.deepEqual(results[0].verses.map((verse) => verse.verse), [1, 2]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("lists searchable references without exposing verse text", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bible-corpus-"));
  const versionDir = path.join(root, "demo");
  await mkdir(versionDir);
  await writeFile(path.join(versionDir, "metadata.json"), JSON.stringify({
    id: "demo",
    name: "Demo Version",
    abbreviation: "DMO",
    language: "en",
    license: "Test fixture",
    source: "Unit test"
  }));
  await writeFile(path.join(versionDir, "verses.jsonl"), [
    JSON.stringify({ version: "demo", book: "Genesis", chapter: 1, verse: 1, text: "hidden text" }),
    JSON.stringify({ version: "demo", book: "Genesis", chapter: 1, verse: 2, text: "more hidden text" }),
    JSON.stringify({ version: "demo", book: "Genesis", chapter: 50, verse: 26, text: "final hidden text" })
  ].join("\n"));

  try {
    const corpus = new BibleCorpus(root);
    await corpus.load();
    const [version] = corpus.listReferenceIndex();
    const [genesis] = version.books;

    assert.equal(genesis.first, "Genesis 1:1");
    assert.equal(genesis.last, "Genesis 50:26");
    assert.deepEqual(genesis.chapters[0].verses, [1, 2]);
    assert.equal("text" in genesis.chapters[0], false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("detects whether a reference and translation are already searchable", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "bible-corpus-"));
  const versionDir = path.join(root, "demo");
  await mkdir(versionDir);
  await writeFile(path.join(versionDir, "metadata.json"), JSON.stringify({
    id: "nasb2020",
    name: "New American Standard Bible 2020",
    abbreviation: "NASB 2020",
    language: "en",
    license: "Test fixture",
    source: "Unit test"
  }));
  await writeFile(path.join(versionDir, "verses.jsonl"),
    JSON.stringify({ version: "nasb2020", book: "Genesis", chapter: 1, verse: 1, text: "fixture text" }));

  try {
    const corpus = new BibleCorpus(root);
    await corpus.load();

    assert.equal(corpus.hasReference("Genesis 1:1", "NASB").exists, true);
    assert.equal(corpus.hasReference("Genesis 1:1", "NIV").exists, false);
    assert.equal(corpus.hasReference("Genesis 1:2", "NASB").exists, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
