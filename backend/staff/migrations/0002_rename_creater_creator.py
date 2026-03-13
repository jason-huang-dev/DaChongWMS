from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("staff", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="typelistmodel",
            old_name="creater",
            new_name="creator",
        ),
    ]
