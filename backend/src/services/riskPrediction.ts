import { db } from '../db'
import { cacheGetOrSet } from '../cache/redis'

interface BBox {
  north: number; south: number; east: number; west: number
}

export interface RiskZone {
  id: string
  center: { lat: number; lng: number }
  radiusMeters: number
  score: number
  probability: number
  historicalCount: number
  peakHours: number[]
  dayOfWeek: number[]
}

export async function computeRiskZones(bbox: BBox): Promise<RiskZone[]> {
  const key = `risk:zones:${bbox.south.toFixed(2)},${bbox.west.toFixed(2)}`

  return cacheGetOrSet<RiskZone[]>(
    key,
    async () => {
      try {
        // Aggregate historical police/camera reports into clusters
        const { rows } = await db.query<{
          cluster_lat: number; cluster_lng: number;
          report_count: number; avg_hour: number;
          peak_hours: number[]; day_of_week: number[];
        }>(`
          WITH recent_reports AS (
            SELECT
              lat,
              lng,
              EXTRACT(HOUR FROM created_at) AS hour,
              EXTRACT(DOW FROM created_at) AS dow
            FROM user_reports
            WHERE
              type IN ('police', 'speed_camera')
              AND created_at > NOW() - INTERVAL '30 days'
              AND lat BETWEEN $1 AND $2
              AND lng BETWEEN $3 AND $4
          ),
          clustered AS (
            SELECT
              ROUND(lat::numeric, 3) AS cluster_lat,
              ROUND(lng::numeric, 3) AS cluster_lng,
              COUNT(*) AS report_count,
              AVG(hour) AS avg_hour,
              ARRAY_AGG(DISTINCT hour::integer) AS peak_hours,
              ARRAY_AGG(DISTINCT dow::integer) AS day_of_week
            FROM recent_reports
            GROUP BY ROUND(lat::numeric, 3), ROUND(lng::numeric, 3)
            HAVING COUNT(*) >= 2
          )
          SELECT * FROM clustered
          ORDER BY report_count DESC
          LIMIT 50
        `, [bbox.south, bbox.north, bbox.west, bbox.east])

        return rows.map((row, i) => {
          const count = row.report_count
          const score = Math.min(100, Math.round((count / 20) * 100))
          const probability = Math.min(0.95, count / 15)

          return {
            id: `risk-${i}-${row.cluster_lat}-${row.cluster_lng}`,
            center: { lat: row.cluster_lat, lng: row.cluster_lng },
            radiusMeters: Math.min(500, 150 + count * 20),
            score,
            probability,
            historicalCount: count,
            peakHours: row.peak_hours ?? [],
            dayOfWeek: row.day_of_week ?? [],
          }
        })
      } catch (err) {
        console.error('[RiskPrediction] Error:', err)
        return []
      }
    },
    120 // 2 min cache
  )
}

export function currentRiskScore(zone: RiskZone): number {
  const now = new Date()
  const hour = now.getHours()
  const dow = now.getDay()

  let multiplier = 1.0
  if (zone.peakHours.includes(hour)) multiplier *= 1.4
  if (zone.dayOfWeek.includes(dow)) multiplier *= 1.2

  // Weekday rush hours
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) multiplier *= 1.3

  return Math.min(100, Math.round(zone.score * multiplier))
}
