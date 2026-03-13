"""CSV header helpers for customer upload/download flows."""

from rest_framework_csv.renderers import CSVStreamingRenderer


def file_headers() -> list[str]:
    return [
        "customer_name",
        "customer_city",
        "customer_address",
        "customer_contact",
        "customer_manager",
        "customer_level",
        "creator",
        "create_time",
        "update_time",
    ]


def cn_data_header() -> dict[str, str]:
    return {
        "customer_name": "客户名称",
        "customer_city": "客户城市",
        "customer_address": "详细地址",
        "customer_contact": "联系电话",
        "customer_manager": "负责人",
        "customer_level": "客户等级",
        "creator": "创建人",
        "create_time": "创建时间",
        "update_time": "更新时间",
    }


def en_data_header() -> dict[str, str]:
    return {
        "customer_name": "Customer Name",
        "customer_city": "Customer City",
        "customer_address": "Customer Address",
        "customer_contact": "Customer Contact",
        "customer_manager": "Customer Manager",
        "customer_level": "Customer Level",
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
