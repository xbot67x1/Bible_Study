const versionList = document.querySelector("#versionList");
const referenceIndexEl = document.querySelector("#referenceIndex");
const referenceIndexCountEl = document.querySelector("#referenceIndexCount");
const navItems = Array.from(document.querySelectorAll("[data-page-target]"));
const pages = Array.from(document.querySelectorAll("[data-page]"));
const questionForm = document.querySelector("#questionForm");
const questionInput = document.querySelector("#question");
const resultsEl = document.querySelector("#results");
const resultCountEl = document.querySelector("#resultCount");
const copyrightNoticeEl = document.querySelector("#copyrightNotice");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatMessagesEl = document.querySelector("#chatMessages");
const chatStatusEl = document.querySelector("#chatStatus");
const sendChatButton = document.querySelector("#sendChatButton");
const newChatButton = document.querySelector("#newChatButton");
const favoritesListEl = document.querySelector("#favoritesList");
const favoriteCountEl = document.querySelector("#favoriteCount");
const favoritesFilterButtons = Array.from(document.querySelectorAll("[data-favorites-filter]"));
const addVerseButtons = Array.from(document.querySelectorAll("[data-add-verse-button]"));
const manualFavoriteForms = Array.from(document.querySelectorAll("[data-manual-favorite-form]"));
const removeFavoriteDialog = document.querySelector("#removeFavoriteDialog");
const cancelRemoveFavoriteButton = document.querySelector("#cancelRemoveFavorite");
const confirmRemoveFavoriteButton = document.querySelector("#confirmRemoveFavorite");
const removeMemorizedDialog = document.querySelector("#removeMemorizedDialog");
const cancelRemoveMemorizedButton = document.querySelector("#cancelRemoveMemorized");
const moveMemorizedToLearningButton = document.querySelector("#moveMemorizedToLearning");
const confirmRemoveMemorizedButton = document.querySelector("#confirmRemoveMemorized");
const studyForm = document.querySelector("#studyForm");
const studyNameInput = document.querySelector("#studyName");
const studyDescriptionInput = document.querySelector("#studyDescription");
const studyListEl = document.querySelector("#studyList");
const studyCountEl = document.querySelector("#studyCount");

let versions = [];
let currentResults = [];
let favorites = loadFavorites();
let manualVerses = loadManualVerses();
let studies = loadStudies();
let memorized = loadMemorized();
let learning = loadLearning();
let activeFavoritesFilter = "all";
let pendingFavoriteRemovalId = null;
let pendingMemorizedRemovalId = null;
let chatMessages = loadChatMessages();
let referenceIndex = [];
let referenceIndexLoaded = false;
let referenceIndexLoadPromise = null;

saveManualVerses();

function citationFor(result) {
  if (result.type === "manual") {
    return `${result.reference}, ${result.abbreviation}`;
  }

  const book = displayBookName(result.book);

  if (result.type === "passage") {
    if (result.isWholeChapter) {
      return `${book} ${result.chapter}, ${result.abbreviation}`;
    }

    return `${book} ${result.chapter}:${result.startVerse}-${result.endVerse}, ${result.abbreviation}`;
  }

  return `${book} ${result.chapter}:${result.verse}, ${result.abbreviation}`;
}

function displayBookName(book) {
  return book === "Psalms" ? "Psalm" : book;
}

function selectedVersions() {
  return Array.from(document.querySelectorAll("input[name='version']:checked")).map((input) => input.value);
}

function isManualCollectionSelected() {
  return document.querySelector("input[name='version'][value='manual-entry']")?.checked ?? true;
}

function selectedVersionMetadata(results = []) {
  const resultVersionIds = new Set(results.map((result) => result.version));
  return versions.filter((version) => resultVersionIds.has(version.id));
}

function renderVersions() {
  const installedVersions = versions.length > 0
    ? versions.map((version) => `
        <label class="version-option">
          <input type="checkbox" name="version" value="${version.id}" checked>
          <span>${version.abbreviation} <small>${version.name}</small></span>
        </label>
      `).join("")
    : `<p class="empty-state">No Bible versions are loaded yet. Add folders under <strong>data/bibles</strong>, then run validation.</p>`;

  versionList.innerHTML = `
    ${installedVersions}
    <label class="version-option manual-corpus-option">
      <input type="checkbox" name="version" value="manual-entry" checked>
      <span>MANUAL <small>Manual Entry</small></span>
    </label>
  `;
}

function renderResults(results, query) {
  currentResults = results;

  if (!query) {
    resultCountEl.textContent = "";
    copyrightNoticeEl.innerHTML = "";
    resultsEl.innerHTML = `<p class="empty-state">Search the local corpus and your manually added verses by reference, phrase, or keyword.</p>`;
    return;
  }

  resultCountEl.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;

  if (results.length === 0) {
    copyrightNoticeEl.innerHTML = "";
    resultsEl.innerHTML = `<p class="empty-state">No local or manually added verses matched that query.</p>`;
    return;
  }

  resultsEl.innerHTML = results.map(renderResult).join("");
  renderCopyrightNotice(selectedVersionMetadata(results));
}

function renderCopyrightNotice(activeVersions) {
  const notices = activeVersions.filter((version) => version.copyrightNotice);

  if (notices.length === 0) {
    copyrightNoticeEl.innerHTML = "";
    return;
  }

  copyrightNoticeEl.innerHTML = notices.map((version) => `
    <p>${escapeHtml(version.copyrightNotice).replace("www.Lockman.org", `<a href="${escapeHtml(version.copyrightUrl ?? "https://www.lockman.org")}" target="_blank" rel="noreferrer">www.Lockman.org</a>`)}</p>
  `).join("");
}

function renderResult(result) {
  const isFavorite = favorites.has(result.id);
  const isLearning = learning.has(result.id);
  const isMemorized = memorized.has(result.id);

  if (result.type === "passage") {
    return `
      <article class="verse">
        <blockquote class="passage">${result.verses.map(renderPassageVerse).join(" ")}</blockquote>
        <div class="citation">${escapeHtml(citationFor(result))}</div>
        ${renderFavoriteButton(result.id, isFavorite, result.type === "manual", isLearning, isMemorized)}
      </article>
    `;
  }

  return `
    <article class="verse">
      ${result.isOmitted ? `<p class="omitted">This verse number is present in the source data, but the ${escapeHtml(result.abbreviation)} text is omitted.</p>` : `<blockquote>${renderVerseText(result)}</blockquote>`}
      <div class="citation">${escapeHtml(citationFor(result))}</div>
      ${renderFavoriteButton(result.id, isFavorite, result.type === "manual", isLearning, isMemorized)}
    </article>
  `;
}

function renderVerseText(result) {
  return result.type === "manual"
    ? formatManualVerseText(result.text, result.reference)
    : escapeHtml(result.text);
}

function formatManualVerseText(text, reference) {
  const range = String(reference).match(/:(\d+)(?:-(\d+))?$/);
  const expectedNumbers = new Set();
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2] ?? range[1]);
    for (let verse = start; verse <= end && verse - start < 200; verse += 1) {
      expectedNumbers.add(String(verse));
    }
  }

  const source = String(text ?? "");
  const markerPattern = /(^|\s)(\d{1,3})(?=[.)]?\s)/g;
  const seen = new Set();
  let output = "";
  let lastIndex = 0;
  let match;

  while ((match = markerPattern.exec(source)) !== null) {
    const [fullMatch, prefix, number] = match;
    const isLineStart = match.index === 0 || /[\r\n]/.test(prefix);
    const isExpected = expectedNumbers.has(number) && !seen.has(number);
    if (!isExpected && !(expectedNumbers.size === 0 && isLineStart)) {
      continue;
    }

    output += escapeHtml(source.slice(lastIndex, match.index));
    output += `${escapeHtml(prefix)}<span class="verse-number">${escapeHtml(number)}</span>`;
    lastIndex = match.index + fullMatch.length;
    seen.add(number);
  }

  output += escapeHtml(source.slice(lastIndex));
  return output.replace(/\r?\n/g, "<br>");
}

function stripManualVerseNumbers(text, reference) {
  const range = String(reference).match(/:(\d+)(?:-(\d+))?$/);
  if (!range) {
    return String(text ?? "");
  }

  const start = Number(range[1]);
  const end = Number(range[2] ?? range[1]);
  const expectedNumbers = new Set();
  for (let verse = start; verse <= end && verse - start < 200; verse += 1) {
    expectedNumbers.add(String(verse));
  }

  const seen = new Set();
  return String(text ?? "").replace(/(^|\s)(\d{1,3})(?=[.)]?\s)/g, (fullMatch, prefix, number) => {
    if (!expectedNumbers.has(number) || seen.has(number)) {
      return fullMatch;
    }
    seen.add(number);
    return prefix;
  });
}

function renderFavoriteButton(resultId, isFavorite, isManual = false, isLearning = false, isMemorized = false) {
  const memorizeState = isMemorized ? "memorized" : isLearning ? "learning" : "none";
  const memorizeLabel = isMemorized
    ? "Clear memorization status"
    : isLearning
      ? "Mark as memorized"
      : "Mark as learning";
  const memorizeTitle = isMemorized ? "Memorized" : isLearning ? "Learning" : "Start learning";

  return `
    <div class="verse-actions">
      ${isManual ? `<span class="manual-tag">manual</span>` : ""}
      <button
        class="memorize-button${isLearning ? " learning" : ""}${isMemorized ? " active" : ""}"
        type="button"
        data-memorize-id="${escapeHtml(resultId)}"
        data-memorize-state="${memorizeState}"
        aria-label="${memorizeLabel}"
        title="${memorizeTitle}"
      >
        <span class="brain-icon" aria-hidden="true"></span>
      </button>
      <button
        class="favorite-button${isFavorite ? " active" : ""}"
        type="button"
        data-favorite-id="${escapeHtml(resultId)}"
        aria-label="${isFavorite ? "Remove from favorites" : "Save to favorites"}"
        title="${isFavorite ? "Remove from favorites" : "Save to favorites"}"
      ><span class="favorite-star" aria-hidden="true">${isFavorite ? "★" : "☆"}</span></button>
    </div>
  `;
}

function renderPassageVerse(verse) {
  if (verse.isOmitted) {
    return `<span class="passage-verse"><span class="verse-number">${verse.verse}</span><span class="omitted-inline">omitted</span></span>`;
  }

  return `<span class="passage-verse"><span class="verse-number">${verse.verse}</span>${escapeHtml(verse.text.trim())}</span>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function showPage(pageName) {
  for (const page of pages) {
    page.classList.toggle("active", page.dataset.page === pageName);
  }

  for (const item of navItems) {
    const isActive = item.dataset.pageTarget === pageName;
    item.classList.toggle("active", isActive);
    if (isActive) {
      item.setAttribute("aria-current", "page");
    } else {
      item.removeAttribute("aria-current");
    }
  }

  if (pageName === "favorites") {
    renderFavorites();
  }

  if (pageName === "chat") {
    renderChatMessages();
    chatInput.focus();
  }

  if (pageName === "study") {
    renderStudies();
  }

  if (pageName === "settings") {
    loadReferenceIndex();
  }
}

async function loadVersions() {
  const response = await fetch("/api/versions");
  if (!response.ok) {
    throw new Error("Unable to load Bible versions.");
  }

  versions = await response.json();
  renderVersions();
  renderResults([], "");
}

async function loadReferenceIndex({ render = true } = {}) {
  if (referenceIndexLoaded) {
    if (render) {
      renderReferenceIndex();
    }
    return;
  }

  if (render) {
    referenceIndexEl.innerHTML = `<p class="empty-state">Loading searchable verse references…</p>`;
  }

  try {
    if (!referenceIndexLoadPromise) {
      referenceIndexLoadPromise = fetch("/api/references").then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load the searchable verse index.");
        }

        const payload = await response.json();
        referenceIndex = payload.versions ?? [];
        referenceIndexLoaded = true;
      });
    }

    await referenceIndexLoadPromise;
    if (render) {
      renderReferenceIndex();
    }
  } catch (error) {
    referenceIndexLoadPromise = null;
    if (render) {
      referenceIndexEl.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
    }
  }
}

function referenceCatalogBooks() {
  const books = new Map();

  for (const version of referenceIndex) {
    for (const book of version.books) {
      const existing = books.get(book.name);
      if (!existing || book.count > existing.count) {
        books.set(book.name, book);
      }
    }
  }

  return Array.from(books.values());
}

function getReferenceSuggestions(value) {
  const query = value.trim().replace(/\s+/g, " ");
  if (!query) {
    return [];
  }

  const books = referenceCatalogBooks();
  const queryLower = query.toLowerCase();
  const exactBook = books
    .toSorted((a, b) => b.name.length - a.name.length)
    .find((book) => queryLower === book.name.toLowerCase() || queryLower.startsWith(`${book.name.toLowerCase()} `));

  if (!exactBook) {
    return books
      .filter((book) => book.name.toLowerCase().startsWith(queryLower))
      .slice(0, 8)
      .map((book) => ({ value: `${book.name} `, label: book.name, detail: `${book.chapters.length} chapters` }));
  }

  const remainder = query.slice(exactBook.name.length).trim();
  if (!remainder) {
    return exactBook.chapters.slice(0, 8).map((chapter) => ({
      value: `${exactBook.name} ${chapter.chapter}:1`,
      label: `${exactBook.name} ${chapter.chapter}:1`,
      detail: `${chapter.verses.length} verses in chapter ${chapter.chapter}`
    }));
  }

  const referenceMatch = remainder.match(/^(\d+)(?::(\d*))?$/);
  if (!referenceMatch) {
    return [];
  }

  const [, chapterInput, verseInput] = referenceMatch;
  const hasColon = remainder.includes(":");
  const matchingChapters = exactBook.chapters.filter((chapter) => (
    hasColon ? String(chapter.chapter) === chapterInput : String(chapter.chapter).startsWith(chapterInput)
  ));

  if (!hasColon) {
    const exactChapter = matchingChapters.find((chapter) => String(chapter.chapter) === chapterInput);
    const chapters = exactChapter ? [exactChapter] : matchingChapters;
    return chapters.slice(0, 8).map((chapter) => ({
      value: `${exactBook.name} ${chapter.chapter}:1`,
      label: `${exactBook.name} ${chapter.chapter}:1`,
      detail: `${chapter.verses.length} verses in chapter ${chapter.chapter}`
    }));
  }

  const chapter = matchingChapters[0];
  if (!chapter) {
    return [];
  }

  return chapter.verses
    .filter((verse) => String(verse).startsWith(verseInput))
    .slice(0, 8)
    .map((verse) => ({
      value: `${exactBook.name} ${chapter.chapter}:${verse}`,
      label: `${exactBook.name} ${chapter.chapter}:${verse}`,
      detail: "Verse reference"
    }));
}

function initializeReferenceAutocomplete() {
  for (const form of manualFavoriteForms) {
    const input = form.querySelector("[data-manual-reference]");
    const suggestionsEl = form.querySelector("[data-reference-suggestions]");
    let suggestions = [];
    let activeIndex = -1;

    const closeSuggestions = () => {
      suggestionsEl.hidden = true;
      suggestionsEl.innerHTML = "";
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
    };

    const chooseSuggestion = (index) => {
      const suggestion = suggestions[index];
      if (!suggestion) {
        return;
      }
      input.value = suggestion.value;
      closeSuggestions();
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    };

    const showSuggestions = async () => {
      await loadReferenceIndex({ render: false });
      suggestions = getReferenceSuggestions(input.value);
      activeIndex = -1;

      if (suggestions.length === 0) {
        closeSuggestions();
        return;
      }

      const listId = `${form.id}-reference-suggestions`;
      suggestionsEl.id = listId;
      input.setAttribute("aria-controls", listId);
      input.setAttribute("aria-expanded", "true");
      suggestionsEl.innerHTML = suggestions.map((suggestion, index) => `
        <button id="${listId}-${index}" class="reference-suggestion" type="button" role="option" data-reference-suggestion="${index}" aria-selected="false">
          <strong>${escapeHtml(suggestion.label)}</strong>
          <small>${escapeHtml(suggestion.detail)}</small>
        </button>
      `).join("");
      suggestionsEl.hidden = false;
    };

    input.addEventListener("input", showSuggestions);
    input.addEventListener("focus", showSuggestions);
    input.addEventListener("keydown", (event) => {
      if (suggestionsEl.hidden || suggestions.length === 0) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + direction + suggestions.length) % suggestions.length;
        const buttons = Array.from(suggestionsEl.querySelectorAll("[data-reference-suggestion]"));
        buttons.forEach((button, index) => button.setAttribute("aria-selected", String(index === activeIndex)));
        input.setAttribute("aria-activedescendant", buttons[activeIndex].id);
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        chooseSuggestion(activeIndex);
      } else if (event.key === "Escape") {
        closeSuggestions();
      }
    });

    suggestionsEl.addEventListener("mousedown", (event) => event.preventDefault());
    suggestionsEl.addEventListener("click", (event) => {
      const button = event.target.closest("[data-reference-suggestion]");
      if (button) {
        chooseSuggestion(Number(button.dataset.referenceSuggestion));
      }
    });
    input.addEventListener("blur", () => setTimeout(closeSuggestions, 100));
  }
}

function renderReferenceIndex() {
  const versions = [...referenceIndex, buildManualReferenceIndex()].filter((version) => version.count > 0);
  const total = versions.reduce((sum, version) => sum + version.count, 0);
  referenceIndexCountEl.textContent = `${total.toLocaleString()} reference${total === 1 ? "" : "s"}`;

  if (versions.length === 0) {
    referenceIndexEl.innerHTML = `<p class="empty-state">No searchable verse references are available.</p>`;
    return;
  }

  referenceIndexEl.innerHTML = versions.map((version, versionIndex) => `
    <details class="reference-version">
      <summary>
        <span><strong>${escapeHtml(version.abbreviation)}</strong> ${escapeHtml(version.name)}</span>
        <span>${version.count.toLocaleString()} verses</span>
      </summary>
      <div class="reference-books">
        ${version.books.map((book, bookIndex) => `
          <details class="reference-book" data-version-index="${versionIndex}" data-book-index="${bookIndex}">
            <summary>
              <span>${escapeHtml(book.name)}</span>
              <span>${escapeHtml(book.first)} – ${escapeHtml(book.last)} · ${book.count.toLocaleString()}</span>
            </summary>
            <div class="reference-chapters"></div>
          </details>
        `).join("")}
      </div>
    </details>
  `).join("");

  const renderedVersions = versions;
  for (const details of referenceIndexEl.querySelectorAll(".reference-book")) {
    details.addEventListener("toggle", () => {
      if (!details.open || details.dataset.rendered === "true") {
        return;
      }

      const version = renderedVersions[Number(details.dataset.versionIndex)];
      const book = version.books[Number(details.dataset.bookIndex)];
      details.querySelector(".reference-chapters").innerHTML = book.chapters.map((chapter) => `
        <section class="reference-chapter">
          <h5>${escapeHtml(book.name)} ${chapter.chapter}</h5>
          <p>${chapter.verses.map((verse) => `${escapeHtml(book.name)} ${chapter.chapter}:${verse}`).join(", ")}</p>
        </section>
      `).join("");
      details.dataset.rendered = "true";
    });
  }
}

function buildManualReferenceIndex() {
  const books = new Map();

  for (const result of manualVerses.values()) {
    const match = result.reference.match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!match) {
      continue;
    }

    const [, book, chapterValue, verseValue] = match;
    const chapter = Number(chapterValue);
    const verse = Number(verseValue);
    const chapters = books.get(book) ?? new Map();
    const verses = chapters.get(chapter) ?? new Set();
    verses.add(verse);
    chapters.set(chapter, verses);
    books.set(book, chapters);
  }

  const bookList = Array.from(books.entries()).map(([book, chapters]) => {
    const chapterList = Array.from(chapters.entries())
      .toSorted(([chapterA], [chapterB]) => chapterA - chapterB)
      .map(([chapter, verses]) => ({ chapter, verses: Array.from(verses).toSorted((a, b) => a - b) }));
    const firstChapter = chapterList[0];
    const lastChapter = chapterList.at(-1);

    return {
      name: book,
      count: chapterList.reduce((sum, item) => sum + item.verses.length, 0),
      first: `${book} ${firstChapter.chapter}:${firstChapter.verses[0]}`,
      last: `${book} ${lastChapter.chapter}:${lastChapter.verses.at(-1)}`,
      chapters: chapterList
    };
  }).toSorted((a, b) => a.name.localeCompare(b.name));

  return {
    id: "manual-entry",
    abbreviation: "MANUAL",
    name: "Manual Entry",
    count: bookList.reduce((sum, book) => sum + book.count, 0),
    books: bookList
  };
}

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = questionInput.value.trim();
  const params = new URLSearchParams({ q: query });
  for (const version of selectedVersions()) {
    if (version !== "manual-entry") {
      params.append("version", version);
    }
  }

  const response = await fetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    resultsEl.innerHTML = `<p class="empty-state">Search failed. Check the server logs and corpus validation.</p>`;
    return;
  }

  const payload = await response.json();
  const combinedResults = new Map(payload.results.map((result) => [result.id, result]));
  if (isManualCollectionSelected()) {
    for (const result of searchManualVerses(query)) {
      combinedResults.set(result.id, result);
    }
  }
  renderResults(Array.from(combinedResults.values()), query);
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = chatInput.value.trim();
  if (!message) {
    return;
  }

  chatMessages.push({ role: "user", content: message });
  saveChatMessages();
  chatInput.value = "";
  setChatBusy(true);
  renderChatMessages(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: chatMessages })
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Chat is unavailable right now.");
    }

    chatMessages.push({ role: "assistant", content: payload.message });
    saveChatMessages();
    chatStatusEl.textContent = `Connected to ${payload.model}. Chat history is saved in this browser.`;
  } catch (error) {
    chatStatusEl.textContent = error.message;
  } finally {
    setChatBusy(false);
    renderChatMessages();
    chatInput.focus();
  }
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  chatMessages = [];
  saveChatMessages();
  renderChatMessages();
  chatStatusEl.textContent = "Started a new chat. Chat history is saved in this browser.";
  chatInput.focus();
});

resultsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (button) {
    toggleFavorite(button.dataset.favoriteId);
    renderResults(currentResults, questionInput.value.trim());
  }
});

resultsEl.addEventListener("click", handleMemorizeButtonClick);

favoritesListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (button) {
    if (favorites.has(button.dataset.favoriteId)) {
      pendingFavoriteRemovalId = button.dataset.favoriteId;
      removeFavoriteDialog.showModal();
    } else {
      toggleFavorite(button.dataset.favoriteId);
      renderFavorites();
      renderResults(currentResults, questionInput.value.trim());
    }
  }
});

favoritesListEl.addEventListener("click", handleMemorizeButtonClick);

favoritesListEl.addEventListener("click", (event) => {
  const card = event.target.closest("[data-flashcard-id]");
  if (!card) {
    return;
  }

  const isFlipped = card.classList.toggle("flipped");
  card.setAttribute("aria-pressed", String(isFlipped));
  card.setAttribute("aria-label", isFlipped ? "Hide verse text" : "Reveal verse text");
  card.querySelector(".flash-card-front").setAttribute("aria-hidden", String(isFlipped));
  card.querySelector(".flash-card-back").setAttribute("aria-hidden", String(!isFlipped));
});

for (const button of favoritesFilterButtons) {
  button.addEventListener("click", () => {
    activeFavoritesFilter = button.dataset.favoritesFilter;

    for (const filterButton of favoritesFilterButtons) {
      const isActive = filterButton === button;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-selected", String(isActive));
    }

    renderFavorites();
  });
}

for (const button of addVerseButtons) {
  button.addEventListener("click", () => {
    const form = document.getElementById(button.getAttribute("aria-controls"));
    const willOpen = form.hidden;
    form.hidden = !willOpen;
    button.setAttribute("aria-expanded", String(willOpen));
    button.textContent = willOpen ? "Close" : "Add verse";

    if (willOpen) {
      form.querySelector("[data-manual-reference]").focus();
      form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

initializeReferenceAutocomplete();

for (const form of manualFavoriteForms) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const reference = form.querySelector("[data-manual-reference]").value.trim();
    const abbreviation = form.querySelector("[data-manual-translation]").value;
    const text = form.querySelector("[data-manual-text]").value.trim();
    const addToFavorites = form.querySelector("[data-manual-add-favorite]").checked;
    const status = form.querySelector("[data-manual-status]");
    const submitButton = form.querySelector('button[type="submit"]');

    status.classList.remove("error");

    if (!reference || !abbreviation || !text) {
      status.textContent = "Complete all fields.";
      status.classList.add("error");
      return;
    }

    submitButton.disabled = true;
    status.textContent = "Checking verse…";

    try {
      const availability = await checkReferenceExists(reference, abbreviation);
      const normalizedReference = availability.normalizedReference ?? reference;

      if (availability.exists || manualVerseAlreadyExists(normalizedReference, abbreviation)) {
        status.textContent = "Verse is already searchable";
        status.classList.add("error");
        return;
      }

      const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const result = { id, type: "manual", reference: normalizedReference, abbreviation, text };
      manualVerses.set(id, result);
      if (addToFavorites) {
        favorites.set(id, result);
      }

      saveManualVerses();
      saveFavorites();
      form.reset();
      status.textContent = addToFavorites
        ? `${normalizedReference} (${abbreviation}) added to Manual Entry and Favorites.`
        : `${normalizedReference} (${abbreviation}) added to Manual Entry.`;
      renderFavorites();
      if (referenceIndexLoaded) {
        renderReferenceIndex();
      }

      const query = questionInput.value.trim();
      if (query && isManualCollectionSelected()) {
        const refreshedResults = new Map(currentResults.map((item) => [item.id, item]));
        for (const manualResult of searchManualVerses(query)) {
          refreshedResults.set(manualResult.id, manualResult);
        }
        renderResults(Array.from(refreshedResults.values()), query);
      }
    } catch {
      status.textContent = "Unable to verify whether this verse is already searchable.";
      status.classList.add("error");
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function checkReferenceExists(reference, translation) {
  const params = new URLSearchParams({ reference, translation });
  const response = await fetch(`/api/reference-exists?${params}`);
  if (!response.ok) {
    throw new Error(`Reference check failed (${response.status})`);
  }
  return response.json();
}

function manualVerseAlreadyExists(reference, abbreviation) {
  const normalizedReference = normalizeManualReference(reference);
  const normalizedTranslation = normalizeManualTranslation(abbreviation);

  return Array.from(manualVerses.values()).some((verse) => (
    normalizeManualReference(verse.reference) === normalizedReference
    && normalizeManualTranslation(verse.abbreviation) === normalizedTranslation
  ));
}

function normalizeManualReference(value) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeManualTranslation(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

cancelRemoveFavoriteButton.addEventListener("click", () => {
  removeFavoriteDialog.close();
});

confirmRemoveFavoriteButton.addEventListener("click", () => {
  if (pendingFavoriteRemovalId && favorites.has(pendingFavoriteRemovalId)) {
    favorites.delete(pendingFavoriteRemovalId);
    saveFavorites();
    renderFavorites();
    renderResults(currentResults, questionInput.value.trim());
  }

  removeFavoriteDialog.close();
});

removeFavoriteDialog.addEventListener("close", () => {
  pendingFavoriteRemovalId = null;
});

cancelRemoveMemorizedButton.addEventListener("click", () => {
  removeMemorizedDialog.close();
});

moveMemorizedToLearningButton.addEventListener("click", () => {
  if (pendingMemorizedRemovalId && memorized.has(pendingMemorizedRemovalId)) {
    const result = memorized.get(pendingMemorizedRemovalId);
    memorized.delete(pendingMemorizedRemovalId);
    learning.set(pendingMemorizedRemovalId, result);
    saveLearning();
    saveMemorized();
    renderResults(currentResults, questionInput.value.trim());
    renderFavorites();
    renderStudies();
  }

  removeMemorizedDialog.close();
});

confirmRemoveMemorizedButton.addEventListener("click", () => {
  if (pendingMemorizedRemovalId && memorized.has(pendingMemorizedRemovalId)) {
    memorized.delete(pendingMemorizedRemovalId);
    saveMemorized();
    renderResults(currentResults, questionInput.value.trim());
    renderFavorites();
    renderStudies();
  }

  removeMemorizedDialog.close();
});

removeMemorizedDialog.addEventListener("close", () => {
  pendingMemorizedRemovalId = null;
});

studyForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = studyNameInput.value.trim();
  if (!name) {
    return;
  }

  const id = `study-${Date.now()}`;
  studies.set(id, {
    id,
    name,
    description: studyDescriptionInput.value.trim(),
    items: []
  });

  saveStudies();
  studyForm.reset();
  renderStudies();
  renderResults(currentResults, questionInput.value.trim());
  renderFavorites();
});

studyListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (button) {
    toggleFavorite(button.dataset.favoriteId);
    renderStudies();
    renderResults(currentResults, questionInput.value.trim());
    renderFavorites();
  }
});

studyListEl.addEventListener("click", handleMemorizeButtonClick);

for (const item of navItems) {
  item.addEventListener("click", () => {
    showPage(item.dataset.pageTarget);
  });
}

loadVersions().catch((error) => {
  versionList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
});

function toggleFavorite(resultId) {
  if (favorites.has(resultId)) {
    favorites.delete(resultId);
  } else {
    const result = findSavedResult(resultId);
    if (!result) {
      return;
    }
    favorites.set(resultId, result);
  }

  saveFavorites();
}

function renderChatMessages(showPending = false) {
  const messages = chatMessages.length > 0
    ? chatMessages
    : [{ role: "assistant", content: "Hello! What would you like to study or talk about?" }];

  chatMessagesEl.innerHTML = `
    ${messages.map((message) => `
      <article class="chat-message ${message.role}">
        <span class="chat-message-label">${message.role === "user" ? "You" : "ChatGPT"}</span>
        <div>${escapeHtml(message.content).replace(/\n/g, "<br>")}</div>
      </article>
    `).join("")}
    ${showPending ? `
      <article class="chat-message assistant pending" aria-label="ChatGPT is thinking">
        <span class="chat-message-label">ChatGPT</span>
        <div class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></div>
      </article>
    ` : ""}
  `;

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

function setChatBusy(isBusy) {
  chatInput.disabled = isBusy;
  sendChatButton.disabled = isBusy;
  newChatButton.disabled = isBusy;
  chatStatusEl.textContent = isBusy ? "ChatGPT is thinking…" : chatStatusEl.textContent;
}

function renderFavorites() {
  const allSaved = new Map(favorites);
  for (const [id, result] of learning) {
    if (result) {
      allSaved.set(id, result);
    }
  }
  for (const [id, result] of memorized) {
    if (result) {
      allSaved.set(id, result);
    }
  }

  const learningVerses = Array.from(learning.values()).filter(Boolean);
  const memorizedVerses = Array.from(memorized.values()).filter(Boolean);
  const favoriteVerses = Array.from(favorites.values());
  const saved = activeFavoritesFilter === "favorites"
    ? favoriteVerses
    : activeFavoritesFilter === "learning"
      ? learningVerses
    : activeFavoritesFilter === "memorized"
      ? memorizedVerses
      : Array.from(allSaved.values());

  favoriteCountEl.textContent = `${saved.length} verse${saved.length === 1 ? "" : "s"}`;

  if (saved.length === 0) {
    const emptyMessage = activeFavoritesFilter === "favorites"
      ? "No favorites saved yet."
      : activeFavoritesFilter === "learning"
        ? "No verses are being learned yet."
      : activeFavoritesFilter === "memorized"
        ? "No memorized verses yet."
        : "No favorite, learning, or memorized verses yet.";
    favoritesListEl.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  if (activeFavoritesFilter === "all") {
    favoritesListEl.innerHTML = `
      ${renderFavoritesGroup("Favorites", favoriteVerses, "No favorites saved yet.")}
      ${renderFavoritesGroup("Learning", learningVerses, "No verses are being learned yet.")}
      ${renderFavoritesGroup("Memorized", memorizedVerses, "No memorized verses yet.")}
    `;
    return;
  }

  if (activeFavoritesFilter === "learning") {
    favoritesListEl.innerHTML = `
      <div class="flash-card-intro">
        <h3>Learning flash cards</h3>
        <p>Choose a card to reveal the verse.</p>
      </div>
      <div class="flash-card-grid">
        ${learningVerses.map(renderFlashCard).join("")}
      </div>
    `;
    return;
  }

  favoritesListEl.innerHTML = saved.map(renderResult).join("");
}

function renderFlashCard(result) {
  return `
    <button
      class="flash-card"
      type="button"
      data-flashcard-id="${escapeHtml(result.id)}"
      aria-label="Reveal verse text"
      aria-pressed="false"
    >
      <span class="flash-card-inner">
        <span class="flash-card-face flash-card-front" aria-hidden="false">
          <span class="flash-card-eyebrow">Tap to reveal</span>
          <strong>${escapeHtml(referenceFor(result))}</strong>
          <span class="flash-card-translation">${escapeHtml(result.abbreviation)}</span>
          ${result.type === "manual" ? `<span class="manual-tag">Manual</span>` : ""}
        </span>
        <span class="flash-card-face flash-card-back" aria-hidden="true">
          <span class="flash-card-text">${result.type === "manual" ? escapeHtml(stripManualVerseNumbers(result.text, result.reference)) : escapeHtml(textForFlashCard(result))}</span>
          <strong>${escapeHtml(referenceFor(result))}</strong>
          ${result.type === "manual" ? `<span class="manual-tag">Manual</span>` : ""}
        </span>
      </span>
    </button>
  `;
}

function referenceFor(result) {
  if (result.type === "manual") {
    return result.reference;
  }

  const book = displayBookName(result.book);
  if (result.type === "passage") {
    return result.isWholeChapter
      ? `${book} ${result.chapter}`
      : `${book} ${result.chapter}:${result.startVerse}-${result.endVerse}`;
  }

  return `${book} ${result.chapter}:${result.verse}`;
}

function textForFlashCard(result) {
  if (result.type === "passage") {
    return result.verses
      .filter((verse) => !verse.isOmitted)
      .map((verse) => verse.text.trim())
      .join(" ");
  }

  return result.isOmitted ? "This verse is omitted in this translation." : result.text;
}

function renderFavoritesGroup(title, verses, emptyMessage) {
  return `
    <section class="favorites-group" aria-label="${escapeHtml(title)}">
      <div class="favorites-group-heading">
        <h3>${escapeHtml(title)}</h3>
        <span>${verses.length}</span>
      </div>
      <div class="favorites-group-list">
        ${verses.length > 0
          ? verses.map(renderResult).join("")
          : `<p class="empty-state">${escapeHtml(emptyMessage)}</p>`}
      </div>
    </section>
  `;
}

function renderStudies() {
  const savedStudies = Array.from(studies.values());
  studyCountEl.textContent = `${savedStudies.length} stud${savedStudies.length === 1 ? "y" : "ies"}`;

  if (savedStudies.length === 0) {
    studyListEl.innerHTML = `<p class="empty-state">No studies yet.</p>`;
    return;
  }

  studyListEl.innerHTML = savedStudies.map((study) => `
    <article class="study-card">
      <h3>${escapeHtml(study.name)}</h3>
      ${study.description ? `<p>${escapeHtml(study.description)}</p>` : ""}
      <div class="study-card-meta">${study.items.length} saved item${study.items.length === 1 ? "" : "s"}</div>
      <div class="results">${study.items.map(renderResult).join("")}</div>
    </article>
  `).join("");
}

function handleMemorizeButtonClick(event) {
  const button = event.target.closest("[data-memorize-id]");
  if (!button) {
    return;
  }

  const resultId = button.dataset.memorizeId;
  if (memorized.has(resultId)) {
    pendingMemorizedRemovalId = resultId;
    removeMemorizedDialog.showModal();
    return;
  } else if (learning.has(resultId)) {
    const result = learning.get(resultId);
    learning.delete(resultId);
    memorized.set(resultId, result);
  } else {
    const result = findSavedResult(resultId);
    if (!result) {
      return;
    }
    learning.set(resultId, result);
  }

  saveLearning();
  saveMemorized();
  renderResults(currentResults, questionInput.value.trim());
  renderFavorites();
  renderStudies();
}

function findSavedResult(resultId) {
  return currentResults.find((result) => result.id === resultId)
    ?? manualVerses.get(resultId)
    ?? favorites.get(resultId)
    ?? learning.get(resultId)
    ?? memorized.get(resultId)
    ?? Array.from(studies.values()).flatMap((study) => study.items).find((result) => result.id === resultId);
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem("bible-study:favorites");
    const saved = raw ? JSON.parse(raw) : [];
    return new Map(saved.map((item) => [item.id, item]));
  } catch {
    return new Map();
  }
}

function saveFavorites() {
  localStorage.setItem("bible-study:favorites", JSON.stringify(Array.from(favorites.values())));
}

function loadManualVerses() {
  try {
    const raw = localStorage.getItem("bible-study:manual-verses");
    const saved = raw ? JSON.parse(raw) : [];
    const entries = saved
      .filter((item) => item?.id && item.type === "manual")
      .map((item) => [item.id, item]);

    for (const item of favorites.values()) {
      if (item?.id && item.type === "manual") {
        entries.push([item.id, item]);
      }
    }

    return new Map(entries);
  } catch {
    return new Map(
      Array.from(favorites.values())
        .filter((item) => item?.id && item.type === "manual")
        .map((item) => [item.id, item])
    );
  }
}

function saveManualVerses() {
  localStorage.setItem("bible-study:manual-verses", JSON.stringify(Array.from(manualVerses.values())));
}

function searchManualVerses(query) {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return [];
  }

  return Array.from(manualVerses.values()).filter((result) => {
    const searchable = `${result.reference} ${result.abbreviation} ${result.text}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

function loadStudies() {
  try {
    const raw = localStorage.getItem("bible-study:studies");
    const saved = raw ? JSON.parse(raw) : [];
    return new Map(saved.map((study) => [study.id, { ...study, items: study.items ?? [] }]));
  } catch {
    return new Map();
  }
}

function saveStudies() {
  localStorage.setItem("bible-study:studies", JSON.stringify(Array.from(studies.values())));
}

function loadMemorized() {
  try {
    const raw = localStorage.getItem("bible-study:memorized");
    const saved = raw ? JSON.parse(raw) : [];
    const entries = saved.map((item) => {
      if (typeof item === "string") {
        const result = favorites.get(item)
          ?? Array.from(studies.values()).flatMap((study) => study.items).find((studyItem) => studyItem.id === item);
        return [item, result];
      }
      return [item.id, item];
    }).filter(([, item]) => item);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function saveMemorized() {
  localStorage.setItem("bible-study:memorized", JSON.stringify(Array.from(memorized.values())));
}

function loadLearning() {
  try {
    const raw = localStorage.getItem("bible-study:learning");
    const saved = raw ? JSON.parse(raw) : [];
    return new Map(saved.filter((item) => item?.id).map((item) => [item.id, item]));
  } catch {
    return new Map();
  }
}

function saveLearning() {
  localStorage.setItem("bible-study:learning", JSON.stringify(Array.from(learning.values())));
}

function loadChatMessages() {
  try {
    const raw = localStorage.getItem("bible-study:chat");
    const saved = raw ? JSON.parse(raw) : [];
    return saved
      .filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string")
      .slice(-30);
  } catch {
    return [];
  }
}

function saveChatMessages() {
  localStorage.setItem("bible-study:chat", JSON.stringify(chatMessages.slice(-30)));
}
