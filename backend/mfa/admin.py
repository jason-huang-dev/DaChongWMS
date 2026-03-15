from django.contrib import admin

from .models import MFAChallenge, MFAEnrollment, MFARecoveryCode


@admin.register(MFAEnrollment)
class MFAEnrollmentAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "openid", "method", "label", "is_verified", "is_primary", "verified_at")
    list_filter = ("method", "is_verified", "is_primary", "is_delete")
    search_fields = ("user__username", "openid", "label", "creator")
    readonly_fields = ("create_time", "update_time", "verified_at", "last_used_at")


@admin.register(MFARecoveryCode)
class MFARecoveryCodeAdmin(admin.ModelAdmin):
    list_display = ("id", "enrollment", "openid", "code_hint", "used_at", "is_delete")
    list_filter = ("used_at", "is_delete")
    search_fields = ("openid", "code_hint", "creator")
    readonly_fields = ("create_time", "update_time", "used_at")


@admin.register(MFAChallenge)
class MFAChallengeAdmin(admin.ModelAdmin):
    list_display = ("id", "challenge_id", "username", "status", "verified_method", "expires_at", "verified_at")
    list_filter = ("status", "verified_method", "is_delete")
    search_fields = ("username", "openid", "operator_name", "creator")
    readonly_fields = ("create_time", "update_time", "verified_at", "consumed_at")
