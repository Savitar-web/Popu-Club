const { app, BrowserWindow, Menu, shell, dialog } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const DIST = path.join(__dirname, '..', 'dist')

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
  }
  return map[ext] || 'application/octet-stream'
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.headers.host !== '127.0.0.1:18473') { res.writeHead(403); res.end('Forbidden'); return }
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        if (urlPath === '/') urlPath = '/index.html'

        const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
        let filePath = path.join(DIST, safe)

        if (!filePath.startsWith(DIST)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          filePath = path.join(filePath, 'index.html')
        }

        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          // SPA fallback
          filePath = path.join(DIST, 'index.html')
        }

        const data = fs.readFileSync(filePath)
        res.writeHead(200, {
          'Content-Type': contentType(filePath),
          'Cache-Control': 'no-cache',
        })
        res.end(data)
      } catch (e) {
        res.writeHead(500)
        res.end(String(e))
      }
    })

    // A stable origin preserves Supabase and reading preferences between launches.
    server.listen(18473, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, port })
    })
    server.on('error', reject)
  })
}

function createWindow(port) {
  // Sin menú File / Edit / View / Window
  Menu.setApplicationMenu(null)

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    title: 'Popu-Club',
    autoHideMenuBar: true,
    // En Windows quita la barra de menú por completo
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
  })

  // Por si el SO vuelve a mostrar el menú con Alt
  win.setMenuBarVisibility(false)

  const origin = `http://127.0.0.1:${port}`
  win.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url) }
  })
  win.loadURL(origin + '/')

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) app.quit()

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) { if (win.isMinimized()) win.restore(); win.focus() }
})

app.whenReady().then(async () => {
  if (!hasInstanceLock) return
  Menu.setApplicationMenu(null)

  const { port } = await startServer()
  createWindow(port)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port)
    }
  })
}).catch((error) => {
  dialog.showErrorBox('No se pudo abrir Popu-Club', `No se pudo iniciar el servidor local. Cierra otras instancias de Popu-Club e inténtalo de nuevo.\n${error.message}`)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
