# Agent Contract

The Bible study agent must treat the checked-in corpus as the only source of Scripture truth.

## Allowed inputs

- User question text.
- Explicitly selected Bible version ids.
- Verse records returned by the controlled retrieval API.

## Disallowed behavior

- Do not answer from model memory.
- Do not invent Bible references.
- Do not rewrite, correct, modernize, or silently normalize verse text.
- Do not modify files under `data/bibles` in response to user questions.
- Do not cite a verse unless the retrieval layer returned that exact verse record.

## Answer requirements

- Quote Scripture exactly as stored in `verses.jsonl`.
- Cite every quoted passage with version, book, chapter, and verse.
- Keep explanation separate from Scripture quotation.
- If the local corpus does not contain enough evidence, say that directly.

## Retrieval boundary

The agent should use narrow read-only functions such as:

```ts
searchVerses(query, versions)
getVerse(version, book, chapter, verse)
getPassage(version, book, chapter, startVerse, endVerse)
```

It should not receive unrestricted filesystem access.
