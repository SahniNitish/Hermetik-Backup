#!/bin/bash

# 🗄️ Phase 1: DocumentDB Setup - AWS CLI Commands
# Run these commands step by step

echo "🚀 Starting Phase 1: DocumentDB Setup"
echo "======================================"

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "❌ AWS CLI is not configured. Please run 'aws configure' first."
    exit 1
fi

echo "✅ AWS CLI is configured"
echo ""

# Variables (update these with your preferences)
REGION="us-east-1"
VPC_CIDR="10.0.0.0/16"
SUBNET_1_CIDR="10.0.1.0/24"
SUBNET_2_CIDR="10.0.2.0/24"
DB_PASSWORD="HermetikSecure123!"  # Change this to a secure password

echo "📋 Configuration:"
echo "  Region: $REGION"
echo "  VPC CIDR: $VPC_CIDR"
echo "  DB Password: [HIDDEN]"
echo ""

read -p "🤔 Do you want to proceed with these settings? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Setup cancelled"
    exit 1
fi

echo ""
echo "🔄 Step 1: Creating VPC and networking..."

# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block $VPC_CIDR \
  --region $REGION \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=hermetik-vpc}]' \
  --query 'Vpc.VpcId' \
  --output text)

echo "✅ Created VPC: $VPC_ID"

# Create Internet Gateway (needed for EC2 internet access in Phase 2)
IGW_ID=$(aws ec2 create-internet-gateway \
  --region $REGION \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=hermetik-igw}]' \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

echo "✅ Created Internet Gateway: $IGW_ID"

# Attach Internet Gateway to VPC
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID \
  --region $REGION

echo "✅ Attached Internet Gateway to VPC"

# Create private subnets for DocumentDB (need 2 AZs minimum)
SUBNET_1_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $SUBNET_1_CIDR \
  --availability-zone ${REGION}a \
  --region $REGION \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=hermetik-private-subnet-1}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "✅ Created Subnet 1: $SUBNET_1_ID"

SUBNET_2_ID=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block $SUBNET_2_CIDR \
  --availability-zone ${REGION}b \
  --region $REGION \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=hermetik-private-subnet-2}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "✅ Created Subnet 2: $SUBNET_2_ID"

echo ""
echo "🔄 Step 2: Creating DocumentDB subnet group..."

# Create DB subnet group
aws docdb create-db-subnet-group \
  --db-subnet-group-name hermetik-docdb-subnet-group \
  --db-subnet-group-description "Subnet group for Hermetik DocumentDB" \
  --subnet-ids $SUBNET_1_ID $SUBNET_2_ID \
  --region $REGION \
  --tags Key=Name,Value=hermetik-docdb-subnet-group

echo "✅ Created DocumentDB subnet group"

echo ""
echo "🔄 Step 3: Creating security groups..."

# Create security group for DocumentDB
DOCDB_SG_ID=$(aws ec2 create-security-group \
  --group-name hermetik-docdb-sg \
  --description "Security group for Hermetik DocumentDB" \
  --vpc-id $VPC_ID \
  --region $REGION \
  --query 'GroupId' \
  --output text)

echo "✅ Created DocumentDB Security Group: $DOCDB_SG_ID"

# Create security group for EC2 (for Phase 2)
EC2_SG_ID=$(aws ec2 create-security-group \
  --group-name hermetik-ec2-sg \
  --description "Security group for Hermetik EC2 backend" \
  --vpc-id $VPC_ID \
  --region $REGION \
  --query 'GroupId' \
  --output text)

echo "✅ Created EC2 Security Group: $EC2_SG_ID"

# Allow DocumentDB access from EC2
aws ec2 authorize-security-group-ingress \
  --group-id $DOCDB_SG_ID \
  --protocol tcp \
  --port 27017 \
  --source-group $EC2_SG_ID \
  --region $REGION

echo "✅ Configured DocumentDB access from EC2"

# Allow HTTP/HTTPS access to EC2 (for Phase 2)
aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region $REGION

aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region $REGION

aws ec2 authorize-security-group-ingress \
  --group-id $EC2_SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0 \
  --region $REGION

echo "✅ Configured EC2 web access"

echo ""
echo "🔄 Step 4: Creating DocumentDB cluster..."

# Create DocumentDB cluster
aws docdb create-db-cluster \
  --db-cluster-identifier hermetik-docdb-cluster \
  --engine docdb \
  --engine-version 4.0.0 \
  --master-username hermetikadmin \
  --master-user-password "$DB_PASSWORD" \
  --vpc-security-group-ids $DOCDB_SG_ID \
  --db-subnet-group-name hermetik-docdb-subnet-group \
  --storage-encrypted \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --region $REGION \
  --tags Key=Name,Value=hermetik-docdb-cluster Key=Environment,Value=production

echo "✅ DocumentDB cluster creation initiated"

echo ""
echo "🔄 Step 5: Creating DocumentDB instance..."

# Create DocumentDB instance
aws docdb create-db-instance \
  --db-instance-identifier hermetik-docdb-instance \
  --db-instance-class db.t3.medium \
  --db-cluster-identifier hermetik-docdb-cluster \
  --engine docdb \
  --region $REGION \
  --tags Key=Name,Value=hermetik-docdb-instance Key=Environment,Value=production

echo "✅ DocumentDB instance creation initiated"

echo ""
echo "⏳ Waiting for DocumentDB cluster to be available..."
echo "   This usually takes 10-15 minutes..."

# Wait for cluster to be available
aws docdb wait db-cluster-available \
  --db-cluster-identifier hermetik-docdb-cluster \
  --region $REGION

echo "✅ DocumentDB cluster is now available!"

# Get the endpoint
DOCDB_ENDPOINT=$(aws docdb describe-db-clusters \
  --db-cluster-identifier hermetik-docdb-cluster \
  --region $REGION \
  --query 'DBClusters[0].Endpoint' \
  --output text)

echo ""
echo "🎉 Phase 1 Complete!"
echo "===================="
echo ""
echo "📋 DocumentDB Details:"
echo "  Cluster ID: hermetik-docdb-cluster"
echo "  Endpoint: $DOCDB_ENDPOINT"
echo "  Port: 27017"
echo "  Username: hermetikadmin"
echo "  Password: [HIDDEN]"
echo ""
echo "📋 Network Details:"
echo "  VPC ID: $VPC_ID"
echo "  DocumentDB Security Group: $DOCDB_SG_ID"
echo "  EC2 Security Group: $EC2_SG_ID"
echo "  Subnet 1: $SUBNET_1_ID"
echo "  Subnet 2: $SUBNET_2_ID"
echo ""
echo "🔗 Connection String:"
echo "mongodb://hermetikadmin:$DB_PASSWORD@$DOCDB_ENDPOINT:27017/hermetikdb?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
echo ""
echo "📥 Next Steps:"
echo "1. Download SSL certificate: wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem"
echo "2. Test connection from EC2 instance (Phase 2)"
echo "3. Migrate data using migrate-data.js script"
echo ""

# Save configuration for Phase 2
cat > ../phase2-ec2/aws-config.env << EOF
# AWS Configuration for Phase 2
VPC_ID=$VPC_ID
EC2_SG_ID=$EC2_SG_ID
DOCDB_SG_ID=$DOCDB_SG_ID
SUBNET_1_ID=$SUBNET_1_ID
SUBNET_2_ID=$SUBNET_2_ID
DOCDB_ENDPOINT=$DOCDB_ENDPOINT
DOCDB_PASSWORD=$DB_PASSWORD
EOF

echo "💾 Configuration saved to ../phase2-ec2/aws-config.env"


