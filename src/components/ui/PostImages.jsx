import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

function ImageViewer({ images, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const dialogRef = useRef(null)
  useEffect(() => {
    const previous = document.activeElement, overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; dialogRef.current?.focus()
    function key(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(value => Math.min(images.length - 1, value + 1)) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(value => Math.max(0, value - 1)) }
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled)')], first = controls[0], last = controls.at(-1)
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus() }
  }, [images.length, onClose])
  const touchStart = useRef(null)
  const control = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-30'
  return createPortal(<div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Post image viewer" tabIndex={-1} className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95 p-3 sm:p-6" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="flex shrink-0 items-center justify-between text-white"><span role="status" className="text-sm">Image {index + 1} of {images.length}</span><button type="button" aria-label="Close image viewer" onClick={onClose} className={control}><X size={22} /></button></div>
    <div className="flex min-h-0 flex-1 items-center justify-center py-3" onTouchStart={event => { touchStart.current = event.changedTouches[0].clientX }} onTouchEnd={event => { if (touchStart.current === null) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 50) setIndex(value => Math.max(0, Math.min(images.length - 1, value + (distance < 0 ? 1 : -1)))); touchStart.current = null }}><img src={images[index]} alt={`Post attachment ${index + 1}`} className="h-full max-h-full w-full object-contain" /></div>
    {images.length > 1 && <div className="flex shrink-0 items-center justify-center gap-5"><button type="button" aria-label="Previous full-size image" disabled={index === 0} onClick={() => setIndex(index - 1)} className={control}><ChevronLeft /></button><span className="text-xs text-white/80">Swipe or use the arrow keys</span><button type="button" aria-label="Next full-size image" disabled={index === images.length - 1} onClick={() => setIndex(index + 1)} className={control}><ChevronRight /></button></div>}
  </div>, document.body)
}
export default function PostImages({ images }) {
  const railRef = useRef(null)
  const [index, setIndex] = useState(0), [viewing, setViewing] = useState(null)
  if (!images.length) return null
  function move(next) { railRef.current.scrollTo({ left: next * railRef.current.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }
  return <div className="mt-3 min-w-0" onClick={event => event.stopPropagation()}>
    <div ref={railRef} aria-label="Post images" className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-xl bg-slate-100" onScroll={event => { const el = event.currentTarget; setIndex(Math.round(el.scrollLeft / el.clientWidth)) }}>
      {images.map((src, i) => <button key={i} type="button" aria-label={`View image ${i + 1} of ${images.length}`} onClick={() => setViewing(i)} className="h-72 w-full shrink-0 snap-center focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#1E4DFF] sm:h-96"><img src={src} alt={`Post attachment ${i + 1}`} loading="lazy" className="h-full w-full object-contain" /></button>)}
    </div>
    {images.length > 1 && <div className="mt-1 flex items-center justify-between"><button type="button" aria-label="Previous post image" disabled={index === 0} onClick={() => move(index - 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={20} /></button><span className="text-xs text-slate-500" aria-live="polite">{index + 1} / {images.length} · Swipe to browse</span><button type="button" aria-label="Next post image" disabled={index === images.length - 1} onClick={() => move(index + 1)} className="flex h-11 w-11 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={20} /></button></div>}
    {viewing !== null && <ImageViewer images={images} initialIndex={viewing} onClose={() => setViewing(null)} />}
  </div>
}
