# Amafaranga spec

Milestone one: what the app is, what it stores, how it looks and how it stays accessible.

## Purpose

A student finance tracker. Log spending, set a cap, see totals in Rwandan francs or six other African currencies. Everything stays in the browser.

## Who it is for

A university student in Kigali with a monthly allowance who loses track of small daily spending.

## Data model

| Field | Type | Rule |
|---|---|---|
| id | string | `rec_` plus at least four digits, unique |
| description | string | no spaces at either end, no double spaces, at most 80 characters |
| amount | number | RWF, zero or more, at most two decimals |
| category | string | letters, single spaces or hyphens between words |
| date | string | YYYY-MM-DD and a real calendar day |
| createdAt | string | ISO timestamp set once |
| updatedAt | string | ISO timestamp refreshed on every edit |

Settings: display currency, six manual exchange rates (per 1,000 RWF), cap in RWF, category list.

## Sections

1. Dashboard: the note, exchange counter, stats, seven day chart, category breakdown
2. Ledger: search, sort, table or cards, inline edit, delete
3. New entry: form with live validation and a preview slip
4. Settings: currency, theme, rates, cap, categories, data import and export
5. About: purpose, contact, keyboard map

## Wireframes

Phone, about 360px wide:

```
┌──────────────────────────┐
│ ◎ AMAFARANGA          ☾  │
│ DASHBOARD LEDGER NEW ... │
├──────────────────────────┤
│ Your note                │
│ ┌──────────────────────┐ │
│ │ AF 0015 · 13 OCT     │ │
│ │ Spent so far         │ │
│ │ 1,767,951            │ │
│ │ RWANDAN FRANCS       │ │
│ │ 88%                  │ │
│ │ ▮▮▮▮▮▮▮▮▮▮▮▮▮▯▯      │ │
│ └──────────────────────┘ │
│ (RWF)(KES)(UGX)(TZS)     │
│ (NGN)(GHS)(XOF)          │
│ ┌─────────┐┌─────────┐   │
│ │ Entries ││ Biggest │   │
│ └─────────┘└─────────┘   │
│ Seven days  ▁▃▂▁█▁▂      │
│ Where it went            │
└──────────────────────────┘
```

Desktop, 1024px and up:

```
┌───────────────────────────────────────────────────────────┐
│ ◎ AMAFARANGA     DASHBOARD LEDGER NEW ENTRY SETTINGS  ☾   │
├───────────────────────────────────────────────────────────┤
│ Your note                                                 │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ AF 0015 · 13 OCT 2026                     88%     ┃   │ │
│ │ Spent so far                 (rosette)    note    ┃   │ │
│ │ 1,767,951                                 text    ┃   │ │
│ │ RWANDAN FRANCS                                    ┃   │ │
│ └───────────────────────────────────────────────────────┘ │
│ Exchange counter (RWF)(KES)(UGX)(TZS)(NGN)(GHS)(XOF)      │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                  │
│ │Entries ││Biggest ││Month   ││Average │                  │
│ └────────┘└────────┘└────────┘└────────┘                  │
│ ┌──────────────────────────┐┌─────────────────────┐       │
│ │ Seven days  bar chart    ││ Where it went       │       │
│ └──────────────────────────┘└─────────────────────┘       │
└───────────────────────────────────────────────────────────┘
```

Ledger, desktop:

```
┌───────────────────────────────────────────────────────────┐
│ Ledger                                       [New entry]  │
│ / coffee|tea                          /i    [ ] Match case│
│ Try one: [coffee|tea] [\.\d{2}\b] [\b(\w+)\s+\1\b]        │
│ 3 of 15 entries match, newest first                       │
│ Sort by (Date ↓) (Description) (Amount)                   │
│ SERIAL   DATE        ENTRY                 AMOUNT         │
│ AF 0015  13 Oct 2026 Café Neo, black coffee 2,200 Edit Del│
└───────────────────────────────────────────────────────────┘
```

## Accessibility plan

* Semantic landmarks and one h1 per view
* Skip link first in the tab order
* Labels bound to every input, hints and errors linked with aria-describedby
* aria-live polite for general updates and the cap while under, assertive once over
* role="status" for search counts and import reports
* Visible focus ring in both themes, contrast of 4.5:1 for text
* Every feature usable from the keyboard, with shortcuts that never fire while typing
* Motion turned off under prefers-reduced-motion

## Visual direction

The note. In dark mode the page is an ink green desk and the dashboard total is printed on a paper banknote with a guilloché rosette, a red serial number and a gold security thread. In light mode the paper becomes the desk and the note turns ink green. Display type is Cormorant for the engraved feel, everything else is Space Mono, like a teller's receipt.
