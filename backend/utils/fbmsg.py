"""Message catalog lifted from the legacy platform.

Strings keep their original Chinese/English wording so that future imports from
GreaterWMS continue to behave identically.
"""

# cSpell:ignore referer baseinfo moreall errfile predelivery dongtai capcha

from typing import Any, Dict, TypedDict


class MessageDict(TypedDict, total=False):
    code: str
    msg: str
    data: Any
    ip: str
    results: Dict[str, Any]


class FBMsg:
    @staticmethod
    def ret() -> MessageDict:
        return {"code": "200", "msg": "Success Create", "data": None}

    @staticmethod
    def err_contact_name() -> MessageDict:
        return {"code": "1001", "msg": "称谓不能为空", "data": None}

    @staticmethod
    def err_contact_mobile() -> MessageDict:
        return {"code": "1002", "msg": "联系电话不能为空", "data": None}

    @staticmethod
    def err_contact_comments() -> MessageDict:
        return {"code": "1003", "msg": "备注不能为空", "data": None}

    @staticmethod
    def err_order_same() -> MessageDict:
        return {"code": "1004", "msg": "订单已存在", "data": None}

    @staticmethod
    def err_order_no() -> MessageDict:
        return {"code": "1005", "msg": "无效订单", "data": None}

    @staticmethod
    def err_order_fail() -> MessageDict:
        return {"code": "1006", "msg": "订单支付失败", "data": None}

    @staticmethod
    def err_ret() -> MessageDict:
        return {"code": "1011", "msg": "User Name Or Password Error", "data": None}

    @staticmethod
    def err_data() -> MessageDict:
        return {"code": "1012", "msg": "数据不可用", "data": None}

    @staticmethod
    def err_tc() -> MessageDict:
        return {"code": "1013", "msg": "transaction_code错误", "data": None}

    @staticmethod
    def err_tc_empty() -> MessageDict:
        return {"code": "1014", "msg": "数据不存在", "data": None}

    @staticmethod
    def err_delete() -> MessageDict:
        return {"code": "1015", "msg": "该条数据已经删除", "data": None}

    @staticmethod
    def err_code1() -> MessageDict:
        return {"code": "1016", "msg": "数据已存在", "data": None}

    @staticmethod
    def err_status() -> MessageDict:
        return {"code": "1017", "msg": "状态已经存在，无需修改", "data": None}

    @staticmethod
    def err_user_name() -> MessageDict:
        return {"code": "1018", "msg": "用户名不可以为空", "data": None}

    @staticmethod
    def err_auth() -> MessageDict:
        return {"code": "1021", "msg": "用户不存在"}

    @staticmethod
    def err_user_same() -> MessageDict:
        return {"code": "1022", "msg": "User Is Exists"}

    @staticmethod
    def error_referer() -> MessageDict:
        return {"code": "1023", "msg": "错误的token"}

    @staticmethod
    def err_password1_empty() -> MessageDict:
        return {"code": "1024", "msg": "Password Can Not Be Empty"}

    @staticmethod
    def err_password2_empty() -> MessageDict:
        return {"code": "1025", "msg": "Please Confirm The Password"}

    @staticmethod
    def err_password_not_same() -> MessageDict:
        return {"code": "1026", "msg": "Password Is Not Same One"}

    @staticmethod
    def err_psw() -> MessageDict:
        return {"code": "1027", "msg": "用户密码错误"}

    @staticmethod
    def err_dev() -> MessageDict:
        return {"code": "1028", "msg": "非开发者openid，无法使用此功能"}

    @staticmethod
    def err_register_more() -> MessageDict:
        return {"code": "1029", "msg": "1个ip只能注册2个账号"}

    @staticmethod
    def err_openid() -> MessageDict:
        return {"code": "1030", "msg": "没有openid"}

    @staticmethod
    def err_more_user() -> MessageDict:
        return {"code": "1041", "msg": "一个账号只能建立5个用户"}

    @staticmethod
    def err_req_day() -> MessageDict:
        return {"code": "1042", "msg": "发货记录至少需要"}

    @staticmethod
    def err_req_shipping_list() -> MessageDict:
        return {"code": "1043", "msg": "请上传发货记录"}

    @staticmethod
    def err_req_stock_list() -> MessageDict:
        return {"code": "1044", "msg": "请上传现有库存"}

    @staticmethod
    def err_req_baseinfo_list() -> MessageDict:
        return {"code": "1045", "msg": "请上传基础信息"}

    @staticmethod
    def err_goods_code() -> MessageDict:
        return {"code": "1051", "msg": "商品编码不存在", "data": None}

    @staticmethod
    def err_po_num_empty() -> MessageDict:
        return {"code": "1060", "msg": "订单号不可以为空", "data": None}

    @staticmethod
    def err_po_num() -> MessageDict:
        return {"code": "1061", "msg": "订单已经存在", "data": None}

    @staticmethod
    def err_po_qty_type() -> MessageDict:
        return {"code": "1062", "msg": "数量必须是数字", "data": None}

    @staticmethod
    def err_po_qty() -> MessageDict:
        return {"code": "1063", "msg": "数量必须大于0", "data": None}

    @staticmethod
    def err_same_po_num() -> MessageDict:
        return {"code": "1063", "msg": "订单编码不一致", "data": None}

    @staticmethod
    def err_lot_num() -> MessageDict:
        return {"code": "1064", "msg": "缺少lot_num，格式为:YYYY-MM-DD", "data": None}

    @staticmethod
    def err_lot_num_empty() -> MessageDict:
        return {"code": "1065", "msg": "lot_num不能为空，格式为:YYYY-MM-DD", "data": None}

    @staticmethod
    def err_lot_num_format() -> MessageDict:
        return {"code": "1066", "msg": "lot_num格式不正确，格式为:YYYY-MM-DD", "data": None}

    @staticmethod
    def err_po_supplier() -> MessageDict:
        return {"code": "1067", "msg": "字段supplier不能为空", "data": None}

    @staticmethod
    def err_po_supplier_empty() -> MessageDict:
        return {"code": "1068", "msg": "供应商不存在", "data": None}

    @staticmethod
    def err_po_goods_code() -> MessageDict:
        return {"code": "1069", "msg": "商品编码不能为空", "data": None}

    @staticmethod
    def err_po_status_empty() -> MessageDict:
        return {"code": "1070", "msg": "订单状态不能为空", "data": None}

    @staticmethod
    def err_po_status_less() -> MessageDict:
        return {"code": "1071", "msg": "订单状态不可逆", "data": None}

    @staticmethod
    def err_po_status_same() -> MessageDict:
        return {"code": "1072", "msg": "订单状态不可以相同", "data": None}

    @staticmethod
    def err_po_status_more() -> MessageDict:
        return {"code": "1073", "msg": "订单状态不可以直接跨级更改", "data": None}

    @staticmethod
    def err_po_status_big() -> MessageDict:
        return {"code": "1074", "msg": "此接口只支持9以内的状态变化", "data": None}

    @staticmethod
    def err_po_status_delete() -> MessageDict:
        return {"code": "1075", "msg": "只有订单状态为1的订单可以删除", "data": None}

    @staticmethod
    def err_po_status_patch() -> MessageDict:
        return {"code": "1076", "msg": "只有订单状态为1的订单可以修改", "data": None}

    @staticmethod
    def err_po_actual_delivery_stock_patch() -> MessageDict:
        return {"code": "1077", "msg": "实际到货数量不可以为空", "data": None}

    @staticmethod
    def err_po_actual_delivery_stock_more() -> MessageDict:
        return {"code": "1078", "msg": "实际到货数量不可以大于订单数量", "data": None}

    @staticmethod
    def err_po_actual_delivery_stock_zero() -> MessageDict:
        return {"code": "1079", "msg": "实际到货数量不可以小于0", "data": None}

    @staticmethod
    def err_po_actual_delivery_stock_moreall() -> MessageDict:
        return {"code": "1080", "msg": "到货数量不可以大于订单数量", "data": None}

    @staticmethod
    def err_po_actual_delivery_stock_again() -> MessageDict:
        return {"code": "1081", "msg": "不要重复修改相同的数量", "data": None}

    @staticmethod
    def err_sort_stock_bin_name() -> MessageDict:
        return {"code": "1082", "msg": "上架库位名称不能为空", "data": None}

    @staticmethod
    def err_sort_stock_bin_name_error() -> MessageDict:
        return {"code": "1083", "msg": "上架库位不存在", "data": None}

    @staticmethod
    def err_sort_stock_qty() -> MessageDict:
        return {"code": "1084", "msg": "需要有上架数量", "data": None}

    @staticmethod
    def err_sort_stock_qty_empty() -> MessageDict:
        return {"code": "1085", "msg": "上架数量不能为空", "data": None}

    @staticmethod
    def err_sort_stock_qty_zero() -> MessageDict:
        return {"code": "1086", "msg": "上架数量必须大于0", "data": None}

    @staticmethod
    def err_sort_stock_qty_more() -> MessageDict:
        return {"code": "1087", "msg": "上架数量不可以超过待上架库存", "data": None}

    @staticmethod
    def err_sort_stock_bin_type() -> MessageDict:
        return {"code": "1088", "msg": "上架库位属性与实际库位属性不符", "data": None}

    @staticmethod
    def wms_ret() -> MessageDict:
        return {"code": "200", "msg": "操作成功", "data": None}

    @staticmethod
    def wms_same() -> MessageDict:
        return {"code": "100001", "msg": "数据已存在", "data": None}

    @staticmethod
    def wms_err() -> MessageDict:
        return {"code": "100002", "msg": "数据不存在", "data": None}

    @staticmethod
    def wms_errfile() -> MessageDict:
        return {"code": "100003", "msg": "下载文件请求参数错误", "data": None}

    @staticmethod
    def wms_time() -> MessageDict:
        return {"results": {"code": "100004", "msg": "起始时间必须大于等于结束日期,默认结束日期为今天", "data": None}}

    @staticmethod
    def wms_vip_get() -> MessageDict:
        return {"results": {"code": "100005", "msg": "您的会员等级不够，请升级会员来提权", "data": None}}

    @staticmethod
    def wms_vip() -> MessageDict:
        return {"code": "100005", "msg": "普通会员每天只能进行3次主动沟通", "data": None}

    @staticmethod
    def wms_dev() -> MessageDict:
        return {"code": "100006", "msg": "不可以对管理员账号进行操作", "data": None}

    @staticmethod
    def wms_user_owner() -> MessageDict:
        return {"code": "100007", "msg": "不可以删除自己", "data": None}

    @staticmethod
    def wms_warehouse_more() -> MessageDict:
        return {"code": "100008", "msg": "只能创建一个仓库", "data": None}

    @staticmethod
    def wms_company_more() -> MessageDict:
        return {"code": "100008", "msg": "只能创建一个公司信息", "data": None}

    @staticmethod
    def wms_binproperty() -> MessageDict:
        return {"code": "100009", "msg": "库位属性不存在", "data": None}

    @staticmethod
    def wms_binsize() -> MessageDict:
        return {"code": "100010", "msg": "库位尺寸不存在", "data": None}

    @staticmethod
    def wms_no_user() -> MessageDict:
        return {"results": {"code": "100011", "msg": "用户名不存在", "data": None}}

    @staticmethod
    def wms_po_status_1() -> MessageDict:
        return {"code": "100012", "msg": "只有入库单状态为1的订单才可以删除", "data": None}

    @staticmethod
    def wms_po_empty() -> MessageDict:
        return {"code": "100013", "msg": "入库单号码不存在", "data": None}

    @staticmethod
    def wms_po_status_predelivery() -> MessageDict:
        return {"code": "100014", "msg": "入库单已经到货", "data": None}

    @staticmethod
    def wms_po_status_predelivery_detail() -> MessageDict:
        return {"code": "100015", "msg": "入库单没有任何订单明细", "data": None}

    @staticmethod
    def wms_po_status_preload_detail() -> MessageDict:
        return {"code": "100016", "msg": "入库单没有任何订单明细", "data": None}

    @staticmethod
    def wms_po_qty_up_more() -> MessageDict:
        return {"code": "100017", "msg": "实际到货上架数量不可大于实际到货数量", "data": None}

    @staticmethod
    def wms_po_qty_dup_more() -> MessageDict:
        return {"code": "100018", "msg": "破损上架数量不可大于到货破损数量", "data": None}

    @staticmethod
    def wms_po_qty_all_up_more() -> MessageDict:
        return {"code": "100019", "msg": "上架数量不可大于待上架数量", "data": None}

    @staticmethod
    def wms_so_picked_more() -> MessageDict:
        return {"code": "100020", "msg": "实际拣货数量不可以大于需要拣货数量", "data": None}

    @staticmethod
    def wms_dongtai() -> MessageDict:
        return {"code": "200", "msg": "动态发布成功", "data": None}

    @staticmethod
    def wms_capcha() -> MessageDict:
        return {"code": "100080", "msg": "刷新过快，请稍后再刷新验证码", "data": None}

    @staticmethod
    def wms_capcha_l() -> MessageDict:
        return {"code": "100081", "msg": "验证码超时", "data": None}

    @staticmethod
    def wms_capcha_n() -> MessageDict:
        return {"code": "100082", "msg": "验证码不存在", "data": None}
