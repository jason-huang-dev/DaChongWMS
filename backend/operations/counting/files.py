"""CSV renderer helpers for counting supervisor exports."""

from rest_framework_csv.renderers import CSVStreamingRenderer


def file_headers() -> list[str]:
    return [
        "record_type",
        "approval_id",
        "count_number",
        "warehouse_name",
        "location_code",
        "goods_code",
        "variance_qty",
        "required_role",
        "line_status",
        "assigned_to",
        "requested_at",
        "age_hours",
        "sla_breach",
    ]


def cn_data_header() -> dict[str, str]:
    return {
        "record_type": "记录类型",
        "approval_id": "审批ID",
        "count_number": "盘点单号",
        "warehouse_name": "仓库",
        "location_code": "库位",
        "goods_code": "商品编码",
        "variance_qty": "差异数量",
        "required_role": "审批角色",
        "line_status": "行状态",
        "assigned_to": "指派人员",
        "requested_at": "请求时间",
        "age_hours": "老化小时",
        "sla_breach": "超时",
    }


def en_data_header() -> dict[str, str]:
    return {
        "record_type": "Record Type",
        "approval_id": "Approval ID",
        "count_number": "Count Number",
        "warehouse_name": "Warehouse",
        "location_code": "Location",
        "goods_code": "Goods Code",
        "variance_qty": "Variance Qty",
        "required_role": "Required Role",
        "line_status": "Line Status",
        "assigned_to": "Assigned To",
        "requested_at": "Requested At",
        "age_hours": "Age Hours",
        "sla_breach": "SLA Breach",
    }


class DashboardFileRenderCN(CSVStreamingRenderer):
    header = file_headers()
    labels = cn_data_header()


class DashboardFileRenderEN(CSVStreamingRenderer):
    header = file_headers()
    labels = en_data_header()
