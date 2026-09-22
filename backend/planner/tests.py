import json
from unittest.mock import MagicMock, patch

from django.test import Client, TestCase

from .services.auth import create_user, issue_token
from .services.planning import Place, build_plan


class HOSPlanningTests(TestCase):
    def setUp(self):
        self.current = Place("Chicago, IL, USA", 41.8781, -87.6298)
        self.pickup = Place("Gary, IN, USA", 41.5934, -87.3464)
        self.dropoff = Place("Indianapolis, IN, USA", 39.7684, -86.1581)

    @patch("planner.services.planning.route_between")
    def test_short_trip_single_day_no_break(self, mock_route):
        # 180 miles, ~3.0 hours driving at 60 mph
        mock_route.return_value = {
            "distanceMiles": 180.0,
            "durationHours": 3.0,
            "geometry": {"type": "LineString", "coordinates": [[-87.6, 41.8], [-86.1, 39.7]]},
        }

        plan = build_plan(self.current, self.pickup, self.dropoff, cycle_used=10.0)

        # Should have: Pickup (on duty 1h), Drive (3h), Dropoff (on duty 1h), Off duty (10h)
        event_types = [e["type"] for e in plan["events"]]
        self.assertIn("on_duty", event_types)
        self.assertIn("driving", event_types)
        self.assertIn("off_duty", event_types)

        # No 30-min break or 10-h mid-route rest should be needed for 3h drive
        labels = [e["label"] for e in plan["events"]]
        self.assertNotIn("30-minute required break", labels)
        self.assertNotIn("10-hour required rest", labels)
        self.assertNotIn("34-hour cycle restart", labels)

    @patch("planner.services.planning.route_between")
    def test_long_trip_requires_break_and_rest(self, mock_route):
        # 1200 miles, ~20 hours driving at 60 mph
        mock_route.return_value = {
            "distanceMiles": 1200.0,
            "durationHours": 20.0,
            "geometry": {"type": "LineString", "coordinates": [[-87.6, 41.8], [-104.9, 39.7]]},
        }

        plan = build_plan(self.current, self.pickup, self.dropoff, cycle_used=5.0)
        labels = [e["label"] for e in plan["events"]]

        # Driving > 8h requires 30-min break
        self.assertIn("30-minute required break", labels)
        # Driving > 11h requires 10-h rest
        self.assertIn("10-hour required rest", labels)
        # 1200 miles requires fuel stop
        self.assertIn("Fuel stop", labels)

    @patch("planner.services.planning.route_between")
    def test_cycle_exhaustion_triggers_34h_restart(self, mock_route):
        # Starting with 68 hours used, 1h pickup leaves 1h cycle before driving 500 miles
        mock_route.return_value = {
            "distanceMiles": 500.0,
            "durationHours": 8.0,
            "geometry": {"type": "LineString", "coordinates": [[-87.6, 41.8], [-86.1, 39.7]]},
        }

        plan = build_plan(self.current, self.pickup, self.dropoff, cycle_used=68.5)
        labels = [e["label"] for e in plan["events"]]

        self.assertIn("34-hour cycle restart", labels)


class APIEndpointsTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_health_check(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    @patch("planner.views.geocode")
    @patch("planner.views.build_plan")
    def test_preview_plan_without_login(self, mock_build_plan, mock_geocode):
        mock_geocode.side_effect = lambda q: Place(q, 40.0, -80.0)
        mock_build_plan.return_value = {
            "route": {"distanceMiles": 100, "durationHours": 2},
            "events": [],
            "summary": {"arrival": "2026-09-22T10:00:00Z", "totalDays": 1, "cycleRemaining": 60},
            "assumptions": [],
        }

        payload = {
            "currentLocation": "Chicago, IL",
            "pickupLocation": "Gary, IN",
            "dropoffLocation": "Indianapolis, IN",
            "cycleUsedHours": 10,
        }

        response = self.client.post(
            "/api/plans/preview/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("route", data)
        self.assertIn("summary", data)

    def test_preview_plan_invalid_cycle(self):
        payload = {
            "currentLocation": "Chicago, IL",
            "pickupLocation": "Gary, IN",
            "dropoffLocation": "Indianapolis, IN",
            "cycleUsedHours": 85,  # Exceeds 70
        }
        response = self.client.post(
            "/api/plans/preview/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_authenticated_endpoints_require_token(self):
        response = self.client.get("/api/plans/")
        self.assertEqual(response.status_code, 401)

        response = self.client.post(
            "/api/plans/save/",
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 401)

    @patch("planner.services.auth.get_database")
    def test_register_and_login_flow(self, mock_db):
        users_collection = MagicMock()
        mock_db.return_value.users = users_collection

        # Register: user doesn't exist yet
        users_collection.find_one.return_value = None
        users_collection.insert_one.return_value.inserted_id = "user123"

        reg_payload = {"name": "Test Driver", "email": "driver@example.com", "password": "password123"}
        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps(reg_payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn("token", data)
        self.assertEqual(data["user"]["email"], "driver@example.com")

        # Login
        from planner.services.auth import hash_password
        users_collection.find_one.return_value = {
            "_id": "user123",
            "name": "Test Driver",
            "email": "driver@example.com",
            "passwordHash": hash_password("password123"),
        }
        login_payload = {"email": "driver@example.com", "password": "password123"}
        login_res = self.client.post(
            "/api/auth/login/",
            data=json.dumps(login_payload),
            content_type="application/json",
        )
        self.assertEqual(login_res.status_code, 200)
        self.assertIn("token", login_res.json())

    @patch("planner.views.delete_trip")
    @patch("planner.views.get_trip")
    @patch("planner.views.list_trips")
    def test_trip_crud_endpoints(self, mock_list, mock_get, mock_delete):
        user = {"id": "user123", "email": "driver@example.com", "name": "Driver"}
        token = issue_token(user)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}

        # List trips
        mock_list.return_value = [{"_id": "trip1", "request": {}, "plan": {}}]
        response = self.client.get("/api/plans/", **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["trips"]), 1)

        # Get trip detail
        mock_get.return_value = {"_id": "trip1", "request": {}, "plan": {}}
        response = self.client.get("/api/plans/trip1/", **headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["trip"]["_id"], "trip1")

        # Delete trip
        mock_delete.return_value = True
        response = self.client.post("/api/plans/trip1/delete/", **headers)
        self.assertEqual(response.status_code, 204)
