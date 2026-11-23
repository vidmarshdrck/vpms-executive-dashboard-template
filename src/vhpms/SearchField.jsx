import { NavIcon } from './icons.jsx'

export default function SearchField({ id, label, placeholder, value, onChange }) {
  return (
    <div className="search-field">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <span className="search-icon" aria-hidden="true"><NavIcon name="search" /></span>
      <input id={id} type="search" value={value} placeholder={placeholder || label} aria-label={label} onChange={(event) => onChange(event.target.value)} />
      {value ? <button type="button" className="search-clear" aria-label="Clear search" onClick={() => onChange('')}><NavIcon name="x" /></button> : null}
    </div>
  )
}
