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

Currently it supports data as far back as 2013.

## Goals

The goal for this project is to provide

- a normalized relational dataset
- cdn based access to that dataset
- git/npm based access to that dataset
- a sqlite seed of the dataset
- typescript types for the data in the dataset
- request builders and schemas for the data for use with [warp-drive.io](https://warp-drive.io)

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
this will likely do-nothing.
