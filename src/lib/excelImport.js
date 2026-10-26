let loading
export function loadExcelReader() {
  if (window.XLSX) return Promise.resolve(window.XLSX)
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `${import.meta.env.BASE_URL}vendor/xlsx.full.min.js`
    script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('The Excel reader could not start.'))
    script.onerror = () => { script.remove(); loading = null; reject(new Error('The Excel reader could not load. Refresh and try again.')) }
    document.head.appendChild(script)
  })
  return loading
}
export function importDate(value, reader) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') return reader.SSF.format('yyyy-mm-dd', value)
  const text = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Use Excel date cells or YYYY-MM-DD dates.')
  return text
}
export function importNumber(value) {
  if (value === '' || value === null || value === undefined) throw new Error('A required figure is empty.')
  const result = Number(String(value).replace(/^(ZMW|K)\s*/i, '').replace(/[,\s]/g, ''))
  if (!Number.isFinite(result) || result < 0) throw new Error('Figures must be non-negative numbers.')
  return result
}
