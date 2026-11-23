import { createContext, createElement, useContext } from 'react'
import { formatK } from './veData.js'
import { formatAmount } from './workspaceCharts.js'

const VeFormatContext = createContext(null)

export function formatVeAmount(amount, currency = 'ZMW') {
  if (currency === 'USD') return formatAmount(amount, 'USD')
  return formatK(amount)
}

export function VeFormat({ children }) {
  return createElement(VeFormatContext.Provider, { value: formatVeAmount }, children)
}

export function useVeFormat() {
  return useContext(VeFormatContext) || formatAmount
}
