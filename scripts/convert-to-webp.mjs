
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const inputDir = String.raw`C:\Users\SavitarXeno\Documents\ReactProjects\Cherry\Prototipo\archivos png para la pagina, comic popu-club completo`

const CONFIG = {
  maxWidth: 2000,
  maxHeight: 16000,
  quality: 88,
  alphaQuality: 90,
  effort: 5,
  deleteOriginalAfterVerification: true,
}

const errorLog = path.join(inputDir, 'conversion-errors.txt')

const stats = {
  total: 0,
  converted: 0,
  deleted: 0,
  skipped: 0,
  failed: 0,
  originalBytes: 0,
  outputBytes: 0,
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function getPngFiles(directory) {
  const results = []
  const entries = await fs.readdir(directory, {
    withFileTypes: true,
  })

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      results.push(...await getPngFiles(fullPath))
      continue
    }

    if (
      entry.isFile() &&
      path.extname(entry.name).toLowerCase() === '.png' &&
      !entry.name.toLowerCase().endsWith('.tmp.png')
    ) {
      results.push(fullPath)
    }
  }

  return results
}

async function verifyWebp(filePath) {
  const metadata = await sharp(filePath, {
    failOn: 'error',
  }).metadata()

  if (
    metadata.format !== 'webp' ||
    !metadata.width ||
    !metadata.height
  ) {
    throw new Error('El archivo generado no es un WebP válido.')
  }

  // Fuerza la lectura y decodificación de la imagen.
  await sharp(filePath, {
    failOn: 'error',
  }).stats()

  return metadata
}

async function convertFile(inputPath) {
  const parsed = path.parse(inputPath)
  const outputPath = path.join(parsed.dir, `${parsed.name}.webp`)
  const tempPath = path.join(
    parsed.dir,
    `.${parsed.name}.${process.pid}.tmp.webp`,
  )

  const originalStat = await fs.stat(inputPath)
  stats.originalBytes += originalStat.size

  // Si ya existe un WebP válido, no repetimos la conversión.
  if (await exists(outputPath)) {
    try {
      await verifyWebp(outputPath)
      stats.skipped++
      stats.outputBytes += (await fs.stat(outputPath)).size
      console.log(`OMITIDA: ${path.basename(inputPath)} — WebP válido existente`)
      return
    } catch {
      console.warn(`WebP existente inválido; se regenerará: ${outputPath}`)
    }
  }

  let installedOutput = false

  try {
    // Elimina únicamente un temporal abandonado de este proceso.
    await fs.rm(tempPath, { force: true })

    await sharp(inputPath, {
      failOn: 'none',
      limitInputPixels: false,
      sequentialRead: true,
    })
      .rotate()
      .resize({
        width: CONFIG.maxWidth,
        height: CONFIG.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: CONFIG.quality,
        alphaQuality: CONFIG.alphaQuality,
        effort: CONFIG.effort,
      })
      .toFile(tempPath)

    // Comprobamos el temporal antes de sustituir cualquier salida.
    const metadata = await verifyWebp(tempPath)

    if (
      metadata.width > CONFIG.maxWidth ||
      metadata.height > CONFIG.maxHeight
    ) {
      throw new Error(
        `Dimensiones inesperadas: ${metadata.width}x${metadata.height}`,
      )
    }

    // La conversión temporal ya está verificada.
    // Ahora instalamos el WebP definitivo.
    await fs.rm(outputPath, { force: true })
    await fs.rename(tempPath, outputPath)
    installedOutput = true

    // Comprobación adicional del archivo definitivo.
    await verifyWebp(outputPath)

    const outputStat = await fs.stat(outputPath)
    stats.outputBytes += outputStat.size
    stats.converted++

    console.log(
      `OK: ${path.basename(inputPath)} ` +
      `(${metadata.width}x${metadata.height})`,
    )

    // Nunca borrar el PNG antes de verificar el WebP definitivo.
    if (CONFIG.deleteOriginalAfterVerification) {
      await fs.unlink(inputPath)
      stats.deleted++
      console.log(`  Original eliminado tras verificar el WebP.`)
    }
  } catch (error) {
    stats.failed++

    // Si el resultado definitivo falla en la verificación,
    // lo retiramos y conservamos el PNG original.
    if (installedOutput) {
      await fs.rm(outputPath, { force: true }).catch(() => {})
    }

    await fs.rm(tempPath, { force: true }).catch(() => {})

    const message =
      `Archivo: ${inputPath}\n` +
      `Error: ${error?.message ?? String(error)}\n` +
      `${'-'.repeat(70)}\n`

    await fs.appendFile(errorLog, message, 'utf8')

    console.error(`ERROR: ${path.basename(inputPath)}`)
    console.error(`  ${error?.message ?? String(error)}`)
    console.error('  El PNG original se conserva.')
  }
}

async function main() {
  console.log('\n========================================')
  console.log(' CONVERSOR PNG A WEBP — POPU-CLUB')
  console.log('========================================\n')
  console.log(`Origen: ${inputDir}`)
  console.log(
    `Dimensiones máximas: ${CONFIG.maxWidth}x${CONFIG.maxHeight}`,
  )
  console.log(`Calidad WebP: ${CONFIG.quality}\n`)

  if (!(await exists(inputDir))) {
    console.error('\nERROR: No existe la carpeta de imágenes.')
    console.error('Comprueba la ruta y la ortografía de "archivos".')
    process.exitCode = 1
    return
  }

  const files = await getPngFiles(inputDir)
  stats.total = files.length

  if (files.length === 0) {
    console.log('No se encontraron archivos PNG.')
    return
  }

  // Cada ejecución genera un registro nuevo de errores.
  await fs.writeFile(errorLog, '', 'utf8')

  console.log(`PNG encontrados: ${files.length}\n`)

  for (let index = 0; index < files.length; index++) {
    console.log(`[${index + 1}/${files.length}]`)
    await convertFile(files[index])
  }

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  }

  console.log('\n========================================')
  console.log(' RESULTADO')
  console.log('========================================')
  console.log(`PNG encontrados: ${stats.total}`)
  console.log(`Convertidos correctamente: ${stats.converted}`)
  console.log(`Originales eliminados: ${stats.deleted}`)
  console.log(`Omitidos por WebP válido existente: ${stats.skipped}`)
  console.log(`Fallidos: ${stats.failed}`)
  console.log(`Tamaño de PNG procesados: ${formatBytes(stats.originalBytes)}`)
  console.log(`Tamaño de WebP utilizados: ${formatBytes(stats.outputBytes)}`)
  console.log(`Registro de errores: ${errorLog}`)
  console.log('========================================\n')

  if (stats.failed > 0) {
    process.exitCode = 1
    console.log('Hay errores pendientes. Los PNG fallidos se conservaron.')
  } else {
    console.log('Proceso terminado sin errores.')
  }
}

main().catch((error) => {
  console.error('\nError general:', error)
  process.exitCode = 1
})