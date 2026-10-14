// Bundles a TypeScript test with esbuild (installed with Vite) and runs it.
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
const entry = process.argv[2];
const outfile = path.join(os.tmpdir(), `askonauts-test-${Date.now()}.mjs`);
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'warning' });
await import(pathToFileURL(outfile).href);
