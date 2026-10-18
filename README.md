# Amafaranga
Link to the deployed site : https://gabrielagaba1.github.io/Building-RI_summative/

**Theme chosen:** Student Finance Tracker

Amafaranga (Kinyarwanda for money) is a finance tracker for students whose money leaves in small amounts: a moto here, a brochette there, airtime on Sunday. You log what you spend, set a cap, and the dashboard prints your total on a banknote with a gold security thread that fills up as you get close to the cap.

It is plain HTML, CSS and JavaScript. No frameworks, no build step, no server. Everything is saved in the browser.


**Demo video:** [add your unlisted YouTube link here]

---

## Features

* **Dashboard.** The note shows total spent, the latest serial number and how much of the cap is used. Below it: entry count, biggest category, this month's total, average entry, a seven day bar chart and a category breakdown.
* **Ledger.** Every entry in a table on desktop and stacked cards on phones. Sort by date, description or amount in either direction.
* **Live regex search.** Type any pattern, see matches highlighted with `<mark>`. Broken patterns show a friendly message instead of crashing. Match case can be toggled. Slash syntax like `/tea/i` also works.
* **New entry form.** Real time regex validation with inline messages and a preview slip that updates as you type and gets stamped when you submit.
* **Inline edit and delete.** Edit any row in place. Delete asks for confirmation in a proper dialog. Every change updates `updatedAt`, the stats and the cap.
* **Spending cap.** Polite live announcement while you are under, assertive one when you go over. The note also gets an "Over cap" stamp.
* **Seven currencies.** RWF is the base. Amounts can be shown in KES, UGX, TZS (East Africa) and NGN, GHS, XOF (West Africa). Rates are typed in by hand in Settings.
* **Data.** Auto save to `localStorage`, JSON export, JSON import with record by record validation, CSV export with proper escaping, a sample data loader and an erase button.
* **Light and dark.** Follows the device by default. The toggle and the Settings choice are remembered.
* **Keyboard first.** Shortcuts for every section, visible focus everywhere, a skip link and focus that moves to the right place after each action.

## Running it

ES modules do not load from `file://`, so serve the folder:

```bash
# any of these, from the project folder
python -m http.server 8000
npx serve .
```

Then open http://localhost:8000. In VS Code, the Live Server extension works too.

On first visit the app loads `seed.json` so there is something to look at. Erase it from Settings whenever.

## Running the tests

Open http://localhost:8000/tests.html. It runs 50+ small assertions covering every regex rule, the safe regex compiler, highlighting, import validation, currency conversion, cap logic, sorting and CSV escaping. The summary at the top should read all passed.

## Regex catalog

| Rule | Pattern | Passes | Fails |
|---|---|---|---|
| Description, no stray spaces at the ends | `^\S(?:.*\S)?$` | `Lunch at cafeteria` | ` Lunch`, `Lunch ` |
| Description, no double spaces | ` {2,}` (must not match) | `Moto to Kacyiru` | `Moto  to Kacyiru` |
| Amount | `^(0\|[1-9]\d*)(\.\d{1,2})?$` | `0`, `12.50`, `450000` | `012`, `1.234`, `-5` |
| Date | `^\d{4}-(0[1-9]\|1[0-2])-(0[1-9]\|[12]\d\|3[01])$` | `2026-10-13`, `2024-02-29` | `2026-13-01`, `13/10/2026` |
| Category | `^[A-Za-z]+(?:[ -][A-Za-z]+)*$` | `Food`, `Late night snacks` | `Food!`, ` Food` |
| **Advanced:** repeated word (back reference) | `\b(\w+)\s+\1\b` with `i` | finds `for for` in "Airtime for for the week" | nothing in "the then" |
| **Advanced:** exchange rate (lookahead) | `^(?=.*[1-9])\d{1,7}(?:\.\d{1,4})?$` | `89`, `0.05` | `0`, `0.000`, `1.23456` |
| Record id on import | `^rec_\d{4,}$` | `rec_0001` | `rec_1`, `txn_0001` |

The date rule is followed by a calendar check, so `2026-02-30` and `2025-02-29` are rejected even though they match the pattern.

The repeated word rule shows a soft warning in the form, since sometimes it is on purpose. The rate rule blocks saving: the lookahead `(?=.*[1-9])` insists on at least one non zero digit, so a rate of zero can never sneak in and turn every amount into nothing.

### Search patterns worth trying

These are also buttons under the search box.

| Pattern | What it finds |
|---|---|
| `coffee\|tea` | Drinks. Three entries in the sample data |
| `\.\d{2}\b` | Amounts with cents, like 1250.50 |
| `\b(\w+)\s+\1\b` | Descriptions with a repeated word |
| `^2026-10` | Everything dated October 2026 |
| `(` | A broken pattern, to show the error handling |

## Keyboard map

| Key | Action |
|---|---|
| `1` to `5` | Dashboard, Ledger, New entry, Settings, About |
| `N` | New entry, with focus in the description |
| `/` | Jump to the ledger search |
| `T` | Switch light and dark |
| `Tab` and `Shift Tab` | Move through controls |
| `Enter` | Submit the focused form or press the focused button |
| `Esc` | Cancel an inline edit or close a dialog |

Shortcuts are ignored while you are typing in a field.

## Accessibility notes

* Landmarks: `header`, `nav`, `main`, `section`, `footer`. One `h1` per view with `h2` inside.
* Skip to content link is the first thing you hit with Tab.
* Every input has a bound `<label>`. Error and hint text is tied to inputs with `aria-describedby`, and invalid fields get `aria-invalid`.
* Live regions: general updates go to a polite region. Cap updates go to a polite region while under the cap and an assertive one when it is exceeded. Search result counts use `role="status"`.
* Highlights use `<mark>` with hidden "match" and "end match" text for screen readers that ignore `<mark>`.
* Visible focus ring on everything, in a colour that reaches 3:1 against both themes.
* Text contrast is at least 4.5:1 in both themes. Muted text in light mode is #56645A on #F1EBDA (about 5.2:1).
* Sort buttons use `aria-pressed`. Table headers carry `aria-sort`. The chart has a text version of every bar for screen readers.
* After navigating, focus moves to the new view's heading. After deleting, focus moves to the next row. Dialogs return focus to the button that opened them.
* All motion is disabled under `prefers-reduced-motion`.

## Responsive design

Mobile first with three breakpoints:

* **Base, from 320px.** Single column. The ledger becomes cards. The gold thread runs horizontally.
* **360px.** Bigger coins and more padding on the note.
* **768px.** Sticky header, two column dashboard, the ledger becomes a real table, the gold thread turns vertical.
* **1024px.** Wider dashboard split, the preview slip sits beside the form and stays in view.

## Data model

```json
{
  "id": "rec_0007",
  "description": "Lunch at ALU cafeteria",
  "amount": 3500,
  "category": "Food",
  "date": "2026-10-08",
  "createdAt": "2026-10-08T10:30:00.000Z",
  "updatedAt": "2026-10-08T10:30:00.000Z"
}
```

Amounts are always stored in RWF. Exports wrap the records with the settings:

```json
{ "app": "Amafaranga", "version": 1, "exportedAt": "...", "settings": { }, "records": [ ] }
```

Import accepts either that object or a bare list of records. If any record fails validation, nothing is loaded and the problems are listed line by line.

## Project structure

```
index.html          the app
tests.html          assertions page
seed.json           15 sample records with edge cases
assets/             favicon
styles/tokens.css   colour and type tokens for light and dark
styles/main.css     layout, components, breakpoints, motion
scripts/main.js     wires events to state and rendering
scripts/state.js    records, settings, view state, sorting
scripts/storage.js  localStorage reads and writes
scripts/validators.js  every regex rule and import checks
scripts/search.js   safe regex compiler, filter, highlight
scripts/stats.js    totals, seven day trend, cap status
scripts/currency.js currencies and conversion
scripts/ui.js       everything that touches the DOM
scripts/router.js   hash based sections
scripts/theme.js    light, dark, device
scripts/io.js       JSON and CSV export, import, seed
scripts/tests.js    the assertions
docs/spec.md        milestone one: spec, wireframes, a11y plan
```

## Seed data edge cases

`seed.json` has 15 records chosen to poke at things: a leap day (2024-02-29), new year's eve and new year's day, a zero amount, a half franc, a 1,250,000 laptop, cents (1250.50), HTML characters in a description (`<with>` and `&`), quotes and commas for CSV, an accented letter (Café) and a repeated word for the back reference search.

## Contact

Gabriel Agaba · [github.com/gabrielagaba1](https://github.com/gabrielagaba1) · g.agaba@alustudent.com
