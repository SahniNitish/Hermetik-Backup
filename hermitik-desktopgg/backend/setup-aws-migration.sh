#!/bin/bash

# AWS Migration Setup Script
# This script helps set up S3 for MongoDB to DocumentDB migration

echo "🚀 AWS Migration Setup Script"
echo "=============================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first:"
    echo "   macOS: brew install awscli"
    echo "   Ubuntu: sudo apt-get install awscli"
    echo "   Or download from: https://aws.amazon.com/cli/"
    echo ""
    exit 1
fi

echo "✅ AWS CLI is installed"
echo ""

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "❌ AWS CLI is not configured. Please configure it first:"
    echo "   aws configure"
    echo "   Enter your AWS Access Key ID, Secret Access Key, and region"
    echo ""
    exit 1
fi

echo "✅ AWS CLI is configured"
echo ""

# Get current date for backup naming
BACKUP_DATE=$(date +%Y%m%d)
BUCKET_NAME="hermetik-mongodb-backup-${BACKUP_DATE}"
BACKUP_DIR="$HOME/mongodb-backup-${BACKUP_DATE}"

echo "📊 Migration Details:"
echo "   Backup Date: ${BACKUP_DATE}"
echo "   S3 Bucket: ${BUCKET_NAME}"
echo "   Local Backup: ${BACKUP_DIR}"
echo ""

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup directory not found: ${BACKUP_DIR}"
    echo "   Please run the MongoDB backup first:"
    echo "   mongodump --db hermetikdb --out ~/mongodb-backup-$(date +%Y%m%d)"
    echo ""
    exit 1
fi

echo "✅ Backup directory found: ${BACKUP_DIR}"
echo ""

# Create S3 bucket
echo "📦 Creating S3 bucket: ${BUCKET_NAME}"
aws s3 mb "s3://${BUCKET_NAME}"

if [ $? -eq 0 ]; then
    echo "✅ S3 bucket created successfully"
else
    echo "❌ Failed to create S3 bucket"
    exit 1
fi

echo ""

# Upload backup to S3
echo "📤 Uploading backup to S3..."
aws s3 cp "${BACKUP_DIR}" "s3://${BUCKET_NAME}/mongodb-backup/" --recursive

if [ $? -eq 0 ]; then
    echo "✅ Backup uploaded successfully"
else
    echo "❌ Failed to upload backup"
    exit 1
fi

echo ""

# Verify upload
echo "🔍 Verifying upload..."
aws s3 ls "s3://${BUCKET_NAME}/mongodb-backup/hermetikdb/"

echo ""
echo "🎯 Next Steps:"
echo "1. Set up DocumentDB cluster in AWS Console"
echo "2. Get the cluster endpoint and credentials"
echo "3. Download backup from S3 to your EC2 instance:"
echo "   aws s3 cp s3://${BUCKET_NAME}/mongodb-backup/ /home/ubuntu/mongodb-backup/ --recursive"
echo "4. Import to DocumentDB using mongorestore"
echo "5. Update your application configuration"
echo ""
echo "✅ AWS migration setup completed!"
echo "   Your backup is safely stored in S3: s3://${BUCKET_NAME}/"

