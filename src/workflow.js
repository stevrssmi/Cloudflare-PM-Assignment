import { WorkflowEntrypoint } from 'cloudflare:workers';

/**
 * Feedback Notification Workflow
 * Analyzes urgency and sends real-time Slack notifications for critical feedback
 */
export class FeedbackNotificationWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const { feedbackId, message, source, author, sentiment } = event.payload;

    // Step 1: Analyze urgency with AI
    const urgency = await step.do('analyze-urgency', async () => {
      return await this.analyzeUrgency(message, sentiment);
    });

    // Step 2: If urgent, send Slack notification
    if (urgency.level === 'CRITICAL' || urgency.level === 'HIGH') {
      await step.do('send-slack-notification', async () => {
        return await this.sendSlackNotification({
          feedbackId,
          message,
          source,
          author,
          sentiment,
          urgency
        });
      });
    }

    return {
      success: true,
      urgency: urgency.level,
      notified: urgency.level === 'CRITICAL' || urgency.level === 'HIGH'
    };
  }

  /**
   * Analyze urgency using Workers AI
   */
  async analyzeUrgency(message, sentiment) {
    try {
      const prompt = `Analyze this customer feedback for urgency. Classify as CRITICAL, HIGH, or NORMAL.

CRITICAL = Security issues, complete service failures, data loss, payment errors, legal threats
HIGH = Major bugs, broken features, workflow blockers, angry customers
NORMAL = Feature requests, minor bugs, general feedback

Feedback: "${message}"
Sentiment: ${sentiment}

Respond ONLY with JSON: {"level": "CRITICAL|HIGH|NORMAL", "confidence": 0.0-1.0, "reason": "brief explanation", "category": "issue type"}`;

      const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are an urgency classifier. Return only valid JSON with no markdown.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Parse AI response
      const responseText = response.response?.trim() || '{}';
      const cleanedResponse = responseText.replace(/```json\n?|```\n?/g, '').trim();
      const analysis = JSON.parse(cleanedResponse);

      return {
        level: analysis.level || 'NORMAL',
        confidence: analysis.confidence || 0.5,
        reason: analysis.reason || 'No specific reason provided',
        category: analysis.category || 'General'
      };
    } catch (error) {
      console.error('Error analyzing urgency:', error);
      // Default to NORMAL on error, unless sentiment is very negative
      return {
        level: sentiment === 'negative' ? 'HIGH' : 'NORMAL',
        confidence: 0.5,
        reason: 'Fallback classification based on sentiment',
        category: 'General'
      };
    }
  }

  /**
   * Send Slack notification
   */
  async sendSlackNotification(data) {
    const { feedbackId, message, source, author, sentiment, urgency } = data;

    // Get Slack webhook URL from environment (we'll add this later)
    const webhookUrl = this.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn('Slack webhook URL not configured');
      return { success: false, reason: 'No webhook configured' };
    }

    // Format Slack message
    const slackMessage = this.formatSlackMessage({
      feedbackId,
      message,
      source,
      author,
      sentiment,
      urgency
    });

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackMessage)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      throw error; // Workflow will retry
    }
  }

  /**
   * Format message for Slack with rich formatting
   */
  formatSlackMessage({ feedbackId, message, source, author, sentiment, urgency }) {
    const urgencyEmoji = {
      'CRITICAL': '🚨',
      'HIGH': '⚠️',
      'NORMAL': 'ℹ️'
    };

    const sentimentEmoji = {
      'positive': '😊',
      'negative': '😡',
      'neutral': '😐'
    };

    const urgencyColor = {
      'CRITICAL': '#FF0000',
      'HIGH': '#FF6633',
      'NORMAL': '#36A64F'
    };

    const title = urgency.level === 'CRITICAL' 
      ? '🚨 URGENT FEEDBACK - Immediate Attention Required'
      : '⚠️ High Priority Feedback';

    return {
      text: `${urgencyEmoji[urgency.level]} ${urgency.level} Priority Feedback Received`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: title,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${urgency.level}`
            },
            {
              type: 'mrkdwn',
              text: `*Source:*\n${source}`
            },
            {
              type: 'mrkdwn',
              text: `*Sentiment:*\n${sentimentEmoji[sentiment]} ${sentiment}`
            },
            {
              type: 'mrkdwn',
              text: `*Time:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|Just now>`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Issue Category:* ${urgency.category}\n*Author:* ${author || 'Anonymous'}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n> ${message}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*AI Analysis:*\n• Urgency: *${urgency.level}* (${Math.round(urgency.confidence * 100)}% confidence)\n• Reason: ${urgency.reason}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '🔍 View Similar Feedback',
                emoji: true
              },
              url: `${this.env.WORKER_URL || 'http://localhost:8787'}/api/similar-feedback?id=${feedbackId}`,
              style: 'primary'
            }
          ]
        }
      ],
      attachments: [
        {
          color: urgencyColor[urgency.level],
          footer: 'Powered by Cloudflare Workers AI + Workflows',
          footer_icon: 'https://cloudflare.com/favicon.ico',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }
}
