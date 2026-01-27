const bcrypt = require('bcryptjs');

// Generate hash for "Password123"
async function generateHash() {
  const password = 'Password123';
  const saltRounds = 10;

  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);

    // Test if the hash works
    const isValid = await bcrypt.compare(password, hash);
    console.log(`Hash validation: ${isValid ? 'SUCCESS' : 'FAILED'}`);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHash();