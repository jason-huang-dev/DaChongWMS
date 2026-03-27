from __future__ import annotations

from datetime import date, datetime
from typing import Any

from apps.organizations.models import OrganizationMembership
from apps.user_settings.models import UserSetting

WORKBENCH_SETTINGS_CATEGORY = "workbench"
DEFAULT_WORKBENCH_TIME_WINDOW = "WEEK"
SUPPORTED_WORKBENCH_TIME_WINDOWS = ("WEEK", "MONTH", "YEAR", "CUSTOM")
DEFAULT_VISIBLE_WIDGET_KEYS = ("ops-summary", "order-trends")
DEFAULT_RIGHT_RAIL_WIDGET_KEYS: tuple[str, ...] = ()


def _normalize_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized: list[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        candidate = item.strip()
        if candidate and candidate not in normalized:
            normalized.append(candidate)
    return normalized


def _normalize_iso_temporal(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    candidate = value.strip()
    if not candidate:
        return None

    if "T" not in candidate and " " not in candidate:
        try:
            return date.fromisoformat(candidate).isoformat()
        except ValueError:
            return None

    normalized_candidate = candidate.replace(" ", "T").replace("Z", "+00:00")
    try:
        parsed_datetime = datetime.fromisoformat(normalized_candidate)
    except ValueError:
        return None

    normalized_datetime = parsed_datetime.replace(minute=0, second=0, microsecond=0, tzinfo=None)
    return normalized_datetime.isoformat(timespec="minutes")


def _normalize_workbench_time_window(value: Any) -> str:
    if not isinstance(value, str):
        return DEFAULT_WORKBENCH_TIME_WINDOW

    candidate = value.strip().upper()
    if candidate not in SUPPORTED_WORKBENCH_TIME_WINDOWS:
        return DEFAULT_WORKBENCH_TIME_WINDOW
    return candidate


def _compact_workbench_payload(payload: dict[str, Any]) -> dict[str, Any]:
    compact: dict[str, Any] = {}
    if payload["time_window"] != DEFAULT_WORKBENCH_TIME_WINDOW:
        compact["time_window"] = payload["time_window"]
    if payload["custom_date_from"]:
        compact["custom_date_from"] = payload["custom_date_from"]
    if payload["custom_date_to"]:
        compact["custom_date_to"] = payload["custom_date_to"]
    if payload["hidden_widget_keys"]:
        compact["hidden_widget_keys"] = payload["hidden_widget_keys"]
    if payload["hidden_right_rail_widget_keys"]:
        compact["hidden_right_rail_widget_keys"] = payload["hidden_right_rail_widget_keys"]
    if payload["hidden_queue_section_keys"]:
        compact["hidden_queue_section_keys"] = payload["hidden_queue_section_keys"]
    if payload["hidden_queue_metric_keys"]:
        compact["hidden_queue_metric_keys"] = payload["hidden_queue_metric_keys"]
    return compact


def _resolve_workbench_payload(raw_payload: dict[str, Any] | None) -> dict[str, Any]:
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    hidden_widget_keys = [
        key for key in _normalize_string_list(payload.get("hidden_widget_keys")) if key in DEFAULT_VISIBLE_WIDGET_KEYS
    ]
    hidden_right_rail_widget_keys = [
        key
        for key in _normalize_string_list(payload.get("hidden_right_rail_widget_keys"))
        if key in DEFAULT_RIGHT_RAIL_WIDGET_KEYS
    ]
    hidden_queue_section_keys = _normalize_string_list(payload.get("hidden_queue_section_keys"))
    hidden_queue_metric_keys = _normalize_string_list(payload.get("hidden_queue_metric_keys"))
    time_window = _normalize_workbench_time_window(payload.get("time_window"))
    custom_date_from = _normalize_iso_temporal(payload.get("custom_date_from"))
    custom_date_to = _normalize_iso_temporal(payload.get("custom_date_to"))

    return {
        "time_window": time_window,
        "custom_date_from": custom_date_from,
        "custom_date_to": custom_date_to,
        "hidden_widget_keys": hidden_widget_keys,
        "hidden_right_rail_widget_keys": hidden_right_rail_widget_keys,
        "hidden_queue_section_keys": hidden_queue_section_keys,
        "hidden_queue_metric_keys": hidden_queue_metric_keys,
        "visible_widget_keys": [key for key in DEFAULT_VISIBLE_WIDGET_KEYS if key not in hidden_widget_keys],
        "right_rail_widget_keys": [
            key for key in DEFAULT_RIGHT_RAIL_WIDGET_KEYS if key not in hidden_right_rail_widget_keys
        ],
    }


def _hidden_keys_from_visible(value: Any, defaults: tuple[str, ...]) -> list[str]:
    visible_keys = [key for key in _normalize_string_list(value) if key in defaults]
    return [key for key in defaults if key not in visible_keys]


def _build_workbench_response(
    *,
    membership: OrganizationMembership,
    page_key: str,
    setting: UserSetting | None,
) -> dict[str, Any]:
    resolved_payload = _resolve_workbench_payload(setting.payload if setting is not None else {})

    return {
        "id": setting.id if setting is not None else 0,
        "membership_id": membership.id,
        "page_key": page_key,
        "time_window": resolved_payload["time_window"],
        "custom_date_from": resolved_payload["custom_date_from"],
        "custom_date_to": resolved_payload["custom_date_to"],
        "visible_widget_keys": resolved_payload["visible_widget_keys"],
        "right_rail_widget_keys": resolved_payload["right_rail_widget_keys"],
        "layout_payload": {
            "hidden_widget_keys": resolved_payload["hidden_widget_keys"],
            "hidden_right_rail_widget_keys": resolved_payload["hidden_right_rail_widget_keys"],
            "hidden_queue_section_keys": resolved_payload["hidden_queue_section_keys"],
            "hidden_queue_metric_keys": resolved_payload["hidden_queue_metric_keys"],
        },
        "create_time": setting.create_time if setting is not None else None,
        "update_time": setting.update_time if setting is not None else None,
    }


def get_workbench_setting(*, membership: OrganizationMembership, page_key: str) -> dict[str, Any]:
    setting = UserSetting.objects.filter(
        user=membership.user,
        membership=membership,
        category=WORKBENCH_SETTINGS_CATEGORY,
        setting_key=page_key,
    ).first()
    return _build_workbench_response(membership=membership, page_key=page_key, setting=setting)


def update_workbench_setting(
    *,
    membership: OrganizationMembership,
    page_key: str,
    overrides: dict[str, Any],
) -> dict[str, Any]:
    setting = UserSetting.objects.filter(
        user=membership.user,
        membership=membership,
        category=WORKBENCH_SETTINGS_CATEGORY,
        setting_key=page_key,
    ).first()
    current_payload = _resolve_workbench_payload(setting.payload if setting is not None else {})
    next_payload = {
        "time_window": current_payload["time_window"],
        "custom_date_from": current_payload["custom_date_from"],
        "custom_date_to": current_payload["custom_date_to"],
        "hidden_widget_keys": current_payload["hidden_widget_keys"],
        "hidden_right_rail_widget_keys": current_payload["hidden_right_rail_widget_keys"],
        "hidden_queue_section_keys": current_payload["hidden_queue_section_keys"],
        "hidden_queue_metric_keys": current_payload["hidden_queue_metric_keys"],
    }

    if "time_window" in overrides:
        next_payload["time_window"] = _normalize_workbench_time_window(overrides.get("time_window"))

    if "custom_date_from" in overrides:
        next_payload["custom_date_from"] = _normalize_iso_temporal(overrides.get("custom_date_from"))

    if "custom_date_to" in overrides:
        next_payload["custom_date_to"] = _normalize_iso_temporal(overrides.get("custom_date_to"))

    if "visible_widget_keys" in overrides:
        next_payload["hidden_widget_keys"] = _hidden_keys_from_visible(
            overrides.get("visible_widget_keys"),
            DEFAULT_VISIBLE_WIDGET_KEYS,
        )

    if "right_rail_widget_keys" in overrides:
        next_payload["hidden_right_rail_widget_keys"] = _hidden_keys_from_visible(
            overrides.get("right_rail_widget_keys"),
            DEFAULT_RIGHT_RAIL_WIDGET_KEYS,
        )

    layout_payload = overrides.get("layout_payload")
    if isinstance(layout_payload, dict):
        if "hidden_widget_keys" in layout_payload:
            next_payload["hidden_widget_keys"] = [
                key
                for key in _normalize_string_list(layout_payload.get("hidden_widget_keys"))
                if key in DEFAULT_VISIBLE_WIDGET_KEYS
            ]
        if "hidden_right_rail_widget_keys" in layout_payload:
            next_payload["hidden_right_rail_widget_keys"] = [
                key
                for key in _normalize_string_list(layout_payload.get("hidden_right_rail_widget_keys"))
                if key in DEFAULT_RIGHT_RAIL_WIDGET_KEYS
            ]
        if "hidden_queue_section_keys" in layout_payload:
            next_payload["hidden_queue_section_keys"] = _normalize_string_list(
                layout_payload.get("hidden_queue_section_keys")
            )
        if "hidden_queue_metric_keys" in layout_payload:
            next_payload["hidden_queue_metric_keys"] = _normalize_string_list(
                layout_payload.get("hidden_queue_metric_keys")
            )

    compact_payload = _compact_workbench_payload(next_payload)

    if compact_payload:
        setting, _created = UserSetting.objects.update_or_create(
            user=membership.user,
            membership=membership,
            category=WORKBENCH_SETTINGS_CATEGORY,
            setting_key=page_key,
            defaults={"payload": compact_payload},
        )
    else:
        if setting is not None:
            setting.delete()
        setting = None

    return _build_workbench_response(membership=membership, page_key=page_key, setting=setting)
