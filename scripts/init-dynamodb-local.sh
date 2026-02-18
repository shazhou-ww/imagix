#!/bin/bash
# Initialize DynamoDB local with tables. Run after docker compose up.
set -e
ENDPOINT="http://localhost:8000"

echo "Creating imagix table..."
aws dynamodb create-table \
  --table-name imagix \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi1pk,AttributeType=S \
    AttributeName=gsi1sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes \
    'IndexName=gsi1,KeySchema=[{AttributeName=gsi1pk,KeyType=HASH},{AttributeName=gsi1sk,KeyType=RANGE}],Projection={ProjectionType=ALL}' \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url "$ENDPOINT" \
  --region us-east-1 2>/dev/null || echo "Table may already exist"

echo "DynamoDB local ready."
