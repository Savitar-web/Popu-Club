const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')
const { pathToFileURL } = require('url')

const isDev = !app.isPackaged
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

    server.listen(0, '127.0.0.1', () => {
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

  win.loadURL(`http://127.0.0.1:${port}/`)

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  return win
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null)

  const { port } = await startServer()
  createWindow(port)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(port)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})