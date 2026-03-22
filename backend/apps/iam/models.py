from django.contrib.auth.models import Permission
from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import MembershipType, Organization, OrganizationMembership


class AccessScope(models.Model):
    class ScopeType(models.TextChoices):
        ORGANIZATION = "ORGANIZATION", "Organization"
        WAREHOUSE = "WAREHOUSE", "Warehouse"
        RESOURCE = "RESOURCE", "Resource"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="access_scopes",
    )
    scope_type = models.CharField(max_length=20, choices=ScopeType.choices)
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.CASCADE,
        related_name="access_scopes",
        null=True,
        blank=True,
    )
    resource_type = models.CharField(max_length=100, blank=True)
    resource_key = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "scope_type", "warehouse", "resource_type", "resource_key"),
                name="unique_access_scope_target",
            ),
        ]

    def clean(self):
        errors = {}

        if bool(self.resource_type) != bool(self.resource_key):
            message = "resource_type and resource_key must be provided together."
            errors["resource_type"] = message
            errors["resource_key"] = message

        if self.scope_type == self.ScopeType.ORGANIZATION:
            if self.warehouse_id or self.resource_type or self.resource_key:
                errors["scope_type"] = "Organization scope cannot target a warehouse or resource."

        if self.scope_type == self.ScopeType.WAREHOUSE:
            if not self.warehouse_id:
                errors["warehouse"] = "Warehouse scope requires a warehouse."
            if self.resource_type or self.resource_key:
                errors["scope_type"] = "Warehouse scope cannot target a resource."

        if self.scope_type == self.ScopeType.RESOURCE and not self.resource_type:
            errors["resource_type"] = "Resource scope requires a resource_type and resource_key."

        if self.warehouse_id and self.organization_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the scope."

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        if self.scope_type == self.ScopeType.WAREHOUSE and self.warehouse_id:
            return f"{self.organization} / warehouse:{self.warehouse.code}"
        if self.scope_type == self.ScopeType.RESOURCE:
            return f"{self.organization} / {self.resource_type}:{self.resource_key}"
        return str(self.organization)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Role(models.Model):
    class SystemCode(models.TextChoices):
        OWNER = "OWNER", "Owner"
        MANAGER = "MANAGER", "Manager"
        STAFF = "STAFF", "Staff"
        CLIENT_ADMIN = "CLIENT_ADMIN", "Client Admin"
        CLIENT_USER = "CLIENT_USER", "Client User"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="roles",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    membership_type = models.CharField(
        max_length=20,
        choices=MembershipType.choices,
        default=MembershipType.INTERNAL,
    )
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        permissions = [
            ("manage_memberships", "Can manage organization memberships"),
            ("manage_client_users", "Can manage client users"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_role_code_per_organization",
            ),
        ]

    def clean(self):
        if self.is_system and self.organization_id is not None:
            raise ValidationError({"organization": "System roles must be global."})
        if not self.is_system and self.organization_id is None:
            raise ValidationError({"organization": "Custom roles must belong to an organization."})

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("role", "permission"),
                name="unique_permission_per_role",
            ),
        ]


class RoleAssignment(models.Model):
    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="member_assignments")
    scope = models.ForeignKey(
        AccessScope,
        on_delete=models.CASCADE,
        related_name="role_assignments",
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("membership", "role", "scope"),
                name="unique_role_assignment_per_scope",
            ),
        ]

    def clean(self):
        errors = {}
        if self.role.organization_id and self.role.organization_id != self.membership.organization_id:
            errors["role"] = "Role must belong to the same organization as the membership."
        if self.role.membership_type != self.membership.membership_type:
            errors["role"] = "Role membership_type must match the membership."
        if self.scope_id and self.scope.organization_id != self.membership.organization_id:
            errors["scope"] = "Scope must belong to the same organization as the membership."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class AccessGroup(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="access_groups",
    )
    code = models.SlugField(max_length=100)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    membership_type = models.CharField(
        max_length=20,
        choices=MembershipType.choices,
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_group_code_per_organization",
            ),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class AccessGroupPermission(models.Model):
    group = models.ForeignKey(
        AccessGroup,
        on_delete=models.CASCADE,
        related_name="group_permissions",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="group_permissions",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("group", "permission"),
                name="unique_permission_per_group",
            ),
        ]


class GroupAssignment(models.Model):
    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="group_assignments",
    )
    group = models.ForeignKey(
        AccessGroup,
        on_delete=models.CASCADE,
        related_name="group_memberships",
    )
    scope = models.ForeignKey(
        AccessScope,
        on_delete=models.CASCADE,
        related_name="group_assignments",
        null=True,
        blank=True,
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("membership", "group", "scope"),
                name="unique_group_assignment_per_scope",
            ),
        ]

    def clean(self):
        errors = {}
        if self.group.organization_id != self.membership.organization_id:
            errors["group"] = "Group must belong to the same organization as the membership."
        if self.group.membership_type and self.group.membership_type != self.membership.membership_type:
            errors["group"] = "Group membership_type must match the membership."
        if self.scope_id and self.scope.organization_id != self.membership.organization_id:
            errors["scope"] = "Scope must belong to the same organization as the membership."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class PermissionOverride(models.Model):
    class Effect(models.TextChoices):
        ALLOW = "ALLOW", "Allow"
        DENY = "DENY", "Deny"

    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
    )
    permission = models.ForeignKey(
        Permission,
        on_delete=models.CASCADE,
        related_name="user_overrides",
    )
    scope = models.ForeignKey(
        AccessScope,
        on_delete=models.CASCADE,
        related_name="permission_overrides",
        null=True,
        blank=True,
    )
    effect = models.CharField(max_length=10, choices=Effect.choices)
    reason = models.TextField(blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("membership", "permission", "scope"),
                name="unique_permission_override_per_scope",
            ),
        ]

    def clean(self):
        if self.scope_id and self.scope.organization_id != self.membership.organization_id:
            raise ValidationError({"scope": "Scope must belong to the same organization as the membership."})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
