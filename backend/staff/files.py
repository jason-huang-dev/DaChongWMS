"""CSV renderer helpers for exporting staff data."""

from rest_framework_csv.renderers import CSVStreamingRenderer


def file_headers() -> list[str]:
    return ["staff_name", "staff_type", "create_time", "update_time"]


def cn_data_header() -> dict[str, str]:
    return {
        "staff_name": "员工用户名",
        "staff_type": "员工类型",
        "create_time": "创建时间",
        "update_time": "更新时间",
    }


def en_data_header() -> dict[str, str]:
    return {
        "staff_name": "Staff Name",
        "staff_type": "Staff Type",
        "create_time": "Create Time",
        "update_time": "Update Time",
    }


class FileRenderCN(CSVStreamingRenderer):
    header = file_headers()
    labels = cn_data_header()


class FileRenderEN(CSVStreamingRenderer):
    header = file_headers()
    labels = en_data_header()
