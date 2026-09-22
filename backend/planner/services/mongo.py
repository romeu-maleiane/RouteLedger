from functools import lru_cache

from django.conf import settings
from pymongo import MongoClient
from pymongo.database import Database


@lru_cache(maxsize=1)
def get_database() -> Database:
    """Return one reusable Atlas client per Django process."""
    if not settings.MONGO_URI:
        raise RuntimeError("MONGO_URI is not configured. Add the MongoDB Atlas URI to backend/.env.")

    client = MongoClient(settings.MONGO_URI, serverSelectionTimeoutMS=5000)
    return client[settings.MONGO_DATABASE]


def check_connection() -> None:
    get_database().command("ping")
