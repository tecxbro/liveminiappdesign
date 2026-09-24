import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseCreate } from '../src/model.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
let count = 0;
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['.vercel', '.data', 'node_modules', '.git'].includes(e.name)) continue;
    const path = resolve(dir, e.name);
    if (e.isDirectory()) await walk(path);
    else if (e.name.endsWith('.mjs')) {
      const r = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (r.status !== 0) throw new Error(r.stderr || `Syntax error in ${path}`);
      count++;
    }
  }
}
await walk(root);
for (const name of ['research', 'checks', 'stages']) parseCreate(JSON.parse(await readFile(resolve(root, `examples/${name}.json`), 'utf8')));
console.log(`Checked ${count} JavaScript modules and all three example payloads.`);
