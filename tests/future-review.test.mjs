import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  concepts,
  currentConcepts,
  legacyConcepts,
} from "../future/catalog.mjs";
import {
  review,
  screens,
  screenMedia,
  feedbackMessage,
} from "../future/review-data.mjs";

const baseline = currentConcepts.find((c) => c.type === "released");
const proposals = currentConcepts.filter((c) => c.type === "proposal");
const file = (path) => new URL("../future/" + path, import.meta.url);

test("the current review adds a distinct release and eight proposals without losing archived votes", () => {
  assert.equal(legacyConcepts.length, 45);
  assert.equal(currentConcepts.length, 9);
  assert.equal(concepts.length, 54);
  assert.equal(baseline.id, "ftw-050");
  assert.deepEqual(
    proposals.map((c) => c.code),
    ["V01", "V02", "V03", "V04", "V05", "V06", "V07", "V08"],
  );
  assert.deepEqual(
    proposals.map((c) => c.screen),
    ["now", "now", "now", "now", "plan", "plan", "car", "car"],
  );
  for (const c of proposals) {
    assert.match(c.note, /Generated mockup.*Not part of 0.5.0/);
    assert.ok(c.question);
    assert.equal(c.media[0].language, "en");
    const original = screenMedia(baseline, c.screen, c.appearance);
    assert.equal(original.screen, c.screen);
    assert.equal(original.appearance, c.appearance);
  }
});

test("all seven app screens have complete unedited release-source captures in both appearances", () => {
  const provenance = JSON.parse(readFileSync(file("capture-provenance.json")));
  assert.equal(provenance.version, review.version);
  assert.equal(provenance.build, 16);
  assert.equal(provenance.source, review.source);
  assert.equal(provenance.release_run, 40186014332);
  assert.equal(baseline.media.length, 14);
  assert.deepEqual(provenance.screenshots, baseline.media);
  for (const screen of screens)
    for (const appearance of ["dark", "light"]) {
      const media = screenMedia(baseline, screen.id, appearance);
      assert.equal(media.screen, screen.id);
      assert.equal(media.appearance, appearance);
      const png = readFileSync(file(media.src));
      assert.equal(png.subarray(1, 4).toString(), "PNG");
      assert.equal(png.readUInt32BE(16), media.width);
      assert.equal(png.readUInt32BE(20), media.height);
      assert.equal(media.width, 1206);
      assert.equal(media.height, 2622);
      assert.equal(
        createHash("sha256").update(png).digest("hex"),
        media.sha256,
      );
    }
});

test("feedback includes the proposal name and a useful direct comparison link", () => {
  const message = feedbackMessage(
    proposals[4],
    "  Clearer time labels, please.  ",
    "https://design.test",
  );
  assert.match(message, /Design: V05 · A Clearer Day/);
  assert.match(message, /Screen: Plan/);
  assert.match(message, /\nClearer time labels, please\.\n/);
  assert.match(message, /https:\/\/design.test\/future\/#v050-clearer-day$/);
  const current = feedbackMessage(
    { ...baseline, screen: "grid", appearance: "light" },
    "Show the phases.",
    "https://design.test",
  );
  assert.match(current, /Screen: Grid connection/);
  const url = new URL(current.split("Design link: ")[1]);
  assert.equal(url.searchParams.get("screen"), "grid");
  assert.equal(url.searchParams.get("appearance"), "light");
  assert.equal(url.hash, "#ftw-050");
});

test("general ideas preserve plain text without inventing a design or adding personal data", () => {
  const text = '<script>alert("idea")</script> & a new layout';
  const message = feedbackMessage(null, text, "https://design.test");
  assert.ok(message.includes(text));
  assert.match(message, /A new idea for FTW/);
  assert.doesNotMatch(message, /Design:|Screen:|email|visitor|cookie/);
  assert.match(message, /https:\/\/design.test\/future\/#feedback$/);
});

test("each generated proposal keeps its prompt, source reference and final asset", () => {
  const provenance = JSON.parse(readFileSync(file("review-prompts-050.json")));
  assert.equal(provenance.proposals.length, proposals.length);
  assert.ok(!JSON.stringify(provenance).includes("/Users/"));
  assert.ok(!JSON.stringify(provenance).includes("/private/tmp/"));
  for (const proposal of proposals) {
    const record = provenance.proposals.find((p) => p.id === proposal.id);
    assert.ok(record.prompt);
    assert.equal(record.output, proposal.media[0].src);
    assert.ok(existsSync(file(record.reference)));
    assert.ok(existsSync(file(record.output)));
  }
});
