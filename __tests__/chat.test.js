/**
 * __tests__/chat.test.js
 *
 * Comprehensive tests for chat.js – chat utilities.
 *
 * chat.js references functions from app.js as browser-script globals.
 * jest.setup.js already loads app.js and exposes those globals, so here
 * we only need to load chat.js after that setup has run.
 */

// chat.js is not required here directly because jest.setup.js has already
// loaded app.js into the global scope.  We require chat.js so its exports
// are available and its initialization code can find the globals it needs.
const chat = require('../chat.js');

const {
  sendChatMessageWrapper,
  getChatHistory,
  getUserUnreadMessages,
  markConversationAsRead,
  deleteMessage,
  searchMessages,
  getMessageStats,
  formatMessageTime
} = chat;

// Also pull the app functions from global so we can set up test fixtures.
const {
  registerUser,
  sendMessage,
  getAllMessages,
  markMessageAsRead
} = global;

beforeEach(() => {
  localStorage.clear();
});

// =============================================================================
// sendChatMessageWrapper
// =============================================================================

describe('sendChatMessageWrapper', () => {
  let sender, receiver;

  beforeEach(() => {
    sender = registerUser('Alice', 'alice@test.com', 'client');
    receiver = registerUser('Bob', 'bob@test.com', 'lawyer');
  });

  test('sends a message and returns the message object', () => {
    const msg = sendChatMessageWrapper(
      sender.id,
      receiver.id,
      'req-1',
      'Hello!'
    );
    expect(msg).toMatchObject({
      senderId: sender.id,
      receiverId: receiver.id,
      requestId: 'req-1',
      text: 'Hello!'
    });
  });

  test('throws when text is empty', () => {
    expect(() =>
      sendChatMessageWrapper(sender.id, receiver.id, 'req-1', '')
    ).toThrow('Message cannot be empty');
  });

  test('throws when text is only whitespace', () => {
    expect(() =>
      sendChatMessageWrapper(sender.id, receiver.id, 'req-1', '   ')
    ).toThrow('Message cannot be empty');
  });

  test('throws when text is null', () => {
    expect(() =>
      sendChatMessageWrapper(sender.id, receiver.id, 'req-1', null)
    ).toThrow();
  });

  test('persists message to localStorage', () => {
    sendChatMessageWrapper(sender.id, receiver.id, 'req-1', 'Hi');
    expect(getAllMessages()).toHaveLength(1);
  });
});

// =============================================================================
// getChatHistory
// =============================================================================

describe('getChatHistory', () => {
  let u1, u2;

  beforeEach(() => {
    u1 = registerUser('Alice', 'alice@test.com', 'client');
    u2 = registerUser('Bob', 'bob@test.com', 'lawyer');
    sendMessage(u1.id, u2.id, 'req-1', 'First');
    sendMessage(u2.id, u1.id, 'req-1', 'Second');
    sendMessage(u1.id, u2.id, 'req-2', 'Other');
  });

  test('returns the conversation for the given requestId', () => {
    const history = getChatHistory(u1.id, u2.id, 'req-1');
    expect(history).toHaveLength(2);
  });

  test('defaults requestId to empty string', () => {
    // No messages with requestId ''
    const history = getChatHistory(u1.id, u2.id);
    expect(history).toHaveLength(0);
  });

  test('returns empty array when there are no messages', () => {
    expect(getChatHistory('x', 'y', 'req-99')).toHaveLength(0);
  });
});

// =============================================================================
// getUserUnreadMessages
// =============================================================================

describe('getUserUnreadMessages', () => {
  let sender, receiver;

  beforeEach(() => {
    sender = registerUser('Alice', 'alice@test.com', 'client');
    receiver = registerUser('Bob', 'bob@test.com', 'lawyer');
  });

  test('returns empty array when no messages exist', () => {
    expect(getUserUnreadMessages(receiver.id)).toEqual([]);
  });

  test('returns unread messages for the receiver', () => {
    sendMessage(sender.id, receiver.id, 'req-1', 'msg1');
    sendMessage(sender.id, receiver.id, 'req-1', 'msg2');
    const unread = getUserUnreadMessages(receiver.id);
    expect(unread).toHaveLength(2);
    expect(unread.every((m) => !m.read)).toBe(true);
  });

  test('excludes read messages', () => {
    const msg = sendMessage(sender.id, receiver.id, 'req-1', 'msg1');
    sendMessage(sender.id, receiver.id, 'req-1', 'msg2');
    markMessageAsRead(msg.messageId);
    expect(getUserUnreadMessages(receiver.id)).toHaveLength(1);
  });

  test('excludes messages sent by the user (not received)', () => {
    sendMessage(receiver.id, sender.id, 'req-1', 'outgoing');
    expect(getUserUnreadMessages(receiver.id)).toHaveLength(0);
  });
});

// =============================================================================
// markConversationAsRead
// =============================================================================

describe('markConversationAsRead', () => {
  let u1, u2;

  beforeEach(() => {
    u1 = registerUser('Alice', 'alice@test.com', 'client');
    u2 = registerUser('Bob', 'bob@test.com', 'lawyer');
    sendMessage(u1.id, u2.id, 'req-1', 'Hi');
    sendMessage(u1.id, u2.id, 'req-1', 'How are you?');
  });

  test('marks all received messages as read for u2', () => {
    markConversationAsRead(u2.id, u1.id);
    const unread = getUserUnreadMessages(u2.id);
    expect(unread).toHaveLength(0);
  });

  test('returns the total number of conversation messages', () => {
    const count = markConversationAsRead(u2.id, u1.id);
    expect(count).toBe(2);
  });

  test('does not affect messages received by the other user', () => {
    sendMessage(u2.id, u1.id, 'req-1', 'Reply');
    markConversationAsRead(u2.id, u1.id);
    // u1 still has 1 unread (the reply from u2)
    expect(getUserUnreadMessages(u1.id)).toHaveLength(1);
  });

  test('returns 0 when there are no messages', () => {
    expect(markConversationAsRead('x', 'y')).toBe(0);
  });
});

// =============================================================================
// deleteMessage
// =============================================================================

describe('deleteMessage', () => {
  let sender, receiver, msg;

  beforeEach(() => {
    sender = registerUser('Alice', 'alice@test.com', 'client');
    receiver = registerUser('Bob', 'bob@test.com', 'lawyer');
    msg = sendMessage(sender.id, receiver.id, 'req-1', 'Delete me');
  });

  test('removes the message from localStorage', () => {
    deleteMessage(msg.messageId);
    const remaining = getAllMessages().find(
      (m) => m.messageId === msg.messageId
    );
    expect(remaining).toBeUndefined();
  });

  test('returns true', () => {
    expect(deleteMessage(msg.messageId)).toBe(true);
  });

  test('does not throw when deleting a non-existent message ID', () => {
    expect(() => deleteMessage('fake-id')).not.toThrow();
  });

  test('leaves other messages intact', () => {
    const msg2 = sendMessage(sender.id, receiver.id, 'req-1', 'Keep me');
    deleteMessage(msg.messageId);
    expect(getAllMessages()).toHaveLength(1);
    expect(getAllMessages()[0].messageId).toBe(msg2.messageId);
  });
});

// =============================================================================
// searchMessages
// =============================================================================

describe('searchMessages', () => {
  let u1, u2;

  beforeEach(() => {
    u1 = registerUser('Alice', 'alice@test.com', 'client');
    u2 = registerUser('Bob', 'bob@test.com', 'lawyer');
    sendMessage(u1.id, u2.id, 'req-1', 'Hello Bob');
    sendMessage(u2.id, u1.id, 'req-1', 'Hi Alice');
    sendMessage(u1.id, u2.id, 'req-1', 'How are you?');
  });

  test('returns messages containing the search term (case-insensitive)', () => {
    const results = searchMessages(u1.id, 'hello');
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('Hello Bob');
  });

  test('matches partial words', () => {
    const results = searchMessages(u1.id, 'how');
    expect(results).toHaveLength(1);
  });

  test('is case-insensitive', () => {
    expect(searchMessages(u1.id, 'HELLO')).toHaveLength(1);
    expect(searchMessages(u1.id, 'hello')).toHaveLength(1);
  });

  test('includes messages both sent and received by the user', () => {
    // "Hi Alice" was received by u1, "Hello Bob" and "How are you?" were sent
    const results = searchMessages(u1.id, 'alice');
    expect(results).toHaveLength(1);
    expect(results[0].text).toBe('Hi Alice');
  });

  test('returns empty array when no messages match', () => {
    expect(searchMessages(u1.id, 'zzznomatch')).toHaveLength(0);
  });
});

// =============================================================================
// getMessageStats
// =============================================================================

describe('getMessageStats', () => {
  let u1, u2;

  beforeEach(() => {
    u1 = registerUser('Alice', 'alice@test.com', 'client');
    u2 = registerUser('Bob', 'bob@test.com', 'lawyer');
    sendMessage(u1.id, u2.id, 'req-1', 'Sent 1');
    sendMessage(u1.id, u2.id, 'req-1', 'Sent 2');
    sendMessage(u2.id, u1.id, 'req-1', 'Received 1');
  });

  test('returns correct totalMessages count', () => {
    expect(getMessageStats(u1.id).totalMessages).toBe(3);
  });

  test('returns correct sentMessages count', () => {
    expect(getMessageStats(u1.id).sentMessages).toBe(2);
  });

  test('returns correct receivedMessages count', () => {
    expect(getMessageStats(u1.id).receivedMessages).toBe(1);
  });

  test('returns correct unreadMessages count', () => {
    // u1 received 1 message which is unread
    expect(getMessageStats(u1.id).unreadMessages).toBe(1);
  });

  test('returns zeros for a user with no messages', () => {
    const other = registerUser('Carol', 'carol@test.com', 'client');
    const stats = getMessageStats(other.id);
    expect(stats).toEqual({
      totalMessages: 0,
      sentMessages: 0,
      receivedMessages: 0,
      unreadMessages: 0
    });
  });
});

// =============================================================================
// formatMessageTime
// =============================================================================

describe('formatMessageTime', () => {
  let realDateNow;

  beforeAll(() => {
    realDateNow = Date.now;
  });

  afterAll(() => {
    Date.now = realDateNow;
  });

  function freezeNow(fakeNow) {
    Date.now = () => fakeNow;
  }

  test('returns "Just now" for timestamps less than 1 minute ago', () => {
    const now = Date.now();
    freezeNow(now);
    const ts = new Date(now - 30 * 1000).toISOString(); // 30 seconds ago
    expect(formatMessageTime(ts)).toBe('Just now');
  });

  test('returns minutes ago for timestamps 1–59 minutes ago', () => {
    const now = Date.now();
    freezeNow(now);
    const ts = new Date(now - 5 * 60 * 1000).toISOString(); // 5 minutes ago
    expect(formatMessageTime(ts)).toBe('5m ago');
  });

  test('returns hours ago for timestamps 1–23 hours ago', () => {
    const now = Date.now();
    freezeNow(now);
    const ts = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago
    expect(formatMessageTime(ts)).toBe('3h ago');
  });

  test('returns days ago for timestamps 1–6 days ago', () => {
    const now = Date.now();
    freezeNow(now);
    const ts = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    expect(formatMessageTime(ts)).toBe('2d ago');
  });

  test('returns locale date string for timestamps 7+ days ago', () => {
    const now = Date.now();
    freezeNow(now);
    const oldDate = new Date(now - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const ts = oldDate.toISOString();
    expect(formatMessageTime(ts)).toBe(oldDate.toLocaleDateString());
  });
});

// =============================================================================
// renderMessage
// =============================================================================

describe('renderMessage', () => {
  const { renderMessage } = chat;

  function makeMessage(overrides = {}) {
    return {
      messageId: 'msg-1',
      senderId: 'user-a',
      receiverId: 'user-b',
      text: 'Test message',
      timestamp: new Date().toISOString(),
      read: false,
      ...overrides
    };
  }

  test('returns a DOM element', () => {
    const el = renderMessage(makeMessage(), 'user-a');
    expect(el).toBeInstanceOf(HTMLElement);
  });

  test('applies "sent" class when current user is the sender', () => {
    const el = renderMessage(makeMessage({ senderId: 'user-a' }), 'user-a');
    expect(el.className).toContain('sent');
  });

  test('does not apply "sent" class when current user is the receiver', () => {
    const el = renderMessage(makeMessage({ senderId: 'user-b' }), 'user-a');
    expect(el.className).not.toContain('sent');
  });

  test('message bubble contains the message text', () => {
    const el = renderMessage(makeMessage({ text: 'Hello world' }), 'user-a');
    expect(el.textContent).toContain('Hello world');
  });

  test('message time element is rendered', () => {
    const el = renderMessage(makeMessage(), 'user-a');
    const timeEl = el.querySelector('.message-time');
    expect(timeEl).not.toBeNull();
  });
});

// =============================================================================
// startChatAutoRefresh / stopChatAutoRefresh
// =============================================================================

describe('startChatAutoRefresh / stopChatAutoRefresh', () => {
  const { startChatAutoRefresh, stopChatAutoRefresh } = chat;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    stopChatAutoRefresh();
    jest.useRealTimers();
  });

  test('calls the load function at the specified interval', () => {
    const mockLoad = jest.fn();
    startChatAutoRefresh(mockLoad, 1000);
    jest.advanceTimersByTime(3000);
    expect(mockLoad).toHaveBeenCalledTimes(3);
  });

  test('stops calling the load function after stopChatAutoRefresh', () => {
    const mockLoad = jest.fn();
    startChatAutoRefresh(mockLoad, 1000);
    jest.advanceTimersByTime(2000);
    stopChatAutoRefresh();
    jest.advanceTimersByTime(3000);
    expect(mockLoad).toHaveBeenCalledTimes(2);
  });

  test('clears previous interval when startChatAutoRefresh is called again', () => {
    const mockLoad1 = jest.fn();
    const mockLoad2 = jest.fn();
    startChatAutoRefresh(mockLoad1, 1000);
    startChatAutoRefresh(mockLoad2, 1000);
    jest.advanceTimersByTime(3000);
    // Only the second handler should have been called
    expect(mockLoad1).not.toHaveBeenCalled();
    expect(mockLoad2).toHaveBeenCalledTimes(3);
  });

  test('stopChatAutoRefresh is safe to call when no interval is active', () => {
    expect(() => stopChatAutoRefresh()).not.toThrow();
  });
});
