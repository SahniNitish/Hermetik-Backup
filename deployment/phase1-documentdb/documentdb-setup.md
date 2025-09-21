# 🗄️ Phase 1: DocumentDB Setup Guide

## Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   aws configure
   # Enter your AWS Access Key, Secret Key, Region, and Output format
   ```

2. **MongoDB tools installed** (for backup/restore)
   ```bash
   # macOS
   brew install mongodb/brew/mongodb-database-tools
   
   # Ubuntu/Linux
   sudo apt-get install mongodb-database-tools
   ```

3. **Database backup completed** (run backup script first)

## Step 1: Create VPC and Security Groups

### 1.1 Create VPC (if you don't have one)
```bash
# Create VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=hermetik-vpc}]'

# Note the VPC ID from the output (vpc-xxxxxxxxx)
export VPC_ID="vpc-xxxxxxxxx"
```

### 1.2 Create Subnets
```bash
# Create private subnet for DocumentDB (AZ 1)
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=hermetik-private-subnet-1}]'

# Create private subnet for DocumentDB (AZ 2) - Required for DocumentDB
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=hermetik-private-subnet-2}]'

# Note the subnet IDs
export SUBNET_ID_1="subnet-xxxxxxxxx"
export SUBNET_ID_2="subnet-yyyyyyyyy"
```

### 1.3 Create DB Subnet Group
```bash
aws docdb create-db-subnet-group \
  --db-subnet-group-name hermetik-docdb-subnet-group \
  --db-subnet-group-description "Subnet group for Hermetik DocumentDB" \
  --subnet-ids $SUBNET_ID_1 $SUBNET_ID_2 \
  --tags Key=Name,Value=hermetik-docdb-subnet-group
```

### 1.4 Create Security Group
```bash
# Create security group for DocumentDB
aws ec2 create-security-group \
  --group-name hermetik-docdb-sg \
  --description "Security group for Hermetik DocumentDB" \
  --vpc-id $VPC_ID

# Note the security group ID
export DOCDB_SG_ID="sg-xxxxxxxxx"

# Allow MongoDB port access from EC2 (we'll add EC2 SG later)
aws ec2 authorize-security-group-ingress \
  --group-id $DOCDB_SG_ID \
  --protocol tcp \
  --port 27017 \
  --cidr 10.0.0.0/16
```

## Step 2: Create DocumentDB Cluster

### 2.1 Create DocumentDB Cluster
```bash
aws docdb create-db-cluster \
  --db-cluster-identifier hermetik-docdb-cluster \
  --engine docdb \
  --engine-version 4.0.0 \
  --master-username hermetikadmin \
  --master-user-password "YourSecurePassword123!" \
  --vpc-security-group-ids $DOCDB_SG_ID \
  --db-subnet-group-name hermetik-docdb-subnet-group \
  --storage-encrypted \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --tags Key=Name,Value=hermetik-docdb-cluster Key=Environment,Value=production
```

### 2.2 Create DocumentDB Instance
```bash
aws docdb create-db-instance \
  --db-instance-identifier hermetik-docdb-instance \
  --db-instance-class db.t3.medium \
  --db-cluster-identifier hermetik-docdb-cluster \
  --engine docdb \
  --tags Key=Name,Value=hermetik-docdb-instance Key=Environment,Value=production
```

### 2.3 Wait for Cluster to be Available
```bash
# Check cluster status
aws docdb describe-db-clusters \
  --db-cluster-identifier hermetik-docdb-cluster \
  --query 'DBClusters[0].Status'

# Wait until status is "available" (usually takes 10-15 minutes)
```

## Step 3: Get Connection Details

### 3.1 Get DocumentDB Endpoint
```bash
aws docdb describe-db-clusters \
  --db-cluster-identifier hermetik-docdb-cluster \
  --query 'DBClusters[0].Endpoint'
```

### 3.2 Download SSL Certificate
```bash
# Download the DocumentDB CA certificate
wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem
```

## Step 4: Test Connection

### 4.1 Create Test Connection Script
The connection string format will be:
```
mongodb://hermetikadmin:YourSecurePassword123!@hermetik-docdb-cluster.cluster-xxxxxxxxx.us-east-1.docdb.amazonaws.com:27017/hermetikdb?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
```

### 4.2 Test from EC2 Instance (we'll need this for Phase 2)
You'll need to test the connection from an EC2 instance in the same VPC since DocumentDB is only accessible from within the VPC.

## Environment Variables for Production

```env
# DocumentDB Configuration
MONGO_URI=mongodb://hermetikadmin:YourSecurePassword123!@hermetik-docdb-cluster.cluster-xxxxxxxxx.us-east-1.docdb.amazonaws.com:27017/hermetikdb?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false

# SSL Certificate Path (for DocumentDB)
SSL_CERT_PATH=/app/rds-combined-ca-bundle.pem
```

## Important Notes

1. **DocumentDB is VPC-only** - Only accessible from EC2 instances in the same VPC
2. **SSL is required** - Must use SSL certificate for connections
3. **No retryWrites** - DocumentDB doesn't support retryWrites=true
4. **Replica Set** - Must specify replicaSet=rs0

## Next Steps

After DocumentDB is created and accessible:
1. Test connection from EC2 instance
2. Migrate data from local MongoDB
3. Update backend configuration
4. Proceed to Phase 2 (EC2 Backend deployment)

## Estimated Costs

- **DocumentDB t3.medium**: ~$200-300/month
- **Storage**: ~$0.10 per GB per month
- **I/O**: ~$0.20 per million requests
- **Backup Storage**: ~$0.095 per GB per month
