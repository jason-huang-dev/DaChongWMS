"""CSV header helpers for supplier upload/download flows."""

from rest_framework_csv.renderers import CSVStreamingRenderer


def file_headers() -> list[str]:
    return [
        "supplier_name",
        "supplier_city",
        "supplier_address",
        "supplier_contact",
        "supplier_manager",
        "supplier_level",
        "creator",
        "create_time",
        "update_time",
    ]


def cn_data_header() -> dict[str, str]:
    return {
        "supplier_name": "供应商名称",
        "supplier_city": "供应商城市",
        "supplier_address": "详细地址",
        "supplier_contact": "联系电话",
        "supplier_manager": "负责人",
        "supplier_level": "供应商等级",
        "creator": "创建人",
        "create_time": "创建时间",
        "update_time": "更新时间",
    }


def en_data_header() -> dict[str, str]:
    return {
        "supplier_name": "Supplier Name",
        "supplier_city": "Supplier City",
        "supplier_address": "Supplier Address",
        "supplier_contact": "Supplier Contact",
        "supplier_manager": "Supplier Manager",
        "supplier_level": "Supplier Level",
        "creator": "Creator",
        "create_time": "Create Time",
        "update_time": "Update Time",
    }


class FileRenderCN(CSVStreamingRenderer):
    header = file_headers()
    labels = cn_data_header()


class FileRenderEN(CSVStreamingRenderer):
    header = file_headers()
    labels = en_data_header()
