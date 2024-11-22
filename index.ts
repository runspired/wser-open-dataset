import { fetchLatestLotteryResults, fetchLotteryDataForYear } from "./src/lottery-utils";

await fetchLotteryDataForYear(2013);
await fetchLotteryDataForYear(2014);
await fetchLotteryDataForYear(2015);
await fetchLotteryDataForYear(2016);
await fetchLotteryDataForYear(2017);
await fetchLotteryDataForYear(2018);
await fetchLotteryDataForYear(2019);
await fetchLotteryDataForYear(2020);
// there is no 2021 lottery data due to the pandemic
await fetchLotteryDataForYear(2022);
await fetchLotteryDataForYear(2023);
await fetchLotteryDataForYear(2024);
await fetchLotteryDataForYear(2025);

// TODO fetch waitlist data for each year (https://www.wser.org/2024-wait-list/)
// TODO fetch result data for each year (https://www.wser.org/results/2024-results/)
// TODO fetch entrant data for each year (https://www.wser.org/2024-entrants-list/)

// No results will be available until December 7th
// await fetchLatestLotteryResults(2025);