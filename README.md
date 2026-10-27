# benlonnqvist.github.io

Personal site of Ben Lonnqvist, Head of NeuroAI at [Read/Write Labs](https://readwritelabs.com).
A small custom Jekyll site with no theme dependency. GitHub Pages builds it automatically on push.

## Editing content

| What | Where |
|---|---|
| Papers | `_data/publications.yml` (copy an entry; your name is bolded automatically) |
| Talks & posters | `_data/talks.yml` |
| Research themes on the home page | `_data/research.yml` |
| News posts | `_posts/YYYY-MM-DD-short-title.md` |
| Bio, hero text | `index.html` |
| Name, role, email (shown as written), profile links | `_config.yml` |
| CV | `cv/Ben_Lonnqvist_CV.tex` → compile to `cv/Ben_Lonnqvist_CV.pdf` |

Set `featured: true` on a paper to show it under "Selected publications" on the home page.

## Preview locally

```bash
bundle install
bundle exec jekyll serve   # http://localhost:4000
```

## Rebuild the CV

Needs XeLaTeX and the free [IBM Plex](https://github.com/IBM/plex) fonts.

```bash
cd cv && xelatex Ben_Lonnqvist_CV.tex && xelatex Ben_Lonnqvist_CV.tex
```

## Structure

- `_layouts/`, `_includes/`: page templates
- `assets/css/site.css`: all styles (dark theme; colours are CSS variables at the top)
- `assets/js/pubs.js`: publication filters, search, BibTeX copy
- `assets/js/flappy-brain.js`: Flappy Brain mini game (not currently shown). To show it, add the `<figure id="game">` with `<canvas id="flappy">` back to `index.html` and load the script
- `download/`: posters
