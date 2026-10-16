import { useRef, useState } from 'react'
import { Paperclip, X, FileText } from 'lucide-react'
import { ATTACHMENT_ACCEPT, readAttachments, validateAttachments } from '../../lib/attachments.js'
export function AttachmentList({ files = [], onRemove }) {
  return <ul className="flex flex-wrap gap-2">{files.map(file => <li key={file.id} className="flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
    <FileText size={14} className="shrink-0" /><a href={file.data} download={file.name} className="truncate underline underline-offset-2">{file.name}</a>
    {file.type?.startsWith('audio/') && <audio controls preload="none" src={file.data} aria-label={file.name} className="h-9 w-52 max-w-full" />}
    {onRemove && <button type="button" aria-label={`Remove ${file.name}`} onClick={() => onRemove(file.id)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-slate-200"><X size={13} /></button>}
  </li>)}</ul>
}
export function AttachmentPicker({ files = [], onChange, onBusy, compact = false }) {
  const ref = useRef(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function pick(event) {
    setBusy(true); onBusy?.(true)
    try { const added = await readAttachments(event.target.files); onChange(validateAttachments([...files, ...added])); setError('') }
    catch (cause) { setError(cause.message) }
    finally { setBusy(false); onBusy?.(false); event.target.value = '' }
  }
  return <div className="space-y-2">
    <input ref={ref} type="file" multiple accept={ATTACHMENT_ACCEPT} aria-label="Attachment files" className="hidden" onChange={pick} />
    <button type="button" aria-label="Attach files" title="Attach documents or images" disabled={busy} onClick={() => ref.current.click()} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 ${compact ? 'w-10' : 'border border-slate-200 px-3'}`}><Paperclip size={17} />{!compact && (busy ? 'Reading files…' : 'Attach documents or images')}</button>
    <AttachmentList files={files} onRemove={id => onChange(files.filter(file => file.id !== id))} />
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>
}
