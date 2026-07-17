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

## Local dev

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
