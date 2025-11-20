#!/bin/bash

# Change to the Docker directory where the compose files are located
cd Docker || { echo "Error: Docker directory not found"; exit 1; }

# Cleanup potential conflict from previous container structure
# This is necessary because we moved the compose project, so Docker sees it as a "new" project
# trying to claim the same container name.
docker rm -f aeroar-app >/dev/null 2>&1

if [ "$1" == "prod" ]; then
    echo "Starting Production Environment..."
    # Stop any existing containers (both prod and dev) to free up ports
    sudo docker compose -f docker-compose.prod.yml down >/dev/null 2>&1
    docker compose -f docker-compose.yml down >/dev/null 2>&1
    
    # We explicitly point to the .env file in the parent directory
    docker rm -f aeroar-app >/dev/null 2>&1 # remove the container if it exists
    sudo docker compose --env-file ../.env -f docker-compose.prod.yml up -d --build
else
    echo "Starting Development Environment..."
    # Stop any existing containers (both prod and dev) to free up ports
    sudo docker compose -f docker-compose.prod.yml down >/dev/null 2>&1
    docker compose -f docker-compose.yml down >/dev/null 2>&1

    docker rm -f aeroar-app >/dev/null 2>&1 # remove the container if it exists
    docker compose --env-file ../.env -f docker-compose.yml up -d --build
fi
