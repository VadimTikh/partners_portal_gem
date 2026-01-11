# n8n Forgot Password Flow Setup

## Overview

This document explains how to set up the forgot password flow in your n8n workflow.

## SendGrid Credentials

### Where to Put SendGrid API Key

The SendGrid API key should be stored in the `CONSTANTS` node in your n8n workflow.

**Current location in workflow:** Look for the node named `CONSTANTS` (around position [-3984, 416])

Update the CONSTANTS node's JavaScript code to include your SendGrid API key:

```javascript
const ODOO = {
  api: {
    prod: {
      // ... existing ODOO config
    }
  }
}

const SEND_GRID = {
  api_key: "YOUR_SENDGRID_API_KEY_HERE"
}

return { ODOO, SEND_GRID }
```

### Alternative: Environment Variables (Recommended)

For better security, use n8n credentials or environment variables:

1. Go to n8n Settings > Credentials
2. Create a new "HTTP Header Auth" credential named "SendGrid API"
3. Set Header Name: `Authorization`
4. Set Header Value: `Bearer YOUR_SENDGRID_API_KEY`

## Required Workflow Changes

### 1. Update Route by Action Switch

Add two new outputs to the `Route by Action` switch node:

**Output: `verify-reset-token`**
```
Condition: $json.query.action equals "verify-reset-token"
```

**Output: `set-new-password`**
```
Condition: $json.query.action equals "set-new-password"
```

### 2. Add New Nodes for Reset Password Flow

#### Node: "Find User for Reset" (Postgres)
```json
{
  "name": "Find User for Reset",
  "type": "n8n-nodes-base.postgres",
  "parameters": {
    "operation": "select",
    "schema": { "__rl": true, "mode": "list", "value": "public" },
    "table": {
      "__rl": true,
      "value": "miomente_partner_portal_users",
      "mode": "list"
    },
    "where": {
      "values": [
        {
          "column": "email",
          "value": "={{ $('Webhook').first().json.body.email }}"
        }
      ]
    }
  },
  "credentials": {
    "postgres": { "id": "0Wh8S0Mv7yF5IDfG", "name": "Supabase Postgres" }
  }
}
```

#### Node: "Generate Reset Token" (Code)
```javascript
const crypto = require('crypto');

const email = $('Webhook').item.json.body.email;
const token = crypto.randomBytes(32).toString('hex');
const expires = new Date(Date.now() + 3600000); // 1 hour

return {
  email: $json.email,
  name: $json.name,
  id: $json.id,
  reset_token: token,
  reset_token_expires: expires.toISOString()
};
```

#### Node: "Save Reset Token" (Postgres)
```json
{
  "name": "Save Reset Token",
  "type": "n8n-nodes-base.postgres",
  "parameters": {
    "operation": "update",
    "schema": { "__rl": true, "mode": "list", "value": "public" },
    "table": {
      "__rl": true,
      "value": "miomente_partner_portal_users",
      "mode": "list"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "reset_token": "={{ $json.reset_token }}",
        "reset_token_expires": "={{ $json.reset_token_expires }}"
      },
      "matchingColumns": ["id"]
    }
  }
}
```

#### Node: "Send Reset Email" (HTTP Request to SendGrid)
```json
{
  "name": "Send Reset Email",
  "type": "n8n-nodes-base.httpRequest",
  "parameters": {
    "method": "POST",
    "url": "https://api.sendgrid.com/v3/mail/send",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "Bearer {{ $('CONSTANTS').item.json.SEND_GRID.api_key }}" },
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"personalizations\": [{\n    \"to\": [{ \"email\": \"{{ $json.email }}\" }],\n    \"subject\": \"Reset Your Password - Miomente Partner Portal\"\n  }],\n  \"from\": {\n    \"email\": \"noreply@miomente.de\",\n    \"name\": \"Miomente Partner Portal\"\n  },\n  \"content\": [{\n    \"type\": \"text/html\",\n    \"value\": \"<h2>Password Reset Request</h2><p>Hello {{ $json.name }},</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href='https://partners.miomente.de/reset-password?token={{ $json.reset_token }}'>Reset Password</a></p><p>This link will expire in 1 hour.</p><p>If you didn't request this, please ignore this email.</p><p>Best regards,<br>Miomente Team</p>\"\n  }]\n}"
  }
}
```

#### Node: "Reset Password Success Response" (Respond to Webhook)
```json
{
  "name": "Reset Password Success Response",
  "type": "n8n-nodes-base.respondToWebhook",
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: true, message: 'If an account exists with this email, a reset link has been sent.' }) }}"
  }
}
```

### 3. Add Nodes for Verify Reset Token Action

#### Node: "Find User by Reset Token" (Postgres)
```json
{
  "name": "Find User by Reset Token",
  "type": "n8n-nodes-base.postgres",
  "parameters": {
    "operation": "select",
    "schema": { "__rl": true, "mode": "list", "value": "public" },
    "table": {
      "__rl": true,
      "value": "miomente_partner_portal_users",
      "mode": "list"
    },
    "where": {
      "values": [
        {
          "column": "reset_token",
          "value": "={{ $('Webhook').first().json.body.token }}"
        }
      ]
    }
  }
}
```

#### Node: "Check Token Valid" (IF)
```
Conditions (AND):
1. $json.id exists (string exists)
2. $json.reset_token_expires > $now (token not expired)
```

#### Node: "Token Valid Response" (Respond to Webhook)
```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ valid: true, email: $json.email }) }}"
  }
}
```

#### Node: "Token Invalid Response" (Respond to Webhook)
```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ valid: false, message: 'Invalid or expired reset token' }) }}",
    "options": { "responseCode": 400 }
  }
}
```

### 4. Add Nodes for Set New Password Action

#### Node: "Find User for Password Update" (Postgres)
Same as "Find User by Reset Token"

#### Node: "Validate Token for Password" (IF)
Same conditions as "Check Token Valid"

#### Node: "Update Password" (Postgres)
```json
{
  "name": "Update Password",
  "type": "n8n-nodes-base.postgres",
  "parameters": {
    "operation": "update",
    "schema": { "__rl": true, "mode": "list", "value": "public" },
    "table": {
      "__rl": true,
      "value": "miomente_partner_portal_users",
      "mode": "list"
    },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "password": "={{ $('Webhook').item.json.body.newPassword }}",
        "reset_token": null,
        "reset_token_expires": null
      },
      "matchingColumns": ["id"]
    }
  }
}
```

#### Node: "Password Updated Response" (Respond to Webhook)
```json
{
  "parameters": {
    "respondWith": "json",
    "responseBody": "={{ JSON.stringify({ success: true, message: 'Password updated successfully' }) }}"
  }
}
```

## Flow Connections

### Reset Password Request Flow
```
Route by Action [reset-password]
  → Find User for Reset
  → IF (user exists?)
    → [true] Generate Reset Token
      → Save Reset Token
      → Send Reset Email
      → Reset Password Success Response
    → [false] Reset Password Success Response (same generic message for security)
```

### Verify Reset Token Flow
```
Route by Action [verify-reset-token]
  → Find User by Reset Token
  → Check Token Valid (IF)
    → [true] Token Valid Response
    → [false] Token Invalid Response
```

### Set New Password Flow
```
Route by Action [set-new-password]
  → Find User for Password Update
  → Validate Token for Password (IF)
    → [true] Update Password → Password Updated Response
    → [false] Token Invalid Response
```

## Email Template Customization

Update the email template in the "Send Reset Email" node:
- Change `from.email` to your verified SendGrid sender email
- Change the reset URL domain: `https://partners.miomente.de/reset-password?token=...`
- Customize the HTML content as needed

## Testing

1. Request a password reset with a valid email
2. Check the email is received (check SendGrid activity if not)
3. Click the reset link
4. Verify the token validation works
5. Set a new password
6. Verify you can log in with the new password
