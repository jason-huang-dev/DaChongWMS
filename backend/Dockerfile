# backend/Dockerfile

FROM python:3.14-slim

# Set the working directory
WORKDIR /app

# Install system packages required for graph generation and building wheels
RUN apt-get update \
    && apt-get install -y --no-install-recommends graphviz libgraphviz-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy project files
COPY . .

# Pre-collect Django static assets for production-serving paths.
RUN DJANGO_SETTINGS_MODULE=dachong_wms.settings \
    DJANGO_SECRET_KEY=build-time-static-secret \
    DJANGO_DEBUG=false \
    DATABASE_URL=sqlite:////tmp/dachongwms-build.sqlite3 \
    python manage.py collectstatic --noinput

# Expose the port that the app runs on
EXPOSE 8000

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Production default; development overrides this with runserver.
CMD ["gunicorn", "dachong_wms.wsgi:application", "--bind", "0.0.0.0:8000"]
