#!/bin/bash

# Quick Security Setup for Hermetik Dashboard
# This script sets up HTTPS without requiring a custom domain

set -e

echo "🔒 Starting Quick Security Setup for Hermetik Dashboard"

# Configuration
REGION="us-east-1"
STACK_NAME="hermetik-dashboard-secure"
S3_BUCKET="hermetik-dashboard-frontend-2025"

# Get current EC2 instance ID (you'll need to replace this)
echo "📋 Please provide your EC2 instance ID:"
read -p "EC2 Instance ID: " EC2_INSTANCE_ID

if [ -z "$EC2_INSTANCE_ID" ]; then
    echo "❌ EC2 Instance ID is required"
    exit 1
fi

echo "🚀 Creating secure infrastructure..."

# Deploy CloudFormation stack
aws cloudformation deploy \
    --template-file aws-infrastructure.yaml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        EC2InstanceId=$EC2_INSTANCE_ID \
        S3BucketName=$S3_BUCKET \
    --capabilities CAPABILITY_IAM \
    --region $REGION

echo "⏳ Waiting for stack deployment to complete..."

# Get outputs
ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text)

CLOUDFRONT_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDNSName`].OutputValue' \
    --output text)

echo "✅ Infrastructure deployed successfully!"
echo ""
echo "📋 New URLs:"
echo "Frontend (HTTPS): https://$CLOUDFRONT_DNS"
echo "Backend API (HTTPS): https://$ALB_DNS/api"
echo ""
echo "🔧 Next steps:"
echo "1. Update your frontend environment variables"
echo "2. Update your backend CORS configuration"
echo "3. Test the new secure endpoints"
echo ""

# Create updated environment files
echo "📝 Creating updated environment files..."

cat > frontend1/.env.production.new << EOF
VITE_API_BASE_URL=https://$ALB_DNS/api
VITE_USE_MOCK_API=false
EOF

cat > backend/.env.production.new << EOF
MONGO_URI=mongodb://127.0.0.1:27017/hermetikdb
JWT_SECRET=115f9c22d041273e84d6e4e13a276e807f66683b639f93b126c28069915605aa58fd43d5fa2bb6deb289c15637f10d557f9c61d73a7f090f5f6e09124e1df6bc
DEBANK_API_KEY=49d99f8436a54069927209f08c8bbb65189c23fc
COINGECKO_API_KEY=CG-KV3S8hGjNCfpVF1D388Lipx3
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://$CLOUDFRONT_DNS
EOF

echo "✅ Environment files created:"
echo "- frontend1/.env.production.new"
echo "- backend/.env.production.new"
echo ""
echo "⚠️  Please review and rename these files to replace your current .env.production files"