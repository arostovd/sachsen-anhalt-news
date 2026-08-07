// Builds index.html from whatever sits in ausgaben/.
//
// The directory is the single source of truth: drop a new file in, run this,
// and the landing page picks it up. No manifest to keep in sync — a manifest
// would be one more thing that can silently disagree with reality.
//
// Naming convention inside ausgaben/:
//   YYYY-MM-DD.html              the card dashboard (the thing you want on a phone)
//   YYYY-MM-DD.md                the long-form report
//   YYYY-MM-DD-filter.md         the filter log for that edition
//   YYYY-MM-DD-filter-<name>.md  a filter log split by source

const AUSGABEN_DIR = "ausgaben";

// Markdown served straight from Pages arrives as text/markdown, which phone
// browsers download instead of display — the exact friction this site exists
// to remove. GitHub's own blob view renders it readably on a phone and needs
// no login on a public repository, so the .md links point there instead.
const BLOB_BASE =
  "https://github.com/arostovd/sachsen-anhalt-news/blob/main/ausgaben";

export type FileKind = "dashboard" | "report" | "filter";

export interface FilterFile {
  file: string;
  // Present only when the edition has more than one filter log, e.g. "mdr".
  label?: string;
}

export interface Edition {
  date: string;
  dashboard?: string;
  report?: string;
  filters: FilterFile[];
  // Pulled out of the report body; purely decorative on the index page.
  period?: string;
  balance?: string;
}

interface ParsedName {
  date: string;
  kind: FileKind;
  label?: string;
}

const NAME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})(?:-filter(?:-([a-z0-9-]+))?)?\.(html|md)$/;

// Returns null for anything that does not follow the convention, so stray
// files in the directory are ignored rather than breaking the build.
export function parseFileName(name: string): ParsedName | null {
  const m = NAME_PATTERN.exec(name);
  if (!m) return null;
  const [, date, label, ext] = m;
  const isFilter = name.includes("-filter");
  if (isFilter) {
    if (ext !== "md") return null;
    return { date, kind: "filter", label };
  }
  return { date, kind: ext === "html" ? "dashboard" : "report" };
}

export function groupEditions(names: string[]): Edition[] {
  const byDate = new Map<string, Edition>();
  for (const name of names) {
    const parsed = parseFileName(name);
    if (!parsed) continue;
    let edition = byDate.get(parsed.date);
    if (!edition) {
      edition = { date: parsed.date, filters: [] };
      byDate.set(parsed.date, edition);
    }
    if (parsed.kind === "dashboard") edition.dashboard = name;
    else if (parsed.kind === "report") edition.report = name;
    else edition.filters.push({ file: name, label: parsed.label });
  }
  for (const edition of byDate.values()) {
    edition.filters.sort((a, b) => a.file.localeCompare(b.file));
  }
  // Newest first: the reason anyone opens this page is the latest edition.
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}

// The reports state their research window in one of two spellings. Both are
// worth showing, because "04.08." alone does not say how far back it reaches.
export function extractPeriod(markdown: string): string | undefined {
  // The filler between the label and the dates varies: bare ": ", markdown
  // bold, or prose such as "Aktueller Monat (". Anything non-numeric up to a
  // short distance is skipped, which keeps the label anchored to its own dates.
  const m =
    /(?:Recherche)?[Zz]eitraum:?[^0-9\n]{0,40}([0-9]{1,2}\.[0-9]{1,2}\.?[0-9]{0,4}\s*[–-]\s*[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4})/
      .exec(markdown);
  return m ? m[1].trim() : undefined;
}

// The filter logs carry a one-line tally of seen/kept/dropped entries.
export function extractBalance(markdown: string): string | undefined {
  const m = /\*\*Bilanz:\*\*\s*(.+)/.exec(markdown);
  return m ? m[1].trim() : undefined;
}

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d}. ${MONTHS[m - 1]} ${y}`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function filterLabel(filter: FilterFile): string {
  if (!filter.label) return "Filter-Log";
  return `Filter-Log (${filter.label.toUpperCase()})`;
}

function renderEdition(edition: Edition, isLatest: boolean): string {
  const links: string[] = [];
  if (edition.dashboard) {
    links.push(
      `<a class="link primary" href="${AUSGABEN_DIR}/${
        escapeHtml(edition.dashboard)
      }">Dashboard ansehen</a>`,
    );
  }
  if (edition.report) {
    links.push(
      `<a class="link" href="${BLOB_BASE}/${
        escapeHtml(edition.report)
      }">Bericht lesen</a>`,
    );
  }
  for (const filter of edition.filters) {
    links.push(
      `<a class="link" href="${BLOB_BASE}/${escapeHtml(filter.file)}">${
        escapeHtml(filterLabel(filter))
      }</a>`,
    );
  }

  const meta: string[] = [];
  if (edition.period) {
    meta.push(
      `<span class="meta-item">Zeitraum ${escapeHtml(edition.period)}</span>`,
    );
  }
  if (edition.balance) {
    meta.push(`<span class="meta-item">${escapeHtml(edition.balance)}</span>`);
  }
  if (!edition.dashboard) {
    meta.push(`<span class="meta-item muted">nur als Bericht</span>`);
  }

  return `      <article class="edition${isLatest ? " latest" : ""}">
        <div class="edition-head">
          <h2>${escapeHtml(formatDate(edition.date))}</h2>
          ${isLatest ? '<span class="badge">aktuell</span>' : ""}
        </div>
        ${meta.length > 0 ? `<div class="meta">${meta.join("")}</div>` : ""}
        <div class="links">${links.join("")}</div>
      </article>`;
}

export function renderIndexHtml(
  editions: Edition[],
  generatedAt: string,
): string {
  const cards = editions
    .map((edition, i) => renderEdition(edition, i === 0))
    .join("\n");
  const empty = `      <p class="empty">Noch keine Ausgaben vorhanden.</p>`;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Neues aus Sachsen-Anhalt</title>
<meta name="description" content="Wöchentliche Nachrichtenübersicht für Sachsen-Anhalt mit Schwerpunkt Halle (Saale), aus öffentlichen Quellen zusammengestellt.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --surface:    #fcfcfb;
    --plane:      #f4f3f0;
    --text:       #0b0b0b;
    --secondary:  #52514e;
    --muted:      #898781;
    --border:     rgba(11,11,11,0.10);
    --accent:     #2a78d6;
    --font-head:  'Fraunces', Georgia, serif;
    --font-body:  'Inter', system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surface:   #16161a;
      --plane:     #101013;
      --text:      #f2f1ee;
      --secondary: #b3b1ab;
      --muted:     #86847e;
      --border:    rgba(255,255,255,0.12);
      --accent:    #6ea8f0;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0 20px 64px;
    background: var(--plane);
    color: var(--text);
    font-family: var(--font-body);
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
  }
  .wrap { max-width: 720px; margin: 0 auto; }
  header { padding: 56px 0 32px; }
  h1 {
    font-family: var(--font-head);
    font-weight: 700;
    font-size: clamp(2rem, 7vw, 2.75rem);
    line-height: 1.1;
    margin: 0 0 12px;
    letter-spacing: -0.01em;
  }
  .lede { color: var(--secondary); margin: 0; font-size: 1.05rem; }
  .edition {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 22px;
    margin-bottom: 14px;
  }
  .edition.latest { border-color: var(--accent); }
  .edition-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .edition h2 {
    font-family: var(--font-head);
    font-weight: 600;
    font-size: 1.4rem;
    margin: 0;
  }
  .badge {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
    border: 1px solid currentColor;
    border-radius: 999px;
    padding: 2px 9px;
  }
  .meta { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px 14px; }
  .meta-item { font-size: 0.85rem; color: var(--secondary); }
  .meta-item.muted { color: var(--muted); font-style: italic; }
  .links { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; }
  .link {
    display: inline-block;
    font-size: 0.9rem;
    font-weight: 500;
    text-decoration: none;
    color: var(--text);
    background: var(--plane);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 7px 15px;
  }
  .link.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .link:hover { border-color: var(--accent); }
  .empty { color: var(--muted); }
  footer {
    margin-top: 36px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    font-size: 0.82rem;
    color: var(--muted);
  }
  footer a { color: inherit; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Neues aus Sachsen-Anhalt</h1>
      <p class="lede">Nachrichtenübersicht mit Schwerpunkt Halle (Saale). Zusammengestellt aus MDR Sachsen-Anhalt, den Pressemitteilungen der Landesregierung und der Parlamentsdokumentation des Landtags.</p>
    </header>
    <main>
${editions.length > 0 ? cards : empty}
    </main>
    <footer>
      <p>Zuletzt erzeugt am ${
    escapeHtml(generatedAt)
  }. Alle Inhalte stammen aus öffentlich zugänglichen Quellen und sind dort verlinkt.</p>
    </footer>
  </div>
</body>
</html>
`;
}

export function berlinTimestamp(now: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "long",
    timeStyle: "short",
  }).format(now);
}

async function main(): Promise<void> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(AUSGABEN_DIR)) {
    if (entry.isFile) names.push(entry.name);
  }
  const editions = groupEditions(names);

  // Reading the bodies is what makes the index more than a file listing.
  for (const edition of editions) {
    if (edition.report) {
      const body = await Deno.readTextFile(`${AUSGABEN_DIR}/${edition.report}`);
      edition.period = extractPeriod(body);
    }
    const primaryFilter = edition.filters[0];
    if (primaryFilter) {
      const body = await Deno.readTextFile(
        `${AUSGABEN_DIR}/${primaryFilter.file}`,
      );
      edition.balance = extractBalance(body);
    }
  }

  const html = renderIndexHtml(editions, berlinTimestamp(new Date()));
  await Deno.writeTextFile("index.html", html);
  console.log(`index.html geschrieben — ${editions.length} Ausgabe(n):`);
  for (const e of editions) {
    const parts = [
      e.dashboard ? "html" : null,
      e.report ? "md" : null,
      e.filters.length > 0 ? `${e.filters.length}× filter` : null,
    ].filter((p): p is string => p !== null);
    console.log(`  ${e.date}  ${parts.join(", ")}`);
  }
}

if (import.meta.main) await main();
