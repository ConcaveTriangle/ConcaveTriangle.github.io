# Jerry Guo — personal website

A static personal site with project overviews, publications, and selected AoPS
solutions. HTML, CSS, and a small navigation script; no third-party dependencies.

## Preview and checks

Requires Node.js 20 or later.

```sh
npm run dev
npm run check
npm run build
```

The local preview runs at `http://127.0.0.1:4173`. The build validates all local
links and copies the public files into `dist/`. The root files also remain
compatible with GitHub Pages; `CNAME` preserves the existing custom domain.

## Editing content

- `index.html`: introduction, current projects, publications, and AoPS solutions.
- `projects/*.html`: individual project overviews.
- `research/laweducator.html`: publication overview and verified DOI.
- `index.css`: shared appearance and responsive layouts.
- `site.js`: navigation and footer year.

Eliza v2 and SelfPortrait v2 link explicitly to their earlier public versions.
The original NAS project, generated notes, and geometry experiment have been
removed. The AoPS links point to solutions signed ConcaveTriangle; they are a
selection, not an exhaustive list of contributions.

The China notes in `input/` are a writing-style reference. They are ignored by
Git and excluded from the build, along with all other local reference files.
Private repository URLs, machine names, credentials, personal conversation
examples, and unpublished research claims are not included in the website.

The Sites preview is configured in `.openai/hosting.json`. It is separate from
the existing public GitHub Pages website; publishing there requires pushing
the intended source state to that repository.
