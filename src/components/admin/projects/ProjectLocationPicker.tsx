'use client'

/**
 * ProjectLocationPicker — interactive OpenStreetMap for project location selection.
 *
 * CRITICAL: This component MUST be loaded via dynamic import with ssr: false
 * in the parent (ProjectForm.tsx). Leaflet accesses `window` at module load
 * and will crash during SSR if imported directly.
 *
 * Features:
 *   - Click anywhere on the map to place a marker (sets lat/lng)
 *   - Circle overlay shows the attendance radius around the selected point
 *   - Defaults to Israel overview (center [31.5, 34.8], zoom 8) when no location set
 *   - Zooms to zoom 14 when location is set
 *
 * Usage (in parent, via dynamic import):
 *   const DynamicLocationPicker = dynamic(
 *     () => import('./ProjectLocationPicker').then(m => ({ default: m.ProjectLocationPicker })),
 *     { ssr: false, loading: () => <div className="h-[300px] animate-pulse bg-muted rounded-lg" /> }
 *   )
 */

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Circle, useMapEvents } from 'react-leaflet'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectLocationPickerProps {
  latitude: number | null
  longitude: number | null
  radius: number
  onLocationChange: (lat: number, lng: number) => void
}

// ---------------------------------------------------------------------------
// ClickHandler — internal component that listens for map click events
// ---------------------------------------------------------------------------

function ClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// ---------------------------------------------------------------------------
// ProjectLocationPicker
// ---------------------------------------------------------------------------

export function ProjectLocationPicker({
  latitude,
  longitude,
  radius,
  onLocationChange,
}: ProjectLocationPickerProps) {
  const hasLocation = latitude !== null && longitude !== null

  const center: [number, number] = hasLocation
    ? [latitude!, longitude!]
    : [31.5, 34.8]           // Israel geographic center

  const zoom = hasLocation ? 14 : 8

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '300px', width: '100%' }}
      className="rounded-lg border"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <ClickHandler onLocationChange={onLocationChange} />

      {hasLocation && (
        <Circle
          center={[latitude!, longitude!]}
          radius={radius > 0 ? radius : 100}
          pathOptions={{
            color:       '#2563eb',
            fillColor:   '#2563eb',
            fillOpacity: 0.2,
            weight:      2,
          }}
        />
      )}
    </MapContainer>
  )
}
