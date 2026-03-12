import { useEffect } from 'react'
import { wsService } from '../services/websocket'
import { useEventsStore } from '../store/eventsStore'
import { TrafficEvent, EVStation, WsMessage } from '../types'

export function useWebSocket() {
  const { addEvent, removeEvent, setEVStations, evStations } = useEventsStore()

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
        setEVStations(
          evStations.map(s => s.id === updated.id ? { ...s, ...updated } : s)
        )
      })
    ]

    return () => {
      unsubs.forEach(u => u())
    }
  }, [addEvent, removeEvent, setEVStations, evStations])
}
