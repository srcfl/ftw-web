import { currentConcepts, legacyConcepts } from "./catalog.mjs?v=050-1";
import {
  review,
  screens,
  screenMedia,
  feedbackMessage,
} from "./review-data.mjs?v=050-1";

const $ = (selector) => document.querySelector(selector);
const byId = new Map(currentConcepts.map((c) => [c.id, c]));
const baseline = currentConcepts.find((c) => c.type === "released");
const variants = currentConcepts.filter((c) => c.type === "proposal");
const params = new URLSearchParams(location.search);
const state = {
  screen: screens.some((s) => s.id === params.get("screen"))
    ? params.get("screen")
    : "now",
  appearance: params.get("appearance") === "light" ? "light" : "dark",
  filter: ["now", "plan", "car"].includes(params.get("view"))
    ? params.get("view")
    : "all",
  sort: "curated",
  active: null,
  mode: "compare",
  feedback: null,
  drafts: new Map(),
  votes: {},
  ready: false,
  busy: false,
  revision: 0,
};
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const thumb =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v11H3V10h4Zm0 0 5-8c2 0 3 1 2 4l-1 4h6a2 2 0 0 1 2 2l-2 7a3 3 0 0 1-3 2H7"/></svg>';
const down = thumb.replace("<svg ", '<svg style="transform:rotate(180deg)" ');
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), 4200);
}
function updateUrl() {
  const url = new URL(location.href);
  for (const key of ["screen", "appearance", "view", "feedback"])
    url.searchParams.delete(key);
  if (state.screen !== "now") url.searchParams.set("screen", state.screen);
  if (state.appearance !== "dark")
    url.searchParams.set("appearance", state.appearance);
  if (state.filter !== "all") url.searchParams.set("view", state.filter);
  if ($("#feedback-dialog").open)
    url.searchParams.set("feedback", state.feedback || "general");
  if (state.active) url.hash = state.active;
  else if (byId.has(url.hash.slice(1))) url.hash = "ideas";
  history.replaceState(null, "", url);
}
function renderCurrent() {
  const current = screens.find((s) => s.id === state.screen),
    media = screenMedia(baseline, state.screen, state.appearance);
  $("#screen-tabs").innerHTML = screens
    .map(
      (s) =>
        `<button type="button" data-screen="${s.id}" aria-pressed="${s.id === state.screen}">${escape(s.name)}</button>`,
    )
    .join("");
  document
    .querySelectorAll("[data-appearance]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.appearance === state.appearance),
    );
  const image = $("#current-image");
  image.src = "/future/" + media.src;
  image.width = media.width;
  image.height = media.height;
  image.alt = `FTW 0.5.0 · ${media.caption}`;
  $("#enlarge-current").setAttribute(
    "aria-label",
    `Enlarge ${current.name} in FTW 0.5.0`,
  );
  $("#screen-title").textContent = current.name;
  $("#screen-description").textContent = current.description;
}
function voteButtons(c) {
  const vote = state.votes[c.id] || { up: 0, down: 0, mine: 0 };
  return `<div class="votes" role="group" aria-label="Vote on ${escape(c.name)}">${[
    [1, "up", "Thumbs up", thumb],
    [-1, "down", "Thumbs down", down],
  ]
    .map(
      ([value, key, label, icon]) =>
        `<button class="vote" type="button" data-vote="${value}" data-id="${c.id}" aria-label="${label}: ${escape(c.name)}" aria-pressed="${vote.mine === value}" ${!state.ready || state.busy ? "disabled" : ""}>${icon}<span>${state.ready ? vote[key] : "–"}</span></button>`,
    )
    .join("")}</div>`;
}
function visibleVariants() {
  const result = variants.filter(
    (c) => state.filter === "all" || c.screen === state.filter,
  );
  if (state.sort === "popular")
    result.sort(
      (a, b) => (state.votes[b.id]?.up || 0) - (state.votes[a.id]?.up || 0),
    );
  return result;
}
function renderBoard() {
  const list = visibleVariants();
  $("#board").innerHTML = list
    .map(
      (c) =>
        `<article class="proposal" id="card-${c.id}"><div class="card-top"><span>${c.code} / ${escape(screens.find((s) => s.id === c.screen).name)}</span><span class="concept-tag">PROPOSAL</span></div><button class="proposal-image" type="button" data-open="${c.id}" data-mode="single" aria-label="Enlarge ${escape(c.name)}"><img src="/future/${c.media[0].thumb}" width="${c.media[0].width}" height="${c.media[0].height}" alt="${escape(c.name)} · Proposed ${c.screen} screen" loading="lazy" decoding="async"></button><div class="proposal-copy"><h3><button class="title-button" type="button" data-open="${c.id}">${escape(c.name)}</button></h3><p>${escape(c.description)}</p></div><div class="proposal-actions"><button class="button" type="button" data-open="${c.id}">Compare with 0.5.0 ↗</button><div class="card-feedback"><div data-votes="${c.id}">${voteButtons(c)}</div><button class="feedback-link" type="button" data-feedback="${c.id}" aria-label="Feedback on ${escape(c.name)}">Feedback ↗</button></div></div></article>`,
    )
    .join("");
  $("#showing").textContent =
    `${list.length} of ${variants.length} proposals · Based on FTW 0.5.0`;
  $("#filters").innerHTML = [
    ["all", "All", variants.length],
    ...["now", "plan", "car"].map((id) => [
      id,
      screens.find((s) => s.id === id).name,
      variants.filter((c) => c.screen === id).length,
    ]),
  ]
    .map(
      ([id, name, count]) =>
        `<button type="button" data-filter="${id}" aria-pressed="${state.filter === id}">${name} <span>${count}</span></button>`,
    )
    .join("");
}
function renderVotes() {
  const focused = document.activeElement?.closest("[data-vote]");
  const restore = focused && {
    parent: focused.closest("[data-votes]"),
    value: focused.dataset.vote,
  };
  document.querySelectorAll("[data-votes]").forEach((el) => {
    const c = byId.get(el.dataset.votes);
    if (c) el.innerHTML = voteButtons(c);
  });
  restore?.parent
    ?.querySelector(`[data-vote="${restore.value}"]`)
    ?.focus({ preventScroll: true });
  if (state.ready) {
    const total = currentConcepts.reduce(
      (sum, c) =>
        sum + (state.votes[c.id]?.up || 0) + (state.votes[c.id]?.down || 0),
      0,
    );
    $("#vote-status").classList.remove("error");
    $("#vote-status").textContent =
      `${total} ${total === 1 ? "vote" : "votes"} on this review · No sign-in needed`;
  }
}
async function loadVotes() {
  if (state.busy) return;
  const revision = state.revision;
  try {
    const response = await fetch("/future/api/votes", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) throw Error();
    const data = await response.json();
    if (state.busy || state.revision !== revision) return;
    state.votes = data.votes;
    state.ready = true;
    renderVotes();
  } catch {
    if (!state.ready) {
      $("#vote-status").textContent =
        "Voting is unavailable right now. Trying again.";
      $("#vote-status").classList.add("error");
    }
  }
}
async function vote(id, value) {
  if (!state.ready || state.busy || !byId.has(id)) return;
  const selected = state.votes[id]?.mine || 0;
  state.busy = true;
  state.revision++;
  renderVotes();
  try {
    const response = await fetch("/future/api/votes", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, value: selected === value ? 0 : value }),
    });
    if (!response.ok) throw Error();
    state.votes = (await response.json()).votes;
    toast(
      selected === value
        ? "Vote removed."
        : "Thanks! Your vote has been saved.",
    );
  } catch {
    toast("Your vote could not be saved. Please try again.");
  } finally {
    state.busy = false;
    renderVotes();
    if (state.sort === "popular") renderBoard();
    const scope = $("#viewer").open ? $("#viewer") : document;
    scope
      .querySelector(`[data-id="${id}"][data-vote="${value}"]`)
      ?.focus({ preventScroll: true });
  }
}
function figure(media, title, alt) {
  return `<figure><figcaption>${escape(title)}</figcaption><img src="/future/${media.src}" width="${media.width}" height="${media.height}" alt="${escape(alt)}"></figure>`;
}
function renderViewer() {
  const c = byId.get(state.active);
  if (!c) return;
  const released = c.type === "released";
  const original = screenMedia(
    baseline,
    released ? state.screen : c.screen,
    released ? state.appearance : c.appearance,
  );
  const proposal = c.media[0];
  const compare = !released && state.mode === "compare";
  $("#viewer-code").textContent = released
    ? "RELEASED APP / 0.5.0 (16)"
    : `${c.code} / DESIGN PROPOSAL`;
  $("#viewer-title").textContent = released
    ? `FTW 0.5.0 · ${screens.find((s) => s.id === state.screen).name}`
    : c.name;
  $("#viewer-images").classList.toggle("single", !compare);
  $("#viewer-images").innerHTML =
    (compare || released || state.mode === "current"
      ? figure(
          original,
          `CURRENT APP · 0.5.0 · ${original.caption}`,
          `Actual FTW 0.5.0 ${original.caption}`,
        )
      : "") +
    (!released && state.mode !== "current"
      ? figure(
          proposal,
          `${c.code} · ${c.name} · PROPOSAL`,
          `${c.name}, a proposed ${c.screen} design`,
        )
      : "");
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.hidden = released && button.dataset.view !== "current";
    button.setAttribute(
      "aria-pressed",
      released
        ? button.dataset.view === "current"
        : button.dataset.view === state.mode,
    );
  });
  $("#viewer-question").textContent =
    c.question ||
    "What works for you in the current app? What would you change?";
  $("#viewer-note").textContent = released
    ? "Actual 0.5.0 (16) app screenshot. Simulator capture from release source, with a demo home."
    : c.note + " · Demo readings vary between captures.";
  $("#viewer-votes").dataset.votes = c.id;
  $("#viewer-votes").innerHTML = voteButtons(c);
  $("#viewer-feedback").textContent = released
    ? "Give feedback on 0.5.0 ↗"
    : "Suggest a change ↗";
}
let viewerFocus, feedbackFocus;
function openViewer(id, mode = "compare", sync = true) {
  const c = byId.get(id);
  if (!c) return;
  if (!$("#viewer").open) viewerFocus = document.activeElement;
  state.active = id;
  state.mode = c.type === "released" ? "current" : mode;
  renderViewer();
  if (!$("#viewer").open) $("#viewer").showModal();
  document.body.style.overflow = "hidden";
  if (sync) updateUrl();
  $("#close-viewer").focus({ preventScroll: true });
}
function feedbackTarget(id) {
  const target = byId.get(id);
  if (!target) return null;
  return target.type === "released"
    ? {
        ...target,
        name: `FTW 0.5.0 · ${screens.find((s) => s.id === state.screen).name}`,
        screen: state.screen,
        appearance: state.appearance,
      }
    : target;
}
function renderFeedback() {
  const target = feedbackTarget(state.feedback),
    text = $("#feedback-text").value;
  $("#feedback-dialog-title").textContent = target
    ? `Feedback on ${target.name}`
    : "A new idea for FTW";
  $("#feedback-context").innerHTML = target
    ? `<strong>${escape(target.code + " · " + target.name)}</strong><span>${target.type === "released" ? "Current app · 0.5.0" : "Proposed design · Not part of 0.5.0"}</span>`
    : "<strong>Your own idea</strong><span>A suggestion for the next version of FTW</span>";
  $("#feedback-count").textContent = `${text.length} / 4000`;
  $("#copy-feedback").disabled = !text.trim();
  $("#feedback-link-preview").textContent = target
    ? `Your feedback will include ${target.code}, the design name and a direct link.`
    : "Your idea will include a link to this design review.";
}
function draftKey(id) {
  return id === baseline.id ? `${id}:${state.screen}:${state.appearance}` : id;
}
function openFeedback(id = "general", sync = true) {
  if (id !== "general" && !byId.has(id)) return;
  feedbackFocus = document.activeElement;
  state.feedback = id;
  $("#feedback-text").value = state.drafts.get(draftKey(id)) || "";
  $("#prepared-feedback").hidden = true;
  $("#copy-status").textContent = "";
  renderFeedback();
  if (!$("#feedback-dialog").open) $("#feedback-dialog").showModal();
  document.body.style.overflow = "hidden";
  if (sync) updateUrl();
  $("#feedback-text").focus({ preventScroll: true });
}
async function copyText(text, success) {
  try {
    await navigator.clipboard.writeText(text);
    toast(success);
    return true;
  } catch {
    toast("Copy is unavailable. Select the text and copy it manually.");
    return false;
  }
}
async function copyLink(id) {
  const url = new URL(location.href);
  url.searchParams.delete("feedback");
  url.hash = id || "current";
  await copyText(url.href, "Link copied.");
}
document.addEventListener("click", (event) => {
  const voted = event.target.closest("[data-vote]");
  if (voted) {
    void vote(voted.dataset.id, Number(voted.dataset.vote));
    return;
  }
  const feedback = event.target.closest("[data-feedback]");
  if (feedback) {
    openFeedback(feedback.dataset.feedback);
    return;
  }
  const opened = event.target.closest("[data-open]");
  if (opened) {
    openViewer(opened.dataset.open, opened.dataset.mode || "compare");
    return;
  }
  const screen = event.target.closest("[data-screen]");
  if (screen) {
    state.screen = screen.dataset.screen;
    renderCurrent();
    updateUrl();
    document
      .querySelector(`[data-screen="${state.screen}"]`)
      .focus({ preventScroll: true });
    return;
  }
  const look = event.target.closest("[data-appearance]");
  if (look) {
    state.appearance = look.dataset.appearance;
    renderCurrent();
    updateUrl();
    return;
  }
  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.filter = filter.dataset.filter;
    renderBoard();
    updateUrl();
    document
      .querySelector(`[data-filter="${state.filter}"]`)
      .focus({ preventScroll: true });
    return;
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    state.mode = view.dataset.view;
    renderViewer();
    return;
  }
});
$("#sort").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderBoard();
});
$("#enlarge-current").addEventListener("click", () =>
  openViewer(baseline.id, "current"),
);
$("#close-viewer").addEventListener("click", () => $("#viewer").close());
$("#viewer").addEventListener("click", (event) => {
  if (event.target === $("#viewer")) $("#viewer").close();
});
$("#viewer").addEventListener("close", () => {
  state.active = null;
  delete $("#viewer-votes").dataset.votes;
  document.body.style.overflow = $("#feedback-dialog").open ? "hidden" : "";
  updateUrl();
  viewerFocus?.focus({ preventScroll: true });
});
$("#viewer-feedback").addEventListener("click", () =>
  openFeedback(state.active),
);
$("#close-feedback").addEventListener("click", () =>
  $("#feedback-dialog").close(),
);
$("#feedback-dialog").addEventListener("click", (event) => {
  if (event.target === $("#feedback-dialog")) $("#feedback-dialog").close();
});
$("#feedback-dialog").addEventListener("close", () => {
  state.drafts.set(draftKey(state.feedback), $("#feedback-text").value);
  state.feedback = null;
  document.body.style.overflow = $("#viewer").open ? "hidden" : "";
  updateUrl();
  feedbackFocus?.focus({ preventScroll: true });
});
$("#feedback-text").addEventListener("input", () => {
  state.drafts.set(draftKey(state.feedback), $("#feedback-text").value);
  $("#prepared-feedback").hidden = true;
  $("#copy-status").textContent = "";
  renderFeedback();
});
$("#copy-feedback").addEventListener("click", async () => {
  const text = $("#feedback-text").value.trim();
  if (!text) return;
  const message = feedbackMessage(
    feedbackTarget(state.feedback),
    text,
    location.origin,
  );
  if (await copyText(message, "Feedback and design link copied."))
    $("#copy-status").textContent =
      "Copied. Open Discord, choose a channel and paste your feedback.";
  else {
    const prepared = $("#prepared-feedback");
    prepared.value = message;
    prepared.hidden = false;
    prepared.focus();
    prepared.select();
    $("#copy-status").textContent =
      "Select and copy the prepared message, then paste it in Discord.";
  }
});
$("#share-review").addEventListener("click", () => {
  void copyLink();
});
$("#share-design").addEventListener("click", () => {
  void copyLink(state.active);
});
function openHash() {
  const id = location.hash.slice(1);
  if (byId.has(id)) openViewer(id, "compare", false);
  else if (legacyConcepts.some((c) => c.id === id))
    location.replace(
      "/future/archive/" + location.search + "#" + encodeURIComponent(id),
    );
  else if ($("#viewer").open) $("#viewer").close();
}
window.addEventListener("hashchange", openHash);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void loadVotes();
});
renderCurrent();
renderBoard();
renderVotes();
openHash();
if (params.get("feedback")) openFeedback(params.get("feedback"), false);
void loadVotes();
setInterval(() => {
  if (!document.hidden) void loadVotes();
}, 30000);
