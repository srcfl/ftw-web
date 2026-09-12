# FTW website

Canonical project landing page for [FTW](https://github.com/srcfl/ftw).

Lean static site. Plain HTML and CSS, no build step.

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
Explain mixed-equipment coordination, simple defaults, local control and
visible outcomes. Clearly distinguish implemented capabilities from goals
such as cloud MCP. Do not publish predicted savings as measured results.

Sourceful maintains the product; Fredrik owns its direction. PRs are welcome,
preferably based on [issues](https://github.com/srcfl/ftw-web/issues). Share a
short Markdown proposal or a focused fix with relevant evidence. Work is
agentic first; see [CONTRIBUTING.md](CONTRIBUTING.md). Keep existing license
and attribution intact. Inspect rendered copy before publishing.

## Local dev

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
