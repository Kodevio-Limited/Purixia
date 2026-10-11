# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt /app/
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy project
COPY . /app/

# Create runtime directories, snapshot shipped media so the entrypoint can seed
# it into the persistent volume on first boot, and drop root privileges.
RUN mkdir -p /app/logs /app/staticfiles /app/media /app/media_seed \
    && cp -a /app/media/. /app/media_seed/ \
    && chmod +x /app/entrypoint.sh \
    && addgroup --system app \
    && adduser --system --ingroup app app \
    && chown -R app:app /app

USER app

# Expose port 8000
EXPOSE 8000

# Container-level health probe (also used by Docker Compose / Traefik).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import sys,urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=4).status == 200 else 1)"

# Start Gunicorn (runs migrations / seeds DB first via entrypoint)
CMD ["/app/entrypoint.sh"]
