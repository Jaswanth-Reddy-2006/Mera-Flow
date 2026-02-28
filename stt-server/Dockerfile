FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required by faster-whisper and CTranslate2
RUN apt-get update && apt-get install -y \
    libgomp1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the correct port
EXPOSE $PORT

# Run the FastAPI server
# Render sets the PORT environment variable dynamically
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
