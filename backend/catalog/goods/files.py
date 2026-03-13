"""CSV header helpers for goods upload/download flows."""

from rest_framework_csv.renderers import CSVStreamingRenderer


def file_headers() -> list[str]:
    return [
        "goods_code",
        "goods_desc",
        "goods_supplier",
        "goods_weight",
        "goods_w",
        "goods_d",
        "goods_h",
        "unit_volume",
        "goods_unit",
        "goods_class",
        "goods_brand",
        "goods_color",
        "goods_shape",
        "goods_specs",
        "goods_origin",
        "goods_cost",
        "goods_price",
        "creator",
        "create_time",
        "update_time",
    ]


def cn_data_header() -> dict[str, str]:
    return {
        "goods_code": "商品编码",
        "goods_desc": "商品描述",
        "goods_supplier": "商品供应商",
        "goods_weight": "商品单位重量",
        "goods_w": "商品单位长度",
        "goods_d": "商品单位宽度",
        "goods_h": "商品单位高度",
        "unit_volume": "最小单位体积",
        "goods_unit": "商品单位",
        "goods_class": "商品类别",
        "goods_brand": "商品品牌",
        "goods_color": "商品颜色",
        "goods_shape": "商品形状",
        "goods_specs": "商品规格",
        "goods_origin": "商品产地",
        "goods_cost": "商品成本",
        "goods_price": "商品价格",
        "creator": "创建人",
        "create_time": "创建时间",
        "update_time": "更新时间",
    }


def en_data_header() -> dict[str, str]:
    return {
        "goods_code": "Goods Code",
        "goods_desc": "Goods Description",
        "goods_supplier": "Goods Supplier",
        "goods_weight": "Goods Weight",
        "goods_w": "Goods Wide",
        "goods_d": "Goods Depth",
        "goods_h": "Goods Height",
        "unit_volume": "Unit Volume",
        "goods_unit": "Goods Unit",
        "goods_class": "Goods Class",
        "goods_brand": "Goods Brand",
        "goods_color": "Goods Color",
        "goods_shape": "Goods Shape",
        "goods_specs": "Goods Specs",
        "goods_origin": "Goods Origin",
        "goods_cost": "Goods Cost",
        "goods_price": "Goods Price",
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
