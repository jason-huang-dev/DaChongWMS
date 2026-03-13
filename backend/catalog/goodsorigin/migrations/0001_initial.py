from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ListModel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('goods_origin', models.CharField(max_length=255, unique=True, verbose_name="Goods Origin")),
                ('creater', models.CharField(max_length=255, default="system", verbose_name="Created By")),
                ('openid', models.CharField(max_length=255, verbose_name="Openid")),
                ('is_delete', models.BooleanField(default=False, verbose_name="Delete Label")),
                ('create_time', models.DateTimeField(auto_now_add=True, verbose_name="Create Time")),
                ('update_time', models.DateTimeField(auto_now=True, verbose_name="Update Time")),
            ],
            options={
                'db_table': 'goodsorigin',
                        'verbose_name': 'Goods Origin',
                        'verbose_name_plural': 'Goods Origins'
            },
        ),
    ]
