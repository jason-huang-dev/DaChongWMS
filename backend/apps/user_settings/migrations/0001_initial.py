from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("organizations", "0004_alter_organizationaccessauditevent_action_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserSetting",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("category", models.CharField(max_length=64)),
                ("setting_key", models.CharField(max_length=64)),
                ("payload", models.JSONField(blank=True, default=dict)),
                ("create_time", models.DateTimeField(auto_now_add=True)),
                ("update_time", models.DateTimeField(auto_now=True)),
                (
                    "membership",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_settings",
                        to="organizations.organizationmembership",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="settings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("user_id", "membership_id", "category", "setting_key", "id"),
            },
        ),
        migrations.AddConstraint(
            model_name="usersetting",
            constraint=models.UniqueConstraint(
                fields=("user", "membership", "category", "setting_key"),
                name="unique_user_setting_scope",
            ),
        ),
    ]
