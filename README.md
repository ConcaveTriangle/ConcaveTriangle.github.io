# Jerry Guo's website

Static HTML, CSS, and JavaScript for [www.concavetriangle.com](https://www.concavetriangle.com).
The current site source lives at the repository root. `dist/` is generated output;
edit the source, then rebuild. There are no third-party runtime or build dependencies.

## Local development

Use Node.js 24 or later (`.nvmrc` selects 24). No dependency installation is needed.

```sh
node --run dev       # http://127.0.0.1:4173
node --run check     # Page metadata, local links/assets, and anchors
node --run test      # Attractor math, state, and export regression checks
node --run build     # Validate source, rebuild dist/, then validate output
node --run preview   # Serve the generated dist/ at the same preview address
```

Stop the development server before starting the output preview. Set `PORT` to use
a different port. Standard npm equivalents (`npm run build`, `npm test`, etc.) also work.
The link check does not fetch external websites.

The build adds a content hash to local CSS and JavaScript URLs, so a changed
asset gets a new URL and bypasses stale browser/CDN caches. The source pages also
include an initial version for the migration from the old website. Deploy with
the GitHub Actions workflow so future builds update these versions automatically.

## Editing

- `index.html`, `index.css`, `site.js`: homepage, shared styles, and navigation.
- `projects/` and `research/`: project and publication pages.
- `studios/attractors/`: interactive attractor viewer and PNG/SVG exports.
- `studios/halvorsen/index.html`: redirect for the original studio URL.
- `scripts/check.mjs`: the public-file allowlist. Add new assets here when needed;
  HTML pages directly inside `projects/` and `research/` are included automatically.
- `tests/`: numerical and application regression checks recovered with the site.

## GitHub Pages deployment

1. In the repository's **Settings → Pages → Build and deployment**, set **Source**
   to **GitHub Actions**.
2. Keep the custom domain set to `www.concavetriangle.com` in Pages settings and
   enable **Enforce HTTPS** when available. `CNAME` is preserved in the source and
   output; Actions deployments use the custom domain configured in Pages settings.
3. Commit and push the prepared source to `master`. The workflow runs the tests,
   validates and builds the site, and deploys only `dist/`. It can also be run
   manually from the Actions tab on `master`. Pull requests run validation without
   deploying.

The workflow uses the repository's automatic `GITHUB_TOKEN`; no personal access
token or repository secret is required. The `github-pages` environment must allow
deployments from `master`. See GitHub's [publishing source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
and [custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

For another static host, use `node --run build` and publish `dist/`.
The existing Sites association remains in `.openai/hosting.json`, with `dist/` as
its static output. Sites packaging adds that manifest separately; the public
build does not include hosting metadata.

## Repository hygiene

`.gitignore` excludes build output, preview archives, local writing references in
`input/` and `inputs/`, scratch notes, dependencies, environment files, logs, and
OS/editor files. `.gitattributes` keeps source line endings consistent across platforms.
The build and preview server use the public-file allowlist, so local files and
tooling are excluded even when present on disk. Older unused font assets and
scripts are not included in the build.

Previously tracked previews, generated output, local references, and `.DS_Store`
files were removed from Git tracking while retaining local copies. Their earlier
committed versions remain in Git history; this cleanup does not rewrite history.
