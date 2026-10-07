// Card primitive
export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return <div className={`px-5 pt-5 pb-3 ${className}`}>{children}</div>
}

export function CardTitle({ children, className = '' }) {
  return <h3 className={`font-semibold text-gray-800 text-sm ${className}`}>{children}</h3>
}

export function CardContent({ children, className = '' }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>
}
