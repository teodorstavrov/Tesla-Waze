import axios from 'axios'
import { cacheGetOrSet } from '../cache/redis'

interface BBox {
  north: number; south: number; east: number; west: number
}

export interface TrafficIncident {
  id: string
  type: string
  position: { lat: number; lng: number }
  title: string
  severity: 1 | 2 | 3 | 4 | 5
  delay?: number
  length?: number
  from?: string
  to?: string
}

export async function fetchTrafficIncidents(bbox: BBox): Promise<TrafficIncident[]> {
  if (!process.env.TOMTOM_API_KEY) return []

  const key = `traffic:incidents:${bbox.south.toFixed(2)},${bbox.west.toFixed(2)}`

  return cacheGetOrSet<TrafficIncident[]>(
    key,
    async () => {
      try {
        const response = await axios.get('https://api.tomtom.com/traffic/services/5/incidentDetails', {
          params: {
            key: process.env.TOMTOM_API_KEY,
            bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
            fields: '{incidents{type,geometry{type,coordinates},properties{id,magnitudeOfDelay,events{description,code,iconCategory},startTime,endTime,from,to,length,delay,roadNumbers,aci{probabilityOfOccurrence,numberOfReports}}}}',
            language: 'en-GB',
            timeValidityFilter: 'present'
          },
          timeout: 6000
        })

        return (response.data?.incidents ?? []).map((inc: Record<string, unknown>) => {
          const props = inc.properties as Record<string, unknown>
          const geom = inc.geometry as { coordinates: number[] }
          const events = (props.events as Array<{ description: string; iconCategory: number }>) ?? []
          return {
            id: `tomtom-${props.id}`,
            type: mapIncidentType(events[0]?.iconCategory ?? 0),
            position: { lat: geom.coordinates[1], lng: geom.coordinates[0] },
            title: events[0]?.description ?? 'Traffic incident',
            severity: mapDelay(props.magnitudeOfDelay as number),
            delay: props.delay as number,
            length: props.length as number,
            from: props.from as string,
            to: props.to as string,
          }
        })
      } catch (err) {
        console.error('[TrafficService] Error:', err)
        return []
      }
    },
    30 // 30s cache
  )
}

function mapIncidentType(iconCategory: number): string {
  const map: Record<number, string> = {
    1: 'accident', 2: 'hazard', 3: 'construction',
    4: 'road_closure', 5: 'road_closure', 6: 'traffic',
    7: 'traffic', 8: 'traffic', 9: 'hazard', 14: 'construction'
  }
  return map[iconCategory] ?? 'traffic'
}

function mapDelay(mag: number): 1 | 2 | 3 | 4 | 5 {
  if (mag >= 4) return 5
  if (mag === 3) return 4
  if (mag === 2) return 3
  if (mag === 1) return 2
  return 1
}
