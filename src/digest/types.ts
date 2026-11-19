// Plan morning-digest § 1. The contract every part of § 2 codes against; the reader lives
// next to it in src/digest/read.ts.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job in a night's run log.
export type DigestRow = {
  job: string;
  owner: string | null; // null stays null here; views render it as "—"
  runs: number; // every line of the job
  retries: number; // its `retry` lines
  lastStatus: RunStatus; // status of the job's last line
  lastError: string | null; // most recent `error` seen, even if the job ended ok
  first: string; // `at` of the first line, offset kept as in the log
  last: string; // `at` of the last line
};

export type DigestNight = {
  night: string; // the file name (YYYY-MM-DD), never taken from `at`
  rows: DigestRow[]; // sorted by job
  counts: Record<RunStatus, number>; // that night's lines by status; bad lines in none
  badLines: number; // lines that don't parse: counted, never thrown
};

// null = no file for that night (the page turns it into a 404). An empty file is a
// DigestNight with no rows.
export type ReadNight = (runsDir: string, night: string) => DigestNight | null;
