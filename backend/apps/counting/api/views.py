from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.counting.models import CountApproval, CycleCount, CycleCountLine
from apps.counting.permissions import CanManageCountApprovals, CanManageCounting, CanViewCounting
from apps.counting.serializers import (
    CountApprovalDecisionSerializer,
    CountApprovalSerializer,
    CycleCountLineAssignSerializer,
    CycleCountLineScanCountSerializer,
    CycleCountLineScannerCompleteSerializer,
    CycleCountLineScannerLookupSerializer,
    CycleCountLineSerializer,
    CycleCountSerializer,
)
from apps.counting.services.counting_service import (
    CountApprovalDecisionInput,
    CreateCycleCountInput,
    CreateCycleCountLineInput,
    CycleCountAssignmentInput,
    CycleCountLineUpdateInput,
    ScannerLookupInput,
    approve_count_approval,
    assign_cycle_count_line,
    complete_scanner_task,
    create_cycle_count,
    find_cycle_count_line_by_scan,
    get_next_assigned_cycle_count_line,
    list_count_approvals,
    list_cycle_count_lines,
    list_cycle_counts,
    reject_count_approval,
    submit_cycle_count,
    transition_scanner_task,
    update_cycle_count_line,
)
from apps.iam.permissions import get_active_membership
from apps.inventory.models import InventoryAdjustmentReason, InventoryBalance
from apps.organizations.models import Organization, OrganizationMembership
from apps.warehouse.models import Warehouse


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


def _should_hide_system_qty(line: CycleCountLine) -> bool:
    return bool(line.cycle_count.is_blind_count and line.status != "RECONCILED")


def _serialized_line(line: CycleCountLine, *, hide_system_qty: bool = False) -> dict[str, object]:
    payload = dict(CycleCountLineSerializer(line).data)
    if hide_system_qty:
        payload["system_qty"] = None
    return payload


class OrganizationCountingBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def get_membership(self, *, required: bool = False) -> OrganizationMembership | None:
        membership = get_active_membership(self.request.user, self.organization)
        if membership is None and required:
            membership = get_object_or_404(
                OrganizationMembership,
                organization=self.organization,
                is_active=True,
                user=self.request.user,
            )
        return membership

    def get_warehouse(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(Warehouse, pk=warehouse_id, organization=self.organization)

    def get_inventory_balance(self, inventory_balance_id: int) -> InventoryBalance:
        return get_object_or_404(
            InventoryBalance,
            pk=inventory_balance_id,
            organization=self.organization,
        )

    def get_adjustment_reason(self, adjustment_reason_id: int | None) -> InventoryAdjustmentReason | None:
        if adjustment_reason_id is None:
            return None
        return get_object_or_404(
            InventoryAdjustmentReason,
            pk=adjustment_reason_id,
            organization=self.organization,
        )

    def get_assignment_membership(self, membership_id: int | None) -> OrganizationMembership | None:
        if membership_id is None:
            return None
        return get_object_or_404(
            OrganizationMembership,
            pk=membership_id,
            organization=self.organization,
        )


class CycleCountListCreateAPIView(OrganizationCountingBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewCounting()]
        return [CanManageCounting()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        counts = list_cycle_counts(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
        )
        return Response(CycleCountSerializer(counts, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = CycleCountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line_items = tuple(
            CreateCycleCountLineInput(
                line_number=item.get("line_number"),
                inventory_balance=self.get_inventory_balance(item["inventory_balance_id"]),
                assigned_membership=self.get_assignment_membership(item.get("assigned_membership_id")),
            )
            for item in serializer.validated_data.get("line_items", [])
        )
        cycle_count = create_cycle_count(
            CreateCycleCountInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                count_number=serializer.validated_data["count_number"],
                scheduled_date=serializer.validated_data.get("scheduled_date"),
                is_blind_count=serializer.validated_data.get("is_blind_count", False),
                notes=serializer.validated_data.get("notes", ""),
                line_items=line_items,
            )
        )
        return Response(CycleCountSerializer(cycle_count).data, status=status.HTTP_201_CREATED)


class CycleCountDetailAPIView(OrganizationCountingBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewCounting()]
        return [CanManageCounting()]

    def get_object(self, cycle_count_id: int) -> CycleCount:
        return get_object_or_404(CycleCount, pk=cycle_count_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        cycle_count = self.get_object(kwargs["cycle_count_id"])
        return Response(CycleCountSerializer(cycle_count).data)


class CycleCountSubmitAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        cycle_count = get_object_or_404(CycleCount, pk=kwargs["cycle_count_id"], organization=self.organization)
        updated = submit_cycle_count(
            cycle_count=cycle_count,
            operator_name=_actor_name_from_request(request),
        )
        return Response(CycleCountSerializer(updated).data)


class CycleCountLineListAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanViewCounting]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        cycle_count_id = request.query_params.get("cycle_count_id")
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        assigned_membership_id = request.query_params.get("assigned_membership_id")
        lines = list_cycle_count_lines(
            organization=self.organization,
            cycle_count_id=int(cycle_count_id) if cycle_count_id else None,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
            assigned_membership_id=int(assigned_membership_id) if assigned_membership_id else None,
        )
        return Response(CycleCountLineSerializer(lines, many=True).data)


class CycleCountLineMyAssignmentsAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        lines = list_cycle_count_lines(
            organization=self.organization,
            assigned_membership_id=membership.id,
        )
        payload = [
            _serialized_line(line, hide_system_qty=_should_hide_system_qty(line))
            for line in lines
            if (
                (line.assigned_membership_id == membership.id and line.status in {"OPEN", "COUNTED"})
                or (line.recount_assigned_membership_id == membership.id and line.status == "RECOUNT_ASSIGNED")
            )
        ]
        return Response(payload)


class CycleCountLineNextTaskAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        line, task_type = get_next_assigned_cycle_count_line(membership=membership)
        if line is None or task_type is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        payload = _serialized_line(line, hide_system_qty=_should_hide_system_qty(line))
        payload["task_type"] = task_type
        return Response(payload)


class CycleCountLineScanLookupAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        serializer = CycleCountLineScannerLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line = find_cycle_count_line_by_scan(
            membership=membership,
            payload=ScannerLookupInput(**serializer.validated_data),
        )
        return Response(_serialized_line(line, hide_system_qty=_should_hide_system_qty(line)))


class CycleCountLineScanCountAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        serializer = CycleCountLineScanCountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line = find_cycle_count_line_by_scan(
            membership=membership,
            payload=ScannerLookupInput(
                location=serializer.validated_data["location"],
                sku=serializer.validated_data["sku"],
                count_number=serializer.validated_data.get("count_number", ""),
                recount=serializer.validated_data.get("recount", False),
            ),
        )
        updated = update_cycle_count_line(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            cycle_count_line=line,
            payload=CycleCountLineUpdateInput(
                counted_qty=serializer.validated_data["counted_qty"],
                adjustment_reason=self.get_adjustment_reason(serializer.validated_data.get("adjustment_reason_id")),
                notes=serializer.validated_data.get("notes", ""),
            ),
            recount=serializer.validated_data.get("recount", False),
        )
        return Response(_serialized_line(updated, hide_system_qty=_should_hide_system_qty(updated)))


class CycleCountLineDetailAPIView(OrganizationCountingBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewCounting()]
        return [CanManageCounting()]

    def get_object(self, cycle_count_line_id: int) -> CycleCountLine:
        return get_object_or_404(CycleCountLine, pk=cycle_count_line_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        line = self.get_object(kwargs["cycle_count_line_id"])
        return Response(CycleCountLineSerializer(line).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        line = self.get_object(kwargs["cycle_count_line_id"])
        serializer = CycleCountLineSerializer(line, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_cycle_count_line(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            cycle_count_line=line,
            payload=CycleCountLineUpdateInput(
                counted_qty=serializer.validated_data.get("counted_qty", line.counted_qty),
                adjustment_reason=self.get_adjustment_reason(serializer.validated_data.get("adjustment_reason_id"))
                if "adjustment_reason_id" in serializer.validated_data
                else line.adjustment_reason,
                notes=serializer.validated_data.get("notes", line.notes),
            ),
        )
        return Response(CycleCountLineSerializer(updated).data)


class CycleCountLineAssignAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        line = get_object_or_404(CycleCountLine, pk=kwargs["cycle_count_line_id"], organization=self.organization)
        serializer = CycleCountLineAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = assign_cycle_count_line(
            cycle_count_line=line,
            payload=CycleCountAssignmentInput(
                assigned_membership=self.get_assignment_membership(serializer.validated_data.get("assigned_membership_id"))
            ),
        )
        return Response(CycleCountLineSerializer(updated).data)


class CycleCountLineAssignRecountAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        line = get_object_or_404(CycleCountLine, pk=kwargs["cycle_count_line_id"], organization=self.organization)
        serializer = CycleCountLineAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = assign_cycle_count_line(
            cycle_count_line=line,
            payload=CycleCountAssignmentInput(
                assigned_membership=self.get_assignment_membership(serializer.validated_data.get("assigned_membership_id"))
            ),
            recount=True,
        )
        return Response(CycleCountLineSerializer(updated).data)


class CycleCountLineRecountAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        line = get_object_or_404(CycleCountLine, pk=kwargs["cycle_count_line_id"], organization=self.organization)
        serializer = CycleCountLineScannerCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = update_cycle_count_line(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            cycle_count_line=line,
            payload=CycleCountLineUpdateInput(
                counted_qty=serializer.validated_data["counted_qty"],
                adjustment_reason=self.get_adjustment_reason(serializer.validated_data.get("adjustment_reason_id")),
                notes=serializer.validated_data.get("notes", line.notes),
            ),
            recount=True,
        )
        return Response(CycleCountLineSerializer(updated).data)


class CycleCountLineScannerAckAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        line = get_object_or_404(CycleCountLine, pk=kwargs["cycle_count_line_id"], organization=self.organization)
        updated = transition_scanner_task(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            cycle_count_line=line,
            action="ack",
        )
        return Response(_serialized_line(updated, hide_system_qty=_should_hide_system_qty(updated)))


class CycleCountLineScannerStartAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        line = get_object_or_404(CycleCountLine, pk=kwargs["cycle_count_line_id"], organization=self.organization)
        updated = transition_scanner_task(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            cycle_count_line=line,
            action="start",
        )
        return Response(_serialized_line(updated, hide_system_qty=_should_hide_system_qty(updated)))


class CycleCountLineScannerCompleteAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCounting]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        line = get_object_or_404(CycleCountLine, pk=kwargs["cycle_count_line_id"], organization=self.organization)
        serializer = CycleCountLineScannerCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = complete_scanner_task(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            cycle_count_line=line,
            payload=CycleCountLineUpdateInput(
                counted_qty=serializer.validated_data["counted_qty"],
                adjustment_reason=self.get_adjustment_reason(serializer.validated_data.get("adjustment_reason_id")),
                notes=serializer.validated_data.get("notes", line.notes),
            ),
        )
        return Response(_serialized_line(updated, hide_system_qty=_should_hide_system_qty(updated)))


class CountApprovalListAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanViewCounting]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        approvals = list_count_approvals(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
        )
        return Response(CountApprovalSerializer(approvals, many=True).data)


class CountApprovalApproveAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCountApprovals]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        approval = get_object_or_404(CountApproval, pk=kwargs["approval_id"], organization=self.organization)
        serializer = CountApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = approve_count_approval(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            approval=approval,
            payload=CountApprovalDecisionInput(
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        return Response(CountApprovalSerializer(updated).data)


class CountApprovalRejectAPIView(OrganizationCountingBaseAPIView):
    permission_classes = [CanManageCountApprovals]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership(required=True)
        assert membership is not None
        approval = get_object_or_404(CountApproval, pk=kwargs["approval_id"], organization=self.organization)
        serializer = CountApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = reject_count_approval(
            membership=membership,
            operator_name=_actor_name_from_request(request),
            approval=approval,
            payload=CountApprovalDecisionInput(
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        return Response(CountApprovalSerializer(updated).data)
