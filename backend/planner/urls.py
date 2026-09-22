from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("auth/register/", views.register, name="register"),
    path("auth/login/", views.login, name="login"),
    path("plans/preview/", views.preview_plan, name="preview-plan"),
    path("plans/", views.trips, name="trips"),
    path("plans/save/", views.save_plan, name="save-plan"),
    path("plans/<str:trip_id>/", views.get_trip_detail, name="get-trip"),
    path("plans/<str:trip_id>/delete/", views.remove_trip, name="remove-trip"),
]
