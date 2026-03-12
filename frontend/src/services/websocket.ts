import { io, Socket } from 'socket.io-client'
import { WsMessage } from '../types'

type MessageHandler = (msg: WsMessage) => void

class WebSocketService {
  private socket: Socket | null = null
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  connect() {
    if (this.socket?.connected) return

    this.socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10
    })

    this.socket.on('connect', () => {
      console.log('[WS] Connected')
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
    })

    this.socket.on('disconnect', (reason) => {
      console.warn('[WS] Disconnected:', reason)
    })

    this.socket.on('message', (msg: WsMessage) => {
      this.dispatch(msg)
    })

    // Direct event types
    const eventTypes = [
      'events:update', 'event:new', 'event:removed',
      'report:confirmed', 'ev:availability', 'risk:update'
    ]
    eventTypes.forEach(type => {
      this.socket!.on(type, (payload: unknown) => {
        this.dispatch({ type: type as WsMessage['type'], payload, timestamp: new Date().toISOString() })
      })
    })
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }

  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => this.handlers.get(type)?.delete(handler)
  }

  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data)
  }

  updateBBox(bbox: { north: number; south: number; east: number; west: number }) {
    this.emit('subscribe:bbox', bbox)
  }

  private dispatch(msg: WsMessage) {
    this.handlers.get(msg.type)?.forEach(h => h(msg))
    this.handlers.get('*')?.forEach(h => h(msg))
  }

  get isConnected() {
    return this.socket?.connected ?? false
  }
}

export const wsService = new WebSocketService()
