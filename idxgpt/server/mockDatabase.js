// Mock database for IDXGPT login system with enhanced debugging
// In development: no password storage needed
// In production: would include hashed passwords

const mockUsers = [
  {
    id: 1,
    email: 'test@example.com',
    role: 'user',
    name: 'Test User',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    email: 'admin@ai-saham.com',
    role: 'admin',
    name: 'Admin User',
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    email: 'agro@demo.com',
    role: 'admin',
    name: 'Agro Demo User',
    createdAt: new Date().toISOString()
  }
];

class MockDatabase {
  constructor() {
    this.users = [...mockUsers];
    this.operationLog = [];
    console.log(`[${new Date().toISOString()}] MockDatabase initialized with ${this.users.length} users`);
  }

  // Enhanced logging method
  logOperation(operation, details, requestId = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      details,
      requestId,
      userCount: this.users.length
    };
    this.operationLog.push(logEntry);
    console.log(`[${logEntry.timestamp}] [${requestId || 'SYSTEM'}] DB ${operation}:`, details);
  }

  // Find user by email with enhanced logging and edge case simulation
  findUserByEmail(email, requestId = null) {
    this.logOperation('FIND_USER_BY_EMAIL_START', { email, requestId }, requestId);

    // Edge case: Simulate database connection issues (1% chance)
    if (Math.random() < 0.01) {
      this.logOperation('FIND_USER_BY_EMAIL_ERROR', { error: 'Database connection timeout', email }, requestId);
      throw new Error('Database connection timeout');
    }

    // Edge case: Simulate malformed email
    if (typeof email !== 'string') {
      this.logOperation('FIND_USER_BY_EMAIL_INVALID_INPUT', { error: 'Email must be string', type: typeof email }, requestId);
      return null;
    }

    // Edge case: Simulate case sensitivity issues
    if (email !== email.toLowerCase()) {
      this.logOperation('FIND_USER_BY_EMAIL_CASE_WARNING', { original: email, normalized: email.toLowerCase() }, requestId);
    }

    const user = this.users.find(user => user.email.toLowerCase() === email.toLowerCase());

    if (user) {
      this.logOperation('FIND_USER_BY_EMAIL_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role
      }, requestId);
    } else {
      this.logOperation('FIND_USER_BY_EMAIL_NOT_FOUND', { email }, requestId);
    }

    return user;
  }

  // Find user by ID with enhanced logging and edge case simulation
  findUserById(id, requestId = null) {
    this.logOperation('FIND_USER_BY_ID_START', { id, requestId }, requestId);

    // Edge case: Simulate invalid ID types
    if (typeof id !== 'number' && isNaN(Number(id))) {
      this.logOperation('FIND_USER_BY_ID_INVALID_INPUT', { error: 'ID must be number', type: typeof id, value: id }, requestId);
      return null;
    }

    const numericId = Number(id);

    // Edge case: Simulate database query delay (5% chance)
    if (Math.random() < 0.05) {
      this.logOperation('FIND_USER_BY_ID_DELAY_SIMULATION', { delay: '500ms', id: numericId }, requestId);
      // Simulate delay without blocking (in real scenario this would be async)
    }

    const user = this.users.find(user => user.id === numericId);

    if (user) {
      this.logOperation('FIND_USER_BY_ID_SUCCESS', {
        userId: user.id,
        email: user.email,
        role: user.role
      }, requestId);
    } else {
      this.logOperation('FIND_USER_BY_ID_NOT_FOUND', { id: numericId }, requestId);
    }

    return user;
  }

  // Add new user with enhanced logging and edge case simulation (DISABLED for this version)
  addUser(user, requestId = null) {
    this.logOperation('ADD_USER_BLOCKED', {
      message: 'User creation disabled in this version',
      attemptedEmail: user.email,
      requestId
    }, requestId);

    throw new Error('User creation is disabled in this version');
  }

  // Get all users with logging
  getAllUsers(requestId = null) {
    this.logOperation('GET_ALL_USERS', { count: this.users.length, requestId }, requestId);
    return this.users;
  }

  // Enhanced credential validation with comprehensive logging
  validateUserCredentials(email, password = null, requestId = null) {
    this.logOperation('VALIDATE_CREDENTIALS_START', {
      email,
      hasPassword: !!password,
      requestId
    }, requestId);

    // Edge case: Simulate database overload (1% chance)
    if (Math.random() < 0.01) {
      this.logOperation('VALIDATE_CREDENTIALS_DB_OVERLOAD', { error: 'Database temporarily unavailable' }, requestId);
      return { valid: false, user: null, error: 'Database temporarily unavailable' };
    }

    const user = this.findUserByEmail(email, requestId);
    if (!user) {
      this.logOperation('VALIDATE_CREDENTIALS_USER_NOT_FOUND', { email }, requestId);
      return { valid: false, user: null, error: 'User not found' };
    }

    // In development mode, any valid email is accepted
    const env = (process.env.NODE_ENV || 'development').trim();
    if (env === 'development') {
      this.logOperation('VALIDATE_CREDENTIALS_DEVELOPMENT_MODE', {
        email: user.email,
        mode: 'passwordless',
        userRole: user.role
      }, requestId);
      return { valid: true, user, error: null };
    }

    // In production, password validation would be required
    if (!password) {
      this.logOperation('VALIDATE_CREDENTIALS_PASSWORD_MISSING', { email: user.email }, requestId);
      return { valid: false, user: null, error: 'Password required' };
    }

    // Mock password validation (in real app, use bcrypt)
    const isValidPassword = password === 'password123'; // Mock validation
    if (!isValidPassword) {
      this.logOperation('VALIDATE_CREDENTIALS_INVALID_PASSWORD', {
        email: user.email,
        passwordLength: password.length
      }, requestId);
      return { valid: false, user: null, error: 'Invalid credentials' };
    }

    this.logOperation('VALIDATE_CREDENTIALS_SUCCESS', {
      email: user.email,
      role: user.role
    }, requestId);

    return { valid: true, user, error: null };
  }

  // Get operation log for debugging
  getOperationLog(limit = 50) {
    return this.operationLog.slice(-limit);
  }

  // Clear operation log
  clearOperationLog() {
    this.operationLog = [];
  }
}

module.exports = new MockDatabase();