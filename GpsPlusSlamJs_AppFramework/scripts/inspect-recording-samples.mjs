import fs from 'fs';
import { ZipReader, Uint8ArrayReader, TextWriter } from '@zip.js/zip.js';

const p = 'c:/gps/gps-plus-slam/TestDataJs-Other/2026-05-23_03-01-11utc-indoor-without-moving.zip';
const r = new ZipReader(new Uint8ArrayReader(new Uint8Array(fs.readFileSync(p))));
const es = await r.getEntries();
const a = es
  .filter((e) => !e.directory && e.filename.includes('actions/') && e.filename.endsWith('.json'))
  .sort((x, y) => x.filename.localeCompare(y.filename));
const sample = {};
for (const e of a) {
  const txt = await e.getData(new TextWriter());
  const obj = JSON.parse(txt);
  if (!sample[obj.type]) sample[obj.type] = obj;
}
for (const [k, v] of Object.entries(sample)) {
  console.log('---', k);
  console.log(JSON.stringify(v, null, 2).slice(0, 1200));
}
await r.close();
