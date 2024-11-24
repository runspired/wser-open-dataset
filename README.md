<p align="center">
  <img
    class="project-logo"
    src="./assets/wser.png#gh-light-mode-only"
    alt="WSER"
    width="150px"
    title="WSER"
    />
  <img
    class="project-logo"
    src="./assets/wser-dark-mode.png#gh-dark-mode-only"
    alt="WSER"
    width="150px"
    title="WSER"
    />
</p>

---

# wser | open dataset

This project collects publicly available data for the [Western States Endurance Run](https://wser.org)
and formats it into [{json:api}](https://jsonapi.org) for ease of consumption.

## Goals

The goal for this project is to provide

- a raw, minimally processed dataset
- a normalized relational dataset
- cdn based access to both datasets
- git/npm based access to both datasets
- a sqlite seed of the normalized dataset
- typescript types for the data in both datasets
- request builders and schemas for both datasets for use with [warp-drive.io](https://warp-drive.io)

## Raw Dataset

The raw dataset is the result of injesting various public sources and transforming it into well-structured [{json:api}](https://jsonapi.org) . This dataset stores each source in isolation. `type+id` information in the dataset is unique by given race year and data source.

The following data sources are currently available:

> [!IMPORTANT]
> In the url and filepath schemes below, replace `{YYYY}` with the
> desired year. E.g. `2013`

### 1974 →

- `finishers`
  - source: `https://www.wser.org/results/{YYYY}-results/`
  - output: `./.data-cache/raw/{YYYY}/finisher.json`

> [!TIP]
> Some early years had starters but no finishers, and some years the race
> includes folks who finished slightly after the 30hour mark in the results
> but without a place.
> There are also a few finishers without a listed age in this data.

### 2013 →

- `applicants` 
  - source: `https://www.wser.org/lottery{YYYY}.html`
  - output: `./.data-cache/raw/{YYYY}/applicant.json`

> [!TIP]
> Beginning in 2020 the race began assigning each applicant
> an ID. We are unsure yet if this is stable across years.

- `entrants`
  - source: `https://www.wser.org/{YYYY}-entrants-list/`
  - output: `./.data-cache/raw/{YYYY}/entrant.json`

> [!TIP]
> The entrants list contains non-lottery entrant data as well
> as individuals who were selected from the waitlist. It does
> not represent fully the lottery outcome.

### 2017 →

- `wait-list`
  - source: `https://www.wser.org/{YYYY}-wait-list/`
  - output: `./.data-cache/raw/{YYYY}/waitlist.json`

> [!TIP]
> The waitlist in 2020 became the 2021 waitlist,
> But it can be useful for tracking who withdrew
> and did not rollover.

### 2024 →

- `live` (lottery outcome)
  - source: `https://lottery.wser.org/`
  - output: `./.data-cache/raw/{YYYY}/live-lottery-results.json`

> [!TIP]
> The live dataset can only be collected the year of the
> given lottery. It can be useful for tracking the delta
> of who withdrew from the entrants list.

## Contributing

1. Install bun from [https://oven.sh](https://oven.sh)

2. Install dependencies:

```bash
bun install
```

To run the script which ingests and processes the data as necessary

```bash
bun run ./index.ts
```

This will scrape publicly available data from [https://wser.org](https://wser.org) and
store it in `.data-cache/raw/`. We keep this under git versioning and only scrape data
when we don't have an entry for it in the cache already: so unless looking to add data
to a new year or working to add ingestion of data from new sources and earlier years
this will likely do-nothing. Setting the `ENV` var `FORCE_GENERATE=true` will cause the
files in `.data-cache` to rebuild. Note: they will rebuild from the responses stored in
`.fetch-cache` when possible, see below.

Additionally, we cache any successful raw fetch response that we scraped into `.fetch-cache`.
This allows us to write tests, work offline, ensures access to the data in the future
should the `wser` site change, and further reduces server load ensuring we don't accidentally
put a site we love under undo strain.

When fetching a page to scrape data from, use the `GET` method to participate in the `.fetch-cache`.

To bypass the fetch cache, set the `ENV` var `FORCE_FETCH=true`.
