from django.urls import path

from . import views

app_name = "test_system"

urlpatterns = [
    path("register/", views.register, name="register"),
]
