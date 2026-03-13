from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("payment", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="transportationfeelistmodel",
            old_name="creater",
            new_name="creator",
        ),
    ]
