from datetime import datetime, timezone

from bson import ObjectId

from .mongo import get_database


def save_trip(user_id: str, request_data: dict, plan: dict) -> str:
    document = {
        "userId": user_id,
        "request": request_data,
        "plan": plan,
        "createdAt": datetime.now(timezone.utc),
    }
    result = get_database().trips.insert_one(document)
    return str(result.inserted_id)


def list_trips(user_id: str) -> list[dict]:
    documents = get_database().trips.find({"userId": user_id}).sort("createdAt", -1)
    results = []
    for trip in documents:
        trip_data = {**trip, "_id": str(trip["_id"])}
        if isinstance(trip_data.get("createdAt"), datetime):
            trip_data["createdAt"] = trip_data["createdAt"].isoformat()
        results.append(trip_data)
    return results


def get_trip(user_id: str, trip_id: str) -> dict | None:
    if not ObjectId.is_valid(trip_id):
        return None
    trip = get_database().trips.find_one({"_id": ObjectId(trip_id), "userId": user_id})
    if not trip:
        return None
    trip_data = {**trip, "_id": str(trip["_id"])}
    if isinstance(trip_data.get("createdAt"), datetime):
        trip_data["createdAt"] = trip_data["createdAt"].isoformat()
    return trip_data


def delete_trip(user_id: str, trip_id: str) -> bool:
    if not ObjectId.is_valid(trip_id):
        return False

    result = get_database().trips.delete_one({"_id": ObjectId(trip_id), "userId": user_id})
    return result.deleted_count == 1
