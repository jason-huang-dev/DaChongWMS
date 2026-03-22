from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.products.models import DistributionProduct, Product, ProductMark, ProductPackaging, ProductSerialConfig
from apps.products.permissions import (
    CanManageDistributionProducts,
    CanManagePackaging,
    CanManageProductMarks,
    CanManageProducts,
    CanManageSerialManagement,
    CanViewProductCatalog,
)
from apps.products.serializers import (
    DistributionProductSerializer,
    ProductMarkSerializer,
    ProductPackagingSerializer,
    ProductSerializer,
    ProductSerialConfigSerializer,
)
from apps.products.services.product_service import (
    CreateDistributionProductInput,
    CreateProductInput,
    CreateProductMarkInput,
    CreateProductPackagingInput,
    UpsertProductSerialConfigInput,
    create_distribution_product,
    create_product,
    create_product_mark,
    create_product_packaging,
    list_distribution_products,
    list_organization_products,
    list_product_marks,
    list_product_packaging,
    update_distribution_product,
    update_product,
    update_product_mark,
    update_product_packaging,
    upsert_product_serial_config,
)


class OrganizationProductBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)


class ProductBoundAPIView(OrganizationProductBaseAPIView):
    product: Product

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        super().initial(request, *args, **kwargs)
        self.product = get_object_or_404(
            Product,
            pk=kwargs["product_id"],
            organization=self.organization,
        )


class OrganizationProductListCreateAPIView(OrganizationProductBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageProducts()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        products = list_organization_products(organization=self.organization)
        return Response(ProductSerializer(products, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = create_product(
            CreateProductInput(
                organization=self.organization,
                **serializer.validated_data,
            )
        )
        return Response(ProductSerializer(product).data, status=status.HTTP_201_CREATED)


class OrganizationProductDetailAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageProducts()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return Response(ProductSerializer(self.product).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ProductSerializer(self.product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        product = update_product(self.product, **serializer.validated_data)
        return Response(ProductSerializer(product).data)


class OrganizationDistributionProductListCreateAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageDistributionProducts()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        distribution_products = list_distribution_products(product=self.product)
        return Response(DistributionProductSerializer(distribution_products, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = DistributionProductSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer_account = get_object_or_404(
            CustomerAccount,
            pk=serializer.validated_data["customer_account_id"],
            organization=self.organization,
        )
        distribution_product = create_distribution_product(
            CreateDistributionProductInput(
                product=self.product,
                customer_account=customer_account,
                external_sku=serializer.validated_data["external_sku"],
                external_name=serializer.validated_data.get("external_name", ""),
                channel_name=serializer.validated_data.get("channel_name", ""),
                allow_dropshipping_orders=serializer.validated_data.get("allow_dropshipping_orders", True),
                allow_inbound_goods=serializer.validated_data.get("allow_inbound_goods", True),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(
            DistributionProductSerializer(distribution_product).data,
            status=status.HTTP_201_CREATED,
        )


class OrganizationDistributionProductDetailAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageDistributionProducts()]

    def get_object(self, distribution_product_id: int) -> DistributionProduct:
        return get_object_or_404(
            DistributionProduct,
            pk=distribution_product_id,
            product=self.product,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        distribution_product = self.get_object(kwargs["distribution_product_id"])
        return Response(DistributionProductSerializer(distribution_product).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        distribution_product = self.get_object(kwargs["distribution_product_id"])
        serializer = DistributionProductSerializer(distribution_product, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        customer_account_id = serializer.validated_data.get("customer_account_id")
        customer_account = distribution_product.customer_account
        if customer_account_id is not None:
            customer_account = get_object_or_404(
                CustomerAccount,
                pk=customer_account_id,
                organization=self.organization,
            )

        updated = update_distribution_product(
            distribution_product,
            customer_account=customer_account,
            external_sku=serializer.validated_data.get("external_sku"),
            external_name=serializer.validated_data.get("external_name"),
            channel_name=serializer.validated_data.get("channel_name"),
            allow_dropshipping_orders=serializer.validated_data.get("allow_dropshipping_orders"),
            allow_inbound_goods=serializer.validated_data.get("allow_inbound_goods"),
            is_active=serializer.validated_data.get("is_active"),
        )
        return Response(DistributionProductSerializer(updated).data)


class OrganizationProductSerialConfigAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageSerialManagement()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        config = getattr(self.product, "serial_config", None) or ProductSerialConfig(product=self.product)
        return Response(ProductSerialConfigSerializer(config).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        current_config = getattr(self.product, "serial_config", None)
        serializer = ProductSerialConfigSerializer(current_config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = upsert_product_serial_config(
            UpsertProductSerialConfigInput(
                product=self.product,
                tracking_mode=serializer.validated_data.get("tracking_mode"),
                serial_pattern=serializer.validated_data.get("serial_pattern"),
                requires_uniqueness=serializer.validated_data.get("requires_uniqueness"),
                capture_on_inbound=serializer.validated_data.get("capture_on_inbound"),
                capture_on_outbound=serializer.validated_data.get("capture_on_outbound"),
                capture_on_returns=serializer.validated_data.get("capture_on_returns"),
            )
        )
        return Response(ProductSerialConfigSerializer(config).data)


class OrganizationProductPackagingListCreateAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManagePackaging()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        packaging_options = list_product_packaging(product=self.product)
        return Response(ProductPackagingSerializer(packaging_options, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ProductPackagingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        packaging = create_product_packaging(
            CreateProductPackagingInput(
                product=self.product,
                package_type=serializer.validated_data["package_type"],
                package_code=serializer.validated_data["package_code"],
                units_per_package=serializer.validated_data["units_per_package"],
                length_cm=serializer.validated_data["length_cm"],
                width_cm=serializer.validated_data["width_cm"],
                height_cm=serializer.validated_data["height_cm"],
                weight_kg=serializer.validated_data["weight_kg"],
                is_default=serializer.validated_data.get("is_default", False),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(ProductPackagingSerializer(packaging).data, status=status.HTTP_201_CREATED)


class OrganizationProductPackagingDetailAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManagePackaging()]

    def get_object(self, packaging_id: int) -> ProductPackaging:
        return get_object_or_404(
            ProductPackaging,
            pk=packaging_id,
            product=self.product,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        packaging = self.get_object(kwargs["packaging_id"])
        return Response(ProductPackagingSerializer(packaging).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        packaging = self.get_object(kwargs["packaging_id"])
        serializer = ProductPackagingSerializer(packaging, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_product_packaging(packaging, **serializer.validated_data)
        return Response(ProductPackagingSerializer(updated).data)


class OrganizationProductMarkListCreateAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageProductMarks()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        marks = list_product_marks(product=self.product)
        return Response(ProductMarkSerializer(marks, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ProductMarkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mark = create_product_mark(
            CreateProductMarkInput(
                product=self.product,
                mark_type=serializer.validated_data["mark_type"],
                value=serializer.validated_data["value"],
                notes=serializer.validated_data.get("notes", ""),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(ProductMarkSerializer(mark).data, status=status.HTTP_201_CREATED)


class OrganizationProductMarkDetailAPIView(ProductBoundAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewProductCatalog()]
        return [CanManageProductMarks()]

    def get_object(self, product_mark_id: int) -> ProductMark:
        return get_object_or_404(
            ProductMark,
            pk=product_mark_id,
            product=self.product,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        mark = self.get_object(kwargs["product_mark_id"])
        return Response(ProductMarkSerializer(mark).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        mark = self.get_object(kwargs["product_mark_id"])
        serializer = ProductMarkSerializer(mark, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_product_mark(mark, **serializer.validated_data)
        return Response(ProductMarkSerializer(updated).data)
