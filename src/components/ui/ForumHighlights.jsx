import { useEffect, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { forumHighlights } from '../../data/forumHighlights.js'

export default function ForumHighlights() {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const count = forumHighlights.length

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return undefined
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000)
    return () => window.clearInterval(timer)
  }, [count, paused, reducedMotion])

  const photo = forumHighlights[index]
  function move(step) {
    setPaused(true)
    setIndex((current) => (current + step + count) % count)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="Integrity at work" aria-roledescription={count > 1 ? 'carousel' : undefined}>
      <h3 className="flex items-center gap-2 px-5 pt-4 text-sm font-bold text-slate-900"><Camera size={16} className="text-[#1E4DFF]" />Integrity at work</h3>
      {photo ? (
        <>
          <figure className="mt-3" aria-live={paused || reducedMotion ? 'polite' : 'off'}>
            <img src={`${import.meta.env.BASE_URL}${photo.src}`} alt={photo.alt} className="h-[320px] w-full object-contain bg-white" loading="lazy" />
            {photo.caption && <figcaption className="px-5 pt-3 text-sm text-slate-600">{photo.caption}</figcaption>}
          </figure>
          {count > 1 && <div className="flex items-center justify-between px-4 py-3">
            <span className="text-xs tabular-nums text-slate-500">{index + 1} / {count}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(-1)} aria-label="Previous photo" className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E4DFF] hover:bg-[#EEF2FF]"><ChevronLeft size={18} /></button>
              {!reducedMotion && <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Play slideshow' : 'Pause slideshow'} className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E4DFF] hover:bg-[#EEF2FF]">{paused ? <Play size={16} /> : <Pause size={16} />}</button>}
              <button type="button" onClick={() => move(1)} aria-label="Next photo" className="flex h-9 w-9 items-center justify-center rounded-full text-[#1E4DFF] hover:bg-[#EEF2FF]"><ChevronRight size={18} /></button>
            </div>
          </div>}
          {count === 1 && <div className="h-4" />}
        </>
      ) : (
        <div className="m-4 flex aspect-[4/3] flex-col items-center justify-center rounded-xl bg-[#EEF2FF] px-5 text-center">
          <Camera size={28} strokeWidth={1.5} className="mb-3 text-[#1E4DFF]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[#1638CC]">Our people. Our workplace.</p>
          <p className="mt-1.5 max-w-[24ch] text-xs leading-5 text-[#1638CC]">Workplace photos and event highlights coming soon.</p>
        </div>
      )}
    </section>
  )
}
