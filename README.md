# Neues aus Sachsen-Anhalt

A recurring news digest for Saxony-Anhalt with a focus on Halle (Saale),
compiled from publicly available sources.

**Read it here: <https://arostovd.github.io/sachsen-anhalt-news/>**

## Sources

- MDR Sachsen-Anhalt (headline feed and section pages)
- Press releases of the state government of Saxony-Anhalt
- PADOKA, the parliamentary documentation of the Landtag (bills, printed
  matter, minor interpellations)

Every item links back to its original source. Nothing here is original
reporting — the value added is selection, grouping and a short classification
of why an item matters locally.

## What is in this repository

Everything under `ausgaben/` is generated output, one set of files per edition:

| File | Purpose |
| --- | --- |
| `YYYY-MM-DD.html` | Card dashboard — the readable version, served by GitHub Pages |
| `YYYY-MM-DD.md` | Long-form report with the classification notes |
| `YYYY-MM-DD-filter.md` | Filter log: every item seen, kept or dropped, with the reason |
| `YYYY-MM-DD-filter-<source>.md` | Same, split per source in older editions |

The filter log is published on purpose. A digest that only shows what survived
the filter cannot be checked; the log makes the selection auditable.

Not every edition has a dashboard — the HTML layout was introduced in July 2026,
so earlier editions exist as a report only.

## Building the index

`index.html` is generated from the contents of `ausgaben/`. There is no
manifest to keep in sync: the directory is the source of truth.

```sh
deno task build    # regenerate index.html
deno task test     # unit tests
deno task check    # type check, lint, format check
```

Markdown files are linked through GitHub's blob view rather than served
directly, because GitHub Pages returns `text/markdown`, which mobile browsers
download instead of rendering.

## Note on the pipeline

The research and rendering pipeline itself is not part of this repository —
only its output is.
