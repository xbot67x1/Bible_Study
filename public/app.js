const versionList = document.querySelector("#versionList");
const navItems = Array.from(document.querySelectorAll("[data-page-target]"));
const pages = Array.from(document.querySelectorAll("[data-page]"));
const questionForm = document.querySelector("#questionForm");
const questionInput = document.querySelector("#question");
const resultsEl = document.querySelector("#results");
const resultCountEl = document.querySelector("#resultCount");
const copyrightNoticeEl = document.querySelector("#copyrightNotice");
const favoritesListEl = document.querySelector("#favoritesList");
const favoriteCountEl = document.querySelector("#favoriteCount");
const studyForm = document.querySelector("#studyForm");
const studyNameInput = document.querySelector("#studyName");
const studyDescriptionInput = document.querySelector("#studyDescription");
const studyListEl = document.querySelector("#studyList");
const studyCountEl = document.querySelector("#studyCount");

let versions = [];
let currentResults = [];
let favorites = loadFavorites();
let studies = loadStudies();

function citationFor(result) {
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

function selectedVersionMetadata(results = []) {
  const resultVersionIds = new Set(results.map((result) => result.version));
  return versions.filter((version) => resultVersionIds.has(version.id));
}

function renderVersions() {
  if (versions.length === 0) {
    versionList.innerHTML = `<p class="empty-state">No Bible versions are loaded yet. Add folders under <strong>data/bibles</strong>, then run validation.</p>`;
    return;
  }

  versionList.innerHTML = versions.map((version) => `
    <label class="version-option">
      <input type="checkbox" name="version" value="${version.id}" checked>
      <span>${version.abbreviation} <small>${version.name}</small></span>
    </label>
  `).join("");
}

function renderResults(results, query) {
  currentResults = results;

  if (!query) {
    resultCountEl.textContent = "";
    copyrightNoticeEl.innerHTML = "";
    resultsEl.innerHTML = `<p class="empty-state">Search by reference, phrase, or keyword. Results are quoted exactly from the local corpus.</p>`;
    return;
  }

  resultCountEl.textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;

  if (results.length === 0) {
    copyrightNoticeEl.innerHTML = "";
    resultsEl.innerHTML = `<p class="empty-state">No local verses matched that query. The app will not invent citations or answer from memory.</p>`;
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

  if (result.type === "passage") {
    return `
      <article class="verse">
        <blockquote class="passage">${result.verses.map(renderPassageVerse).join(" ")}</blockquote>
        <div class="citation">${escapeHtml(citationFor(result))}</div>
        ${renderFavoriteButton(result.id, isFavorite)}
      </article>
    `;
  }

  return `
    <article class="verse">
      ${result.isOmitted ? `<p class="omitted">This verse number is present in the source data, but the ${escapeHtml(result.abbreviation)} text is omitted.</p>` : `<blockquote>${escapeHtml(result.text)}</blockquote>`}
      <div class="citation">${escapeHtml(citationFor(result))}</div>
      ${renderFavoriteButton(result.id, isFavorite)}
    </article>
  `;
}

function renderFavoriteButton(resultId, isFavorite) {
  return `
    <div class="verse-actions">
      <button
        class="favorite-button${isFavorite ? " active" : ""}"
        type="button"
        data-favorite-id="${escapeHtml(resultId)}"
        aria-label="${isFavorite ? "Remove from favorites" : "Save to favorites"}"
        title="${isFavorite ? "Remove from favorites" : "Save to favorites"}"
      >${isFavorite ? "★" : "☆"}</button>
      ${renderStudyControl(resultId)}
    </div>
  `;
}

function renderStudyControl(resultId) {
  const savedStudies = Array.from(studies.values());
  const disabled = savedStudies.length === 0;

  return `
    <button
      class="study-toggle-button"
      type="button"
      data-study-toggle-id="${escapeHtml(resultId)}"
      ${disabled ? "disabled" : ""}
      aria-label="${disabled ? "Create a study first" : "Add to study"}"
      title="${disabled ? "Create a study first" : "Add to study"}"
    >Study</button>
    <select class="study-select" data-study-select-id="${escapeHtml(resultId)}" aria-label="Choose study">
      <option value="">Choose study</option>
      ${savedStudies.map((study) => `<option value="${escapeHtml(study.id)}">${escapeHtml(study.name)}</option>`).join("")}
    </select>
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

  if (pageName === "study") {
    renderStudies();
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

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = questionInput.value.trim();
  const params = new URLSearchParams({ q: query });
  for (const version of selectedVersions()) {
    params.append("version", version);
  }

  const response = await fetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    resultsEl.innerHTML = `<p class="empty-state">Search failed. Check the server logs and corpus validation.</p>`;
    return;
  }

  const payload = await response.json();
  renderResults(payload.results, query);
});

resultsEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (button) {
    toggleFavorite(button.dataset.favoriteId);
    renderResults(currentResults, questionInput.value.trim());
  }
});

resultsEl.addEventListener("click", handleStudyButtonClick);
resultsEl.addEventListener("change", handleStudySelection);

favoritesListEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (button) {
    toggleFavorite(button.dataset.favoriteId);
    renderFavorites();
    renderResults(currentResults, questionInput.value.trim());
  }
});

favoritesListEl.addEventListener("click", handleStudyButtonClick);
favoritesListEl.addEventListener("change", handleStudySelection);

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

studyListEl.addEventListener("click", handleStudyButtonClick);
studyListEl.addEventListener("change", handleStudySelection);

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
    const result = currentResults.find((item) => item.id === resultId);
    if (!result) {
      return;
    }
    favorites.set(resultId, result);
  }

  saveFavorites();
}

function renderFavorites() {
  const saved = Array.from(favorites.values());
  favoriteCountEl.textContent = `${saved.length} saved`;

  if (saved.length === 0) {
    favoritesListEl.innerHTML = `<p class="empty-state">No favorites saved yet.</p>`;
    return;
  }

  favoritesListEl.innerHTML = saved.map(renderResult).join("");
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

function handleStudyButtonClick(event) {
  const button = event.target.closest("[data-study-toggle-id]");
  if (!button) {
    return;
  }

  const select = button.parentElement.querySelector(`[data-study-select-id="${CSS.escape(button.dataset.studyToggleId)}"]`);
  if (select) {
    select.classList.toggle("open");
    select.focus();
  }
}

function handleStudySelection(event) {
  const select = event.target.closest("[data-study-select-id]");
  if (!select || !select.value) {
    return;
  }

  addToStudy(select.value, select.dataset.studySelectId);
  select.value = "";
  select.classList.remove("open");
}

function addToStudy(studyId, resultId) {
  const study = studies.get(studyId);
  const result = findSavedResult(resultId);
  if (!study || !result) {
    return;
  }

  if (!study.items.some((item) => item.id === resultId)) {
    study.items.push(result);
    saveStudies();
  }

  renderStudies();
}

function findSavedResult(resultId) {
  return currentResults.find((result) => result.id === resultId)
    ?? favorites.get(resultId)
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
