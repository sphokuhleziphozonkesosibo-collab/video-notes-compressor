FROM python:3.11-slim

# Install FFmpeg for media compression and audio chunking
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and database
COPY main.py .
COPY .env* ./

# Render requires port 10000
ENV PORT=10000
EXPOSE 10000

# Start Uvicorn bound to port 10000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]