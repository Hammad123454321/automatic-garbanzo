#!/bin/bash
set -euo pipefail

echo "==> Pulling latest code..."
git pull origin master

echo "==> Stopping existing containers..."
docker compose down --remove-orphans

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Running database migrations..."
docker compose exec -T api npx prisma migrate deploy

echo "==> Deployment complete."
docker compose ps
