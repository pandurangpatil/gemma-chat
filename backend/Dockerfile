# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Define build argument for the application version
ARG APP_VERSION
# Set the application version as an environment variable
ENV APP_VERSION=$APP_VERSION

# Set the working directory in the container
WORKDIR /app

# Install system dependencies that might be needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application's code into the container
COPY . .

# Create startup script
COPY startup.sh .
RUN chmod +x startup.sh

# Command to run the application with migrations
CMD ["./startup.sh"]
