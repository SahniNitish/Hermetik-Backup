#!/usr/bin/env node

/**
 * MongoDB to DocumentDB Migration Script
 * This script helps migrate your local MongoDB data to AWS DocumentDB
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 MongoDB to DocumentDB Migration Guide');
console.log('==========================================\n');

// Step 1: AWS DocumentDB Setup
console.log('📋 STEP 1: AWS DocumentDB Setup');
console.log('--------------------------------');
console.log('1. Go to AWS Console → DocumentDB');
console.log('2. Click "Create cluster"');
console.log('3. Configure your cluster:');
console.log('   - Cluster identifier: hermetik-cluster');
console.log('   - Engine version: 5.0 (latest)');
console.log('   - Instance class: db.t3.medium (or larger)');
console.log('   - Number of instances: 1 (or more for HA)');
console.log('   - VPC: Your application VPC');
console.log('   - Subnet group: Create or use existing');
console.log('   - Security group: Allow port 27017 from EC2');
console.log('   - Master username: admin (or preferred)');
console.log('   - Master password: [Create strong password]');
console.log('4. Wait for cluster to be available (5-10 minutes)\n');

// Step 2: Get Connection Details
console.log('📋 STEP 2: Get DocumentDB Connection Details');
console.log('---------------------------------------------');
console.log('1. After cluster creation, get the endpoint:');
console.log('   - Go to your cluster → "Connectivity & security"');
console.log('   - Copy the "Reader endpoint"');
console.log('   - Note your master username and password\n');

// Step 3: Upload to S3
console.log('📋 STEP 3: Upload Backup to S3');
console.log('--------------------------------');
console.log('1. Create S3 bucket for backup:');
console.log('   aws s3 mb s3://hermetik-mongodb-backup-$(date +%Y%m%d)');
console.log('');
console.log('2. Upload your MongoDB backup to S3:');
console.log('   aws s3 cp ~/mongodb-backup-$(date +%Y%m%d) s3://hermetik-mongodb-backup-$(date +%Y%m%d)/mongodb-backup/ --recursive');
console.log('');
console.log('3. Verify upload:');
console.log('   aws s3 ls s3://hermetik-mongodb-backup-$(date +%Y%m%d)/mongodb-backup/hermetikdb/\n');

// Step 4: Import to DocumentDB
console.log('📋 STEP 4: Import Data to DocumentDB');
console.log('-------------------------------------');
console.log('1. Download from S3 to your EC2 instance:');
console.log('   aws s3 cp s3://hermetik-mongodb-backup-$(date +%Y%m%d)/mongodb-backup/ /home/ubuntu/mongodb-backup/ --recursive');
console.log('');
console.log('2. Import to DocumentDB (replace with your actual endpoint):');
console.log('   mongorestore \\');
console.log('     --host your-cluster.cluster-xxxxx.region.docdb.amazonaws.com \\');
console.log('     --port 27017 \\');
console.log('     --ssl \\');
console.log('     --username your-master-username \\');
console.log('     --password your-master-password \\');
console.log('     --db hermetikdb \\');
console.log('     /home/ubuntu/mongodb-backup/hermetikdb/\n');

// Step 5: Update Application Configuration
console.log('📋 STEP 5: Update Application Configuration');
console.log('--------------------------------------------');
console.log('1. On your EC2 instance, update the .env file:');
console.log('   nano .env');
console.log('');
console.log('2. Change MONGO_URI from:');
console.log('   MONGO_URI=mongodb://127.0.0.1:27017/hermetikdb');
console.log('   to:');
console.log('   MONGO_URI=mongodb://your-master-username:your-master-password@your-cluster.cluster-xxxxx.region.docdb.amazonaws.com:27017/hermetikdb?ssl=true&replicaSet=rs0&readPreference=secondaryPreferred');
console.log('');

// Step 6: Test Connection
console.log('📋 STEP 6: Test DocumentDB Connection');
console.log('--------------------------------------');
console.log('1. Test connection to DocumentDB:');
console.log('   mongosh --host your-cluster.cluster-xxxxx.region.docdb.amazonaws.com --port 27017 --ssl --username your-master-username --password your-master-password');
console.log('');
console.log('2. Check if data was imported:');
console.log('   use hermetikdb');
console.log('   db.users.countDocuments()');
console.log('   db.walletdatas.countDocuments()');
console.log('   db.navsettings.countDocuments()');
console.log('');

// Step 7: Restart Application
console.log('📋 STEP 7: Restart Your Application');
console.log('------------------------------------');
console.log('1. Restart your application to use DocumentDB:');
console.log('   pm2 restart all');
console.log('');
console.log('2. Check logs:');
console.log('   pm2 logs');
console.log('');

// Step 8: Verify Everything Works
console.log('📋 STEP 8: Verify Everything Works');
console.log('-----------------------------------');
console.log('1. Test the API endpoints:');
console.log('   curl -X POST "http://localhost:3001/api/auth/login" \\');
console.log('     -H "Content-Type: application/json" \\');
console.log('     -d \'{"email": "admin@example.com", "password": "password123"}\'');
console.log('');
console.log('2. Test NAV export:');
console.log('   curl -X GET "http://localhost:3001/api/analytics/export/monthly-nav" \\');
console.log('     -H "Authorization: Bearer YOUR_TOKEN"');
console.log('');

// Current backup info
const backupDir = `~/mongodb-backup-$(new Date().toISOString().split('T')[0].replace(/-/g, ''))`;
console.log('📊 Your Current Backup Information:');
console.log('-----------------------------------');
console.log(`Backup location: ${backupDir}`);
console.log('Collections backed up:');
console.log('  - users (16 documents)');
console.log('  - navdatas (12 documents)');
console.log('  - benchmarkdatas (8 documents)');
console.log('  - positionhistories (8 documents)');
console.log('  - conversationcontexts (2 documents)');
console.log('  - clientprofiles (0 documents)');
console.log('  - dailysnapshots (389 documents)');
console.log('  - walletdatas (3,132 documents)');
console.log('  - navsettings (24 documents)');
console.log('');

console.log('🎯 Next Steps:');
console.log('1. Set up DocumentDB cluster in AWS');
console.log('2. Upload backup to S3');
console.log('3. Import data to DocumentDB');
console.log('4. Update application configuration');
console.log('5. Test and verify functionality');
console.log('');

console.log('⚠️  Important Notes:');
console.log('- DocumentDB requires SSL connections');
console.log('- Use "secondaryPreferred" read preference for better performance');
console.log('- Keep your backup safe until migration is complete');
console.log('- Test thoroughly before going live');
console.log('');

console.log('✅ Migration script completed! Follow the steps above to migrate to DocumentDB.');

