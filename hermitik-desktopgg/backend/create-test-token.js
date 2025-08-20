const jwt = require('jsonwebtoken');
require('dotenv').config();

// Create a test token for a user that has data
const testUser = {
  id: '689bca849fe4bbc83dc793a2', // User that we've been testing
  role: 'user',
  email: 'test@example.com'
};

const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1d' });

console.log('Test token for API calls:');
console.log(token);
console.log('\nUse this token in Authorization header: Bearer ' + token);