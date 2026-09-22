from dataclasses import dataclass

import requests


class RoutingError(Exception):
    """Raised when a requested location or route cannot be resolved."""


@dataclass(frozen=True)
class Place:
    label: str
    latitude: float
    longitude: float


def geocode(query: str) -> Place:
    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 1},
        headers={"User-Agent": "hos-trip-planner-assessment/1.0"},
        timeout=12,
    )
    response.raise_for_status()
    matches = response.json()

    if not matches:
        raise RoutingError(f"We could not find '{query}'. Try a city, state, or full address.")

    match = matches[0]
    address = match.get("address", {})
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("municipality")
        or address.get("county")
    )
    state = address.get("state") or address.get("state_code")
    if city and state:
        clean_label = f"{city}, {state}"
    elif "," in query:
        clean_label = query.strip()
    else:
        clean_label = match["display_name"].split(",")[0]

    return Place(clean_label, float(match["lat"]), float(match["lon"]))


def route_between(stops: list[Place]) -> dict:
    coordinates = ";".join(f"{place.longitude},{place.latitude}" for place in stops)
    response = requests.get(
        f"https://router.project-osrm.org/route/v1/driving/{coordinates}",
        params={"overview": "full", "geometries": "geojson"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()

    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise RoutingError("A route could not be calculated for these locations.")

    route = payload["routes"][0]
    legs = [
        {
            "distanceMiles": round(leg["distance"] / 1609.344, 1),
            "durationHours": round(leg["duration"] / 3600, 2),
        }
        for leg in route.get("legs", [])
    ]

    return {
        "distanceMiles": round(route["distance"] / 1609.344, 1),
        "durationHours": round(route["duration"] / 3600, 2),
        "geometry": route["geometry"],
        "legs": legs,
    }
