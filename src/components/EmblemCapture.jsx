import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, Crop, ImagePlus, RefreshCw, RotateCcw, SlidersHorizontal } from 'lucide-react'

const OUTPUT_SIZE = 640
const DEFAULT_REMOVAL = 58
// Closest available match to the printed MY EMBLEM field: a horizontal 1.27:1 oval.
// Keep the output canvas square for Storage/presentation compatibility; pixels outside
// this oval are transparent.
const EMBLEM_VIEWPORT = { x: .08, y: .17, width: .84, height: .66 }
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
    OUTPUT_SIZE * EMBLEM_VIEWPORT.width / 2,
    OUTPUT_SIZE * EMBLEM_VIEWPORT.height / 2,
    0, 0, Math.PI * 2,
  )
  context.fill()
  context.restore()
  return canvas
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 245
}

function estimatePaperColor(pixels, width, height) {
  const channels = { r: [], g: [], b: [] }
  const border = Math.max(12, Math.round(width * .12))
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      if (x > border && x < width - border && y > border && y < height - border) continue
      const index = (y * width + x) * 4
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]
      const brightness = .2126 * r + .7152 * g + .0722 * b
      const chroma = Math.max(r, g, b) - Math.min(r, g, b)
      if (brightness > 125 && chroma < 105) {
        channels.r.push(r); channels.g.push(g); channels.b.push(b)
      }
    }
  }
  return { r: median(channels.r), g: median(channels.g), b: median(channels.b) }
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return amount * amount * (3 - 2 * amount)
}

function removePaperBackground(canvas, strength) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const paper = estimatePaperColor(pixels, canvas.width, canvas.height)
  const paperLuminance = .2126 * paper.r + .7152 * paper.g + .0722 * paper.b
  const lowerEdge = .075 + (strength / 100) * .115
  const upperEdge = lowerEdge + .15

  for (let index = 0; index < pixels.length; index += 4) {
    const originalAlpha = pixels[index + 3] / 255
    if (!originalAlpha) continue
    const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2]
    const luminance = .2126 * r + .7152 * g + .0722 * b
    const saturation = (Math.max(r, g, b) - Math.min(r, g, b)) / 255
    const colorDistance = Math.sqrt((r - paper.r) ** 2 + (g - paper.g) ** 2 + (b - paper.b) ** 2) / 441.67
    const darkerThanPaper = Math.max(0, paperLuminance - luminance) / 255
    const inkScore = darkerThanPaper * .9 + colorDistance * .65 + saturation * .35
    const alpha = smoothstep(lowerEdge, upperEdge, inkScore) * originalAlpha

    if (alpha > .025 && alpha < .98) {
      pixels[index] = clamp(Math.round((r - paper.r * (1 - alpha)) / alpha), 0, 255)
      pixels[index + 1] = clamp(Math.round((g - paper.g * (1 - alpha)) / alpha), 0, 255)
      pixels[index + 2] = clamp(Math.round((b - paper.b * (1 - alpha)) / alpha), 0, 255)
    }
    pixels[index + 3] = alpha < .025 ? 0 : Math.round(alpha * 255)
  }
  context.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
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
  const imageRef = useRef(null)
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
    removePaperBackground(canvas, strength)
    setResult(applyEmblemMask(canvas).toDataURL('image/png'))
    const elapsed = Math.round(performance.now() - started)
    setProcessingMs(elapsed)
    if (import.meta.env.DEV) console.info(`[T.I.M.E. registration] emblem processing: ${elapsed}ms`)
  }, [buildCroppedCanvas, removalStrength])

  useEffect(() => { if (phase === 'result') createResult(removalStrength) }, [createResult, phase, removalStrength])

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
    <div className="capture-intro"><Camera /><h3>拍攝你的個人識別徽章</h3><p>拍下完整紙張，下一步再將作品對準橢圓框</p></div>
    <div className="capture-actions">
      <label className="button capture-primary"><input type="file" accept="image/*" capture="environment" onChange={(event) => readFile(event.target.files?.[0])} /><Camera size={18} /> 拍攝徽章</label>
      <label className="button button--ghost capture-secondary"><input type="file" accept="image/*" onChange={(event) => readFile(event.target.files?.[0])} /><ImagePlus size={18} /> 從相簿選擇</label>
    </div>
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
