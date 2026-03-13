from django.urls import path

from . import views

app_name = "uploadfile"

urlpatterns = [
    path("goodslistfile/", views.GoodlistfileViewSet.as_view(), name="goodslistfile"),
    path("supplierfile/", views.SupplierfileViewSet.as_view(), name="suppplierfile"),
    path("customerfile/", views.CustomerfileViewSet.as_view(), name="customerfile"),
    path("capitalfile/", views.CapitalfileViewSet.as_view(), name="capitalfile"),
    path("freightfile/", views.FreightfileViewSet.as_view(), name="freightfile"),
    path("goodslistfileadd/", views.GoodlistfileAddViewSet.as_view(), name="goodslistfileadd"),
    path("supplierfileadd/", views.SupplierfileAddViewSet.as_view(), name="suppplierfileadd"),
    path("customerfileadd/", views.CustomerfileAddViewSet.as_view(), name="customerfileadd"),
    path("capitalfileadd/", views.CapitalfileAddViewSet.as_view(), name="capitalfileadd"),
    path("freightfileadd/", views.FreightfileAddViewSet.as_view(), name="freightfileadd"),
]
