# wser-open-dataset

## Usage



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
