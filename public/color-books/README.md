# Color Books (seasons)

Color books are **static and saved in the system**. Each **season** (e.g. Fall Winter 2026) has one JSON file. Each season contains multiple **lines of color** (e.g. LINE 81, LINE 82, LINE 10). In the CSV, the **Color Book** column selects which line applies to each page.

**App-created lines:** Lines you create in the **Color Book** tab (e.g. from a board photo) are saved in `data/color-books/{SeasonId}.json`. The app and API always prefer `data/` over `public/`. For Python catalog generation, pass `--colors ../data/color-books/FallWinter2026.json` (or your season) so LINE 01 and other app-created lines are used.

## Structure

- **Color Book** = one season (e.g. `FallWinter2026`).
- **Line** = one set of swatches (e.g. `LINE 81` FRANCIA LEATHER, `LINE 82`, `LINE 10`). Each line has an `id`, `name`, and `colors` array.
- In catalog CSV, the column **Color Book** (or **Line**) holds the line id (e.g. `LINE 81`) for that row/page.

## Adding a new season

1. Create `public/color-books/{SeasonId}.json` (e.g. `SpringSummer2027.json`).
2. Use this structure:

```json
{
  "id": "SpringSummer2027",
  "name": "Spring Summer 2027",
  "season": "Spring Summer 2027",
  "lines": [
    {
      "id": "LINE 81",
      "name": "FRANCIA LEATHER",
      "colors": [
        { "code": "Col.01", "name": "White", "hex": "#FFFFFF" },
        { "code": "Col.90", "name": "Black", "hex": "#1a1a1a" }
      ]
    }
  ]
}
```

3. Add the season id to `manifest.json` (e.g. `["FallWinter2026", "SpringSummer2027"]`).

The Catalog Builder will list the new season in the Color Book menu. CSV rows can reference any line id (e.g. LINE 81, LINE 82) that exists in the selected season.
