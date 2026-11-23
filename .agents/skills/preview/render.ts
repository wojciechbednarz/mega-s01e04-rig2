// Render a page the way rig serves it, in-process (no server, no port).
// Usage (from the repo root): tsx --env-file-if-exists=.env .agents/skills/preview/render.ts /digest/<night> > <outside-dir>/digest.html
import { createApp } from '../../../src/app.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: render.ts /digest/<night>');
  process.exit(2);
}
const res = await createApp().request(path);
if (res.status !== 200) {
  console.error(`render ${path}: status ${res.status}`);
  process.exit(1);
}
process.stdout.write(await res.text());
