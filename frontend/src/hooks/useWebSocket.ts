import { useEffect } from 'react'
import { wsService } from '../services/websocket'
import { useEventsStore } from '../store/eventsStore'
import { TrafficEvent, EVStation, WsMessage } from '../types'

export function useWebSocket() {
  const { addEvent, removeEvent, setEVStations } = useEventsStore()

  useEffect(() => {
    wsService.connect()

    const unsubs = [
      wsService.subscribe('event:new', (msg: WsMessage) => {
        addEvent(msg.payload as TrafficEvent)
      }),
      wsService.subscribe('event:removed', (msg: WsMessage) => {
        const { id } = msg.payload as { id: string }
        removeEvent(id)
      }),
      wsService.subscribe('ev:availability', (msg: WsMessage) => {
        const updated = msg.payload as Partial<EVStation> & { id: string }
        useEventsStore.setState(s => ({
          evStations: s.evStations.map(st => st.id === updated.id ? { ...st, ...updated } : st)
        }))
      })
    ]

    return () => {
      unsubs.forEach(u => u())
      wsService.disconnect()
    }
  }, [addEvent, removeEvent, setEVStations])
}
