// Mock database for IDXGPT login system with enhanced debugging
// In development: no password storage needed
// In production: would include hashed passwords

const mockUsers = [
  {
    id: 1,
    email: 'test@example.com',
    role: 'user',
    name: 'Test User',
    auth_method: 'local',
    password: 'password123',
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    email: 'admin@ai-saham.com',
    role: 'admin',
    name: 'Admin User',
    auth_method: 'local',
    password: 'password123',
    createdAt: new Date().toISOString()
  },
  {
    id: 3,
    email: 'agro@demo.com',
    role: 'admin',
    name: 'Agro Demo User',
    auth_method: 'local',
    password: 'password123',
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

  // Add new user with enhanced logging and edge case simulation
  addUser(user, requestId = null) {
    this.logOperation('ADD_USER_START', {
      email: user.email,
      hasPassword: !!user.password,
      requestId
    }, requestId);

    // Edge case: Simulate database connection issues (1% chance)
    if (Math.random() < 0.01) {
      this.logOperation('ADD_USER_ERROR', { error: 'Database connection timeout', email: user.email }, requestId);
      throw new Error('Database connection timeout');
    }

    // Edge case: Validate user object
    if (!user || typeof user !== 'object') {
      this.logOperation('ADD_USER_INVALID_INPUT', { error: 'User must be an object', type: typeof user }, requestId);
      throw new Error('Invalid user data');
    }

    // Edge case: Check for required fields
    if (!user.email || typeof user.email !== 'string') {
      this.logOperation('ADD_USER_MISSING_EMAIL', { error: 'Email is required' }, requestId);
      throw new Error('Email is required');
    }

    // Edge case: Check if user already exists
    const existingUser = this.findUserByEmail(user.email, requestId);
    if (existingUser) {
      this.logOperation('ADD_USER_EXISTS', { email: user.email }, requestId);
      throw new Error('User already exists');
    }

    // Generate new ID
    const newId = Math.max(...this.users.map(u => u.id), 0) + 1;

    // Create new user object with defaults
    const newUser = {
      id: newId,
      email: user.email,
      password: user.password || 'password123', // Default password for development
      name: user.name || 'New User',
      role: user.role || 'user',
      auth_method: user.auth_method || 'local',
      phone: user.phone || '',
      createdAt: new Date().toISOString()
    };

    // Add user to database
    this.users.push(newUser);

    this.logOperation('ADD_USER_SUCCESS', {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      totalUsers: this.users.length
    }, requestId);

    return newUser;
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

    // Always validate password - remove development mode bypass for secure authentication
    if (!password) {
      this.logOperation('VALIDATE_CREDENTIALS_PASSWORD_MISSING', { email: user.email }, requestId);
      return { valid: false, user: null, error: 'Password required' };
    }

    // Mock password validation (in real app, use bcrypt) - FIXED: Always validate
    const isValidPassword = password === 'password123'; // Mock validation
    if (!isValidPassword) {
      this.logOperation('VALIDATE_CREDENTIALS_INVALID_PASSWORD', {
        email: user.email,
        providedPassword: password,
        expectedPassword: 'password123',
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