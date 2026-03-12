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

# Expose the port that the app runs on
EXPOSE 8000

# Set Python path
ENV PYTHONPATH=/app:$PYTHONPATH

# Start the Django server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
# CMD ["sleep", "infinity"]