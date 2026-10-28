import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import { build, Platform } from 'electron-builder'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const electron = require('electron/package.json')
const platform = process.argv.includes('--linux') ? Platform.LINUX : process.argv.includes('--mac') ? Platform.MAC : Platform.WINDOWS
const targets = platform === Platform.WINDOWS ? ['nsis', 'portable'] : platform === Platform.MAC ? ['dmg'] : ['AppImage']
const icon = resolve(root, 'build/icon.png')
await build({
  projectDir: resolve(root, 'build/desktop'),
  targets: platform.createTarget(targets),
  config: {
    ...pkg.build,
    directories: { output: resolve(root, 'electron-dist', pkg.version) },
    electronVersion: electron.version,
    electronDist: resolve(root, 'node_modules/electron/dist'),
    icon,
    win: { ...pkg.build.win, icon },
    mac: { ...pkg.build.mac, icon },
    linux: { ...pkg.build.linux, icon },
  },
})
