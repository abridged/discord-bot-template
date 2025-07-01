#!/usr/bin/env node

console.log('🔥 SIMPLE TEST - TOP LEVEL');

require('dotenv').config();

console.log('🔥 SIMPLE TEST - AFTER DOTENV');

async function testFunction() {
  console.log('🔥 SIMPLE TEST - INSIDE FUNCTION');
  return 'done';
}

console.log('🔥 SIMPLE TEST - BEFORE FUNCTION CALL');

testFunction().then(() => {
  console.log('🔥 SIMPLE TEST - AFTER FUNCTION CALL');
  process.exit(0);
}).catch((error) => {
  console.error('🔥 SIMPLE TEST - ERROR:', error);
  process.exit(1);
});
