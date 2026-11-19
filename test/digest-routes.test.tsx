import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestNight } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null = 'ana') =>
  JSON.stringify({ at, job, status, owner });

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  mkdirSync(runsDir, { recursive: true });
  // Jobs are written out of order on purpose: both routes must sort by job.
  writeFileSync(
    join(runsDir, '2030-01-01.jsonl'),
    [
      line('2030-01-01T01:00:00+01:00', 'job-zulu', 'ok'),
      line('2030-01-01T01:05:00+01:00', 'job-alpha', 'retry'),
      line('2030-01-01T01:10:00+01:00', 'job-alpha', 'ok'),
      line('2030-01-01T01:15:00+01:00', 'job-mike', 'fail', null),
      '',
    ].join('\n'),
  );
  writeFileSync(join(runsDir, '2030-01-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2030-01-03.jsonl'),
    [line('2030-01-03T01:00:00+01:00', 'job-solo', 'ok'), 'this is not json', ''].join('\n'),
  );
  app = createApp({ adapter: 'shim', installed: '2030-01-01T00:00:00+01:00', beatEverySeconds: 60, runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page', () => {
  it('renders 200 with the night rows', async () => {
    const res = await app.request('/digest/2030-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('job-alpha');
    expect(html).toContain('job-mike');
    expect(html).toContain('job-zulu');
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request('/digest/2030-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders 200 when the night has a bad line', async () => {
    const res = await app.request('/digest/2030-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('job-solo');
  });
});

describe('digest JSON', () => {
  it('returns 200 with the DigestNight', async () => {
    const res = await app.request('/api/digest/2030-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.night).toBe('2030-01-01');
    expect(body.rows.map((r) => r.job)).toEqual(['job-alpha', 'job-mike', 'job-zulu']);
    expect(body.counts).toEqual({ ok: 2, retry: 1, fail: 1 });
    expect(body.badLines).toBe(0);
  });

  it('404s for a night with no file', async () => {
    const res = await app.request('/api/digest/2030-12-31');
    expect(res.status).toBe(404);
  });

  it('has rows [] for an empty night', async () => {
    const res = await app.request('/api/digest/2030-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts a bad line and still answers 200', async () => {
    const res = await app.request('/api/digest/2030-01-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['job-solo']);
  });
});

describe('page and JSON agree', () => {
  it('lists the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2030-01-01')).text();
    const body = (await (await app.request('/api/digest/2030-01-01')).json()) as DigestNight;
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toHaveLength(3);
    // Order of first appearance of each job name in the page.
    const onPage = jobs
      .map((job) => ({ job, at: html.indexOf(job) }))
      .sort((a, b) => a.at - b.at)
      .map((x) => x.job);
    expect(html).not.toContain('nothing ran');
    for (const job of jobs) expect(html.indexOf(job)).toBeGreaterThanOrEqual(0);
    expect(onPage).toEqual(jobs);
  });
});
