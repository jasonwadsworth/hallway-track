#!/bin/bash

# Hallway Track Deployment Script
# This script builds the frontend and deploys everything to AWS

set -e

echo "🚀 Starting Hallway Track Deployment..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get AWS region
AWS_REGION=$(aws configure get region || echo "us-west-2")

# Step 1: Check if stack exists to get current outputs
echo -e "\n${BLUE}Step 1: Checking for existing deployment...${NC}"
if aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION &> /dev/null; then
  echo "Existing stack found, extracting outputs..."
  USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
  USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
  GRAPHQL_ENDPOINT=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='GraphQLApiUrl'].OutputValue" --output text)
else
  echo "No existing stack found, will create new deployment"
  # Set placeholder values for first deployment
  USER_POOL_ID="PLACEHOLDER"
  USER_POOL_CLIENT_ID="PLACEHOLDER"
  GRAPHQL_ENDPOINT="PLACEHOLDER"
fi

# Step 2: Update frontend environment variables
echo -e "\n${BLUE}Step 2: Updating frontend environment variables...${NC}"
cat > frontend/.env << EOF
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_GRAPHQL_ENDPOINT=$GRAPHQL_ENDPOINT
VITE_AWS_REGION=$AWS_REGION
EOF

echo "Frontend .env file updated"

# Step 3: Build frontend
echo -e "\n${BLUE}Step 3: Building frontend application...${NC}"
npm run frontend:build

# Check if build was successful
if [ ! -d "frontend/dist" ]; then
  echo -e "\n${YELLOW}⚠️  Frontend build failed or dist directory not found${NC}"
  exit 1
fi

echo "Frontend built successfully"

# Step 4: Deploy CDK Infrastructure (includes S3 upload and CloudFront)
echo -e "\n${BLUE}Step 4: Deploying CDK Infrastructure and Frontend...${NC}"
npm run cdk:deploy -- --require-approval never

# Step 5: Extract final outputs
echo -e "\n${BLUE}Step 5: Extracting deployment outputs...${NC}"
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text)
GRAPHQL_ENDPOINT=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='GraphQLApiUrl'].OutputValue" --output text)
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" --output text)
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name HallwayTrackStack --region $AWS_REGION --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)

echo ""
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "GraphQL Endpoint: $GRAPHQL_ENDPOINT"
echo "Website URL: $WEBSITE_URL"
echo "CloudFront Distribution ID: $DISTRIBUTION_ID"
echo "AWS Region: $AWS_REGION"

# Step 6: Update frontend .env with real values if they were placeholders
if [ "$USER_POOL_ID" != "PLACEHOLDER" ]; then
  echo -e "\n${BLUE}Step 6: Updating frontend .env with deployed values...${NC}"
  cat > frontend/.env << EOF
VITE_USER_POOL_ID=$USER_POOL_ID
VITE_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_GRAPHQL_ENDPOINT=$GRAPHQL_ENDPOINT
VITE_AWS_REGION=$AWS_REGION
EOF
fi

echo -e "\n${GREEN}✅ Deployment complete!${NC}"
echo -e "\n${BLUE}Your application is now live at:${NC}"
echo -e "${GREEN}$WEBSITE_URL${NC}"
echo ""
echo -e "${BLUE}Note:${NC} CloudFront distribution may take 5-10 minutes to fully propagate."
echo ""
echo -e "${BLUE}To invalidate CloudFront cache after updates:${NC}"
echo "aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*' --region $AWS_REGION"
