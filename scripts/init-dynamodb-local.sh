#!/bin/bash
# Initialize DynamoDB local with tables. Run after docker compose up.
set -e
ENDPOINT="http://localhost:8000"

echo "Creating imagix-stories table..."
aws dynamodb create-table \
  --table-name imagix-stories \
  --attribute-definitions AttributeName=pk,AttributeType=S AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  --region us-east-1 2>/dev/null || echo "Table may already exist"

echo "DynamoDB local ready."
