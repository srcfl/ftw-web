# FTW website

Canonical project landing page for [FTW](https://github.com/srcfl/ftw).

Lean static site. Plain HTML, CSS and a small menu script, no build step.

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
Do not publish predicted savings as measured results.

Product screenshots show the complete app viewport, without cropping or
changing the interface. Use the public webapp demo and the iOS app's built-in
demo. Label simulated homes. These show the interface, not measured savings
or a worker benchmark. Keep HTML dimensions in step with the image files.

Current images: `assets/ftw-webapp-now.webp` comes from the public demo at
430 × 932 CSS pixels; `assets/ftw-ios-now.webp` comes from the iPhone 17 Pro
simulator, built from `srcfl/ftw-app` commit `4448968`. Both use simulated data.
`home.css` holds homepage styles; the shared stylesheet also serves the
support, privacy and ChatGPT pages.

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

## Local dev

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Product license

FTW code uses AGPL-3.0-only with the narrow Energyplan combination permission.
Commercial FTW use is allowed under the AGPL terms. The proprietary Energyplan
worker is free for private household use; commercial worker use, bundling and
paid services require a separate written Sourceful license. Keep product copy
consistent with [LICENSING.md](LICENSING.md), which also explains the separate
rights in website artwork and brands.
