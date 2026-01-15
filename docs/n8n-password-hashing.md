# Password Hashing Implementation Guide for n8n Workflow

This guide explains how to modify your n8n workflow to hash passwords using SHA-256 with salt instead of storing them in plain text.

## Overview

You need to modify:

1. **Set New Password flow** - Hash password before storing
2. **Login flow** - Verify password against stored hash

No external packages required - uses built-in `crypto` API.

---

## Step-by-Step Modifications

### 1. Add "Hash New Password" Code Node

**Position:** Between "Validate Token for Password" (true branch) and "Update Password"

**Code:**
```javascript
const password = $('Webhook').item.json.body.newPassword;

// Generate random salt
const saltArray = new Uint8Array(16);
crypto.getRandomValues(saltArray);
const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');

// SHA-256 hash with salt
const encoder = new TextEncoder();
const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(salt + password));
const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

return {
  id: $json.id,
  password_hash: `${salt}:${hash}`
};
```

### 2. Modify "Update Password" Node

Change the column mapping from:
```javascript
"password": "={{ $('Webhook').item.json.body.newPassword }}"
```

To:
```javascript
"password": "={{ $json.password_hash }}"
```

---

### 3. Replace "Verify Credentials" with Code Node

**Position:** After "Find User by Email", replace the existing IF node

**Code:**
```javascript
const user = $json;
const inputPassword = $('Webhook').item.json.body.password;

// Check if user exists
if (!user.id || !user.password) {
  return { valid: false, user: null };
}

// Parse stored hash (format: salt:hash)
const [salt, storedHash] = user.password.split(':');

if (!salt || !storedHash) {
  return { valid: false, user: null };
}

// Hash input password with same salt
const encoder = new TextEncoder();
const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(salt + inputPassword));
const inputHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

// Compare hashes
const valid = storedHash === inputHash;

return {
  valid: valid,
  user: valid ? {
    id: user.id,
    email: user.email,
    name: user.name,
    customer_number: user.customer_number,
    is_manager: user.is_manager
  } : null
};
```

### 4. Add IF Node After "Verify Password Hash"

**Condition:**
```
{{ $json.valid }} equals true
```

- **True branch:** Connect to "Generate Token"
- **False branch:** Connect to "Login Failed"

### 5. Update "Generate Token" Node

Change references from `$json` to `$json.user`:
```javascript
return {
  token: `${$json.user.email.split('@')[0]}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
  email: $json.user.email,
  name: $json.user.name,
  id: $json.user.id
};
```

---

## Workflow Diagrams

### Login Flow
```
[Find User by Email]
        |
        v
[Verify Password Hash] (Code node)
        |
        v
    [IF valid?]
     |       |
     v       v
[Generate  [Login
 Token]    Failed]
```

### Set New Password Flow
```
[Validate Token for Password]
        | (true)
        v
[Hash New Password] (Code node)
        |
        v
[Update Password]
        |
        v
[Respond Success]
```

---

## Testing

1. Set a new password via reset flow
2. Check database - should see: `a1b2c3...:e5f6g7...` (32 char salt : 64 char hash)
3. Login with correct password - should succeed
4. Login with wrong password - should fail
