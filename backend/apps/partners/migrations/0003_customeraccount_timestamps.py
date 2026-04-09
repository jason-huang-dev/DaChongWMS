from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("partners", "0002_customeraccount_operational_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="customeraccount",
            name="create_time",
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="customeraccount",
            name="update_time",
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
