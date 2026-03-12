import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server as SocketIOServer } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import cron from 'node-cron'

import { initDb, db } from './db'
import { initRedis } from './cache/redis'
import { initWebSocket, startEventBroadcast, getConnectedCount } from './websocket/broadcaster'
import eventsRouter from './routes/events'
import reportsRouter from './routes/reports'
import routesRouter from './routes/routes'
import evRouter from './routes/ev'
import riskRouter from './routes/risk'

const PORT = parseInt(process.env.PORT ?? '3001', 10)

async function bootstrap() {
  // ─── Init connections ─────────────────────────────────────────────────────
  await initDb()
  await initRedis()

  // ─── Express app ──────────────────────────────────────────────────────────
  const app = express()
  const server = http.createServer(app)

  // ─── Socket.IO ────────────────────────────────────────────────────────────
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  initWebSocket(io)
  startEventBroadcast(10_000)

  // ─── Middleware ───────────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for map tiles
    crossOriginEmbedderPolicy: false,
  }))

  app.use(cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  })
  app.use('/api', limiter)

  // ─── Routes ───────────────────────────────────────────────────────────────
  app.use('/api/events', eventsRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/routes', routesRouter)
  app.use('/api/ev', evRouter)
  app.use('/api/risk', riskRouter)

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      connected: getConnectedCount(),
      timestamp: new Date().toISOString(),
    })
  })

  // ─── Scheduled jobs ───────────────────────────────────────────────────────
  // Cleanup expired records daily at 3am
  cron.schedule('0 3 * * *', async () => {
    try {
      await db.query('SELECT cleanup_expired()')
      console.log('[Cron] Cleaned up expired records')
    } catch (err) {
      console.error('[Cron] Cleanup error:', err)
    }
  })

  // ─── Start server ─────────────────────────────────────────────────────────
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Tesla Intelligence API`)
    console.log(`   ➜ HTTP: http://localhost:${PORT}`)
    console.log(`   ➜ WS:   ws://localhost:${PORT}`)
    console.log(`   ➜ ENV:  ${process.env.NODE_ENV ?? 'development'}\n`)
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Shutting down gracefully…`)
    server.close(async () => {
      await db.end()
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))
}

bootstrap().catch(err => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
