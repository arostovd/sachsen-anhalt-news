import { assertEquals } from "@std/assert";
import {
  type Edition,
  escapeHtml,
  extractBalance,
  extractPeriod,
  formatDate,
  groupEditions,
  parseFileName,
  renderIndexHtml,
} from "./build-index.ts";

Deno.test("parseFileName recognises the three file kinds", () => {
  assertEquals(parseFileName("2026-08-04.html"), {
    date: "2026-08-04",
    kind: "dashboard",
  });
  assertEquals(parseFileName("2026-08-04.md"), {
    date: "2026-08-04",
    kind: "report",
  });
  assertEquals(parseFileName("2026-08-04-filter.md"), {
    date: "2026-08-04",
    kind: "filter",
    label: undefined,
  });
  assertEquals(parseFileName("2026-05-30-filter-mdr.md"), {
    date: "2026-05-30",
    kind: "filter",
    label: "mdr",
  });
});

Deno.test("parseFileName ignores files outside the convention", () => {
  for (
    const name of [
      "README.md",
      "raw_mdr_2026-08-04.md",
      "2026-08-04.txt",
      "2026-8-4.md",
      "2026-08-04-filter.html",
      "index.html",
    ]
  ) {
    assertEquals(parseFileName(name), null, `expected null for ${name}`);
  }
});

Deno.test("groupEditions collects files per date, newest first", () => {
  const editions = groupEditions([
    "2026-05-30.md",
    "2026-08-04.html",
    "2026-08-04.md",
    "2026-08-04-filter.md",
    "2026-05-30-filter-mdr.md",
    "2026-05-30-filter-landesregierung.md",
    "stray-file.md",
  ]);
  assertEquals(editions.length, 2);
  assertEquals(editions[0].date, "2026-08-04");
  assertEquals(editions[0].dashboard, "2026-08-04.html");
  assertEquals(editions[0].report, "2026-08-04.md");
  assertEquals(editions[0].filters, [{
    file: "2026-08-04-filter.md",
    label: undefined,
  }]);
  // Older edition has no dashboard and two filter logs, sorted by file name.
  assertEquals(editions[1].date, "2026-05-30");
  assertEquals(editions[1].dashboard, undefined);
  assertEquals(editions[1].filters.map((f) => f.label), [
    "landesregierung",
    "mdr",
  ]);
});

Deno.test("extractPeriod handles both spellings used in the reports", () => {
  assertEquals(
    extractPeriod("**Recherchezeitraum:** 25.05.–27.05.2026\n"),
    "25.05.–27.05.2026",
  );
  assertEquals(
    extractPeriod("Zeitraum: 28.07.–04.08.2026 (letzte 7 Tage)\n"),
    "28.07.–04.08.2026",
  );
  assertEquals(
    extractPeriod("Zeitraum: Aktueller Monat (01.06.2026 – 30.06.2026)\n"),
    "01.06.2026 – 30.06.2026",
  );
  assertEquals(extractPeriod("no period at all"), undefined);
  // The filler must not swallow a line break and pick up an unrelated date.
  assertEquals(
    extractPeriod("Zeitraum:\n\n01.06.2026 – 30.06.2026"),
    undefined,
  );
});

Deno.test("extractBalance picks up the tally line", () => {
  assertEquals(
    extractBalance(
      "**Bilanz:** 66 Einträge gesehen, 50 aufgenommen, 16 verworfen.\n",
    ),
    "66 Einträge gesehen, 50 aufgenommen, 16 verworfen.",
  );
  assertEquals(extractBalance("nothing here"), undefined);
});

Deno.test("formatDate renders German long form", () => {
  assertEquals(formatDate("2026-08-04"), "4. August 2026");
  assertEquals(formatDate("2026-12-31"), "31. Dezember 2026");
});

Deno.test("escapeHtml neutralises markup", () => {
  assertEquals(
    escapeHtml(`<script>"x" & 'y'</script>`),
    "&lt;script&gt;&quot;x&quot; &amp; 'y'&lt;/script&gt;",
  );
});

Deno.test("renderIndexHtml marks the newest edition and links every file", () => {
  const editions: Edition[] = [
    {
      date: "2026-08-04",
      dashboard: "2026-08-04.html",
      report: "2026-08-04.md",
      filters: [{ file: "2026-08-04-filter.md" }],
      period: "28.07.–04.08.2026",
      balance: "66 Einträge gesehen",
    },
    { date: "2026-05-28", report: "2026-05-28.md", filters: [] },
  ];
  const html = renderIndexHtml(editions, "7. August 2026 um 13:20");

  // The dashboard is served by Pages itself...
  assertEquals(html.includes('href="ausgaben/2026-08-04.html"'), true);
  // ...while markdown goes through GitHub's renderer so phones display it.
  const blob = "https://github.com/arostovd/sachsen-anhalt-news/blob/main";
  assertEquals(html.includes(`href="${blob}/ausgaben/2026-08-04.md"`), true);
  assertEquals(
    html.includes(`href="${blob}/ausgaben/2026-08-04-filter.md"`),
    true,
  );
  assertEquals(html.includes(`href="${blob}/ausgaben/2026-05-28.md"`), true);
  // No raw .md link may survive, or the download problem comes back.
  assertEquals(html.includes('href="ausgaben/2026-05-28.md"'), false);
  assertEquals(html.includes("4. August 2026"), true);
  assertEquals(html.includes("28. Mai 2026"), true);
  // Exactly one "aktuell" badge, on the first card.
  assertEquals(html.split('class="badge"').length - 1, 1);
  // The dashboard-less edition says so.
  assertEquals(html.includes("nur als Bericht"), true);
  assertEquals(html.includes("7. August 2026 um 13:20"), true);
});

Deno.test("renderIndexHtml survives an empty directory", () => {
  const html = renderIndexHtml([], "7. August 2026 um 13:20");
  assertEquals(html.includes("Noch keine Ausgaben vorhanden."), true);
  assertEquals(html.includes('class="badge"'), false);
});
