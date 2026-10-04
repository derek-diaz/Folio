import { execFileSync } from 'node:child_process';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const notices = ['Folio third-party notices\nGenerated from the installed lockfile dependencies.\nThese licenses apply to their respective components, not to Folio itself.'];
async function append(name, version, license, source, directory, explicitFile) {
  notices.push(`\n${'='.repeat(72)}\n${name} ${version}\nLicense: ${license || 'See upstream'}\nSource: ${source || ''}\n`);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile() && /^(?:licen[sc]e|copying|notice)(?:[._-]|$)/i.test(entry.name)).map(entry => entry.name);
  if (explicitFile && !files.includes(explicitFile)) files.push(explicitFile);
  for (const file of files) notices.push(`--- ${file} ---\n${await readFile(path.resolve(directory, file), 'utf8')}`);
}

const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
for (const [location, metadata] of Object.entries(lock.packages)) {
  if (!location || metadata.dev || metadata.devOptional || metadata.optional) continue;
  const directory = path.resolve(location);
  const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
  await append(pkg.name, pkg.version, pkg.license, typeof pkg.repository === 'object' ? pkg.repository.url : pkg.repository, directory);
}

const host = execFileSync('rustc', ['-vV'], { encoding: 'utf8' }).match(/^host: (.+)$/m)[1];
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--locked', '--format-version', '1', '--filter-platform', host, '--manifest-path', 'src-tauri/Cargo.toml'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
const resolved = new Set(metadata.resolve.nodes.map(node => node.id));
for (const pkg of metadata.packages.filter(pkg => pkg.source && resolved.has(pkg.id)).sort((a, b) => a.name.localeCompare(b.name))) {
  await append(pkg.name, pkg.version, pkg.license, pkg.repository, path.dirname(pkg.manifest_path), pkg.license_file);
}

await mkdir('src-tauri/resources', { recursive: true });
await writeFile('src-tauri/resources/THIRD_PARTY_NOTICES.txt', notices.join('\n'));
console.log('Wrote bundled third-party notices.');
