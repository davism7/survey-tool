# Life insurance survey tool

A standalone California life insurance comparison prototype. The survey creates a ranked shortlist of real insurer products, explains why each appears, and links to an insurer quote or agent contact process. Link to its `index.html` URL from a button on your main website.

**Personalized dollar prices are not connected.** No quote-provider API or account has been supplied. The results explicitly say that a price must be obtained from the insurer. There are no invented premiums, advertised minimums presented as personalized rates, or automatic submissions to insurers.

## Run locally

From this repository:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Use a web server; opening the HTML through `file://` prevents JSON loading. No build step or dependencies are required. Reload the page after editing files.

## Project structure

- `index.html`: page structure and CSS/JavaScript entry points.
- `css/style.css`: responsive layout and survey/results styling.
- `js/app.js`: navigation, answer state, validation, comparison cards, and results.
- `js/recommendations.js`: filters, weighted matching, ordering, and explanations.
- `data/questions.json`: editable survey questions and options.
- `data/rules.json`: product catalog, official sources, age/term constraints, scoring, and discussion notes.
- `data/prices.json`: explicit unconnected quote status; product amounts remain `null`.
- `tests/recommendations.test.js`: ranking, filtering, data integrity, and pricing checks.
- `assets/`: reserved for static media.

## What the ranking means

The eight questions cover personal priorities and feature preferences. California is configured in `rules.json` as the default market, so users are not asked to confirm their location. The catalog currently contains Protective Classic Choice Term, State Farm Select Term, State Farm Limited Pay Whole Life, and New York Life Whole Life Insurance. It is a limited selection, not the whole market or a claim that these are the cheapest insurers.

1. Filter products to the configured California market and require an adult age band. Under-18 answers show guidance instead of policies.
2. Match a defined protection period to term insurance, or lifetime protection to whole life. A range uses its upper endpoint: 11–20 years explores a 20-year term. Unsupported terms are excluded.
3. Exclude term products when the entire selected age band is above the published maximum for that term. A partially overlapping age band is only a potential match; exact age and underwriting remain unconfirmed. Protective's age limits use its published non-tobacco maximums; tobacco limits may be lower. No health-class assumption is used to promise eligibility or prices.
4. Add 10 points for a matching protection period, 2 per relevant goal, and 3 per supported feature preference. If the duration is undecided, require at least one relevant goal. Feature preferences cannot create a match alone.
5. Sort descending by score. Equal scores share a rank and are ordered alphabetically. There are no artificial percentage match claims or popularity-based tie breakers.

Income, dependents, current coverage, and budget provide discussion context; they do not establish a coverage amount or premium. Budget does not affect ordering without real comparable quotes. Feature matches describe documented options, not exclusive advantages over every other insurer. Whole-life affordability and underwriting are unverified. The rules are a transparent prototype heuristic requiring professional review before use as financial advice.

## Editing questions and products

Each question needs a unique stable `id`, `category`, `title`, `description`, a `type` of `single` or `multiple`, and `options` with unique `value` and `label` fields. `exclusive: true` supports “none” or “not sure” in multiple-choice questions. Progress adjusts automatically to the number of questions.

When changing IDs or values, update `rules.json` references and the matching engine for structural changes. Product IDs must match `prices.json`. A term product's `termAges` maps term length to the published maximum issue age used for preliminary filtering. A product's `features` maps to the `priorities` question and `featureReasons`. Keep official source URLs and `checkedOn` dates current. Never encode unsupported California rider features as matching benefits.

## Connecting personalized prices later

The current site is static. A real integration requires a provider that authorizes access to California life insurance quotes, its API documentation and credentials, and a backend to protect those credentials. Do not put keys or personal quote responses in public JSON files.

The provider determines required inputs, which may include exact age, coverage amount, term, and underwriting factors. Obtain appropriate consent before sending personal information. Normalize returned premiums with their coverage amount, term, payment frequency, assumptions, quote ID and expiry; invalidate quotes when relevant answers change. Only then can the app display an individual dollar amount and compare quoted affordability. A static `monthly` field is intentionally ignored by the current engine.

The existing buttons open official insurer pages without passing survey answers. Some start an online quote; others require contacting an agent. They do not promise an instant price or an API connection.

## Official product sources

Product information checked November 3, 2026:

- [Protective Classic Choice Term](https://www.protective.com/what-we-offer/life-insurance/term/classic-choice) and [consumer quote page](https://www.protective.com/life-insurance/term).
- [Protective term issue-age specifications](https://finpro.protective.com/-/media/project/pli/finpro/download-assets/assets/2158000-2158999/plag/plag-2158823-12-25-classicchoicetermaag-12-31-25-digital.pdf). The consumer page and specifications differ on the general maximum age; term-specific specifications drive preliminary filtering, never a guarantee of eligibility.
- [State Farm Select Term](https://www.statefarm.com/insurance/life/term-life/select-term).
- [State Farm whole life options, including Limited Pay](https://www.statefarm.com/insurance/life/whole-life).
- [New York Life Whole Life](https://www.newyorklife.com/products/insurance/whole-life).

California-specific exclusions include Protective Conversion Choice with ExtendCare and New York Life's Chronic Care Rider. Those features are not used as benefits in the shortlist. Insurers must confirm current product availability and all policy terms.

## Data and verification

Answers stay in memory in the current tab. There is no analytics, answer submission, cookie, or local storage. Reloading or starting over clears answers. Fonts load from Google Fonts with system fallbacks. The insurer pages have their own privacy practices.

With Node.js 22.7 or later, run:

```sh
node --test tests/recommendations.test.js
```

Manual browser checks: required selections, exclusive choices, back navigation, rankings after editing, tied ranks, external quote links, under-18 and no-match results, restart, keyboard operation, and narrow-screen layout. Browser visual checks require computer-access permissions and were not available in this environment.
