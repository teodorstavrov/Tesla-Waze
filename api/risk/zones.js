// Vercel Edge Function — risk zones (returns empty, no DB on Vercel)
export const config = { runtime: 'edge' }

export default async function handler(req) {
  return new Response(JSON.stringify({ zones: [] }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=60', 'Access-Control-Allow-Origin': '*' }
  })
}
