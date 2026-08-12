import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, Crop, ImagePlus, RefreshCw, RotateCcw, SlidersHorizontal, X } from 'lucide-react'

const OUTPUT_SIZE = 640
const DEFAULT_REMOVAL = 58
// Match the printed MY EMBLEM field: a vertical oval with a 0.8:1 ratio.
// Keep the output canvas square for Storage/presentation compatibility; pixels outside
// this oval are transparent.
const EMBLEM_VIEWPORT = { x: .18, y: .10, width: .64, height: .80 }
// Production paper reference: the printed oval sits about 24–27 px inside the
// nominal guide after alignment. Keep the valid area just inside that ink line.
const MASK_EDGE_INSET = 28
const TEMPLATE_STAR = { centerX: .5, centerY: .164, radiusX: .04, radiusY: .045 }
// Printed paper oval, expressed relative to the nominal emblem ellipse radii.
// The narrow band covers the press line plus camera antialiasing/soft focus,
// without moving the valid-area boundary inward.
const PRINTED_ELLIPSE_RING = { innerScale: .680, outerScale: .735 }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function calculateImageLayout(naturalWidth, naturalHeight, zoom, position) {
  const baseScale = Math.max(OUTPUT_SIZE / naturalWidth, OUTPUT_SIZE / naturalHeight)
  const width = naturalWidth * baseScale * zoom
  const height = naturalHeight * baseScale * zoom
  return {
    width,
    height,
    x: (OUTPUT_SIZE - width) * position.x / 100,
    y: (OUTPUT_SIZE - height) * position.y / 100,
  }
}

function applyEmblemMask(canvas) {
  const context = canvas.getContext('2d')
  context.save()
  context.globalCompositeOperation = 'destination-in'
  context.beginPath()
  context.ellipse(
    OUTPUT_SIZE * (EMBLEM_VIEWPORT.x + EMBLEM_VIEWPORT.width / 2),
    OUTPUT_SIZE * (EMBLEM_VIEWPORT.y + EMBLEM_VIEWPORT.height / 2),
    OUTPUT_SIZE * EMBLEM_VIEWPORT.width / 2 - MASK_EDGE_INSET,
    OUTPUT_SIZE * EMBLEM_VIEWPORT.height / 2 - MASK_EDGE_INSET,
    0, 0, Math.PI * 2,
  )
  context.fill()
  context.restore()
  return canvas
}

function drawPrintedEllipseRing(context) {
  const { innerScale, outerScale } = PRINTED_ELLIPSE_RING
  if (!(innerScale > 0 && outerScale > innerScale && outerScale <= 1)) return false
  const centerX = OUTPUT_SIZE * (EMBLEM_VIEWPORT.x + EMBLEM_VIEWPORT.width / 2)
  const centerY = OUTPUT_SIZE * (EMBLEM_VIEWPORT.y + EMBLEM_VIEWPORT.height / 2)
  const radiusX = OUTPUT_SIZE * EMBLEM_VIEWPORT.width / 2
  const radiusY = OUTPUT_SIZE * EMBLEM_VIEWPORT.height / 2
  context.beginPath()
  context.ellipse(centerX, centerY, radiusX * outerScale, radiusY * outerScale, 0, 0, Math.PI * 2)
  context.ellipse(centerX, centerY, radiusX * innerScale, radiusY * innerScale, 0, 0, Math.PI * 2, true)
  context.fill('evenodd')
  return true
}

function drawFixedTemplateElements(context) {
  context.beginPath()
  context.ellipse(
    OUTPUT_SIZE * TEMPLATE_STAR.centerX,
    OUTPUT_SIZE * TEMPLATE_STAR.centerY,
    OUTPUT_SIZE * TEMPLATE_STAR.radiusX,
    OUTPUT_SIZE * TEMPLATE_STAR.radiusY,
    0, 0, Math.PI * 2,
  )
  context.fill()
}

function buildTemplateExclusionMask() {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE; canvas.height = OUTPUT_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.fillStyle = '#fff'
  drawPrintedEllipseRing(context)
  drawFixedTemplateElements(context)
  const pixels = context.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE).data
  const excluded = new Uint8Array(OUTPUT_SIZE * OUTPUT_SIZE)
  for (let index = 0; index < excluded.length; index += 1) excluded[index] = pixels[index * 4 + 3] > 127 ? 1 : 0
  return excluded
}

const BACKGROUND_GRID_SIZE = 16
const luminance = (r, g, b) => .2126 * r + .7152 * g + .0722 * b

function pixelLuminance(pixels, width, height, x, y, excluded, fallback) {
  const safeX = clamp(x, 0, width - 1), safeY = clamp(y, 0, height - 1)
  const index = (safeY * width + safeX) * 4
  if (pixels[index + 3] === 0 || excluded?.[safeY * width + safeX]) return fallback
  return luminance(pixels[index], pixels[index + 1], pixels[index + 2])
}

function localContrast(pixels, width, height, x, y, radius = 3, excluded) {
  const index = (y * width + x) * 4
  const center = luminance(pixels[index], pixels[index + 1], pixels[index + 2])
  return Math.max(
    Math.abs(center - pixelLuminance(pixels, width, height, x - radius, y, excluded, center)),
    Math.abs(center - pixelLuminance(pixels, width, height, x + radius, y, excluded, center)),
    Math.abs(center - pixelLuminance(pixels, width, height, x, y - radius, excluded, center)),
    Math.abs(center - pixelLuminance(pixels, width, height, x, y + radius, excluded, center)),
  )
}

function estimateLocalPaperGrid(pixels, width, height, excluded) {
  const cells = Array.from({ length: BACKGROUND_GRID_SIZE ** 2 }, () => ({ r: 0, g: 0, b: 0, count: 0 }))
  const cellWidth = width / BACKGROUND_GRID_SIZE, cellHeight = height / BACKGROUND_GRID_SIZE
  let global = { r: 0, g: 0, b: 0, count: 0 }

  for (let y = 2; y < height - 2; y += 3) {
    for (let x = 2; x < width - 2; x += 3) {
      const index = (y * width + x) * 4
      if (pixels[index + 3] === 0 || excluded[y * width + x]) continue
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]
      const light = luminance(r, g, b)
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
      const contrast = localContrast(pixels, width, height, x, y, 3, excluded)
      if (light < 72 || saturation > .18 || contrast > 18) continue
      const cellX = Math.min(BACKGROUND_GRID_SIZE - 1, Math.floor(x / cellWidth))
      const cellY = Math.min(BACKGROUND_GRID_SIZE - 1, Math.floor(y / cellHeight))
      const cell = cells[cellY * BACKGROUND_GRID_SIZE + cellX]
      cell.r += r; cell.g += g; cell.b += b; cell.count += 1
      global.r += r; global.g += g; global.b += b; global.count += 1
    }
  }

  const fallback = global.count
    ? { r: global.r / global.count, g: global.g / global.count, b: global.b / global.count }
    : { r: 245, g: 245, b: 245 }
  let grid = cells.map((cell) => cell.count ? ({ r: cell.r / cell.count, g: cell.g / cell.count, b: cell.b / cell.count }) : null)

  // Fill cells covered by drawings from nearby paper estimates before interpolation.
  for (let pass = 0; pass < BACKGROUND_GRID_SIZE; pass += 1) {
    const previous = grid
    grid = previous.map((cell, index) => {
      if (cell) return cell
      const x = index % BACKGROUND_GRID_SIZE, y = Math.floor(index / BACKGROUND_GRID_SIZE)
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
        .filter(([nx, ny]) => nx >= 0 && nx < BACKGROUND_GRID_SIZE && ny >= 0 && ny < BACKGROUND_GRID_SIZE)
        .map(([nx, ny]) => previous[ny * BACKGROUND_GRID_SIZE + nx]).filter(Boolean)
      if (!neighbors.length) return null
      const sum = neighbors.reduce((total, value) => ({ r: total.r + value.r, g: total.g + value.g, b: total.b + value.b }), { r: 0, g: 0, b: 0 })
      return { r: sum.r / neighbors.length, g: sum.g / neighbors.length, b: sum.b / neighbors.length }
    })
  }
  return grid.map((cell) => cell || fallback)
}

function interpolatePaper(grid, width, height, x, y) {
  const gridX = clamp(x / width * BACKGROUND_GRID_SIZE - .5, 0, BACKGROUND_GRID_SIZE - 1)
  const gridY = clamp(y / height * BACKGROUND_GRID_SIZE - .5, 0, BACKGROUND_GRID_SIZE - 1)
  const x0 = Math.floor(gridX), y0 = Math.floor(gridY)
  const x1 = Math.min(BACKGROUND_GRID_SIZE - 1, x0 + 1), y1 = Math.min(BACKGROUND_GRID_SIZE - 1, y0 + 1)
  const tx = gridX - x0, ty = gridY - y0
  const topLeft = grid[y0 * BACKGROUND_GRID_SIZE + x0], topRight = grid[y0 * BACKGROUND_GRID_SIZE + x1]
  const bottomLeft = grid[y1 * BACKGROUND_GRID_SIZE + x0], bottomRight = grid[y1 * BACKGROUND_GRID_SIZE + x1]
  const blend = (channel) => (topLeft[channel] * (1 - tx) + topRight[channel] * tx) * (1 - ty)
    + (bottomLeft[channel] * (1 - tx) + bottomRight[channel] * tx) * ty
  return { r: blend('r'), g: blend('g'), b: blend('b') }
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

function removePaperBackground(canvas, strength, excluded) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const paperGrid = estimateLocalPaperGrid(pixels, canvas.width, canvas.height, excluded)
  const tolerance = .105 + (strength / 100) * .105
  const feather = .13

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4
      const originalAlpha = pixels[index + 3] / 255
      if (!originalAlpha || excluded[y * canvas.width + x]) continue
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]
      const paper = interpolatePaper(paperGrid, canvas.width, canvas.height, x, y)
      const pixelLight = luminance(r, g, b), paperLight = luminance(paper.r, paper.g, paper.b)
      const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
      const colorDistance = Math.sqrt((r - paper.r) ** 2 + (g - paper.g) ** 2 + (b - paper.b) ** 2) / 441.67
      const darkerThanPaper = Math.max(0, paperLight - pixelLight) / 255
      const edge = localContrast(pixels, canvas.width, canvas.height, x, y, 2, excluded) / 255
      // Low-frequency neutral differences follow the local paper model; chroma and
      // sharp edges protect colored strokes and intentional line work.
      const inkScore = darkerThanPaper * .52 + colorDistance * .38 + saturation * .82 + edge * .9
      const alpha = smoothstep(tolerance, tolerance + feather, inkScore) * originalAlpha

      if (alpha > .025 && alpha < .98) {
        pixels[index] = clamp(Math.round((r - paper.r * (1 - alpha)) / alpha), 0, 255)
        pixels[index + 1] = clamp(Math.round((g - paper.g * (1 - alpha)) / alpha), 0, 255)
        pixels[index + 2] = clamp(Math.round((b - paper.b * (1 - alpha)) / alpha), 0, 255)
      }
      pixels[index + 3] = alpha < .025 ? 0 : Math.round(alpha * 255)
    }
  }
  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

function applyTemplateExclusion(canvas, excluded) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < excluded.length; index += 1) {
    if (excluded[index]) imageData.data[index * 4 + 3] = 0
  }
  context.putImageData(imageData, 0, 0)
  return canvas
}

export function EmblemCapture({ value, onChange }) {
  const [source, setSource] = useState(value?.source || '')
  const [phase, setPhase] = useState(value?.cropped ? 'result' : source ? 'crop' : 'capture')
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 50, y: 50 })
  const [showCropTools, setShowCropTools] = useState(false)
  const [showRemovalTools, setShowRemovalTools] = useState(false)
  const [removalStrength, setRemovalStrength] = useState(DEFAULT_REMOVAL)
  const [result, setResult] = useState(value?.cropped || '')
  const [imageReady, setImageReady] = useState(false)
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 })
  const [processingMs, setProcessingMs] = useState(0)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const imageRef = useRef(null)
  const videoRef = useRef(null)
  const pointers = useRef(new Map())
  const gesture = useRef({ last: null, distance: 0, zoom: 1 })

  const buildCroppedCanvas = useCallback(() => {
    const image = imageRef.current
    if (!source || !image?.naturalWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE; canvas.height = OUTPUT_SIZE
    const context = canvas.getContext('2d')
    const layout = calculateImageLayout(image.naturalWidth, image.naturalHeight, zoom, position)
    context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    context.drawImage(image, layout.x, layout.y, layout.width, layout.height)
    return canvas
  }, [position, source, zoom])

  const createResult = useCallback((strength = removalStrength) => {
    const started = performance.now()
    const canvas = buildCroppedCanvas()
    if (!canvas) return
    applyEmblemMask(canvas)
    const excluded = buildTemplateExclusionMask()
    removePaperBackground(canvas, strength, excluded)
    applyTemplateExclusion(canvas, excluded)
    setResult(canvas.toDataURL('image/png'))
    const elapsed = Math.round(performance.now() - started)
    setProcessingMs(elapsed)
    if (import.meta.env.DEV) console.info(`[T.I.M.E. registration] emblem processing: ${elapsed}ms`)
  }, [buildCroppedCanvas, removalStrength])

  useEffect(() => { if (phase === 'result') createResult(removalStrength) }, [createResult, phase, removalStrength])

  useEffect(() => {
    if (phase === 'camera' && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
      void videoRef.current.play().catch(() => setCameraError('相機預覽無法啟動，請改用系統相機。'))
    }
  }, [cameraStream, phase])

  useEffect(() => () => cameraStream?.getTracks().forEach((track) => track.stop()), [cameraStream])

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
  }

  const startCamera = async () => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('此瀏覽器不支援網頁相機預覽，請改用系統相機。')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      setCameraStream(stream)
      setPhase('camera')
    } catch {
      setCameraError('無法取得相機權限，請允許相機存取或改用系統相機。')
    }
  }

  const captureCameraFrame = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    const nextSource = canvas.toDataURL('image/jpeg', .92)
    stopCamera()
    setSource(nextSource); setZoom(1); setPosition({ x: 50, y: 50 }); setResult(''); setImageReady(false)
    setShowCropTools(false); setShowRemovalTools(false); setRemovalStrength(DEFAULT_REMOVAL); setPhase('crop')
    onChange({ source: nextSource, cropped: '' })
  }

  const readFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const nextSource = String(reader.result)
      setSource(nextSource); setZoom(1); setPosition({ x: 50, y: 50 }); setResult(''); setImageReady(false)
      setShowCropTools(false); setShowRemovalTools(false); setRemovalStrength(DEFAULT_REMOVAL); setPhase('crop')
      onChange({ source: nextSource, cropped: '' })
    }
    reader.readAsDataURL(file)
  }

  const retake = () => {
    stopCamera()
    setSource(''); setResult(''); setImageReady(false); setPhase('capture'); setZoom(1); setPosition({ x: 50, y: 50 })
    onChange({ source: '', cropped: '' })
  }

  const usePhoto = () => { createResult(); setPhase('result'); setShowCropTools(false) }
  const confirm = () => onChange({ source, cropped: result, processingMs })

  const pointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    gesture.current.last = { x: event.clientX, y: event.clientY }
    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      gesture.current.distance = Math.hypot(first.x - second.x, first.y - second.y)
      gesture.current.zoom = zoom
    }
  }

  const pointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 1 && gesture.current.last) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const dx = event.clientX - gesture.current.last.x, dy = event.clientY - gesture.current.last.y
      setPosition((current) => ({ x: clamp(current.x - dx / bounds.width * 100, 0, 100), y: clamp(current.y - dy / bounds.height * 100, 0, 100) }))
      gesture.current.last = { x: event.clientX, y: event.clientY }
    } else if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      if (gesture.current.distance) setZoom(clamp(gesture.current.zoom * distance / gesture.current.distance, 1, 2.5))
    }
  }

  const pointerEnd = (event) => {
    pointers.current.delete(event.pointerId)
    gesture.current.last = null
    if (pointers.current.size < 2) gesture.current.distance = 0
  }

  if (phase === 'capture') return <div className="emblem-capture emblem-capture--start">
    <div className="capture-intro"><Camera /><h3>拍攝你的個人識別徽章</h3><p>開啟相機後，將紙上的作品對準橢圓框</p></div>
    {cameraError && <p className="camera-preview-error">{cameraError}</p>}
    <div className="capture-actions">
      <button className="button capture-primary" type="button" onClick={startCamera}><Camera size={18} /> 開啟相機預覽</button>
      {cameraError && <label className="button button--ghost capture-secondary"><input type="file" accept="image/*" capture="environment" onChange={(event) => readFile(event.target.files?.[0])} /><Camera size={18} /> 使用系統相機</label>}
      <label className="button button--ghost capture-secondary"><input type="file" accept="image/*" onChange={(event) => readFile(event.target.files?.[0])} /><ImagePlus size={18} /> 從相簿選擇</label>
    </div>
  </div>

  if (phase === 'camera') return <div className="emblem-camera-flow">
    <header><span className="eyebrow">CAMERA ALIGNMENT</span><h3>將徽章放入橢圓框內</h3><p>橢圓內就是最後的個人徽章；相機仍會保留完整矩形畫面。</p></header>
    <div className="emblem-camera-preview"><video ref={videoRef} autoPlay muted playsInline aria-label="個人徽章相機預覽" /><div className="camera-oval-guide" aria-hidden="true" /><span>橢圓內將成為你的徽章</span></div>
    <div className="camera-preview-actions"><button className="button" type="button" onClick={captureCameraFrame}><Camera size={18} /> 拍攝</button><button className="text-button" type="button" onClick={retake}><X size={16} /> 取消</button></div>
  </div>

  if (phase === 'result') return <div className="emblem-result">
    <header><span className="eyebrow">BACKGROUND REMOVED</span><h3>你的個人識別徽章</h3><p>棋盤格區域代表透明背景</p></header>
    <div className="transparent-preview emblem-oval-preview"><img src={result} alt="已去除白紙背景的橢圓個人識別徽章" /></div>
    <div className="result-actions"><button className="button" type="button" onClick={confirm}><Check size={18} /> 確認徽章</button><button className="text-button" type="button" onClick={retake}><RefreshCw size={15} /> 重新拍攝</button><button className="text-button" type="button" onClick={() => setShowRemovalTools((shown) => !shown)}><SlidersHorizontal size={15} /> 調整去背</button></div>
    {showRemovalTools && <div className="removal-tools"><div><span>保留更多筆跡</span><span>去除更多紙張</span></div><input aria-label="去背強度" type="range" min="0" max="100" value={removalStrength} onChange={(event) => setRemovalStrength(+event.target.value)} /></div>}
  </div>

  return <div className="emblem-crop-flow">
    <header><span className="eyebrow">EMBLEM ALIGNMENT</span><h3>橢圓內就是最後的個人徽章</h3><p>拖曳照片調整位置，雙指縮放；請將紙上的橢圓作品完整放入中央。</p></header>
    <div className="crop-window crop-window--touch" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}>
      <img ref={imageRef} src={source} alt="待裁切的個人識別徽章" onLoad={(event) => { setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setImageReady(true) }} style={(() => { const layout = calculateImageLayout(imageSize.width, imageSize.height, zoom, position); return { width: `${layout.width / OUTPUT_SIZE * 100}%`, height: `${layout.height / OUTPUT_SIZE * 100}%`, left: `${layout.x / OUTPUT_SIZE * 100}%`, top: `${layout.y / OUTPUT_SIZE * 100}%` } })()} />
      <div className="emblem-oval-mask" aria-hidden="true" /><span className="crop-hint">橢圓內將成為你的徽章</span>
    </div>
    <div className="photo-actions"><button className="button" type="button" disabled={!imageReady} onClick={usePhoto}><Check size={18} /> 使用這張照片</button><button className="text-button" type="button" onClick={retake}><RefreshCw size={15} /> 重新拍攝</button><button className="text-button" type="button" onClick={() => setShowCropTools((shown) => !shown)}><Crop size={15} /> 調整裁切</button></div>
    {showCropTools && <div className="crop-tools crop-tools--advanced">
      <label>縮放<input aria-label="徽章縮放" type="range" min="1" max="2.5" step=".05" value={zoom} onChange={(event) => setZoom(+event.target.value)} /></label>
      <label>水平位置<input aria-label="徽章水平位置" type="range" min="0" max="100" value={position.x} onChange={(event) => setPosition((current) => ({ ...current, x: +event.target.value }))} /></label>
      <label>垂直位置<input aria-label="徽章垂直位置" type="range" min="0" max="100" value={position.y} onChange={(event) => setPosition((current) => ({ ...current, y: +event.target.value }))} /></label>
      <button className="icon-button" type="button" onClick={() => { setZoom(1); setPosition({ x: 50, y: 50 }) }}><RotateCcw size={16} /> 重設</button>
    </div>}
  </div>
}
