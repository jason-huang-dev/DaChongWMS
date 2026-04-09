from __future__ import annotations

from rest_framework import serializers

from .models import CustomerAccount


class CustomerAccountSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    approval_status = serializers.SerializerMethodField()
    company_name = serializers.CharField(read_only=True, source="name")
    country_region = serializers.SerializerMethodField()
    settlement_currency = serializers.SerializerMethodField()
    distribution_mode = serializers.SerializerMethodField()
    serial_number_management = serializers.SerializerMethodField()
    total_available_balance = serializers.SerializerMethodField()
    credit_limit = serializers.SerializerMethodField()
    credit_used = serializers.SerializerMethodField()
    authorized_order_quantity = serializers.SerializerMethodField()
    limit_balance_documents = serializers.SerializerMethodField()
    charging_template_name = serializers.SerializerMethodField()
    warehouse_assignments = serializers.SerializerMethodField()
    contact_people = serializers.SerializerMethodField()
    oms_login_url = serializers.SerializerMethodField()

    class Meta:
        model = CustomerAccount
        fields = (
            "id",
            "organization_id",
            "name",
            "code",
            "approval_status",
            "company_name",
            "country_region",
            "settlement_currency",
            "distribution_mode",
            "serial_number_management",
            "contact_name",
            "contact_email",
            "contact_phone",
            "contact_people",
            "billing_email",
            "shipping_method",
            "allow_dropshipping_orders",
            "allow_inbound_goods",
            "total_available_balance",
            "credit_limit",
            "credit_used",
            "authorized_order_quantity",
            "limit_balance_documents",
            "charging_template_name",
            "warehouse_assignments",
            "oms_login_url",
            "notes",
            "is_active",
            "create_time",
            "update_time",
        )
        read_only_fields = ("id", "organization_id", "create_time", "update_time")

    def get_approval_status(self, obj: CustomerAccount) -> str:
        return "APPROVED" if obj.is_active else "DEACTIVATED"

    def get_country_region(self, obj: CustomerAccount) -> None:
        return None

    def get_settlement_currency(self, obj: CustomerAccount) -> None:
        return None

    def get_distribution_mode(self, obj: CustomerAccount) -> str:
        return "NOT_SUPPORTED"

    def get_serial_number_management(self, obj: CustomerAccount) -> None:
        return None

    def get_total_available_balance(self, obj: CustomerAccount) -> int:
        return 0

    def get_credit_limit(self, obj: CustomerAccount) -> int:
        return 0

    def get_credit_used(self, obj: CustomerAccount) -> int:
        return 0

    def get_authorized_order_quantity(self, obj: CustomerAccount) -> int:
        return 0

    def get_limit_balance_documents(self, obj: CustomerAccount) -> bool:
        return False

    def get_charging_template_name(self, obj: CustomerAccount) -> None:
        return None

    def get_warehouse_assignments(self, obj: CustomerAccount) -> list[str]:
        return []

    def get_contact_people(self, obj: CustomerAccount) -> list[dict[str, str]]:
        if not (obj.contact_name or obj.contact_email or obj.contact_phone):
            return []
        return [
            {
                "name": obj.contact_name,
                "email": obj.contact_email,
                "phone": obj.contact_phone,
            }
        ]

    def get_oms_login_url(self, obj: CustomerAccount) -> None:
        return None
