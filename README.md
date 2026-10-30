# FTW website

Canonical project landing page for [FTW](https://github.com/srcfl/ftw).

Lean static site. Plain HTML, CSS and small scripts, no build step.

- Canonical target: https://ftw.sourceful.energy
- Cutover: https://fortytwowatts.com must redirect to the canonical site
- Hosting: Cloudflare Pages
- Design system: https://design.sourceful.energy/DESIGN.md

The legacy `home.fortytwowatts.com` host is not part of the website redirect.
It remains a WebAuthn security identity until the separate passkey migration is
complete.

## Product direction and contribution policy

Use [FTW's vision](https://github.com/srcfl/ftw/blob/master/VISION.md) and
[roadmap](https://github.com/srcfl/ftw/blob/master/docs/roadmap.md) when writing product copy.
Explain FTW as a fast local energy core for people, agents and other software.
Show the current iPhone beta, webapp, Home Assistant app and ChatGPT integration.
Keep preview integrations and planned features distinct from public releases.
Do not publish predicted savings as measured results. The savings example on
the home page comes from `savings-model.mjs`: one simulated home with made-up
prices, compared with the same home under ordinary self-consumption control,
as the vision asks. Both runs end with the same stored energy. Label it as an
example, and let `tests/savings-model.test.mjs` keep the page's numbers in
step with the model.

Product screenshots show the complete app viewport, without cropping or
changing the interface. Use the public webapp demo and the iOS app's built-in
demo. Label simulated homes. These show the interface, not measured savings
or a worker benchmark. Keep HTML dimensions in step with the image files.

Current images come from the iPhone app's built-in demo on an iPhone 17 Pro
simulator (iOS 26.5), at 600 px wide. `ftw-ios-plan`, `-car`, `-history` and
`-price.webp` come from `srcfl/ftw-app` commit `95af454` with `-FTWDemo YES
-FTWTab plan|car|history|price`. `ftw-ios-now-ring.webp` is a frame of Now
with the steady-flow ring from `srcfl/ftw-app#132`. All use simulated data.

Now on the home page is not a recording. `phone.mjs` draws it live in a
drawn iPhone 17 Pro, in the app's points, with the app's ring rules ported to
`ring.mjs` from `Flow.swift` and `FlowDiagram.swift` (`srcfl/ftw-app`
`44efeac`). Its simulated home in `demo-home.mjs` is the savings example's
plan at four moments of the day, and `tests/ring.test.mjs` holds both to the
app's rules and the example. Label it as drawn and simulated. When the app's
ring changes, port the change and its tests.

The home page uses the iPhone app's dark palette and its colour per kind of
energy (`ftw-app`, `Theme.xcassets`), set in Satoshi with JetBrains Mono
labels. The layout borrows from Sourceful's editorial design
(https://design.sourceful.energy/DESIGN.md): a label rail beside the text,
ruled lists, square corners and hairlines. Keep it free of generic template
marks: no glows, gradients, rounded cards, pill buttons, scroll fades or
grey second halves in headings. Light belongs to the app's ring: inside the
iPhone, and as thin arcs of the same flow round the phone, running in toward
it for power coming into the home and out for power leaving, with the phone's
reading. Motion must show something, such as the ring, the example day, the
plan dial, the receipt or the app tour. `home.css` holds the home page's
styles and `home.js` runs it, respecting Reduce Motion: the ring holds still
with a chevron for direction and the arcs stop. The other pages keep
`sourceful.css`.

Sourceful maintains the product; Fredrik owns its direction. PRs are welcome,
preferably based on [issues](https://github.com/srcfl/ftw-web/issues). Share a
short Markdown proposal or a focused fix with relevant evidence. Work is
agentic first; see [CONTRIBUTING.md](CONTRIBUTING.md). Keep existing license
and attribution intact. Inspect rendered copy before publishing.

## Installation copy

[Install and update FTW](https://github.com/srcfl/ftw/blob/master/docs/native-beta.md)
is the single source for installation commands and update paths. Link to it
instead of copying version numbers or shell commands into this site.
2.x and 3.x receive no more updates; recommend the new 0.x line. The old
Pi image, one-line Docker installer and 3.x Home Assistant beta are not
current install choices. Explain that a new setup is available now but guided
transfer of old settings and history is not ready. For an existing Pi, put the
physical SD-card swap before install commands. Present same-host Docker as a
separate option for people who can manage its services, not the next step
after a failed native install.

## Public entry points

- iPhone beta: https://testflight.apple.com/join/E4Japad7
- Webapp and interactive demo: https://app.ftw.energy/
- Home Assistant app: https://github.com/srcfl/ftw/blob/master/docs/home-assistant-app.md
- ChatGPT integration and its availability: `/chatgpt`
- Anonymous project statistics: https://stats.ftw.energy/
- FTW plugin for assistants: https://github.com/srcfl/ftw-plugin
- Discord: https://discord.gg/UK2ygPBu8N (Swedish channel: https://discord.gg/25xcBzQaux)

## News and box waitlist sign-ups

The home page's two forms post to `/api/signup` in `_worker.js`. It accepts
same-origin JSON only, checks the address, list and country, ignores a filled
hidden field and answers the same for a new and a known address. Rows go to a
D1 database bound as `SIGNUPS_DB`, kept apart from the anonymous
`FUTURE_DB` votes because it holds email addresses. Production and preview
share the EU database `ftw-signups`
(`32851378-602c-4b71-b3ea-69e85acff569`); its schema is `signups.sql`.
Without the binding the endpoint answers 503 and the forms say sign-up is
closed. Test only with your own address, then delete that row. Each row records the consent
version that `privacy.html#email` describes; change both together. Name the
email service in the privacy notice before the first send.

## Local dev

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The static server does not run `_worker.js`,
so the sign-up forms report that sign-up is closed.

```bash
node --test tests/*.test.mjs
```

## Product license

FTW code uses AGPL-3.0-only with the narrow Energyplan combination permission.
Commercial FTW use is allowed under the AGPL terms. The proprietary Energyplan
worker is free for private household use; commercial worker use, bundling and
paid services require a separate written Sourceful license. Keep product copy
consistent with [LICENSING.md](LICENSING.md), which also explains the separate
rights in website artwork and brands.
