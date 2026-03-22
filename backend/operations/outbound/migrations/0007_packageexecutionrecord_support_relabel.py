from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("outbound", "0006_outbound_wave_and_package_execution_records"),
    ]

    operations = [
        migrations.AlterField(
            model_name="packageexecutionrecord",
            name="step_type",
            field=models.CharField(
                choices=[
                    ("RELABEL", "Scan And Relabel"),
                    ("PACK", "Scan To Pack"),
                    ("INSPECT", "Scan To Inspect"),
                    ("WEIGH", "Weighing To Ship"),
                ],
                max_length=16,
                verbose_name="Step Type",
            ),
        ),
    ]
