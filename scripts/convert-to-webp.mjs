/**
 * Convierte todas las imágenes PNG/JPG/JPEG de una carpeta y sus subcarpetas
 * a WebP y elimina los archivos originales después de una conversión exitosa.
 *
 * Uso:
 *   npm install sharp --save-dev
 *   node scripts/convert-all-to-webp.mjs
 *
 * Carpeta objetivo:
 *   C:\Users\SavitarXeno\Documents\ReactProjects\Cherry\Prototipo\archivos png para la pagina, comic popu-club completo
 *
 * IMPORTANTE:
 * - Recorre todas las subcarpetas.
 * - Convierte PNG, JPG y JPEG a WebP.
 * - Mantiene los nombres y estructura de carpetas.
 * - Solo elimina el original si el WebP se creó correctamente.
 * - Los archivos que ya son WebP no se modifican.
 */

import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const inputDir = String.raw`C:\Users\SavitarXeno\Documents\ReactProjects\Cherry\Prototipo\archivos png para la pagina, comic popu-club completo`

if (!fs.existsSync(inputDir)) {
  console.error('❌ La carpeta no existe:')
  console.error(inputDir)
  process.exit(1)
}

const exts = new Set([
  '.png',
  '.jpg',
  '.jpeg',
])

function walk(dir) {
  const results = []

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)

    let stat

    try {
      stat = fs.statSync(full)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      results.push(...walk(full))
    } else if (exts.has(path.extname(name).toLowerCase())) {
      results.push(full)
    }
  }

  return results
}

const files = walk(inputDir)

console.log('==============================================')
console.log(' CONVERSIÓN MASIVA A WEBP')
console.log('==============================================')
console.log('')
console.log(`Carpeta: ${inputDir}`)
console.log(`Imágenes encontradas: ${files.length}`)
console.log('')
console.log('Iniciando...')
console.log('')

let converted = 0
let deleted = 0
let failed = 0
let totalBefore = 0
let totalAfter = 0

for (const file of files) {
  const ext = path.extname(file)
  const out = file.slice(0, -ext.length) + '.webp'

  try {
    const before = fs.statSync(file).size

    await sharp(file)
      .webp({
        quality: 80,
        effort: 5,
      })
      .toFile(out)

    const after = fs.statSync(out).size

    // Verifica que el WebP realmente exista y tenga contenido.
    if (!fs.existsSync(out) || after === 0) {
      throw new Error('El archivo WebP no se creó correctamente')
    }

    const saved = before > 0
      ? (((before - after) / before) * 100).toFixed(1)
      : '0.0'

    console.log(
      `✓ ${path.relative(inputDir, file)}`
    )

    console.log(
      `  → ${path.basename(out)} | ${formatBytes(before)} → ${formatBytes(after)} | ahorro ${saved}%`
    )

    totalBefore += before
    totalAfter += after

    converted++

    // Elimina el original SOLO después de comprobar
    // que el WebP fue creado correctamente.
    fs.unlinkSync(file)

    deleted++

  } catch (err) {
    console.error('')
    console.error(`✗ ERROR: ${path.relative(inputDir, file)}`)
    console.error(`  ${err.message}`)
    console.error('')

    failed++
  }
}

const totalSaved = totalBefore > 0
  ? (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)
  : '0.0'

console.log('')
console.log('==============================================')
console.log(' CONVERSIÓN FINALIZADA')
console.log('==============================================')
console.log('')
console.log(`Imágenes convertidas : ${converted}`)
console.log(`Originales eliminados : ${deleted}`)
console.log(`Errores               : ${failed}`)
console.log(`Tamaño original       : ${formatBytes(totalBefore)}`)
console.log(`Tamaño WebP           : ${formatBytes(totalAfter)}`)
console.log(`Ahorro total          : ${totalSaved}%`)
console.log('')
console.log('Los archivos WebP se conservaron en sus carpetas originales.')
console.log('==============================================')

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))

  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}