from datetime import datetime, timedelta, timezone

from .routing import Place, route_between


MAX_DRIVING_HOURS = 11
MAX_WINDOW_HOURS = 14
MAX_CYCLE_HOURS = 70
BREAK_THRESHOLD_HOURS = 8
FUEL_INTERVAL_MILES = 1000


def _event(kind: str, label: str, starts_at: datetime, hours: float, location: str, miles: float = 0) -> dict:
    return {
        "type": kind,
        "label": label,
        "start": starts_at.isoformat(),
        "end": (starts_at + timedelta(hours=hours)).isoformat(),
        "durationHours": round(hours, 2),
        "location": location,
        "miles": round(miles, 1),
    }


def build_plan(current: Place, pickup: Place, dropoff: Place, cycle_used: float) -> dict:
    route = route_between([current, pickup, dropoff])
    current_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    events: list[dict] = []
    average_mph = max(route["distanceMiles"] / max(route["durationHours"], 0.1), 35)
    driving_left = MAX_DRIVING_HOURS
    window_left = MAX_WINDOW_HOURS
    cycle_left = MAX_CYCLE_HOURS - cycle_used
    driving_since_break = 0.0
    miles_since_fuel = 0.0

    def add_stop(kind: str, label: str, hours: float, location: str, consumes_cycle: bool | None = None) -> None:
        nonlocal current_time, window_left, cycle_left, driving_since_break
        events.append(_event(kind, label, current_time, hours, location))
        current_time += timedelta(hours=hours)
        window_left -= hours
        if consumes_cycle is None:
            consumes_cycle = (kind != "off_duty")
        if consumes_cycle:
            cycle_left -= hours
        if hours >= 0.5:
            driving_since_break = 0.0

    # Determine legs: Leg 1 = current -> pickup, Leg 2 = pickup -> dropoff
    legs_data = route.get("legs", [])
    if len(legs_data) >= 2:
        legs = [
            {"miles": legs_data[0]["distanceMiles"], "from": current.label, "to": pickup.label},
            {"miles": legs_data[1]["distanceMiles"], "from": pickup.label, "to": dropoff.label},
        ]
    else:
        half_miles = round(route["distanceMiles"] / 2, 1)
        legs = [
            {"miles": half_miles, "from": current.label, "to": pickup.label},
            {"miles": round(route["distanceMiles"] - half_miles, 1), "from": pickup.label, "to": dropoff.label},
        ]

    def drive_leg(leg: dict) -> None:
        nonlocal current_time, window_left, cycle_left, driving_left, driving_since_break, miles_since_fuel
        remaining_leg_miles = leg["miles"]

        while remaining_leg_miles > 0.05:
            if cycle_left <= 0:
                events.append(_event("off_duty", "34-hour cycle restart", current_time, 34, "Safe rest area"))
                current_time += timedelta(hours=34)
                cycle_left = MAX_CYCLE_HOURS
                driving_left = MAX_DRIVING_HOURS
                window_left = MAX_WINDOW_HOURS
                driving_since_break = 0.0
                continue

            if driving_left <= 0 or window_left <= 0:
                events.append(_event("off_duty", "10-hour required rest", current_time, 10, "Safe rest area"))
                current_time += timedelta(hours=10)
                driving_left = MAX_DRIVING_HOURS
                window_left = MAX_WINDOW_HOURS
                driving_since_break = 0.0
                continue

            if miles_since_fuel >= FUEL_INTERVAL_MILES - 0.1:
                add_stop("on_duty", "Fuel stop", 0.5, "Fuel stop")
                miles_since_fuel = 0.0
                continue

            if driving_since_break >= BREAK_THRESHOLD_HOURS:
                add_stop("off_duty", "30-minute required break", 0.5, "Safe rest area")
                continue

            hours_to_fuel = max(0.1, FUEL_INTERVAL_MILES - miles_since_fuel) / average_mph
            drive_hours = min(
                remaining_leg_miles / average_mph,
                driving_left,
                window_left,
                cycle_left,
                BREAK_THRESHOLD_HOURS - driving_since_break,
                hours_to_fuel,
            )
            drive_hours = max(0.02, drive_hours)
            drive_miles = min(remaining_leg_miles, drive_hours * average_mph)

            events.append(
                _event(
                    "driving",
                    f"Drive to {leg['to']}",
                    current_time,
                    drive_hours,
                    f"En route to {leg['to']}",
                    drive_miles,
                )
            )
            current_time += timedelta(hours=drive_hours)
            remaining_leg_miles -= drive_miles
            miles_since_fuel += drive_miles
            driving_left -= drive_hours
            window_left -= drive_hours
            cycle_left -= drive_hours
            driving_since_break += drive_hours

    # 1. Drive Leg 1: Current -> Pickup
    drive_leg(legs[0])

    # 2. Arrived at Pickup: 1 hour on-duty loading
    add_stop("on_duty", "Pickup and loading", 1.0, pickup.label)

    # 3. Drive Leg 2: Pickup -> Dropoff
    drive_leg(legs[1])

    # 4. Arrived at Dropoff: 1 hour on-duty unloading
    add_stop("on_duty", "Dropoff and unloading", 1.0, dropoff.label)

    # 5. Trip completed: Driver released from duty
    events.append(_event("off_duty", "Trip completed / Off duty", current_time, 10.0, dropoff.label, 0))

    active_days = {event["start"][:10] for event in events if event["type"] in ("driving", "on_duty")}

    return {
        "route": route,
        "stops": {
            "current": current.__dict__,
            "pickup": pickup.__dict__,
            "dropoff": dropoff.__dict__,
        },
        "events": events,
        "summary": {
            "arrival": current_time.isoformat(),
            "totalDays": max(1, len(active_days)),
            "cycleRemaining": max(0, round(cycle_left, 1)),
        },
        "assumptions": [
            "Property-carrying driver using the 70-hour / 8-day cycle.",
            "New plans begin after a qualifying 10-hour off-duty period.",
            "Pickup and dropoff each take one hour of on-duty, not-driving time.",
            "This plan excludes HOS exceptions and split sleeper berth.",
        ],
    }
