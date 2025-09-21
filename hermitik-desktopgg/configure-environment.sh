#!/bin/bash

# Environment Configuration Script

echo "🔧 Configuring environment for secure deployment..."

# Get ALB and CloudFront DNS names from CloudFormation
STACK_NAME="hermetik-dashboard-secure"
REGION="us-east-1"

echo "📋 Retrieving infrastructure details..."

ALB_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`ALBDNSName`].OutputValue' \
    --output text 2>/dev/null || echo "")

CLOUDFRONT_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDNSName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [ -z "$ALB_DNS" ] || [ -z "$CLOUDFRONT_DNS" ]; then
    echo "❌ Could not retrieve infrastructure details from CloudFormation"
    echo "Please provide the URLs manually:"
    read -p "ALB DNS Name: " ALB_DNS
    read -p "CloudFront DNS Name: " CLOUDFRONT_DNS
fi

echo "✅ Using URLs:"
echo "  Backend: https://$ALB_DNS/api"
echo "  Frontend: https://$CLOUDFRONT_DNS"

# Update frontend environment
echo "📝 Updating frontend environment..."
cat > frontend1/.env.production << EOF
VITE_API_BASE_URL=https://$ALB_DNS/api
VITE_USE_MOCK_API=false
EOF

# Update backend environment
echo "📝 Updating backend environment..."
cat > backend/.env.production << EOF
MONGO_URI=mongodb://127.0.0.1:27017/hermetikdb
JWT_SECRET=115f9c22d041273e84d6e4e13a276e807f66683b639f93b126c28069915605aa58fd43d5fa2bb6deb289c15637f10d557f9c61d73a7f090f5f6e09124e1df6bc
DEBANK_API_KEY=49d99f8436a54069927209f08c8bbb65189c23fc
COINGECKO_API_KEY=CG-KV3S8hGjNCfpVF1D388Lipx3
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://$CLOUDFRONT_DNS
EOF

echo "✅ Environment files updated!"
echo ""
echo "🚀 Ready for deployment. Run: ./deploy-secure.sh"