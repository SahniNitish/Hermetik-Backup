#!/bin/bash

# 🖥️ EC2 Setup Commands for DocumentDB Connection
# Run these commands on your EC2 instance

echo "🚀 Setting up EC2 instance for Hermetik backend..."
echo "================================================"

# Update system packages
echo "📦 Updating system packages..."
sudo yum update -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Git
echo "📦 Installing Git..."
sudo yum install -y git

# Install MongoDB tools for database operations
echo "📦 Installing MongoDB tools..."
cat > /tmp/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF

sudo cp /tmp/mongodb-org-7.0.repo /etc/yum.repos.d/mongodb-org-7.0.repo
sudo yum install -y mongodb-mongosh mongodb-database-tools

# Install PM2 for process management
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Install nginx for reverse proxy
echo "📦 Installing nginx..."
sudo amazon-linux-extras install nginx1 -y

# Download DocumentDB SSL certificate
echo "🔒 Downloading DocumentDB SSL certificate..."
wget https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem -O global-bundle.pem

# Clone the repository
echo "📂 Cloning Hermetik repository..."
git clone https://github.com/SahniNitish/Hermetik-Backup.git

# Navigate to backend directory
cd Hermetik-Backup/hermitik-desktopgg/backend

# Install dependencies
echo "📦 Installing backend dependencies..."
npm install --production

# Create production environment file
echo "⚙️ Creating production environment file..."
cp config/production.env.example .env

echo ""
echo "✅ EC2 setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env file with DocumentDB connection string"
echo "2. Test DocumentDB connection"
echo "3. Migrate data from local backup"
echo "4. Start the backend application"
echo ""
echo "🔗 Your DocumentDB connection string:"
echo "mongodb://admin1:Hermetik2025@hermetik-docdb-final.cagkrtwngcl9.us-east-1.docdb.amazonaws.com:27017/hermetikdb?tls=true&tlsCAFile=global-bundle.pem&retryWrites=false&authSource=admin"


