// Test environment variable loading
console.log('Testing environment variable loading...');

// Try different paths
const dotenv = require('dotenv');

console.log('\n1. Testing path: ../../.env');
dotenv.config({ path: '../../.env' });
console.log('DEPLOYMENT_PK loaded:', !!process.env.DEPLOYMENT_PK);

console.log('\n2. Testing path: ../.env');
dotenv.config({ path: '../.env' });
console.log('DEPLOYMENT_PK loaded:', !!process.env.DEPLOYMENT_PK);

console.log('\n3. Testing current directory .env');
dotenv.config();
console.log('DEPLOYMENT_PK loaded:', !!process.env.DEPLOYMENT_PK);

console.log('\n4. Current working directory:', process.cwd());

if (process.env.DEPLOYMENT_PK) {
  console.log('DEPLOYMENT_PK first 10 chars:', process.env.DEPLOYMENT_PK.substring(0, 10) + '...');
} else {
  console.log('DEPLOYMENT_PK not found');
}
