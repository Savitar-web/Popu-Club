/**
 * Convierte PNG/JPG a WebP en lote.
 *
 * Uso (desde la carpeta del proyecto):
 *   npm install sharp --save-dev
 *   node scripts/convert-to-webp.mjs "./ruta/a/tus/imagenes"
 *
 * Crea archivos .webp al lado de cada imagen original.
 * No borra los PNG (por seguridad). Cuando verifiques, puedes borrarlos a mano.
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const inputDir = process.argv[2]

if (!inputDir) {
  console.error('Uso: node scripts/convert-to-webp.mjs "./carpeta-con-imagenes"')
  process.exit(1)
}

const absDir = path.resolve(inputDir)
if (!fs.existsSync(absDir)) {
  console.error('La carpeta no existe:', absDir)
  process.exit(1)
}

const exts = new Set(['.png', '.jpg', '.jpeg'])

function walk(dir) {
  const results = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) results.push(...walk(full))
    else if (exts.has(path.extname(name).toLowerCase())) results.push(full)
  }
  return results
}

const files = walk(absDir)
console.log(`Encontradas ${files.length} imágenes para convertir...\n`)

let ok = 0
let fail = 0

for (const file of files) {
  const out = file.replace(/\.(png|jpe?g)$/i, '.webp')
  try {
    await sharp(file)
      .resize({
        width: 800,          // ancho típico Webtoon (ajusta si quieres)
        withoutEnlargement: true,
      })
      .webp({ quality: 80 }) // 75-85 es un buen equilibrio
      .toFile(out)

    const before = fs.statSync(file).size
    const after = fs.statSync(out).size
    const saved = (((before - after) / before) * 100).toFixed(1)
    console.log(`✓ ${path.basename(file)} → ${path.basename(out)} (ahorro ${saved}%)`)
    ok++
  } catch (err) {
    console.error(`✗ Error en ${file}:`, err.message)
    fail++
  }
}

console.log(`\nListo. Convertidas: ${ok} | Errores: ${fail}`)
console.log('Los PNG originales NO se borraron. Revísalos y bórralos tú cuando quieras.')
