import fs from 'fs';
import { ZipReader, Uint8ArrayReader, TextWriter } from '@zip.js/zip.js';

const zips = [
  'c:/gps/gps-plus-slam/TestDataJs-Other/2026-05-23_03-01-11utc-indoor-without-moving.zip',
  'c:/gps/gps-plus-slam/TestDataJs/2026-05-19_15-43-55utc.zip',
];
for (const p of zips) {
  const r = new ZipReader(new Uint8ArrayReader(new Uint8Array(fs.readFileSync(p))));
  const es = await r.getEntries();
  const a = es
    .filter((e) => !e.directory && e.filename.includes('actions/') && e.filename.endsWith('.json'))
    .sort((x, y) => x.filename.localeCompare(y.filename));
  console.log(p, 'action count:', a.length);
  const types = {};
  for (const e of a) {
    const txt = await e.getData(new TextWriter());
    const obj = JSON.parse(txt);
    types[obj.type] = (types[obj.type] || 0) + 1;
  }
  console.log(types);
  await r.close();
}
