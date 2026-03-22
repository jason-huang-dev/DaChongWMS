from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.request import Request

from apps.fees.models import (
    BalanceTransaction,
    BusinessExpense,
    ChargeItem,
    ChargeTemplate,
    FundFlow,
    ManualCharge,
    ProfitCalculation,
    ReceivableBill,
    RentDetail,
    Voucher,
)
from apps.fees.permissions import (
    CanManageBalanceTransactions,
    CanManageBusinessExpenses,
    CanManageChargeCatalog,
    CanManageFundFlows,
    CanManageManualCharges,
    CanManageProfitCalculations,
    CanManageReceivableBills,
    CanManageRentDetails,
    CanManageVouchers,
    CanReviewBalanceTransactions,
    CanViewFees,
)
from apps.fees.serializers import (
    BalanceTransactionSerializer,
    BusinessExpenseSerializer,
    ChargeItemSerializer,
    ChargeTemplateSerializer,
    FundFlowSerializer,
    ManualChargeSerializer,
    ProfitCalculationSerializer,
    ReceivableBillSerializer,
    RentDetailSerializer,
    VoucherSerializer,
)
from apps.organizations.models import Organization


class OrganizationFeesBaseAPIView:
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)


class OrganizationScopedListCreateAPIView(OrganizationFeesBaseAPIView, ListCreateAPIView):
    read_permission_class = CanViewFees
    write_permission_class = CanViewFees
    filter_fields: tuple[str, ...] = ()
    select_related_fields: tuple[str, ...] = ()

    def get_permissions(self) -> list[object]:
        permission_class = self.read_permission_class if self.request.method == "GET" else self.write_permission_class
        return [permission_class()]

    def get_queryset(self):
        queryset = self.queryset.filter(organization=self.organization)
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        for field in self.filter_fields:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset

    def perform_create(self, serializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationScopedDetailAPIView(OrganizationFeesBaseAPIView, RetrieveUpdateAPIView):
    read_permission_class = CanViewFees
    write_permission_class = CanViewFees
    lookup_url_kwarg: str
    select_related_fields: tuple[str, ...] = ()

    def get_permissions(self) -> list[object]:
        permission_class = self.read_permission_class if self.request.method == "GET" else self.write_permission_class
        return [permission_class()]

    def get_queryset(self):
        queryset = self.queryset.filter(organization=self.organization)
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        return queryset


class OrganizationBalanceTransactionListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = BalanceTransaction.objects.all()
    serializer_class = BalanceTransactionSerializer
    write_permission_class = CanManageBalanceTransactions
    filter_fields = ("status", "transaction_type", "customer_account_id")
    select_related_fields = ("customer_account", "voucher")


class OrganizationBalanceTransactionDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = BalanceTransaction.objects.all()
    serializer_class = BalanceTransactionSerializer
    lookup_url_kwarg = "balance_transaction_id"
    write_permission_class = CanReviewBalanceTransactions
    select_related_fields = ("customer_account", "voucher")


class OrganizationVoucherListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = Voucher.objects.all()
    serializer_class = VoucherSerializer
    write_permission_class = CanManageVouchers
    filter_fields = ("status", "voucher_type", "customer_account_id")
    select_related_fields = ("customer_account",)


class OrganizationVoucherDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = Voucher.objects.all()
    serializer_class = VoucherSerializer
    lookup_url_kwarg = "voucher_id"
    write_permission_class = CanManageVouchers
    select_related_fields = ("customer_account",)


class OrganizationChargeItemListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = ChargeItem.objects.all()
    serializer_class = ChargeItemSerializer
    write_permission_class = CanManageChargeCatalog
    filter_fields = ("category", "is_active")


class OrganizationChargeItemDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = ChargeItem.objects.all()
    serializer_class = ChargeItemSerializer
    lookup_url_kwarg = "charge_item_id"
    write_permission_class = CanManageChargeCatalog


class OrganizationChargeTemplateListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = ChargeTemplate.objects.all()
    serializer_class = ChargeTemplateSerializer
    write_permission_class = CanManageChargeCatalog
    filter_fields = ("is_active", "warehouse_id", "customer_account_id")
    select_related_fields = ("charge_item", "warehouse", "customer_account")


class OrganizationChargeTemplateDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = ChargeTemplate.objects.all()
    serializer_class = ChargeTemplateSerializer
    lookup_url_kwarg = "charge_template_id"
    write_permission_class = CanManageChargeCatalog
    select_related_fields = ("charge_item", "warehouse", "customer_account")


class OrganizationManualChargeListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = ManualCharge.objects.all()
    serializer_class = ManualChargeSerializer
    write_permission_class = CanManageManualCharges
    filter_fields = ("status", "customer_account_id", "warehouse_id")
    select_related_fields = ("customer_account", "warehouse", "charge_item", "charge_template")


class OrganizationManualChargeDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = ManualCharge.objects.all()
    serializer_class = ManualChargeSerializer
    lookup_url_kwarg = "manual_charge_id"
    write_permission_class = CanManageManualCharges
    select_related_fields = ("customer_account", "warehouse", "charge_item", "charge_template")


class OrganizationFundFlowListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = FundFlow.objects.all()
    serializer_class = FundFlowSerializer
    write_permission_class = CanManageFundFlows
    filter_fields = ("status", "flow_type", "warehouse_id", "customer_account_id")
    select_related_fields = ("warehouse", "customer_account")


class OrganizationFundFlowDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = FundFlow.objects.all()
    serializer_class = FundFlowSerializer
    lookup_url_kwarg = "fund_flow_id"
    write_permission_class = CanManageFundFlows
    select_related_fields = ("warehouse", "customer_account")


class OrganizationRentDetailListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = RentDetail.objects.all()
    serializer_class = RentDetailSerializer
    write_permission_class = CanManageRentDetails
    filter_fields = ("status", "warehouse_id", "customer_account_id")
    select_related_fields = ("warehouse", "customer_account")


class OrganizationRentDetailDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = RentDetail.objects.all()
    serializer_class = RentDetailSerializer
    lookup_url_kwarg = "rent_detail_id"
    write_permission_class = CanManageRentDetails
    select_related_fields = ("warehouse", "customer_account")


class OrganizationBusinessExpenseListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = BusinessExpense.objects.all()
    serializer_class = BusinessExpenseSerializer
    write_permission_class = CanManageBusinessExpenses
    filter_fields = ("status", "expense_category", "warehouse_id")
    select_related_fields = ("warehouse",)


class OrganizationBusinessExpenseDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = BusinessExpense.objects.all()
    serializer_class = BusinessExpenseSerializer
    lookup_url_kwarg = "business_expense_id"
    write_permission_class = CanManageBusinessExpenses
    select_related_fields = ("warehouse",)


class OrganizationReceivableBillListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = ReceivableBill.objects.all()
    serializer_class = ReceivableBillSerializer
    write_permission_class = CanManageReceivableBills
    filter_fields = ("status", "warehouse_id", "customer_account_id")
    select_related_fields = ("warehouse", "customer_account")


class OrganizationReceivableBillDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = ReceivableBill.objects.all()
    serializer_class = ReceivableBillSerializer
    lookup_url_kwarg = "receivable_bill_id"
    write_permission_class = CanManageReceivableBills
    select_related_fields = ("warehouse", "customer_account")


class OrganizationProfitCalculationListCreateAPIView(OrganizationScopedListCreateAPIView):
    queryset = ProfitCalculation.objects.all()
    serializer_class = ProfitCalculationSerializer
    write_permission_class = CanManageProfitCalculations
    filter_fields = ("status", "warehouse_id", "customer_account_id")
    select_related_fields = ("warehouse", "customer_account")


class OrganizationProfitCalculationDetailAPIView(OrganizationScopedDetailAPIView):
    queryset = ProfitCalculation.objects.all()
    serializer_class = ProfitCalculationSerializer
    lookup_url_kwarg = "profit_calculation_id"
    write_permission_class = CanManageProfitCalculations
    select_related_fields = ("warehouse", "customer_account")

