# The future of FTW

`/future/` is a public design canvas with named concepts, images, motion
studies and anonymous thumbs up/down. It uses the website's static hosting
and one Pages Worker route, `/future/api/votes`. There is no upload flow;
new ideas come through Discord.

All visible copy and artwork is in English. `assets/en/` contains translated
editions of 43 earlier images; the originals stay in `assets/` for reference.
`artwork-localization.json` records source hashes, prompts and English outputs.
The current-interface screenshots remain unchanged. `design-prompts.json`
records the six newer ring and FTW-theme proposals.

Six families in `families.mjs` group the 45 proposals without changing their
IDs or votes. Cards distinguish app directions, interaction ideas, characters
and current interfaces. Visitors can filter, search, choose interactive studies,
and compare two designs. The comparison URL preserves both IDs; family and
interactive filters also have shareable URLs.

Sixteen proposals open interactive studies, including all ten fluid-field
proposals, a home-battery reservoir and a separate Robot B playground. The demos
in `demos/` run locally in an iframe with example data. Scenarios and direct
graph scrubbing change a balanced home energy model. One signed grid
connection imports or exports; solar supplies energy; home demand, car and
home battery remain distinct. L1/L2/L3 appear only in grid details. Fluid
regions preserve their relative areas as they deform. Fields and streams use
the same material deformation, with spring motion and momentum on release.
Dragging a participant changes the example allocation; stream width and
particle direction follow the same balanced powers. The same robot moves
between overview, app sections and device details. Pointer and keyboard
controls, pause, reduced motion and visibility handling keep the studies usable. Closing a study removes
its iframe and stops its animation. Nothing connects to a real home.

The distribution studies add day playback, charging priorities, a larger car
view and day/night appearance. The storage study lets visitors drag the
battery level or switch between solar charging and evening use. Robot B has
Float, Follow and Rest behaviours. These remain example interactions, not
planning or hardware-control logic. Reduced motion starts without ambient
movement; direct pointer and keyboard controls still work.

Earlier app films contain Swedish, so the gallery replaces them with the
English interactive studies. The language-free robot film remains available.

## Add a proposal

Add full images and smaller previews to `assets/`, then add an entry to
`catalog.mjs`. Keep the `id` and `code` of existing entries unchanged so
votes and shared links keep working. Use a new ID for a changed design
that needs its own votes. Full app screenshots must retain the complete
viewport. Mark mockups, demo data and user references clearly.

Each entry has a name, description, tags and at least one image. Optional
`video` is a local MP4 path. `media` can include more images with captions.
Set each image’s `language` to `en` after reviewing its text. Add the proposal
to exactly one family in `families.mjs`. Add interactive variants in
`demos/variants.mjs`; the canvas derives its playable IDs from that registry.
The API reads the same catalog, so new entries need no separate allowlist.

## Votes

Create the schema in `schema.sql` in a D1 database and bind it as
`FUTURE_DB` in the Pages environment being deployed. Production and preview
share the EU database `ftw-future-votes`
(`c079f4c6-f3bb-4ffa-91ee-d60784600bf9`). When testing a preview, remove only
the test browser's own votes through the UI or vote API.

The random, HttpOnly cookie identifies a browser on this host for a year.
The database stores only that random ID, a proposal ID and a vote. It stores
no IP address, name or email. A unique key allows one current vote per
browser and proposal. Votes can change or be removed. This is informal
feedback, not a verified one-person ballot: clearing cookies or using
another browser allows another vote.

The API checks the request origin, accepted proposal IDs and values, and
limits the body to 512 bytes. SQL uses bound parameters. Updates and the
returned counts run in one D1 batch. The UI shows failures without claiming
that a vote was saved. Only the API route invokes the Worker; other pages
and assets retain static routing through `_routes.json`.

## Review and deploy

Use an isolated branch and its Pages preview. Do not merge to `main` or
deploy to production without the owner's go-ahead. The existing Pages Git
integration publishes preview branches automatically. Before a production
release, bind the intended voting database in the production environment.

Run `node --test tests/future-*.test.mjs`. The tests check shared votes,
changes/removal, invalid requests, catalog assets, complete family membership,
English artwork coverage, energy balance during gestures, fluid proportions
under two-axis deformation, spring settling at 30/60/120 Hz and stream reversal.
Review the canvas at phone and desktop widths. Check graph and surface drags,
robot movement, device details, motion controls and comparison deep links.
Check a real vote, reload and a second browser session on the deployed preview.

Images retain the earlier concept names. The two current-interface images
come from the homepage's demo screenshots. The ring image is the user
reference supplied on 22 October 2026. Robot and app studies come from the
16–17 October design exploration; they are ideas, not release promises.
