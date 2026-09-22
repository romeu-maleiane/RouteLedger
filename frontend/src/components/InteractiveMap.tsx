import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Place {
  label: string;
  latitude: number;
  longitude: number;
}

interface InteractiveMapProps {
  geometry?: {
    type: string;
    coordinates: [number, number][];
  };
  stops: {
    current: Place;
    pickup: Place;
    dropoff: Place;
  };
}

export function InteractiveMap({ geometry, stops }: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing map instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter: [number, number] = [
      stops.pickup.latitude || stops.current.latitude || 39.8283,
      stops.pickup.longitude || stops.current.longitude || -98.5795,
    ];

    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 6,
      scrollWheelZoom: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);

    // Custom marker icon helper
    const createMarker = (lat: number, lon: number, label: string, color: string, badge: string) => {
      const icon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="
            background: ${color};
            color: white;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 6px;
            border: 2px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            display: inline-flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            transform: translate(-50%, -100%);
          ">
            <span>${badge}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lon], { icon }).addTo(map);
      marker.bindPopup(`<strong>${badge}</strong><br/>${label}`);
      bounds.extend([lat, lon]);
      return marker;
    };

    if (stops.current.latitude && stops.current.longitude) {
      createMarker(
        stops.current.latitude,
        stops.current.longitude,
        stops.current.label,
        "#102a43",
        "Current Location"
      );
    }

    if (stops.pickup.latitude && stops.pickup.longitude) {
      createMarker(
        stops.pickup.latitude,
        stops.pickup.longitude,
        stops.pickup.label,
        "#2c9360",
        "Pickup Stop (1h)"
      );
    }

    if (stops.dropoff.latitude && stops.dropoff.longitude) {
      createMarker(
        stops.dropoff.latitude,
        stops.dropoff.longitude,
        stops.dropoff.label,
        "#d9381e",
        "Dropoff Stop (1h)"
      );
    }

    // Draw route geometry if present
    if (geometry && geometry.coordinates && geometry.coordinates.length > 0) {
      const latlngs: [number, number][] = geometry.coordinates.map(([lon, lat]) => [lat, lon]);
      const polyline = L.polyline(latlngs, {
        color: "#1664c0",
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      bounds.extend(polyline.getBounds());
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [geometry, stops]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: "100%",
        height: "360px",
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid #cbd5e1",
        position: "relative",
        zIndex: 1,
      }}
      aria-label="Interactive route and stops map"
    />
  );
}
