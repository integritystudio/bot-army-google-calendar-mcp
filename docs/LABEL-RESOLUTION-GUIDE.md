# Label Resolution Guide (L6 Pattern)

## Overview

The L6 refactoring introduces dynamic label ID resolution, eliminating hardcoded account-specific label IDs (e.g., `Label_5`, `Label_18`) in Gmail scripts.

## Pattern

### Before (Hardcoded)
```javascript
import { createGmailClient } from './lib/gmail-client.mjs';

async function myScript() {
  const gmail = createGmailClient();
  const labelId = 'Label_7'; // Account-specific, breaks on other accounts
  const messages = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [labelId],
  });
}
```

### After (Dynamic Resolution)
```javascript
import { createGmailClient } from './lib/gmail-client.mjs';
import { buildLabelCache } from './lib/gmail-label-utils.mjs';

async function myScript() {
  const gmail = createGmailClient();

  try {
    const labelCache = await buildLabelCache(gmail);
    const labelId = labelCache.get('Events/Community'); // or your label name

    if (!labelId) {
      console.error('❌ Events/Community label not found');
      process.exit(1);
    }

    const messages = await gmail.users.messages.list({
      userId: 'me',
      labelIds: [labelId],
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}
```

## Steps to Refactor

1. **Add import** at top of file:
   ```javascript
   import { buildLabelCache } from './lib/gmail-label-utils.mjs';
   ```

2. **Build label cache** in your try block:
   ```javascript
   const labelCache = await buildLabelCache(gmail);
   ```

3. **Resolve label ID** by name instead of hardcoded value:
   ```javascript
   // Before:
   const labelId = 'Label_7';

   // After:
   const labelId = labelCache.get('Your/Label/Name');
   if (!labelId) {
     console.error('❌ Your/Label/Name not found');
     process.exit(1);
   }
   ```

4. **Handle multiple possible names** (if label name might vary):
   ```javascript
   const labelId = labelCache.get('Events/Workshops') ||
                   labelCache.get('Workshops');
   ```

## Available Label Resolution Functions

- **`buildLabelCache(gmail)`** - Fetch all labels once at startup
  - Returns: `Map<string, string>` of label names to IDs
  - Use: Fast lookups within same script execution

- **`resolveLabelId(gmail, labelName, labelCache)`** - Single label lookup with caching
  - Use: When you need a specific label
  - Cache miss triggers rebuild

- **`resolveLabelIds(gmail, labelNames)`** - Batch label resolution
  - Use: When resolving multiple labels at once
  - Returns: `Map<string, string>` of found labels

## Benefits

✅ **Portable** - Works across different Gmail accounts with different label hierarchies
✅ **Reliable** - Fails explicitly if label not found (instead of silently)
✅ **Maintainable** - No magic numbers, clear intent
✅ **Consistent** - Follows established pattern across scripts

## Examples

### Example 1: Single Label Resolution
```javascript
const labelCache = await buildLabelCache(gmail);
const communityId = labelCache.get('Events/Community');
```

### Example 2: Multiple Label Fallbacks
```javascript
const labelCache = await buildLabelCache(gmail);
const ccvId = labelCache.get('Events/Invitations/Community Services/Capital City Village') ||
              labelCache.get('Services/Capital City Village') ||
              labelCache.get('Capital City Village');
```

### Example 3: Batch Resolution
```javascript
import { resolveLabelIds } from './lib/gmail-label-utils.mjs';

const labelNames = ['Events/Community', 'Services/Important'];
const resolved = await resolveLabelIds(gmail, labelNames);

const communityId = resolved.get('Events/Community');
const importantId = resolved.get('Services/Important');
```

## Finding Your Label Names

To find the correct label names for your account:

1. **List all labels** in any refactored script:
   ```javascript
   const labelCache = await buildLabelCache(gmail);
   for (const [name, id] of labelCache) {
     console.log(`${name} → ${id}`);
   }
   ```

2. **Use Gmail UI** - See label hierarchy in Gmail settings

3. **Comment mapping** - Document the hardcoded ID with its name:
   ```javascript
   // Label_7 → Newsletters/Subject-Based
   ```

## Scripts Already Using L6

- ✅ `create-all-sublabels.mjs` - Dynamic resolution for workshop/community labels
- ✅ `analyze-community-events.mjs` - Events/Community label resolution

## Contributing

When refactoring new scripts:
1. Add buildLabelCache import
2. Document original label names in comments
3. Use fallback lookups if label name might vary
4. Test script works with the resolved label ID
5. Commit with `refactor(L6-extended):` prefix
