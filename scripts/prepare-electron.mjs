import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const target = resolve(root, 'build/desktop')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
await mkdir(target, { recursive: true })
// The web bundle contains its dependencies. Electron's main process uses Node built-ins only.
// A minimal app package prevents shipping the web/native build toolchain in the installer.
await writeFile(resolve(target, 'package.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, description: pkg.description, author: pkg.author,
  private: true, main: 'electron/main.cjs',
}, null, 2))
await writeFile(resolve(target, 'package-lock.json'), JSON.stringify({
  name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true,
  packages: { '': { name: pkg.name, version: pkg.version } },
}, null, 2))
for (const dir of ['dist', 'electron']) await cp(resolve(root, dir), resolve(target, dir), { recursive: true })
await mkdir(resolve(target, 'build'), { recursive: true })
await cp(resolve(root, 'build/icon.png'), resolve(target, 'build/icon.png'))
console.log(`Desktop app prepared: ${target}`)
