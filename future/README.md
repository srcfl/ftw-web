# FTW design review

`/future/` starts with the FTW 0.5.0 (16) app, then shows eight named design
proposals for Now, Plan and Car. Visitors can browse seven real app screens
in dark and light appearance, enlarge them, and compare a proposal with its
matching app screen. All public copy is in English.

The 14 full PNG screenshots come from a simulator build of release source
`70f4e02dd58d158955014ead2846e5229e2fe386`, using the built-in demo home.
They retain the full viewport and have no image edits. The release workflow
uploaded 0.5.0 (16) from that commit. `capture-provenance.json` records the
source, workflow runs, device, date and image hashes. This does not establish
App Store approval or behaviour on physical hardware.

The eight proposals are generated mockups, labelled separately from the
current app. `review-prompts-050.json` records their prompts, reference images
and final assets. Demo readings can differ between screenshots and proposals.

## Feedback

Each design has anonymous thumbs up/down and a feedback button. The current
app also accepts feedback on the selected screen and appearance. Visitors can
write a general idea without choosing a design. The site copies the text,
design name and direct link; the visitor then pastes it into FTW Discord.
Nothing posts to Discord automatically. Text drafts stay in memory for the
open page. There is no upload form or website account.

`review-data.mjs` defines the screen list and feedback text. `review.mjs` handles
the gallery, comparisons, links, drafts and votes. `review.css` styles the page.

## Add a proposal

Add the complete image and a smaller preview to `assets/review-050/`, then add
an entry to `currentConcepts` in `catalog.mjs`. Set `type: 'proposal'`, a new
stable `id` and `code`, a name, description, review question, screen and
appearance. `media` contains the local source and preview paths, dimensions,
language and caption. Keep full app viewports and label mockups and demo data.
Record the prompt and reference in `review-prompts-050.json`.

Keep existing IDs and codes unchanged so votes and shared links remain valid.
A changed design that needs its own votes needs a new ID. The API imports
the combined catalog, so new entries need no separate allowlist.

## Earlier explorations

`/future/archive/` retains the earlier 45 concepts, their votes and 16
interactive studies. `legacy-catalog.mjs`, `families.mjs`, `future.mjs`,
`future.css` and `demos/` serve that archive. Old design links at `/future/#id`
redirect to the matching archived design. The archive links back to this
review. The new review counts only its nine entries in its vote total.

Archived fluid studies use a balanced example home model with one signed
grid connection, solar supply, home demand, car and home battery. They keep
L1/L2/L3 in grid details. Pointer and keyboard controls, pause, reduced motion
and visibility handling keep them usable. No study connects to a real home.
Earlier translated artwork and its provenance remain in `assets/en/` and
`artwork-localization.json`. Older Swedish app films stay outside the gallery.

## Votes

The static site uses one Pages Worker route, `/future/api/votes`, and a D1
binding named `FUTURE_DB`. Production and preview share the EU database
`ftw-future-votes` (`c079f4c6-f3bb-4ffa-91ee-d60784600bf9`). The schema lives
in `schema.sql`. This review needs no schema change or vote reset.

A random HttpOnly cookie identifies a browser on this host for a year. The
database stores only that random ID, a design ID and a vote. It stores no IP
address, name or email. Each browser can change or remove its vote for each
design. This is informal feedback: clearing cookies or using another browser
allows another vote.

The API checks the origin, accepted IDs and values, and limits the body to
512 bytes. SQL uses bound parameters. Updates and returned counts run in one
D1 batch. The UI reports failures without claiming to have saved a vote.
`_routes.json` keeps other pages and assets on static routing.

## Review and deploy

Use an isolated branch and its Pages preview. The Pages Git integration
publishes preview branches automatically. Production needs the owner's
go-ahead; a request to deploy the change provides it. Confirm the intended
database binding before publishing. Test only with your own votes, then
remove those test votes through the UI or API.

Run `node --test tests/future-*.test.mjs`. These checks cover capture hashes,
complete screens, proposal references, feedback links, vote changes and
removal, archive IDs and the existing motion studies. Review desktop and
phone layouts, gallery controls, comparison modes, feedback copy, shared
links and old archive links in a browser. Verify shared votes in two sessions
on the deployed preview.
