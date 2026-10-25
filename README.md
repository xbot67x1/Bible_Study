# Bible Study Agent

A local-first Bible study application that answers questions only from Bible versions stored in this repository.

## Design goals

- Bible source files are treated as immutable truth.
- The UI and agent can only read Scripture through controlled lookup/search APIs.
- Every verse record is versioned, cited, and validated.
- Generated indexes and notes are kept separate from canonical Bible text.
- If the local files do not support an answer, the app should say so.

## Run locally

```powershell
npm run dev
```

Then open `http://localhost:5173`.

## Enable ChatGPT chat

The Chat page uses the OpenAI Responses API. Keep the API key on the server by setting it as an environment variable before starting the app:

```powershell
$env:OPENAI_API_KEY="your-api-key"
npm run dev
```

The default model is `gpt-5.5`. To use another model available to your OpenAI project, also set `OPENAI_MODEL`. On Railway, add both values as service variables instead of putting them in the repository.

## Add Bible versions

Create one folder per Bible version:

```text
data/bibles/kjv/
  metadata.json
  verses.jsonl
```

`metadata.json`:

```json
{
  "id": "kjv",
  "name": "King James Version",
  "abbreviation": "KJV",
  "language": "en",
  "license": "Public Domain",
  "source": "Describe the exact source used",
  "sourceUrl": "https://example.com/source",
  "importedAt": "2026-09-12T00:00:00.000Z"
}
```

`verses.jsonl` contains one verse per line:

```json
{"version":"kjv","book":"John","chapter":3,"verse":16,"text":"..."}
```

Run validation after adding or changing Bible files:

```powershell
npm run validate
```

For production-quality accuracy, import from a trusted source file and commit both the source metadata and generated checksum manifest.

## Import World English Bible JSON

Clone or download `https://github.com/TehShrike/world-english-bible`, then run:

```powershell
npm run import:web -- C:\path\to\world-english-bible\json
npm run validate
```

## Import KJV from Midvash bible-data

Clone or download `https://github.com/midvash/bible-data`, then run:

```powershell
npm run import:kjv
npm run validate
```

The importer expects the repo at `imports/bible-data` by default. To use another folder:

```powershell
npm run import:midvash -- kjv C:\path\to\bible-data\versions\en\kjv
```

## Import KJV from mrk214 bible-data-en-eng

Clone or download `https://github.com/mrk214/bible-data-en-eng`, then run:

```powershell
npm run import:mrk214:kjv
npm run validate
```

This imports only KJV from that repository as `kjv-mrk214`. The same source repository includes copyrighted modern translations, but those are intentionally not imported without a separate rights review.

## Import NASB 2020 impact subset

The NASB importer stores a maximum of 1,000 selected verses and refuses to import a complete book.

```powershell
npm run import:nasb1000
npm run validate
```

This creates `data/bibles/nasb2020-impact`. The app displays the required Lockman Foundation copyright notice when this version is loaded.

If the repo is cloned inside this project at `imports/world-english-bible`, the path argument is optional:

```powershell
npm run import:web
npm run validate
```
