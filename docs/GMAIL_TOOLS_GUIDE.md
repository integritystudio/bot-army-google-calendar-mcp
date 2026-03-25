# Gmail MCP Tools Guide

## Overview
Three comprehensive Gmail tools are now available in the MCP server for searching, reading, and modifying email messages.

---

## Available Tools

### Overview
Five comprehensive Gmail tools for searching, managing, organizing, and automating email workflows.

---

### 1. `gmail-search-messages`
Search and retrieve Gmail messages with flexible query support.

**Parameters:**
- `query` (required, string): Gmail search query
  - Examples: `is:unread`, `from:user@example.com`, `subject:hello`, `has:attachment`
  - Can combine: `is:unread AND from:work@company.com`
- `maxResults` (optional, 1-100): Number of messages to return (default: 10)
- `pageToken` (optional, string): Token for pagination to get next batch

**Response:**
```json
{
  "total": 201,
  "returned": 10,
  "messages": [
    {
      "id": "msg_id_123",
      "threadId": "thread_id_456",
      "snippet": "Message preview text...",
      "subject": "Email Subject",
      "from": "sender@example.com",
      "date": "2026-03-23T10:30:00Z"
    }
  ],
  "nextPageToken": "CAIQAA..."
}
```

**Common Queries:**
- `is:unread` - All unread messages
- `from:user@example.com` - From specific sender
- `subject:keyword` - Messages with keyword in subject
- `has:attachment` - Messages with attachments
- `is:starred` - Starred messages
- `label:work` - Messages with label
- `before:2026-03-20` - Messages before date
- `after:2026-03-20` - Messages after date

---

### 2. `gmail-get-profile`
Get summary information about the Gmail account.

**Parameters:** None

**Response:**
```json
{
  "emailAddress": "user@gmail.com",
  "messagesTotal": 5432,
  "threadsTotal": 2156,
  "historyId": "67890"
}
```

**Use Cases:**
- Quick account overview
- Check total message count
- Verify authenticated email

---

### 3. `gmail-modify-messages`
Modify Gmail messages in batch: mark read/unread, archive, delete, manage labels.

**Parameters:**
- `messageIds` (required, array): Array of message IDs (at least 1)
- `action` (required, enum): Action to perform
  - `markRead` - Mark messages as read
  - `markUnread` - Mark messages as unread
  - `archive` - Move to archive (remove from inbox)
  - `delete` - Permanently delete messages
  - `addLabel` - Add a label (requires labelId)
  - `removeLabel` - Remove a label (requires labelId)
- `labelId` (optional, string): Gmail label ID (required for label operations)

**Response:**
```json
{
  "action": "markRead",
  "processed": 5,
  "failed": 0,
  "messages": [
    {
      "id": "msg_id_1",
      "action": "marked as read",
      "success": true
    },
    {
      "id": "msg_id_2",
      "action": "marked as read",
      "success": true
    }
  ]
}
```

**Action Details:**

#### Mark as Read
```
action: "markRead"
messageIds: ["id1", "id2", "id3"]
```
- Removes UNREAD label
- Message no longer appears in unread count

#### Mark as Unread
```
action: "markUnread"
messageIds: ["id1", "id2"]
```
- Adds UNREAD label
- Appears in unread messages again

#### Archive
```
action: "archive"
messageIds: ["id1", "id2"]
```
- Removes from INBOX
- Still searchable and in All Mail
- No longer appears in inbox

#### Delete
```
action: "delete"
messageIds: ["id1", "id2"]
```
- Permanently deletes messages
- Messages moved to Trash (can be recovered briefly)
- Eventually purged from Google servers

#### Add Label
```
action: "addLabel"
messageIds: ["id1", "id2"]
labelId: "Label_123"  // Required!
```
- Applies label to messages
- Messages can have multiple labels
- Use gmail-get-labels to find label IDs (if available)

#### Remove Label
```
action: "removeLabel"
messageIds: ["id1", "id2"]
labelId: "Label_123"  // Required!
```
- Removes label from messages
- Does not delete message
- Message still exists with other labels

---

### 4. `gmail-create-label`
Create new Gmail labels for organizing and categorizing emails.

**Parameters:**
- `name` (required, string): Label name
  - Examples: "Work", "Personal", "Invoices", "Follow Up"
  - Cannot contain special characters
- `labelListVisibility` (optional, enum): Show/hide in label list
  - `labelShow` - Visible in label list (default)
  - `labelHide` - Hidden from label list
- `messageListVisibility` (optional, enum): Show/hide in message list
  - `show` - Appears when message has label (default)
  - `hide` - Hidden from message list

**Response:**
```json
{
  "success": true,
  "label": {
    "id": "Label_1234567890",
    "name": "Work",
    "messageCount": 0,
    "threadCount": 0,
    "labelListVisibility": "labelShow",
    "messageListVisibility": "show"
  },
  "message": "Label \"Work\" created successfully"
}
```

**Use Cases:**
- Create organizational labels (Work, Personal, Invoices, etc.)
- Create workflow labels (TODO, Follow Up, Waiting For, etc.)
- Create category labels (Receipts, Contracts, etc.)

**Error Handling:**
```json
{
  "success": false,
  "error": "Label \"Work\" already exists",
  "suggestion": "Use a different name or try to find the existing label"
}
```

---

### 5. `gmail-create-filter`
Create filters to automatically organize incoming emails based on matching criteria.

**Parameters:**
- `criteria` (required, object): Matching conditions
  - `from` (optional, string): Filter emails from specific sender
  - `to` (optional, string): Filter emails to specific recipient
  - `subject` (optional, string): Filter by subject line
  - `query` (optional, string): Gmail search query
  - `hasAttachment` (optional, boolean): Only emails with attachments
  - `excludeChats` (optional, boolean): Exclude chat messages

- `action` (required, object): Actions to apply
  - `addLabelIds` (optional, array): Labels to automatically add
  - `removeLabelIds` (optional, array): Labels to automatically remove
  - `archive` (optional, boolean): Auto-archive matching emails
  - `markAsRead` (optional, boolean): Auto-mark as read
  - `markAsSpam` (optional, boolean): Auto-mark as spam
  - `markAsTrash` (optional, boolean): Auto-move to trash
  - `forward` (optional, string): Forward to email address
  - `neverMarkAsSpam` (optional, boolean): Never mark as spam

**Response:**
```json
{
  "success": true,
  "filter": {
    "id": "AAAAAAA",
    "criteria": {
      "from": "newsletter@example.com"
    },
    "action": {
      "addLabelIds": ["Label_123"],
      "skip": true
    }
  },
  "message": "Filter created successfully",
  "summary": "Filter: IF (from: newsletter@example.com) THEN archive, add 1 label(s)"
}
```

**Filter Examples:**

#### Newsletter Auto-Archive
```json
{
  "criteria": {
    "from": "newsletter@example.com"
  },
  "action": {
    "archive": true
  }
}
```
- All emails from newsletter automatically archived
- Won't appear in inbox

#### Invoice Auto-Label and Archive
```json
{
  "criteria": {
    "subject": "invoice"
  },
  "action": {
    "addLabelIds": ["Label_Invoices"],
    "archive": true
  }
}
```
- Emails with "invoice" in subject get labeled
- Automatically archived from inbox

#### Work Email Auto-Organization
```json
{
  "criteria": {
    "from": "work@company.com"
  },
  "action": {
    "addLabelIds": ["Label_Work"],
    "markAsRead": false
  }
}
```
- Auto-label work emails
- Keeps them unread for attention

#### Spam Prevention Filter
```json
{
  "criteria": {
    "from": "spam@example.com"
  },
  "action": {
    "markAsSpam": true
  }
}
```
- Automatically mark as spam
- Train Gmail's spam filter

#### Forward Receipts
```json
{
  "criteria": {
    "subject": "receipt"
  },
  "action": {
    "forward": "accounting@company.com",
    "addLabelIds": ["Label_Receipts"]
  }
}
```
- Forward receipts to accounting
- Keep copy with label

#### Attachment Auto-Organize
```json
{
  "criteria": {
    "hasAttachment": true,
    "from": "clients@external.com"
  },
  "action": {
    "addLabelIds": ["Label_ClientDocuments"]
  }
}
```
- Auto-label emails with attachments from clients
- Easy to find important documents

---

## Common Workflows

### 1. Mark All Unread Emails as Read
```
1. gmail-search-messages: query="is:unread", maxResults=100
2. gmail-modify-messages: action="markRead", messageIds=[... all unread ids ...]
```

### 2. Archive Promotional Emails
```
1. gmail-search-messages: query="from:marketing@company.com", maxResults=50
2. gmail-modify-messages: action="archive", messageIds=[... matching ids ...]
```

### 3. Organize Emails with Labels
```
1. gmail-search-messages: query="subject:invoice AND is:unread"
2. gmail-modify-messages: action="addLabel", messageIds=[...], labelId="Label_Invoices"
3. gmail-modify-messages: action="markRead", messageIds=[...]
```

### 4. Clean Up Old Spam
```
1. gmail-search-messages: query="from:spam@example.com before:2026-01-01", maxResults=100
2. gmail-modify-messages: action="delete", messageIds=[... old spam ids ...]
```

### 5. Get Account Summary
```
gmail-get-profile
# Returns: email, total messages, total threads
```

---

## Gmail Label IDs

Standard Gmail labels use predefined IDs:
- `INBOX` - Inbox
- `SENT` - Sent Mail
- `DRAFT` - Drafts
- `UNREAD` - Unread messages
- `STARRED` - Starred messages
- `TRASH` - Trash/Bin
- `SPAM` - Spam

Custom labels have unique IDs starting with `Label_` (e.g., `Label_1234567890`)

To find custom label IDs, you would typically need a separate `gmail-get-labels` tool (future enhancement).

---

## Error Handling

### Missing Required Parameters
```json
{
  "error": "labelId required for addLabel action"
}
```

### Invalid Message IDs
```json
{
  "id": "invalid_id",
  "action": "markRead",
  "success": false,
  "error": "Not Found"
}
```

### Batch Partial Failures
```json
{
  "action": "delete",
  "processed": 3,
  "failed": 1,
  "messages": [
    { "id": "id1", "success": true },
    { "id": "id2", "success": true },
    { "id": "id3", "success": false, "error": "Not Found" }
  ]
}
```

---

## Permissions & Security

**OAuth Scopes Required:**
- `gmail.readonly` - For search and profile operations
- `gmail.modify` - For modification operations (marking, archiving, deleting, labels)

**Important Notes:**
- Operations are performed on authenticated user's account
- Cannot modify emails in other users' accounts
- Deleted emails are recoverable from Trash for ~30 days
- Modifications are logged in Gmail audit trail
- Batch operations are atomic per message (one fails doesn't stop others)

---

## Rate Limiting

Gmail API has rate limits:
- 250 quota units per user per second
- Each message operation: ~1 unit
- Search operations: ~1-5 units depending on query complexity
- Profile: ~1 unit

Batch operations are recommended to stay within limits (modify many messages in one call vs many separate calls).

---

## Future Enhancements

Potential additional tools:
- `gmail-get-labels` - List available labels and their IDs
- `gmail-get-labels-for-message` - Get labels on a specific message
- `gmail-get-message` - Get full message content (headers, body, attachments)
- `gmail-send-message` - Send/compose emails
- `gmail-create-draft` - Create draft messages
- `gmail-get-attachment` - Download attachments
- `gmail-delete-filter` - Delete existing filters
- `gmail-list-filters` - List all active filters
- `gmail-delete-label` - Delete labels
- `gmail-update-label` - Update label properties
- `gmail-get-labels` - List all labels with IDs

---

## Examples

### Example 1: Mark Work Emails as Read
```typescript
// Search for unread work emails
const search = await mcp.callTool('gmail-search-messages', {
  query: 'is:unread from:work@company.com',
  maxResults: 50
});

// Mark them as read
const modify = await mcp.callTool('gmail-modify-messages', {
  action: 'markRead',
  messageIds: search.messages.map(m => m.id)
});

console.log(`Marked ${modify.processed} emails as read`);
```

### Example 2: Archive Old Emails
```typescript
// Find old emails
const search = await mcp.callTool('gmail-search-messages', {
  query: 'before:2026-01-01',
  maxResults: 100
});

// Archive them
const modify = await mcp.callTool('gmail-modify-messages', {
  action: 'archive',
  messageIds: search.messages.map(m => m.id)
});

console.log(`Archived ${modify.processed} old emails`);
```

### Example 3: Add Label to Important Emails
```typescript
// Find important emails
const search = await mcp.callTool('gmail-search-messages', {
  query: 'is:starred',
  maxResults: 50
});

// Add label
const modify = await mcp.callTool('gmail-modify-messages', {
  action: 'addLabel',
  messageIds: search.messages.map(m => m.id),
  labelId: 'Label_Important' // Or appropriate label ID
});

console.log(`Added label to ${modify.processed} emails`);
```

### Example 4: Create Label for Organization
```typescript
// Create a new label
const label = await mcp.callTool('gmail-create-label', {
  name: 'ClientProjects',
  labelListVisibility: 'labelShow',
  messageListVisibility: 'show'
});

console.log(`Created label: ${label.label.name} (ID: ${label.label.id})`);

// Now use the label ID for organizing emails
const messages = await mcp.callTool('gmail-search-messages', {
  query: 'from:client@external.com',
  maxResults: 50
});

await mcp.callTool('gmail-modify-messages', {
  action: 'addLabel',
  messageIds: messages.messages.map(m => m.id),
  labelId: label.label.id
});
```

### Example 5: Create Auto-Organization Filter
```typescript
// Create filter for newsletters (auto-archive)
const filter1 = await mcp.callTool('gmail-create-filter', {
  criteria: {
    from: 'newsletter@example.com'
  },
  action: {
    archive: true
  }
});
console.log(filter1.summary);
// Output: "Filter: IF (from: newsletter@example.com) THEN archive"

// Create filter for invoices (auto-label and archive)
const filter2 = await mcp.callTool('gmail-create-filter', {
  criteria: {
    subject: 'invoice'
  },
  action: {
    addLabelIds: ['Label_Invoices'],
    archive: true,
    markAsRead: true
  }
});
console.log(filter2.summary);
// Output: "Filter: IF (subject: invoice) THEN archive, mark as read, add 1 label(s)"
```

### Example 6: Complete Email Organization Setup
```typescript
// Step 1: Create labels
const workLabel = await mcp.callTool('gmail-create-label', {
  name: 'Work',
  labelListVisibility: 'labelShow'
});

const invoiceLabel = await mcp.callTool('gmail-create-label', {
  name: 'Invoices',
  labelListVisibility: 'labelShow'
});

// Step 2: Create filters
await mcp.callTool('gmail-create-filter', {
  criteria: { from: 'work@company.com' },
  action: { addLabelIds: [workLabel.label.id] }
});

await mcp.callTool('gmail-create-filter', {
  criteria: { subject: 'invoice' },
  action: {
    addLabelIds: [invoiceLabel.label.id],
    archive: true
  }
});

// Step 3: Organize existing emails
const workEmails = await mcp.callTool('gmail-search-messages', {
  query: 'from:work@company.com',
  maxResults: 100
});

await mcp.callTool('gmail-modify-messages', {
  action: 'addLabel',
  messageIds: workEmails.messages.map(m => m.id),
  labelId: workLabel.label.id
});

console.log('Email organization setup complete!');
```

---

## Troubleshooting

**Issue:** "Insufficient Permission" error
- **Solution:** Ensure gmail.modify scope is in OAuth authentication

**Issue:** "Not Found" errors for message IDs
- **Solution:** Message IDs may have expired; get fresh list from search

**Issue:** labelId not found
- **Solution:** Verify label exists; use standard label IDs (INBOX, UNREAD, etc.) or create custom labels in Gmail first

**Issue:** Batch operation very slow
- **Solution:** Reduce batch size; Gmail API may throttle very large operations

---

## Related Documentation
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Gmail Search Operators](https://support.google.com/mail/answer/7190)
- [Gmail Labels](https://support.google.com/mail/answer/6078)
- [CLAUDE.md](../CLAUDE.md) - Project guidelines
- [README.md](../README.md) - MCP server overview
