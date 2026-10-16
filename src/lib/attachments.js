const TYPES = {
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  webm: 'audio/webm', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
}
export const ATTACHMENT_ACCEPT = Object.keys(TYPES).map(extension => `.${extension}`).join(',')
export function validateAttachments(files = []) {
  if (!Array.isArray(files) || files.length > 5) throw new Error('Attach up to five files.')
  if (files.reduce((sum, file) => sum + file.size, 0) > 2 * 1024 * 1024) throw new Error('Keep attachments below 2 MB in total for this preview.')
  for (const file of files) {
    const expected = TYPES[file.name?.split('.').at(-1)?.toLowerCase()]
    if (!expected || typeof file.data !== 'string' || !file.data.startsWith(`data:${expected};base64,`) || !file.data.includes(';base64,') || !Number.isFinite(file.size) || file.size < 0) throw new Error('Choose a supported document, image or audio file.')
  }
  return files.map(({ id, name, type, size, data }) => ({ id, name, type, size, data }))
}
export async function readAttachments(fileList) {
  const files = [...fileList]
  if (files.length > 5 || files.reduce((sum, file) => sum + file.size, 0) > 2 * 1024 * 1024) throw new Error('Choose files smaller than 2 MB for this preview.')
  return Promise.all(files.map(file => new Promise((resolve, reject) => {
    const type = TYPES[file.name.split('.').at(-1).toLowerCase()]
    if (!type) return reject(new Error('Use PDF, Office documents, text, images or audio.'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`${file.name} could not be read. Try again.`))
    reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, type, size: file.size, data: String(reader.result).replace(/^data:[^;]*/, `data:${type}`) })
    reader.readAsDataURL(file)
  })))
}
