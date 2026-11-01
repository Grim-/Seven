export interface Place {
  name: string
  region: string
  latitude: number
  longitude: number
}

export interface Day {
  date: string
  label: string
  code: number
  text: string
  high: number
  low: number
  rain: number | null
  sunrise: string
  sunset: string
}

export interface Forecast {
  place: Place
  units: { temp: string; wind: string }
  now: { temp: number; feels: number; code: number; text: string; wind: number; humidity: number; day: boolean }
  days: Day[]
  at: number
}

const CODES: [number[], string][] = [
  [[0], 'Clear'],
  [[1], 'Mainly clear'],
  [[2], 'Partly cloudy'],
  [[3], 'Overcast'],
  [[45, 48], 'Fog'],
  [[51, 53, 55], 'Drizzle'],
  [[56, 57], 'Freezing drizzle'],
  [[61], 'Light rain'],
  [[63], 'Rain'],
  [[65], 'Heavy rain'],
  [[66, 67], 'Freezing rain'],
  [[71], 'Light snow'],
  [[73], 'Snow'],
  [[75], 'Heavy snow'],
  [[77], 'Snow grains'],
  [[80, 81], 'Showers'],
  [[82], 'Heavy showers'],
  [[85, 86], 'Snow showers'],
  [[95], 'Thunderstorm'],
  [[96, 99], 'Thunderstorm with hail']
]

export function describe(code: number): string {
  return CODES.find(([codes]) => codes.includes(code))?.[1] ?? 'Unknown'
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`The weather service (Open-Meteo) answered ${res.status}. Try again in a few minutes.`)
  return res.json()
}

const places = new Map<string, Place>()

export async function findPlace(query: string): Promise<Place> {
  const key = query.trim().toLowerCase()
  const cached = places.get(key)
  if (cached) return cached
  const name = query.split(',')[0].trim()
  const body = (await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json`)) as { results?: Record<string, unknown>[] }
  const results = body.results ?? []
  const hint = query.split(',').slice(1).join(' ').trim().toLowerCase()
  const pick = (hint && results.find((r) => [r.admin1, r.country, r.country_code].some((v) => typeof v === 'string' && v.toLowerCase().includes(hint)))) || results[0]
  if (!pick) throw new Error(`Could not find a place called "${query}". Try "town, country".`)
  const place: Place = {
    name: String(pick.name),
    region: [pick.admin1, pick.country].filter((v) => typeof v === 'string' && v).join(', '),
    latitude: Number(pick.latitude),
    longitude: Number(pick.longitude)
  }
  places.set(key, place)
  return place
}

const forecasts = new Map<string, Forecast>()
const FRESH = 15 * 60_000

export function forget(): void {
  forecasts.clear()
}

export async function forecast(query: string, days: number, fahrenheit: boolean): Promise<Forecast> {
  const key = `${query.trim().toLowerCase()}|${days}|${fahrenheit}`
  const cached = forecasts.get(key)
  if (cached && Date.now() - cached.at < FRESH) return cached
  const place = await findPlace(query)
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: String(Math.min(16, Math.max(1, days))),
    ...(fahrenheit ? { temperature_unit: 'fahrenheit', wind_speed_unit: 'mph' } : {})
  })
  const body = (await getJson(`https://api.open-meteo.com/v1/forecast?${params}`)) as {
    current: Record<string, number>
    daily: Record<string, (number | string | null)[]>
  }
  const c = body.current
  const d = body.daily
  const result: Forecast = {
    place,
    units: { temp: fahrenheit ? '°F' : '°C', wind: fahrenheit ? 'mph' : 'km/h' },
    now: { temp: Math.round(c.temperature_2m), feels: Math.round(c.apparent_temperature), code: c.weather_code, text: describe(c.weather_code), wind: Math.round(c.wind_speed_10m), humidity: Math.round(c.relative_humidity_2m), day: c.is_day === 1 },
    days: (d.time as string[]).map((date, i) => ({
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
      code: Number(d.weather_code[i]),
      text: describe(Number(d.weather_code[i])),
      high: Math.round(Number(d.temperature_2m_max[i])),
      low: Math.round(Number(d.temperature_2m_min[i])),
      rain: d.precipitation_probability_max[i] === null ? null : Number(d.precipitation_probability_max[i]),
      sunrise: String(d.sunrise[i]).slice(11, 16),
      sunset: String(d.sunset[i]).slice(11, 16)
    })),
    at: Date.now()
  }
  forecasts.set(key, result)
  return result
}

export function forecastText(f: Forecast): string {
  const n = f.now
  const lines = f.days.map((d) => `- ${d.label}: ${d.text}, ${d.low}–${d.high}${f.units.temp}${d.rain !== null ? `, ${d.rain}% chance of rain` : ''}`)
  return `Weather in ${f.place.name}${f.place.region ? `, ${f.place.region}` : ''}: now ${n.temp}${f.units.temp} (feels ${n.feels}${f.units.temp}), ${n.text.toLowerCase()}, wind ${n.wind} ${f.units.wind}, humidity ${n.humidity}%.\n${lines.join('\n')}`
}
