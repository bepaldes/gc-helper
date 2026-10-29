import fs from 'node:fs';

const pkgPath = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

export const VERSION = pkg.version;
export const PACKAGE_NAME = pkg.name;
