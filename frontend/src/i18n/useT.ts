import { useMemo } from 'react'
import { useUIStore } from '../store/uiStore'
import { getT } from './translations'

export function useT() {
  const language = useUIStore(s => s.language)
  return useMemo(() => getT(language), [language])
}
