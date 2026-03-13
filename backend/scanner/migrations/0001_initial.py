from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ListModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('mode', models.CharField(max_length=255, verbose_name="Mode")),
                ('code', models.TextField(verbose_name="Code")),
                ('bar_code', models.CharField(max_length=255, verbose_name="Bar Code")),
                ('openid', models.CharField(max_length=255, verbose_name="Openid")),
                ('is_delete', models.BooleanField(default=False, verbose_name="Delete Label")),
                ('create_time', models.DateTimeField(auto_now_add=True, verbose_name="Create Time")),
                ('update_time', models.DateTimeField(auto_now=True, verbose_name="Update Time")),
            ],
            options={
                'ordering': ['-id'],
                        'db_table': 'scanner',
                        'verbose_name': 'Scanner',
                        'verbose_name_plural': 'Scanners'
            },
        ),
    ]
