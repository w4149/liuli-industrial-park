/**
 * 图像处理工具：像素化压缩 + 主色提取
 * 用于飞鸽传书的"邮票"图片处理：
 *  1. 从原图提取主色（RGB 均值），作为信鸽颜色
 *  2. 按区块 RGB 均值填充实现像素化，兼具压缩与艺术效果
 *  3. 输出为 JPEG Blob，控制在 1MB 以内以便上传
 */

// 从图片文件中提取主色（所有像素 RGB 均值）
export const extractDominantColor = async (file: File): Promise<string> => {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // 用较小尺寸采样以加速
    const sw = 64
    const sh = Math.round((img.height / img.width) * sw) || 64
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')
    if (!ctx) return '#667eea'
    ctx.drawImage(img, 0, 0, sw, sh)
    const data = ctx.getImageData(0, 0, sw, sh).data
    let r = 0, g = 0, b = 0, count = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      count++
    }
    r = Math.round(r / count)
    g = Math.round(g / count)
    b = Math.round(b / count)
    return `rgb(${r},${g},${b})`
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 对图片进行像素化处理：按 blockSize 分块，每块用 RGB 均值填充
export const pixelateImage = async (
  file: File,
  blockSize: number = 12,
  maxSize: number = 600
): Promise<Blob> => {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    // 限制最大尺寸以控制体积
    let w = img.width
    let h = img.height
    if (w > maxSize || h > maxSize) {
      const ratio = Math.min(maxSize / w, maxSize / h)
      w = Math.round(w * ratio)
      h = Math.round(h * ratio)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas context failed')
    ctx.drawImage(img, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)
    const data = imageData.data
    for (let y = 0; y < h; y += blockSize) {
      for (let x = 0; x < w; x += blockSize) {
        let r = 0, g = 0, b = 0, count = 0
        const bw = Math.min(blockSize, w - x)
        const bh = Math.min(blockSize, h - y)
        for (let dy = 0; dy < bh; dy++) {
          for (let dx = 0; dx < bw; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 4
            r += data[idx]
            g += data[idx + 1]
            b += data[idx + 2]
            count++
          }
        }
        r = Math.round(r / count)
        g = Math.round(g / count)
        b = Math.round(b / count)
        for (let dy = 0; dy < bh; dy++) {
          for (let dx = 0; dx < bw; dx++) {
            const idx = ((y + dy) * w + (x + dx)) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
          }
        }
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/jpeg',
        0.7
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// 一体化处理：返回像素化后的 Blob + 主色 + 预览 dataURL
export const processStampImage = async (
  file: File,
  blockSize: number = 12
): Promise<{ blob: Blob; color: string; previewUrl: string }> => {
  const [color, blob] = await Promise.all([
    extractDominantColor(file),
    pixelateImage(file, blockSize),
  ])
  const previewUrl = await blobToDataUrlAsync(blob)
  return { blob, color, previewUrl }
}

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })

// 异步版本：将 Blob 转为 dataURL 用于预览
export const blobToDataUrlAsync = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
