#!/bin/bash

# Secure Deployment Script for Hermetik Dashboard

set -e

echo "🚀 Starting secure deployment process..."

# Configuration
REGION="us-east-1"
S3_BUCKET="hermetik-dashboard-frontend-2025"
EC2_USER="ec2-user"  # or ubuntu, depending on your AMI
EC2_HOST="23.20.137.235"

# Step 1: Build and deploy frontend
echo "📦 Building frontend..."
cd frontend1
npm run build

echo "📤 Deploying frontend to S3..."
aws s3 sync dist/ s3://$S3_BUCKET --delete --region $REGION

# Step 2: Deploy backend
echo "🔧 Deploying backend to EC2..."
cd ../backend

# Create deployment package
tar -czf backend-deploy.tar.gz \
    --exclude=node_modules \
    --exclude=logs \
    --exclude=*.log \
    --exclude=.env \
    .

# Copy to EC2
scp backend-deploy.tar.gz $EC2_USER@$EC2_HOST:~/

# Deploy on EC2
ssh $EC2_USER@$EC2_HOST << 'EOF'
    # Stop existing service
    sudo systemctl stop hermetik-backend || true
    
    # Backup current deployment
    if [ -d ~/hermetik-backend ]; then
        mv ~/hermetik-backend ~/hermetik-backend-backup-$(date +%Y%m%d-%H%M%S)
    fi
    
    # Extract new deployment
    mkdir ~/hermetik-backend
    tar -xzf ~/backend-deploy.tar.gz -C ~/hermetik-backend
    cd ~/hermetik-backend
    
    # Install dependencies
    npm install --production
    
    # Copy production environment file
    cp .env.production .env
    
    # Start service
    sudo systemctl start hermetik-backend
    sudo systemctl enable hermetik-backend
    
    # Check status
    sudo systemctl status hermetik-backend
EOF

# Clean up
rm backend-deploy.tar.gz

echo "✅ Deployment completed!"
echo ""
echo "🔍 Next steps:"
echo "1. Verify backend is running: ssh $EC2_USER@$EC2_HOST 'sudo systemctl status hermetik-backend'"
echo "2. Check health endpoint: curl https://YOUR-ALB-DNS/api/health"
echo "3. Test frontend: https://YOUR-CLOUDFRONT-DNS"
echo ""
echo "📋 Don't forget to:"
echo "- Update DNS records if using custom domain"
echo "- Configure monitoring and alerts"
echo "- Set up automated backups"