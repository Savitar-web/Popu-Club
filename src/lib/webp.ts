/**
 * Conversión silenciosa a WebP en el cliente.
 * Usar en CUALQUIER subida de imagen (perfil, banner, portada, slider, páginas, iconos).
 * No muestra loaders: convierte y listo.
 */
export async function fileToWebP(
  file: File | Blob,
  options?: {
    quality?: number
    maxWidth?: number
    maxHeight?: number
  }
): Promise<File> {
  const quality = options?.quality ?? 0.82
  const maxWidth = options?.maxWidth ?? 1600
  const maxHeight = options?.maxHeight ?? 4000

  // Si el navegador no soporta WebP en canvas, devolver original
  const support = await canvasSupportsWebP()
  if (!support) {
    if (file instanceof File) return file
    return new File([file], `image-${Date.now()}.jpg`, { type: file.type || 'image/jpeg' })
  }

  const bitmap = await createImageBitmap(file)
  let { width, height } = bitmap

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height)
    height = maxHeight
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    if (file instanceof File) return file
    return new File([file], `image-${Date.now()}.bin`, { type: 'application/octet-stream' })
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', quality)
  )

  if (!blob) {
    if (file instanceof File) return file
    return new File([file], `image-${Date.now()}.jpg`, { type: 'image/jpeg' })
  }

  const base =
    file instanceof File
      ? file.name.replace(/\.[^.]+$/, '')
      : `image-${Date.now()}`
  const safe = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase() || 'image'

  return new File([blob], `${safe}.webp`, { type: 'image/webp', lastModified: Date.now() })
}

/** dataURL / blob URL → File WebP (útil tras cropper) */
export async function dataUrlToWebP(
  dataUrl: string,
  fileName = 'image.webp',
  quality = 0.82
): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const webp = await fileToWebP(blob, { quality })
  return new File([webp], fileName.replace(/\.[^.]+$/, '.webp'), {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

async function canvasSupportsWebP(): Promise<boolean> {
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}
