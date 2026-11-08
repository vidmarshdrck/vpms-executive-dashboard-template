export const SIDEBAR_KEY = 'vhpms-sidebar'

export function readSidebarRetracted(storage) {
  try { return storage.getItem(SIDEBAR_KEY) === 'retracted' } catch { return false }
}

export function writeSidebarRetracted(storage, retracted) {
  try { storage.setItem(SIDEBAR_KEY, retracted ? 'retracted' : 'expanded') } catch { /* private mode */ }
}
