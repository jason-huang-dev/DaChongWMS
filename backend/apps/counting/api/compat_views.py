from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.api_compat import get_compat_membership, get_optional_int
from apps.counting.services.counting_service import build_approval_summary


class CompatibilityCountApprovalSummaryAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return Response(
                {
                    "pending_count": 0,
                    "rejected_count": 0,
                    "pending_by_warehouse": [],
                    "rejected_by_warehouse": [],
                }
            )

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        return Response(
            build_approval_summary(
                organization=membership.organization,
                warehouse_id=warehouse_id,
            )
        )
