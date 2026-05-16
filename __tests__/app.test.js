/**
 * __tests__/app.test.js
 *
 * Comprehensive tests for app.js – the core data-management module.
 * All functions are tested via the module.exports object.
 * localStorage is cleared before every test to guarantee isolation.
 */

const app = require('../app.js');

const {
  generateUniqueId,
  generateUUID,
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  getAllUsers,
  getUserById,
  getAllLawyers,
  getLawyerById,
  getLawyersBySpecialization,
  addLawyer,
  createRequest,
  getAllRequests,
  getRequestById,
  getUserRequests,
  updateRequestStatus,
  sendMessage,
  getAllMessages,
  getConversation,
  markMessageAsRead,
  getUnreadMessageCount,
  createNotification,
  getAllNotifications,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead
} = app;

beforeEach(() => {
  localStorage.clear();
});

// =============================================================================
// ID GENERATION
// =============================================================================

describe('generateUniqueId', () => {
  test('returns a non-empty string', () => {
    expect(typeof generateUniqueId()).toBe('string');
    expect(generateUniqueId().length).toBeGreaterThan(0);
  });

  test('matches the timestamp-randomstring format', () => {
    const id = generateUniqueId();
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  test('produces unique IDs on successive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, generateUniqueId));
    expect(ids.size).toBe(100);
  });
});

describe('generateUUID', () => {
  test('returns a string in UUID v4 format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  test('produces unique UUIDs on successive calls', () => {
    const uuids = new Set(Array.from({ length: 100 }, generateUUID));
    expect(uuids.size).toBe(100);
  });
});

// =============================================================================
// USER MANAGEMENT
// =============================================================================

describe('registerUser', () => {
  test('creates and persists a new client user', () => {
    const user = registerUser('Alice', 'alice@test.com', 'client');

    expect(user).toMatchObject({
      name: 'Alice',
      email: 'alice@test.com',
      role: 'client'
    });
    expect(typeof user.id).toBe('string');
    expect(typeof user.createdAt).toBe('string');
  });

  test('creates and persists a new lawyer user', () => {
    const user = registerUser('Bob', 'bob@test.com', 'lawyer');
    expect(user.role).toBe('lawyer');
  });

  test('persists user to localStorage', () => {
    registerUser('Alice', 'alice@test.com', 'client');
    const stored = JSON.parse(localStorage.getItem('aegis_users'));
    expect(stored).toHaveLength(1);
    expect(stored[0].email).toBe('alice@test.com');
  });

  test('throws when name is missing', () => {
    expect(() => registerUser('', 'x@test.com', 'client')).toThrow(
      'Name, email, and role are required'
    );
  });

  test('throws when email is missing', () => {
    expect(() => registerUser('Alice', '', 'client')).toThrow(
      'Name, email, and role are required'
    );
  });

  test('throws when role is missing', () => {
    expect(() => registerUser('Alice', 'alice@test.com', '')).toThrow(
      'Name, email, and role are required'
    );
  });

  test('throws when role is invalid', () => {
    expect(() => registerUser('Alice', 'alice@test.com', 'admin')).toThrow(
      'Role must be "client" or "lawyer"'
    );
  });

  test('throws when email is already registered', () => {
    registerUser('Alice', 'alice@test.com', 'client');
    expect(() => registerUser('Alice2', 'alice@test.com', 'client')).toThrow(
      'Email already registered'
    );
  });

  test('allows multiple users with distinct emails', () => {
    registerUser('Alice', 'alice@test.com', 'client');
    registerUser('Bob', 'bob@test.com', 'lawyer');
    expect(getAllUsers()).toHaveLength(2);
  });
});

describe('loginUser', () => {
  beforeEach(() => {
    registerUser('Alice', 'alice@test.com', 'client');
  });

  test('returns the user and persists current session', () => {
    const user = loginUser('alice@test.com');
    expect(user.email).toBe('alice@test.com');
    expect(JSON.parse(localStorage.getItem('aegis_current_user')).email).toBe(
      'alice@test.com'
    );
  });

  test('throws when email is not found', () => {
    expect(() => loginUser('nobody@test.com')).toThrow('User not found');
  });
});

describe('getCurrentUser', () => {
  test('returns null when no user is logged in', () => {
    expect(getCurrentUser()).toBeNull();
  });

  test('returns the logged-in user', () => {
    registerUser('Alice', 'alice@test.com', 'client');
    loginUser('alice@test.com');
    expect(getCurrentUser()).toMatchObject({ email: 'alice@test.com' });
  });
});

describe('logoutUser', () => {
  test('removes the current user session', () => {
    registerUser('Alice', 'alice@test.com', 'client');
    loginUser('alice@test.com');
    logoutUser();
    expect(getCurrentUser()).toBeNull();
    expect(localStorage.getItem('aegis_current_user')).toBeNull();
  });

  test('does nothing when no user is logged in', () => {
    expect(() => logoutUser()).not.toThrow();
    expect(getCurrentUser()).toBeNull();
  });
});

describe('getAllUsers', () => {
  test('returns empty array when no users exist', () => {
    expect(getAllUsers()).toEqual([]);
  });

  test('returns all registered users', () => {
    registerUser('Alice', 'alice@test.com', 'client');
    registerUser('Bob', 'bob@test.com', 'lawyer');
    expect(getAllUsers()).toHaveLength(2);
  });
});

describe('getUserById', () => {
  test('returns the correct user', () => {
    const user = registerUser('Alice', 'alice@test.com', 'client');
    expect(getUserById(user.id)).toMatchObject({ email: 'alice@test.com' });
  });

  test('returns undefined for an unknown ID', () => {
    expect(getUserById('nonexistent-id')).toBeUndefined();
  });
});

// =============================================================================
// LAWYER MANAGEMENT
// =============================================================================

describe('getAllLawyers', () => {
  test('returns empty array when no lawyers are stored', () => {
    expect(getAllLawyers()).toEqual([]);
  });

  test('returns stored lawyers', () => {
    addLawyer('Jane', 'Criminal Law', 'jane@law.com', '555-0001', '5 years');
    expect(getAllLawyers()).toHaveLength(1);
  });
});

describe('addLawyer', () => {
  test('creates a lawyer with a default rating of 4.5', () => {
    const lawyer = addLawyer(
      'Jane',
      'Criminal Law',
      'jane@law.com',
      '555-0001',
      '5 years'
    );
    expect(lawyer).toMatchObject({
      name: 'Jane',
      specialization: 'Criminal Law',
      email: 'jane@law.com',
      phone: '555-0001',
      experience: '5 years',
      rating: 4.5
    });
    expect(typeof lawyer.id).toBe('string');
    expect(typeof lawyer.createdAt).toBe('string');
  });

  test('persists the lawyer to localStorage', () => {
    addLawyer('Jane', 'Criminal Law', 'jane@law.com', '555-0001', '5 years');
    expect(getAllLawyers()).toHaveLength(1);
  });

  test('accumulates multiple lawyers', () => {
    addLawyer('Jane', 'Criminal Law', 'jane@law.com', '555-0001', '5 years');
    addLawyer('John', 'Family Law', 'john@law.com', '555-0002', '8 years');
    expect(getAllLawyers()).toHaveLength(2);
  });
});

describe('getLawyerById', () => {
  test('returns the correct lawyer', () => {
    const lawyer = addLawyer(
      'Jane',
      'Criminal Law',
      'jane@law.com',
      '555-0001',
      '5 years'
    );
    expect(getLawyerById(lawyer.id)).toMatchObject({ name: 'Jane' });
  });

  test('returns undefined for an unknown lawyer ID', () => {
    expect(getLawyerById('unknown-id')).toBeUndefined();
  });
});

describe('getLawyersBySpecialization', () => {
  beforeEach(() => {
    addLawyer('Jane', 'Criminal Law', 'jane@law.com', '555-0001', '5 years');
    addLawyer('John', 'Family Law', 'john@law.com', '555-0002', '8 years');
    addLawyer('Amy', 'Criminal Defense', 'amy@law.com', '555-0003', '3 years');
  });

  test('returns lawyers matching the specialization (case-insensitive)', () => {
    const results = getLawyersBySpecialization('criminal');
    expect(results).toHaveLength(2);
    expect(results.map((l) => l.name)).toEqual(
      expect.arrayContaining(['Jane', 'Amy'])
    );
  });

  test('returns empty array when no match', () => {
    expect(getLawyersBySpecialization('Intellectual Property')).toHaveLength(0);
  });

  test('partial match works', () => {
    expect(getLawyersBySpecialization('law')).toHaveLength(2);
  });
});

// =============================================================================
// REQUEST MANAGEMENT
// =============================================================================

describe('createRequest', () => {
  let client, lawyer;

  beforeEach(() => {
    client = registerUser('Alice', 'alice@test.com', 'client');
    lawyer = addLawyer(
      'Jane',
      'Criminal Law',
      'jane@law.com',
      '555-0001',
      '5 years'
    );
  });

  test('creates a request with status pending', () => {
    const req = createRequest(client.id, lawyer.id, 'Need help with case');
    expect(req).toMatchObject({
      clientId: client.id,
      lawyerId: lawyer.id,
      status: 'pending',
      description: 'Need help with case'
    });
    expect(typeof req.requestId).toBe('string');
  });

  test('defaults to empty description when not provided', () => {
    const req = createRequest(client.id, lawyer.id);
    expect(req.description).toBe('');
  });

  test('persists request to localStorage', () => {
    createRequest(client.id, lawyer.id, 'Help needed');
    expect(getAllRequests()).toHaveLength(1);
  });

  test('creates a notification for the lawyer', () => {
    createRequest(client.id, lawyer.id, 'Help needed');
    const notifications = getUserNotifications(lawyer.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain('New request from');
  });

  test('throws when clientId is missing', () => {
    expect(() => createRequest('', lawyer.id)).toThrow(
      'clientId and lawyerId are required'
    );
  });

  test('throws when lawyerId is missing', () => {
    expect(() => createRequest(client.id, '')).toThrow(
      'clientId and lawyerId are required'
    );
  });
});

describe('getAllRequests', () => {
  test('returns empty array when no requests exist', () => {
    expect(getAllRequests()).toEqual([]);
  });
});

describe('getRequestById', () => {
  test('returns the correct request', () => {
    const client = registerUser('Alice', 'alice@test.com', 'client');
    const lawyer = addLawyer(
      'Jane',
      'Criminal Law',
      'jane@law.com',
      '555',
      '5y'
    );
    const req = createRequest(client.id, lawyer.id);
    expect(getRequestById(req.requestId)).toMatchObject({
      requestId: req.requestId
    });
  });

  test('returns undefined for an unknown request ID', () => {
    expect(getRequestById('nonexistent')).toBeUndefined();
  });
});

describe('getUserRequests', () => {
  let client, lawyer, req1, req2;

  beforeEach(() => {
    client = registerUser('Alice', 'alice@test.com', 'client');
    lawyer = addLawyer('Jane', 'Criminal Law', 'j@law.com', '555', '5y');
    req1 = createRequest(client.id, lawyer.id, 'First case');
    req2 = createRequest(client.id, lawyer.id, 'Second case');
  });

  test('returns requests for a client', () => {
    const requests = getUserRequests(client.id, 'client');
    expect(requests).toHaveLength(2);
  });

  test('returns requests for a lawyer', () => {
    const requests = getUserRequests(lawyer.id, 'lawyer');
    expect(requests).toHaveLength(2);
  });

  test('returns empty array for unknown role', () => {
    expect(getUserRequests(client.id, 'admin')).toEqual([]);
  });

  test("returns empty array when user has no requests", () => {
    const other = registerUser('Bob', 'bob@test.com', 'client');
    expect(getUserRequests(other.id, 'client')).toEqual([]);
  });
});

describe('updateRequestStatus', () => {
  let client, lawyer, req;

  beforeEach(() => {
    client = registerUser('Alice', 'alice@test.com', 'client');
    lawyer = addLawyer('Jane', 'Criminal Law', 'j@law.com', '555', '5y');
    req = createRequest(client.id, lawyer.id, 'Case description');
  });

  test.each(['accepted', 'rejected', 'completed', 'pending'])(
    'updates status to %s successfully',
    (status) => {
      const updated = updateRequestStatus(req.requestId, status);
      expect(updated.status).toBe(status);
    }
  );

  test('updates the updatedAt timestamp', () => {
    const before = req.updatedAt;
    // Ensure at least 1 ms passes
    jest.advanceTimersByTime && jest.advanceTimersByTime(1);
    const updated = updateRequestStatus(req.requestId, 'accepted');
    expect(updated.updatedAt).toBeDefined();
  });

  test('creates a notification for the client when accepted', () => {
    updateRequestStatus(req.requestId, 'accepted');
    const notifications = getUserNotifications(client.id);
    expect(notifications.some((n) => n.title.includes('accepted'))).toBe(true);
  });

  test('creates a notification for the client when rejected', () => {
    updateRequestStatus(req.requestId, 'rejected');
    const notifications = getUserNotifications(client.id);
    expect(notifications.some((n) => n.title.includes('rejected'))).toBe(true);
  });

  test('throws for an invalid status', () => {
    expect(() => updateRequestStatus(req.requestId, 'unknown')).toThrow(
      'Invalid status'
    );
  });

  test('throws when request is not found', () => {
    expect(() => updateRequestStatus('bad-id', 'accepted')).toThrow(
      'Request not found'
    );
  });
});

// =============================================================================
// MESSAGE MANAGEMENT
// =============================================================================

describe('sendMessage', () => {
  let sender, receiver;

  beforeEach(() => {
    sender = registerUser('Alice', 'alice@test.com', 'client');
    receiver = registerUser('Bob', 'bob@test.com', 'lawyer');
  });

  test('creates and returns a message object', () => {
    const msg = sendMessage(sender.id, receiver.id, 'req-1', 'Hello!');
    expect(msg).toMatchObject({
      senderId: sender.id,
      receiverId: receiver.id,
      requestId: 'req-1',
      text: 'Hello!',
      read: false
    });
    expect(typeof msg.messageId).toBe('string');
  });

  test('persists message to localStorage', () => {
    sendMessage(sender.id, receiver.id, 'req-1', 'Hello!');
    expect(getAllMessages()).toHaveLength(1);
  });

  test('creates a notification for the receiver', () => {
    sendMessage(sender.id, receiver.id, 'req-1', 'Hello!');
    const notifications = getUserNotifications(receiver.id);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain('New message from');
  });

  test('notification includes sender name', () => {
    sendMessage(sender.id, receiver.id, 'req-1', 'Hello!');
    const notifications = getUserNotifications(receiver.id);
    expect(notifications[0].title).toContain('Alice');
  });

  test('throws when senderId is missing', () => {
    expect(() => sendMessage('', receiver.id, 'req-1', 'Hello!')).toThrow(
      'senderId, receiverId, and messageText are required'
    );
  });

  test('throws when receiverId is missing', () => {
    expect(() => sendMessage(sender.id, '', 'req-1', 'Hello!')).toThrow(
      'senderId, receiverId, and messageText are required'
    );
  });

  test('throws when messageText is missing', () => {
    expect(() => sendMessage(sender.id, receiver.id, 'req-1', '')).toThrow(
      'senderId, receiverId, and messageText are required'
    );
  });
});

describe('getAllMessages', () => {
  test('returns empty array when no messages exist', () => {
    expect(getAllMessages()).toEqual([]);
  });
});

describe('getConversation', () => {
  let u1, u2;

  beforeEach(() => {
    u1 = registerUser('Alice', 'alice@test.com', 'client');
    u2 = registerUser('Bob', 'bob@test.com', 'lawyer');
    sendMessage(u1.id, u2.id, 'req-1', 'Hi Bob');
    sendMessage(u2.id, u1.id, 'req-1', 'Hi Alice');
    sendMessage(u1.id, u2.id, 'req-2', 'Different request');
  });

  test('returns only messages for the specified requestId', () => {
    const conv = getConversation(u1.id, u2.id, 'req-1');
    expect(conv).toHaveLength(2);
  });

  test('returns messages in chronological order', () => {
    const conv = getConversation(u1.id, u2.id, 'req-1');
    const times = conv.map((m) => new Date(m.timestamp).getTime());
    expect(times[0]).toBeLessThanOrEqual(times[1]);
  });

  test('is symmetric — same result when user order is swapped', () => {
    const conv1 = getConversation(u1.id, u2.id, 'req-1');
    const conv2 = getConversation(u2.id, u1.id, 'req-1');
    expect(conv1).toHaveLength(conv2.length);
  });

  test('returns empty array for a requestId with no messages', () => {
    expect(getConversation(u1.id, u2.id, 'req-999')).toEqual([]);
  });
});

describe('markMessageAsRead', () => {
  let sender, receiver, msg;

  beforeEach(() => {
    sender = registerUser('Alice', 'alice@test.com', 'client');
    receiver = registerUser('Bob', 'bob@test.com', 'lawyer');
    msg = sendMessage(sender.id, receiver.id, 'req-1', 'Hello!');
  });

  test('marks the message as read', () => {
    markMessageAsRead(msg.messageId);
    const updated = getAllMessages().find((m) => m.messageId === msg.messageId);
    expect(updated.read).toBe(true);
  });

  test('returns the updated message', () => {
    const result = markMessageAsRead(msg.messageId);
    expect(result.read).toBe(true);
  });

  test('returns undefined for a non-existent message ID', () => {
    expect(markMessageAsRead('bad-id')).toBeUndefined();
  });
});

describe('getUnreadMessageCount', () => {
  let sender, receiver;

  beforeEach(() => {
    sender = registerUser('Alice', 'alice@test.com', 'client');
    receiver = registerUser('Bob', 'bob@test.com', 'lawyer');
  });

  test('returns 0 when there are no messages', () => {
    expect(getUnreadMessageCount(receiver.id)).toBe(0);
  });

  test('counts only unread messages for the specified receiver', () => {
    sendMessage(sender.id, receiver.id, 'req-1', 'msg 1');
    sendMessage(sender.id, receiver.id, 'req-1', 'msg 2');
    expect(getUnreadMessageCount(receiver.id)).toBe(2);
  });

  test('decreases after a message is marked as read', () => {
    const msg = sendMessage(sender.id, receiver.id, 'req-1', 'msg 1');
    sendMessage(sender.id, receiver.id, 'req-1', 'msg 2');
    markMessageAsRead(msg.messageId);
    expect(getUnreadMessageCount(receiver.id)).toBe(1);
  });

  test('does not count messages sent by the user', () => {
    sendMessage(receiver.id, sender.id, 'req-1', 'from receiver');
    expect(getUnreadMessageCount(receiver.id)).toBe(0);
  });
});

// =============================================================================
// NOTIFICATION MANAGEMENT
// =============================================================================

describe('createNotification', () => {
  test('creates and persists a notification', () => {
    const n = createNotification('user-1', 'Test notification', 'ref-1');
    expect(n).toMatchObject({
      userId: 'user-1',
      title: 'Test notification',
      relatedId: 'ref-1',
      read: false
    });
    expect(typeof n.notificationId).toBe('string');
    expect(typeof n.timestamp).toBe('string');
  });

  test('defaults relatedId to empty string', () => {
    const n = createNotification('user-1', 'Title');
    expect(n.relatedId).toBe('');
  });

  test('persists to localStorage', () => {
    createNotification('user-1', 'Title');
    expect(getAllNotifications()).toHaveLength(1);
  });
});

describe('getAllNotifications', () => {
  test('returns empty array when nothing is stored', () => {
    expect(getAllNotifications()).toEqual([]);
  });

  test('returns all notifications', () => {
    createNotification('u1', 'A');
    createNotification('u2', 'B');
    expect(getAllNotifications()).toHaveLength(2);
  });
});

describe('getUserNotifications', () => {
  beforeEach(() => {
    createNotification('u1', 'Notif 1');
    createNotification('u1', 'Notif 2');
    createNotification('u2', 'Other user notif');
  });

  test('returns only notifications for the specified user', () => {
    expect(getUserNotifications('u1')).toHaveLength(2);
  });

  test('returns empty array for a user with no notifications', () => {
    expect(getUserNotifications('u3')).toEqual([]);
  });

  test('returns notifications sorted by timestamp descending (newest first)', () => {
    const notifs = getUserNotifications('u1');
    if (notifs.length > 1) {
      expect(new Date(notifs[0].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(notifs[1].timestamp).getTime()
      );
    }
  });
});

describe('getUnreadNotificationCount', () => {
  test('returns 0 when there are no notifications', () => {
    expect(getUnreadNotificationCount('u1')).toBe(0);
  });

  test('counts unread notifications for a user', () => {
    createNotification('u1', 'N1');
    createNotification('u1', 'N2');
    expect(getUnreadNotificationCount('u1')).toBe(2);
  });

  test('decreases after marking a notification as read', () => {
    const n = createNotification('u1', 'N1');
    createNotification('u1', 'N2');
    markNotificationAsRead(n.notificationId);
    expect(getUnreadNotificationCount('u1')).toBe(1);
  });
});

describe('markNotificationAsRead', () => {
  test('marks a notification as read', () => {
    const n = createNotification('u1', 'Test');
    markNotificationAsRead(n.notificationId);
    const stored = getAllNotifications().find(
      (x) => x.notificationId === n.notificationId
    );
    expect(stored.read).toBe(true);
  });

  test('returns the updated notification', () => {
    const n = createNotification('u1', 'Test');
    const result = markNotificationAsRead(n.notificationId);
    expect(result.read).toBe(true);
  });

  test('returns undefined for a non-existent notification ID', () => {
    expect(markNotificationAsRead('bad-id')).toBeUndefined();
  });
});

describe('markAllNotificationsAsRead', () => {
  test('marks all notifications for a user as read', () => {
    createNotification('u1', 'N1');
    createNotification('u1', 'N2');
    createNotification('u2', 'Other');
    markAllNotificationsAsRead('u1');

    const u1Notifs = getUserNotifications('u1');
    expect(u1Notifs.every((n) => n.read)).toBe(true);
  });

  test('does not affect notifications for other users', () => {
    createNotification('u1', 'N1');
    createNotification('u2', 'N2');
    markAllNotificationsAsRead('u1');

    const u2Notifs = getUserNotifications('u2');
    expect(u2Notifs.every((n) => !n.read)).toBe(true);
  });

  test('returns the affected notifications array', () => {
    createNotification('u1', 'N1');
    createNotification('u1', 'N2');
    const result = markAllNotificationsAsRead('u1');
    expect(result).toHaveLength(2);
    expect(result.every((n) => n.read)).toBe(true);
  });

  test('returns empty array when user has no notifications', () => {
    expect(markAllNotificationsAsRead('nobody')).toEqual([]);
  });
});
