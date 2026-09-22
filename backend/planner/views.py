import json
from functools import wraps

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from .services.auth import authenticate, create_user, issue_token, read_token
from .services.planning import MAX_CYCLE_HOURS, build_plan
from .services.routing import RoutingError, geocode
from .services.trip_repository import delete_trip, get_trip, list_trips, save_trip


def parse_body(request):
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        raise ValueError("The request body must be valid JSON.")


def require_user(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return JsonResponse({"error": "Sign in is required."}, status=401)
        try:
            request.user_claims = read_token(header[7:])
        except Exception:
            return JsonResponse({"error": "Your session has expired. Sign in again."}, status=401)
        return view(request, *args, **kwargs)
    return wrapped


def plan_from_payload(payload):
    required = ("currentLocation", "pickupLocation", "dropoffLocation", "cycleUsedHours")
    missing = [field for field in required if payload.get(field) in (None, "")]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}.")
    cycle_used = float(payload["cycleUsedHours"])
    if not 0 <= cycle_used <= MAX_CYCLE_HOURS:
        raise ValueError("Current cycle used must be between 0 and 70 hours.")
    return build_plan(
        geocode(payload["currentLocation"]),
        geocode(payload["pickupLocation"]),
        geocode(payload["dropoffLocation"]),
        cycle_used,
    )


@require_GET
def health(request):
    return JsonResponse({"status": "ok"})


@require_POST
def preview_plan(request):
    try:
        return JsonResponse(plan_from_payload(parse_body(request)))
    except (TypeError, ValueError) as error:
        return JsonResponse({"error": str(error)}, status=400)
    except RoutingError as error:
        return JsonResponse({"error": str(error)}, status=422)


@require_POST
def register(request):
    try:
        payload = parse_body(request)
        if len(payload.get("password", "")) < 8:
            raise ValueError("Password must contain at least 8 characters.")
        user = create_user(payload.get("name", ""), payload.get("email", ""), payload["password"])
        return JsonResponse({"user": user, "token": issue_token(user)}, status=201)
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=400)


@require_POST
def login(request):
    try:
        payload = parse_body(request)
        user = authenticate(payload.get("email", ""), payload.get("password", ""))
        return JsonResponse({"user": user, "token": issue_token(user)})
    except ValueError as error:
        return JsonResponse({"error": str(error)}, status=401)


@require_POST
@require_user
def save_plan(request):
    try:
        payload = parse_body(request)
        plan = plan_from_payload(payload)
        trip_id = save_trip(request.user_claims["sub"], payload, plan)
        return JsonResponse({"id": trip_id, "plan": plan}, status=201)
    except (TypeError, ValueError) as error:
        return JsonResponse({"error": str(error)}, status=400)
    except RoutingError as error:
        return JsonResponse({"error": str(error)}, status=422)


@require_GET
@require_user
def trips(request):
    return JsonResponse({"trips": list_trips(request.user_claims["sub"])})


@require_GET
@require_user
def get_trip_detail(request, trip_id):
    trip = get_trip(request.user_claims["sub"], trip_id)
    if not trip:
        return JsonResponse({"error": "Trip not found."}, status=404)
    return JsonResponse({"trip": trip})


@require_POST
@require_user
def remove_trip(request, trip_id):
    if not delete_trip(request.user_claims["sub"], trip_id):
        return JsonResponse({"error": "Trip not found."}, status=404)
    return JsonResponse({}, status=204)
