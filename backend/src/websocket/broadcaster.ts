import { Server as SocketIOServer, Socket } from 'socket.io'
import { fetchEvents } from '../services/aggregator'
import { fetchEVStations } from '../services/evService'

interface BBox {
  north: number; south: number; east: number; west: number
}

interface ConnectedClient {
  socket: Socket
  bbox: BBox | null
  lastEventIds: Set<string>
}

const clients = new Map<string, ConnectedClient>()

export function initWebSocket(io: SocketIOServer): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`)

    clients.set(socket.id, { socket, bbox: null, lastEventIds: new Set() })

    socket.on('subscribe:bbox', (bbox: BBox) => {
      const client = clients.get(socket.id)
      if (client) {
        client.bbox = bbox
        // Immediately send current events
        sendEventsToClient(client).catch(() => {})
      }
    })

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`)
      clients.delete(socket.id)
    })
  })
}

async function sendEventsToClient(client: ConnectedClient): Promise<void> {
  if (!client.bbox) return

  const events = await fetchEvents(client.bbox)
  const eventIds = new Set(events.map(e => e.id))

  // Find new events
  const newEvents = events.filter(e => !client.lastEventIds.has(e.id))
  const removedIds = [...client.lastEventIds].filter(id => !eventIds.has(id))

  // Update client's known event set
  client.lastEventIds = eventIds

  if (newEvents.length > 0) {
    newEvents.forEach(event => {
      client.socket.emit('event:new', event)
    })
  }

  if (removedIds.length > 0) {
    removedIds.forEach(id => {
      client.socket.emit('event:removed', { id })
    })
  }
}

// Periodic broadcast to all connected clients
export function startEventBroadcast(intervalMs = 10000): NodeJS.Timeout {
  return setInterval(async () => {
    const clientList = Array.from(clients.values())
    await Promise.allSettled(
      clientList.map(client => sendEventsToClient(client))
    )
  }, intervalMs)
}

// Broadcast a new user report to nearby clients
export function broadcastUserReport(
  io: SocketIOServer,
  report: { type: string; position: { lat: number; lng: number }; id: string }
): void {
  clients.forEach(client => {
    if (!client.bbox) return
    const { lat, lng } = report.position
    if (lat > client.bbox.south && lat < client.bbox.north &&
        lng > client.bbox.west && lng < client.bbox.east) {
      client.socket.emit('event:new', {
        id: `report-${report.id}`,
        type: report.type,
        position: report.position,
        title: `${report.type} reported nearby`,
        severity: 2,
        confidence: 50,
        votes: 0,
        source: 'user_report',
        reportedAt: new Date().toISOString(),
      })
    }
  })
}

export function getConnectedCount(): number {
  return clients.size
}
