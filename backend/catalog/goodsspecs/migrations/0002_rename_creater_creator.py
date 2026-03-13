from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("goodsspecs", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="listmodel",
            old_name="creater",
            new_name="creator",
        ),
    ]
