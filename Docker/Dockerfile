# Use Python 3.14 slim image
FROM python:3.14-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=main.py \
    PATH="/root/.cargo/bin:$PATH"

# Install system dependencies (curl for uv installation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    ffmpeg \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN python3 -m pip install uv --no-cache-dir

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock* ./

# Copy run script and make it executable
COPY run.sh .
RUN chmod +x run.sh

# Copy project files
COPY main.py .
# uv needs the readme for some reason...
RUN touch README.md

COPY src/ ./src/

# Expose port 9999
EXPOSE 80

# Run the application
CMD ["bash", "run.sh"]
