# The future of FTW

`/future/` is a public design canvas with named concepts, images, motion
studies and anonymous thumbs up/down. It uses the website's static hosting
and one Pages Worker route, `/future/api/votes`. There is no upload flow;
new ideas come through Discord.

The canvas UI, proposal names and descriptions are in English. Earlier
artwork retains its original text. Six new English mockups explore the
user's ring design and the current FTW theme. `design-prompts.json` records
their built-in imagegen prompts and output paths in `assets/`.

## Add a proposal

Add full images and smaller previews to `assets/`, then add an entry to
`catalog.mjs`. Keep the `id` and `code` of existing entries unchanged so
votes and shared links keep working. Use a new ID for a changed design
that needs its own votes. Full app screenshots must retain the complete
viewport. Mark mockups, demo data and user references clearly.

Each entry has a name, description, tags and at least one image. Optional
`video` is a local MP4 path. `media` can include more images with captions.
The API reads the same catalog, so new entries need no separate allowlist.

## Votes

Create the schema in `schema.sql` in a D1 database and bind it as
`FUTURE_DB` in the Pages environment being deployed. The initial preview
uses the separate EU database `ftw-future-votes`
(`c079f4c6-f3bb-4ffa-91ee-d60784600bf9`). Production has no binding yet.

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

Run `node --test tests/future-votes.test.mjs`. The tests use SQLite to check
shared counts, vote changes/removal, invalid requests and catalog assets.
Review the canvas in a browser at phone and desktop widths. Check a real
vote, reload and a second browser session on the deployed preview.

Images retain the earlier concept names. The two current-interface images
come from the homepage's demo screenshots. The ring image is the user
reference supplied on 22 October 2026. Robot and app studies come from the
16–17 October design exploration; they are ideas, not release promises.
