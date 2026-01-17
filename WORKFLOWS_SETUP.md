# Cloudflare Workflows Setup Guide

## 🌊 What We Built

An **AI-powered urgency detection system** that automatically notifies your Slack channel when critical feedback arrives!

### Features:
- ✅ **AI Urgency Classification** - Workers AI analyzes each feedback for urgency
- ✅ **Real-time Slack Notifications** - Instant alerts for critical issues  
- ✅ **Durable Execution** - Guaranteed delivery with automatic retries
- ✅ **Rich Formatting** - Beautiful Slack messages with colors and buttons

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Slack Webhook

1. Go to https://api.slack.com/messaging/webhooks
2. Click **"Create New App"** → **"From scratch"**
3. Name it "Feedback Alerts" and choose your workspace
4. Click **"Incoming Webhooks"** in the sidebar
5. Toggle **"Activate Incoming Webhooks"** to ON
6. Click **"Add New Webhook to Workspace"**
7. Choose a channel (e.g., `#feedback` or `#urgent-feedback`)
8. **Copy the webhook URL**

### Step 2: Configure Your Worker

```bash
npx wrangler secret put SLACK_WEBHOOK_URL
```

Paste your webhook URL when prompted.

### Step 3: Deploy

```bash
npm run deploy
```

Done! 🎉

---

## 🧪 Testing

1. Open your dashboard
2. Go to **"🔔 Slack Notification Configuration"**
3. Click **"🚨 Test CRITICAL Alert"**
4. Check Slack - you should get a notification!

---

## 📊 How It Works

```
Feedback → AI Urgency Analysis → If CRITICAL/HIGH → Slack Notification
```

**Urgency Levels:**
- 🚨 **CRITICAL**: Service outages, security issues, data loss
- ⚠️ **HIGH**: Major bugs, broken features, angry customers
- ℹ️ **NORMAL**: Feature requests, minor bugs (no notification)

---

## ✅ Success Checklist

- [ ] Slack webhook created
- [ ] Secret set via `wrangler secret put SLACK_WEBHOOK_URL`
- [ ] Worker deployed
- [ ] Test notification sent and received

---

You now have 4 Cloudflare products working together! 🚀
