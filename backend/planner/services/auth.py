from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from django.conf import settings
from pymongo.errors import DuplicateKeyError

from .mongo import get_database


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_user(name: str, email: str, password: str) -> dict:
    users = get_database().users
    users.create_index("email", unique=True)
    document = {
        "name": name.strip(),
        "email": email.strip().lower(),
        "passwordHash": hash_password(password),
        "createdAt": datetime.now(timezone.utc),
    }
    try:
        result = users.insert_one(document)
    except DuplicateKeyError as error:
        raise ValueError("An account with this email already exists.") from error
    return {"id": str(result.inserted_id), "name": document["name"], "email": document["email"]}


def authenticate(email: str, password: str) -> dict:
    user = get_database().users.find_one({"email": email.strip().lower()})
    if not user or not bcrypt.checkpw(password.encode(), user["passwordHash"].encode()):
        raise ValueError("Email or password is incorrect.")
    return {"id": str(user["_id"]), "name": user["name"], "email": user["email"]}


def issue_token(user: dict) -> str:
    payload = {"sub": user["id"], "email": user["email"], "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def read_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
