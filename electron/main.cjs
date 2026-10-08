const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')
const fs = require('fs')

const dist = path.join(__dirname, '../dist')

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8'
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8'
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8'
  if (filePath.endsWith('.png')) return 'image/png'
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg'
  if (filePath.endsWith('.webp')) return 'image/webp'
  if (filePath.endsWith('.svg')) return 'image/svg+xml'
  if (filePath.endsWith('.woff')) return 'font/woff'
  if (filePath.endsWith('.woff2')) return 'font/woff2'
  if (filePath.endsWith('.json') || filePath.endsWith('.webmanifest')) return 'application/json'
  return 'application/octet-stream'
}

function createServer() {
  return http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    if (urlPath === '/') urlPath = '/index.html'

    const filePath = path.normalize(path.join(dist, urlPath))
    if (!filePath.startsWith(dist)) {
      res.writeHead(403)
      res.end()
      return
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        // SPA: cualquier ruta desconocida → index.html
        fs.readFile(path.join(dist, 'index.html'), (err2, html) => {
          if (err2) {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html)
        })
        return
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) })
      res.end(data)
    })
  })
}

function createWindow(port) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.loadURL(`http://127.0.0.1:${port}/`)
}

app.whenReady().then(() => {
  const server = createServer()
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    createWindow(port)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})