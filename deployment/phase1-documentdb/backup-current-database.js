/**
 * Backup current MongoDB database before migration
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `./backup-${timestamp}`;
  
  console.log('🗄️ Starting database backup...');
  console.log(`📁 Backup directory: ${backupDir}`);
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    // Use mongodump to backup the database
    const command = `mongodump --uri="mongodb://localhost:27017/hermetikdb" --out="${backupDir}"`;
    
    console.log('🔄 Running mongodump...');
    console.log(`Command: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Backup failed:', error.message);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.log('⚠️ Backup warnings:', stderr);
      }
      
      console.log('✅ Backup completed successfully!');
      console.log('📊 Backup output:', stdout);
      console.log(`📁 Backup saved to: ${path.resolve(backupDir)}`);
      
      // List backup contents
      const backupPath = path.join(backupDir, 'hermetikdb');
      if (fs.existsSync(backupPath)) {
        const files = fs.readdirSync(backupPath);
        console.log('📋 Backup contents:');
        files.forEach(file => {
          const filePath = path.join(backupPath, file);
          const stats = fs.statSync(filePath);
          console.log(`  - ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
        });
      }
      
      resolve(backupDir);
    });
  });
}

async function main() {
  try {
    const backupPath = await backupDatabase();
    
    console.log('\n✅ Database backup completed successfully!');
    console.log('📁 Backup location:', path.resolve(backupPath));
    console.log('\n🚀 Ready to proceed with DocumentDB migration');
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { backupDatabase };


