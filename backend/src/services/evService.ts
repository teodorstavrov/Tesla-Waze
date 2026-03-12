import axios from 'axios'
import { cacheGetOrSet } from '../cache/redis'
import { db } from '../db'

interface BBox {
  north: number; south: number; east: number; west: number
}

export interface EVStationData {
  id: string
  name: string
  operator: string
  position: { lat: number; lng: number }
  connectors: Array<{
    type: string
    powerKw: number
    available: boolean
    total: number
  }>
  pricePerKwh?: number
  totalPorts: number
  availablePorts: number
  isTesla: boolean
  amenities: string[]
  rating?: number
}

export async function fetchEVStations(bbox: BBox): Promise<EVStationData[]> {
  const key = `ev:stations:${bbox.south.toFixed(2)},${bbox.west.toFixed(2)},${bbox.north.toFixed(2)},${bbox.east.toFixed(2)}`

  return cacheGetOrSet<EVStationData[]>(
    key,
    async () => {
      const [openCharge, localStations] = await Promise.allSettled([
        fetchOpenChargeMap(bbox),
        fetchLocalStations(bbox),
      ])

      const results: EVStationData[] = []

      if (openCharge.status === 'fulfilled') results.push(...openCharge.value)
      if (localStations.status === 'fulfilled') results.push(...localStations.value)

      // Deduplicate by proximity
      return deduplicateStations(results)
    },
    300 // 5 minute cache
  )
}

async function fetchOpenChargeMap(bbox: BBox): Promise<EVStationData[]> {
  if (!process.env.OPENCHARGEMAP_API_KEY) return []

  try {
    const { data } = await axios.get('https://api.openchargemap.io/v3/poi', {
      params: {
        key: process.env.OPENCHARGEMAP_API_KEY,
        boundingbox: `(${bbox.south},${bbox.west}),(${bbox.north},${bbox.east})`,
        maxresults: 100,
        compact: true,
        verbose: false,
        output: 'json'
      },
      timeout: 8000
    })

    return (data ?? []).map((poi: Record<string, unknown>) => {
      const addr = poi.AddressInfo as Record<string, unknown>
      const conns = (poi.Connections as Array<Record<string, unknown>>) ?? []
      const op = (poi.OperatorInfo as Record<string, unknown>) ?? {}

      const connectors = conns.map(c => ({
        type: mapPlugType((c.ConnectionType as Record<string, string>)?.Title ?? ''),
        powerKw: Number(c.PowerKW ?? 0),
        available: (c.StatusType as Record<string, unknown>)?.IsOperational !== false,
        total: 1
      }))

      const availablePorts = connectors.filter(c => c.available).length

      return {
        id: `ocm-${poi.ID}`,
        name: String(addr.Title ?? 'Charging Station'),
        operator: String(op.Title ?? 'Unknown'),
        position: { lat: Number(addr.Latitude), lng: Number(addr.Longitude) },
        connectors,
        totalPorts: connectors.length,
        availablePorts,
        isTesla: String(op.Title ?? '').toLowerCase().includes('tesla'),
        amenities: [],
      }
    })
  } catch (err) {
    console.error('[EVService] OpenChargeMap error:', err)
    return []
  }
}

async function fetchLocalStations(bbox: BBox): Promise<EVStationData[]> {
  try {
    const { rows } = await db.query<{
      id: string; name: string; operator: string;
      lat: number; lng: number; total_ports: number;
      available_ports: number; is_tesla: boolean;
      price_per_kwh: string | null; amenities: string[];
      connectors: string;
    }>(`
      SELECT
        s.id, s.name, s.operator,
        s.lat, s.lng,
        s.total_ports, s.available_ports, s.is_tesla,
        s.price_per_kwh, s.amenities,
        json_agg(json_build_object(
          'type', c.plug_type,
          'powerKw', c.power_kw,
          'available', c.available,
          'total', c.total
        )) AS connectors
      FROM ev_stations s
      LEFT JOIN ev_connectors c ON c.station_id = s.id
      WHERE s.lat BETWEEN $1 AND $2
        AND s.lng BETWEEN $3 AND $4
      GROUP BY s.id
      LIMIT 200
    `, [bbox.south, bbox.north, bbox.west, bbox.east])

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      operator: row.operator ?? 'Unknown',
      position: { lat: row.lat, lng: row.lng },
      connectors: JSON.parse(row.connectors as unknown as string) ?? [],
      totalPorts: row.total_ports,
      availablePorts: row.available_ports,
      isTesla: row.is_tesla,
      pricePerKwh: row.price_per_kwh ? parseFloat(row.price_per_kwh) : undefined,
      amenities: row.amenities ?? [],
    }))
  } catch {
    return []
  }
}

function mapPlugType(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('tesla')) return 'Tesla'
  if (t.includes('chademo')) return 'CHAdeMO'
  if (t.includes('ccs') && t.includes('type 2')) return 'CCS2'
  if (t.includes('ccs')) return 'CCS'
  if (t.includes('type 2') || t.includes('type2')) return 'Type2'
  if (t.includes('j1772') || t.includes('type 1')) return 'J1772'
  return 'Type2'
}

function deduplicateStations(stations: EVStationData[]): EVStationData[] {
  const seen = new Map<string, EVStationData>()
  for (const s of stations) {
    const gridKey = `${Math.round(s.position.lat * 1000)},${Math.round(s.position.lng * 1000)}`
    if (!seen.has(gridKey)) seen.set(gridKey, s)
  }
  return Array.from(seen.values())
}
