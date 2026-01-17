var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/workflow.js
import { WorkflowEntrypoint } from "cloudflare:workers";
var FeedbackNotificationWorkflow = class extends WorkflowEntrypoint {
  static {
    __name(this, "FeedbackNotificationWorkflow");
  }
  async run(event, step) {
    const { feedbackId, message, source, author, sentiment } = event.payload;
    const urgency = await step.do("analyze-urgency", async () => {
      return await this.analyzeUrgency(message, sentiment);
    });
    if (urgency.level === "CRITICAL" || urgency.level === "HIGH") {
      await step.do("send-slack-notification", async () => {
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
      notified: urgency.level === "CRITICAL" || urgency.level === "HIGH"
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
      const response = await this.env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: [
          {
            role: "system",
            content: "You are an urgency classifier. Return only valid JSON with no markdown."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });
      const responseText = response.response?.trim() || "{}";
      const cleanedResponse = responseText.replace(/```json\n?|```\n?/g, "").trim();
      const analysis = JSON.parse(cleanedResponse);
      return {
        level: analysis.level || "NORMAL",
        confidence: analysis.confidence || 0.5,
        reason: analysis.reason || "No specific reason provided",
        category: analysis.category || "General"
      };
    } catch (error) {
      console.error("Error analyzing urgency:", error);
      return {
        level: sentiment === "negative" ? "HIGH" : "NORMAL",
        confidence: 0.5,
        reason: "Fallback classification based on sentiment",
        category: "General"
      };
    }
  }
  /**
   * Send Slack notification
   */
  async sendSlackNotification(data) {
    const { feedbackId, message, source, author, sentiment, urgency } = data;
    const webhookUrl = this.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("Slack webhook URL not configured");
      return { success: false, reason: "No webhook configured" };
    }
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackMessage)
      });
      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status}`);
      }
      return {
        success: true,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      console.error("Error sending Slack notification:", error);
      throw error;
    }
  }
  /**
   * Format message for Slack with rich formatting
   */
  formatSlackMessage({ feedbackId, message, source, author, sentiment, urgency }) {
    const urgencyEmoji = {
      "CRITICAL": "\u{1F6A8}",
      "HIGH": "\u26A0\uFE0F",
      "NORMAL": "\u2139\uFE0F"
    };
    const sentimentEmoji = {
      "positive": "\u{1F60A}",
      "negative": "\u{1F621}",
      "neutral": "\u{1F610}"
    };
    const urgencyColor = {
      "CRITICAL": "#FF0000",
      "HIGH": "#FF6633",
      "NORMAL": "#36A64F"
    };
    const title = urgency.level === "CRITICAL" ? "\u{1F6A8} URGENT FEEDBACK - Immediate Attention Required" : "\u26A0\uFE0F High Priority Feedback";
    return {
      text: `${urgencyEmoji[urgency.level]} ${urgency.level} Priority Feedback Received`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: title,
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Severity:*
${urgency.level}`
            },
            {
              type: "mrkdwn",
              text: `*Source:*
${source}`
            },
            {
              type: "mrkdwn",
              text: `*Sentiment:*
${sentimentEmoji[sentiment]} ${sentiment}`
            },
            {
              type: "mrkdwn",
              text: `*Time:*
<!date^${Math.floor(Date.now() / 1e3)}^{date_short_pretty} at {time}|Just now>`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Issue Category:* ${urgency.category}
*Author:* ${author || "Anonymous"}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Message:*
> ${message}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*AI Analysis:*
\u2022 Urgency: *${urgency.level}* (${Math.round(urgency.confidence * 100)}% confidence)
\u2022 Reason: ${urgency.reason}`
          }
        },
        {
          type: "divider"
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "\u{1F50D} View Similar Feedback",
                emoji: true
              },
              url: `${this.env.WORKER_URL || "http://localhost:8787"}/api/similar-feedback?id=${feedbackId}`,
              style: "primary"
            }
          ]
        }
      ],
      attachments: [
        {
          color: urgencyColor[urgency.level],
          footer: "Powered by Cloudflare Workers AI + Workflows",
          footer_icon: "https://cloudflare.com/favicon.ico",
          ts: Math.floor(Date.now() / 1e3)
        }
      ]
    };
  }
};

// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === "/api/feedback" && request.method === "POST") {
      return handlePostFeedback(request, env, corsHeaders);
    }
    if (url.pathname === "/api/feedback" && request.method === "GET") {
      return handleGetFeedback(env, corsHeaders);
    }
    if (url.pathname === "/api/analyze-features" && request.method === "GET") {
      return handleFeatureAnalysis(env, corsHeaders);
    }
    if (url.pathname === "/api/similar-feedback" && request.method === "GET") {
      return handleSimilarFeedback(url, env, corsHeaders);
    }
    if (url.pathname === "/api/backfill-embeddings" && request.method === "POST") {
      return handleBackfillEmbeddings(env, corsHeaders);
    }
    if (url.pathname === "/") {
      return handleDashboard(corsHeaders);
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};
async function handlePostFeedback(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { source, message, author, category } = body;
    if (!source || !message) {
      return new Response(
        JSON.stringify({ error: "source and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const sentiment = await analyzeSentiment(message, env);
    const result = await env.DB.prepare(
      `INSERT INTO feedback (source, message, sentiment, category, author) 
       VALUES (?, ?, ?, ?, ?)`
    ).bind(source, message, sentiment, category || null, author || null).run();
    const feedbackId = result.meta.last_row_id;
    try {
      const embedding = await generateEmbedding(message, env);
      await env.VECTORIZE.insert([
        {
          id: feedbackId.toString(),
          values: embedding,
          metadata: {
            source,
            sentiment,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          }
        }
      ]);
    } catch (error) {
      console.error("Error storing embedding:", error);
    }
    try {
      const instance = await env.FEEDBACK_WORKFLOW.create({
        params: {
          feedbackId,
          message,
          source,
          author: author || "Anonymous",
          sentiment
        }
      });
      console.log("Workflow triggered:", instance.id);
    } catch (error) {
      console.error("Error triggering workflow:", error);
    }
    return new Response(
      JSON.stringify({
        success: true,
        id: feedbackId,
        sentiment
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error posting feedback:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create feedback", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handlePostFeedback, "handlePostFeedback");
async function handleGetFeedback(env, corsHeaders) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM feedback ORDER BY timestamp DESC`
    ).all();
    const stats = await getStats(env);
    return new Response(
      JSON.stringify({ feedback: results, stats }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error getting feedback:", error);
    return new Response(
      JSON.stringify({ error: "Failed to retrieve feedback", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleGetFeedback, "handleGetFeedback");
async function analyzeSentiment(message, env) {
  try {
    const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        {
          role: "system",
          content: 'You are a sentiment analyzer. Analyze the sentiment of the following text and respond with ONLY one word: "positive", "negative", or "neutral". No explanation needed.'
        },
        {
          role: "user",
          content: message
        }
      ]
    });
    const sentiment = response.response?.toLowerCase().trim() || "neutral";
    if (sentiment.includes("positive")) return "positive";
    if (sentiment.includes("negative")) return "negative";
    return "neutral";
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return "neutral";
  }
}
__name(analyzeSentiment, "analyzeSentiment");
async function generateEmbedding(text, env) {
  try {
    const response = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
      text: [text]
    });
    return response.data[0];
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}
__name(generateEmbedding, "generateEmbedding");
async function getStats(env) {
  try {
    const { results: sourceStats } = await env.DB.prepare(
      `SELECT source, COUNT(*) as count FROM feedback GROUP BY source`
    ).all();
    const { results: sentimentStats } = await env.DB.prepare(
      `SELECT sentiment, COUNT(*) as count FROM feedback GROUP BY sentiment`
    ).all();
    const { results: totalResult } = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM feedback`
    ).all();
    return {
      bySource: sourceStats,
      bySentiment: sentimentStats,
      total: totalResult[0]?.total || 0
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return { bySource: [], bySentiment: [], total: 0 };
  }
}
__name(getStats, "getStats");
async function handleSimilarFeedback(url, env, corsHeaders) {
  try {
    const feedbackId = url.searchParams.get("id");
    if (!feedbackId) {
      return new Response(
        JSON.stringify({ error: "id parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { results } = await env.DB.prepare(
      "SELECT * FROM feedback WHERE id = ?"
    ).bind(feedbackId).all();
    if (results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Feedback not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const originalFeedback = results[0];
    const embedding = await generateEmbedding(originalFeedback.message, env);
    const similarVectors = await env.VECTORIZE.query(embedding, {
      topK: 6,
      // Get 6 results (including itself)
      returnValues: false,
      returnMetadata: true
    });
    const similarIds = similarVectors.matches.filter((match) => match.id !== feedbackId && match.score >= 0.6).slice(0, 5).map((match) => match.id);
    if (similarIds.length === 0) {
      return new Response(
        JSON.stringify({
          original: originalFeedback,
          similar: [],
          message: "No similar feedback found (minimum 60% similarity required)"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const placeholders = similarIds.map(() => "?").join(",");
    const { results: similarFeedback } = await env.DB.prepare(
      `SELECT * FROM feedback WHERE id IN (${placeholders})`
    ).bind(...similarIds).all();
    return new Response(
      JSON.stringify({
        original: originalFeedback,
        similar: similarFeedback,
        scores: similarVectors.matches.filter((match) => match.id !== feedbackId && match.score >= 0.6).slice(0, 5).map((match) => ({
          id: match.id,
          score: match.score
        }))
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error finding similar feedback:", error);
    return new Response(
      JSON.stringify({ error: "Failed to find similar feedback", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleSimilarFeedback, "handleSimilarFeedback");
async function handleBackfillEmbeddings(env, corsHeaders) {
  try {
    const { results: allFeedback } = await env.DB.prepare(
      "SELECT id, message, source, sentiment FROM feedback ORDER BY id"
    ).all();
    if (!allFeedback || allFeedback.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No feedback to backfill",
          processed: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let processed = 0;
    let errors = 0;
    const batchSize = 5;
    for (let i = 0; i < allFeedback.length; i += batchSize) {
      const batch = allFeedback.slice(i, i + batchSize);
      const batchPromises = batch.map(async (feedback) => {
        try {
          const embedding = await generateEmbedding(feedback.message, env);
          await env.VECTORIZE.insert([
            {
              id: feedback.id.toString(),
              values: embedding,
              metadata: {
                source: feedback.source,
                sentiment: feedback.sentiment,
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              }
            }
          ]);
          processed++;
          return { id: feedback.id, success: true };
        } catch (error) {
          console.error(`Error processing feedback ${feedback.id}:`, error);
          errors++;
          return { id: feedback.id, success: false, error: error.message };
        }
      });
      await Promise.all(batchPromises);
    }
    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill complete: ${processed} embeddings created, ${errors} errors`,
        processed,
        errors,
        total: allFeedback.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in backfill:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleBackfillEmbeddings, "handleBackfillEmbeddings");
async function handleFeatureAnalysis(env, corsHeaders) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT message, sentiment FROM feedback`
    ).all();
    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({
          bestFeatures: [],
          worstFeatures: [],
          message: "No feedback available for analysis"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const positiveFeedback = results.filter((f) => f.sentiment === "positive").map((f) => f.message);
    const negativeFeedback = results.filter((f) => f.sentiment === "negative").map((f) => f.message);
    const bestFeatures = await extractFeatures(positiveFeedback, "positive", env);
    const worstFeatures = await extractFeatures(negativeFeedback, "negative", env);
    return new Response(
      JSON.stringify({
        bestFeatures,
        worstFeatures,
        analyzedCount: results.length,
        positiveCount: positiveFeedback.length,
        negativeCount: negativeFeedback.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("Error analyzing features:", error);
    return new Response(
      JSON.stringify({ error: "Failed to analyze features", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleFeatureAnalysis, "handleFeatureAnalysis");
async function extractFeatures(feedbackList, sentimentType, env) {
  if (feedbackList.length === 0) return [];
  try {
    const combinedFeedback = feedbackList.slice(0, 20).join("\n- ");
    const prompt = sentimentType === "positive" ? `Analyze the following positive customer feedback and extract the TOP 3 most praised features, products, or aspects. Return ONLY a JSON array of objects with "feature" and "mentions" (count) fields. Feedback:
- ${combinedFeedback}` : `Analyze the following negative customer feedback and extract the TOP 3 most criticized features, products, or aspects. Return ONLY a JSON array of objects with "feature" and "mentions" (count) fields. Feedback:
- ${combinedFeedback}`;
    const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [
        {
          role: "system",
          content: 'You are a feature extraction expert. Analyze customer feedback and identify specific features, products, or aspects mentioned. Return ONLY valid JSON array format with no markdown or explanation. Each object must have "feature" (string) and "mentions" (number) fields.'
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });
    let features = [];
    try {
      const responseText = response.response?.trim() || "[]";
      const cleanedResponse = responseText.replace(/```json\n?|```\n?/g, "").trim();
      features = JSON.parse(cleanedResponse);
      if (!Array.isArray(features)) {
        features = [];
      }
      features = features.filter((f) => f.feature && typeof f.feature === "string").map((f) => ({
        feature: f.feature,
        mentions: typeof f.mentions === "number" ? f.mentions : 1
      })).slice(0, 3);
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
      features = extractKeywords(feedbackList, sentimentType);
    }
    return features;
  } catch (error) {
    console.error("Error extracting features:", error);
    return [];
  }
}
__name(extractFeatures, "extractFeatures");
function extractKeywords(feedbackList, sentimentType) {
  const keywords = {};
  const commonWords = /* @__PURE__ */ new Set(["the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they", "my", "your", "his", "her", "its", "our", "their", "me", "him", "them", "us", "so", "than", "too", "very", "just", "can", "to", "of", "in", "for", "on", "with", "as", "by", "at", "from"]);
  feedbackList.forEach((feedback) => {
    const words = feedback.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    words.forEach((word) => {
      if (!commonWords.has(word)) {
        keywords[word] = (keywords[word] || 0) + 1;
      }
    });
  });
  return Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([feature, mentions]) => ({ feature, mentions }));
}
__name(extractKeywords, "extractKeywords");
function handleDashboard(corsHeaders) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 10px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .subtitle {
            text-align: center;
            color: #FF6633;
            font-size: 1.1em;
            margin-bottom: 30px;
            font-weight: 500;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
            border-top: 4px solid #FF6633;
        }
        
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 6px 12px rgba(255,102,51,0.3);
        }
        
        .stat-label {
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        
        .stat-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #FF6633;
        }
        
        .section {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #FF6633;
        }
        
        .source-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        
        .source-card {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #FF6633;
        }
        
        .source-name {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        
        .source-count {
            color: #FF6633;
            font-size: 1.5em;
            font-weight: bold;
        }
        
        .sentiment-bars {
            margin-top: 20px;
        }
        
        .sentiment-bar {
            margin-bottom: 15px;
        }
        
        .sentiment-label {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-weight: 500;
        }
        
        .bar-container {
            height: 30px;
            background: #e9ecef;
            border-radius: 15px;
            overflow: hidden;
        }
        
        .bar-fill {
            height: 100%;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            padding-left: 10px;
            color: white;
            font-weight: bold;
        }
        
        .bar-fill.positive { background: linear-gradient(90deg, #48bb78, #38a169); }
        .bar-fill.negative { background: linear-gradient(90deg, #f56565, #e53e3e); }
        .bar-fill.neutral { background: linear-gradient(90deg, #a0aec0, #718096); }
        
        .feedback-list {
            margin-top: 20px;
        }
        
        .feedback-item {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #cbd5e0;
        }
        
        .feedback-item.positive { border-left-color: #48bb78; }
        .feedback-item.negative { border-left-color: #f56565; }
        .feedback-item.neutral { border-left-color: #a0aec0; }
        
        .feedback-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 0.85em;
            color: #666;
        }
        
        .feedback-message {
            color: #333;
            line-height: 1.5;
        }
        
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .badge.positive { background: #c6f6d5; color: #22543d; }
        .badge.negative { background: #fed7d7; color: #742a2a; }
        .badge.neutral { background: #e2e8f0; color: #2d3748; }
        
        .loading {
            text-align: center;
            padding: 40px;
            color: #666;
            font-size: 1.2em;
        }
        
        .error {
            background: #fed7d7;
            color: #742a2a;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .test-form {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #333;
        }
        
        input, select, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #cbd5e0;
            border-radius: 6px;
            font-size: 1em;
        }
        
        textarea {
            resize: vertical;
            min-height: 100px;
        }
        
        button {
            background: #FF6633;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 1em;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }
        
        button:hover {
            background: #E55A2B;
        }
        
        button:disabled {
            background: #cbd5e0;
            cursor: not-allowed;
        }
        
        .feature-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .feature-item {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: transform 0.2s;
        }
        
        .feature-item:hover {
            transform: translateX(5px);
        }
        
        .feature-item.best {
            border-left: 4px solid #48bb78;
        }
        
        .feature-item.worst {
            border-left: 4px solid #f56565;
        }
        
        .feature-name {
            font-weight: 500;
            color: #333;
            flex: 1;
        }
        
        .feature-mentions {
            background: #FF6633;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
        }
        
        .feedback-item {
            cursor: pointer;
        }
        
        .feedback-item:hover {
            background: #e9ecef !important;
        }
        
        .modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            animation: fadeIn 0.2s;
        }
        
        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-content {
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 800px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            animation: slideUp 0.3s;
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #FF6633;
        }
        
        .modal-close {
            background: #e2e8f0;
            border: none;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1.2em;
            line-height: 1;
        }
        
        .modal-close:hover {
            background: #cbd5e0;
        }
        
        .similar-item {
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #FF6633;
        }
        
        .similarity-score {
            display: inline-block;
            background: #FF6633;
            color: white;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: bold;
            margin-left: 10px;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(50px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>\u{1F4CA} Feedback Analytics</h1>
        <div class="subtitle">Powered by Cloudflare Workers AI + Vectorize</div>
        
        <div id="error" class="error" style="display: none;"></div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Feedback</div>
                <div class="stat-value" id="totalCount">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Positive</div>
                <div class="stat-value" style="color: #48bb78;" id="positiveCount">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Negative</div>
                <div class="stat-value" style="color: #f56565;" id="negativeCount">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Neutral</div>
                <div class="stat-value" style="color: #a0aec0;" id="neutralCount">-</div>
            </div>
        </div>
        
        <div class="section">
            <h2>\u{1F9EA} Test Feedback Submission</h2>
            <form class="test-form" id="testForm">
                <div class="form-group">
                    <label for="source">Source</label>
                    <select id="source" required>
                        <option value="Discord">Discord</option>
                        <option value="Support">Support</option>
                        <option value="GitHub">GitHub</option>
                        <option value="Reddit">Reddit</option>
                        <option value="X">X (Twitter)</option>
                        <option value="Email">Email</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="message">Message</label>
                    <textarea id="message" required placeholder="Enter feedback message..."></textarea>
                </div>
                <div class="form-group">
                    <label for="author">Author (optional)</label>
                    <input type="text" id="author" placeholder="Username or email">
                </div>
                <button type="submit" id="submitBtn">Submit Feedback</button>
            </form>
        </div>
        
        <div class="section">
            <h2>\u{1F514} Slack Notification Configuration</h2>
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #FF6633;">
                <strong>\u2139\uFE0F Setup Instructions:</strong>
                <ol style="margin: 10px 0 0 20px; line-height: 1.8;">
                    <li>Go to <a href="https://api.slack.com/messaging/webhooks" target="_blank" style="color: #FF6633;">Slack Webhooks</a></li>
                    <li>Create a new incoming webhook</li>
                    <li>Choose a channel (e.g., #feedback or #urgent-feedback)</li>
                    <li>Copy the webhook URL</li>
                    <li>Run: <code style="background: #f4f4f4; padding: 2px 6px; border-radius: 3px;">npx wrangler secret put SLACK_WEBHOOK_URL</code></li>
                    <li>Paste your webhook URL when prompted</li>
                </ol>
            </div>
            <div class="test-form">
                <h3 style="margin-bottom: 15px; color: #333;">Test Urgent Notifications</h3>
                <p style="color: #666; margin-bottom: 15px; font-size: 0.9em;">
                    Submit feedback below to test Slack notifications. The AI will analyze urgency and notify your Slack channel if it's CRITICAL or HIGH priority.
                </p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                    <button onclick="testUrgentFeedback('critical')" style="background: #FF0000;">\u{1F6A8} Test CRITICAL Alert</button>
                    <button onclick="testUrgentFeedback('high')" style="background: #FF6633;">\u26A0\uFE0F Test HIGH Priority</button>
                </div>
                <div id="slackTestResult" style="margin-top: 15px; padding: 10px; border-radius: 6px; display: none;"></div>
            </div>
        </div>
        
        <div class="section">
            <h2>\u{1F4C8} Sentiment Distribution</h2>
            <div class="sentiment-bars" id="sentimentBars">
                <div class="loading">Loading...</div>
            </div>
        </div>
        
        <div class="section">
            <h2>\u{1F310} Feedback by Source</h2>
            <div class="source-grid" id="sourceGrid">
                <div class="loading">Loading...</div>
            </div>
        </div>
        
        <div class="section">
            <h2>\u{1F3C6} Feature Analysis (AI-Powered)</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                <div>
                    <h3 style="color: #48bb78; margin-bottom: 15px; font-size: 1.2em;">\u2728 Best Performing Features</h3>
                    <div id="bestFeatures" class="feature-list">
                        <div class="loading">Analyzing...</div>
                    </div>
                </div>
                <div>
                    <h3 style="color: #f56565; margin-bottom: 15px; font-size: 1.2em;">\u26A0\uFE0F Worst Performing Features</h3>
                    <div id="worstFeatures" class="feature-list">
                        <div class="loading">Analyzing...</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>\u{1F4AC} Recent Feedback</h2>
            <p style="color: #666; margin-bottom: 15px; font-size: 0.9em;">\u{1F4A1} Click on any feedback to find similar items using AI-powered semantic search</p>
            <div class="feedback-list" id="feedbackList">
                <div class="loading">Loading...</div>
            </div>
        </div>
    </div>
    
    <!-- Similar Feedback Modal -->
    <div id="similarModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>\u{1F50D} Similar Feedback</h2>
                <button class="modal-close" onclick="closeSimilarModal()">\u2715</button>
            </div>
            <div id="modalContent">
                <div class="loading">Finding similar feedback...</div>
            </div>
        </div>
    </div>

    <script>
        let allData = null;
        
        // Load feedback data
        async function loadFeedback() {
            try {
                const response = await fetch('/api/feedback');
                const data = await response.json();
                allData = data;
                renderDashboard(data);
            } catch (error) {
                showError('Failed to load feedback: ' + error.message);
            }
        }
        
        // Render dashboard
        function renderDashboard(data) {
            const { feedback, stats } = data;
            
            // Update total counts
            document.getElementById('totalCount').textContent = stats.total || 0;
            
            const sentimentCounts = {
                positive: 0,
                negative: 0,
                neutral: 0
            };
            
            stats.bySentiment.forEach(item => {
                if (item.sentiment) {
                    sentimentCounts[item.sentiment] = item.count;
                }
            });
            
            document.getElementById('positiveCount').textContent = sentimentCounts.positive;
            document.getElementById('negativeCount').textContent = sentimentCounts.negative;
            document.getElementById('neutralCount').textContent = sentimentCounts.neutral;
            
            // Render sentiment bars
            renderSentimentBars(sentimentCounts, stats.total);
            
            // Render source cards
            renderSourceCards(stats.bySource);
            
            // Render feedback list
            renderFeedbackList(feedback);
        }
        
        // Render sentiment bars
        function renderSentimentBars(counts, total) {
            const container = document.getElementById('sentimentBars');
            const sentiments = [
                { name: 'Positive', value: counts.positive, class: 'positive' },
                { name: 'Negative', value: counts.negative, class: 'negative' },
                { name: 'Neutral', value: counts.neutral, class: 'neutral' }
            ];
            
            container.innerHTML = sentiments.map(s => {
                const percentage = total > 0 ? (s.value / total * 100) : 0;
                return \`
                    <div class="sentiment-bar">
                        <div class="sentiment-label">
                            <span>\${s.name}</span>
                            <span>\${s.value} (\${percentage.toFixed(1)}%)</span>
                        </div>
                        <div class="bar-container">
                            <div class="bar-fill \${s.class}" style="width: \${percentage}%">
                                \${percentage > 10 ? percentage.toFixed(0) + '%' : ''}
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
        }
        
        // Render source cards
        function renderSourceCards(sources) {
            const container = document.getElementById('sourceGrid');
            
            if (sources.length === 0) {
                container.innerHTML = '<p style="color: #666;">No feedback yet</p>';
                return;
            }
            
            container.innerHTML = sources.map(s => \`
                <div class="source-card">
                    <div class="source-name">\${s.source}</div>
                    <div class="source-count">\${s.count}</div>
                </div>
            \`).join('');
        }
        
        // Render feedback list
        function renderFeedbackList(feedback) {
            const container = document.getElementById('feedbackList');
            
            if (feedback.length === 0) {
                container.innerHTML = '<p style="color: #666;">No feedback yet. Submit some using the form above!</p>';
                return;
            }
            
            container.innerHTML = feedback.slice(0, 20).map(item => {
                const date = new Date(item.timestamp);
                return \`
                    <div class="feedback-item \${item.sentiment || 'neutral'}" onclick="showSimilarFeedback(\${item.id})" style="cursor: pointer;">
                        <div class="feedback-header">
                            <span><strong>\${item.source}</strong>\${item.author ? ' \u2022 ' + item.author : ''}</span>
                            <span>
                                <span class="badge \${item.sentiment || 'neutral'}">\${item.sentiment || 'neutral'}</span>
                                \${date.toLocaleString()}
                            </span>
                        </div>
                        <div class="feedback-message">\${escapeHtml(item.message)}</div>
                    </div>
                \`;
            }).join('');
        }
        
        // Show similar feedback modal
        async function showSimilarFeedback(feedbackId) {
            const modal = document.getElementById('similarModal');
            const content = document.getElementById('modalContent');
            
            modal.classList.add('show');
            content.innerHTML = '<div class="loading">Finding similar feedback...</div>';
            
            try {
                const response = await fetch(\`/api/similar-feedback?id=\${feedbackId}\`);
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load similar feedback');
                }
                
                renderSimilarFeedback(data);
            } catch (error) {
                content.innerHTML = \`<p style="color: #f56565;">Error: \${error.message}</p>\`;
            }
        }
        
        // Render similar feedback in modal
        function renderSimilarFeedback(data) {
            const { original, similar, scores } = data;
            const content = document.getElementById('modalContent');
            
            let html = \`
                <div style="margin-bottom: 25px;">
                    <h3 style="color: #FF6633; margin-bottom: 10px;">Original Feedback</h3>
                    <div class="similar-item" style="border-left-color: #FF6633;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85em; color: #666;">
                            <span><strong>\${original.source}</strong>\${original.author ? ' \u2022 ' + original.author : ''}</span>
                            <span class="badge \${original.sentiment}">\${original.sentiment}</span>
                        </div>
                        <div style="color: #333; line-height: 1.5;">\${escapeHtml(original.message)}</div>
                    </div>
                </div>
            \`;
            
            if (similar.length === 0) {
                html += '<p style="color: #666;">No similar feedback found with at least 60% match. This feedback may be unique, or more data is needed for better matching. Try running the backfill if you haven't yet!</p>';
            } else {
                html += \`
                    <h3 style="color: #FF6633; margin-bottom: 10px;">\u{1F91D} Similar Feedback (\${similar.length})</h3>
                    <p style="color: #666; font-size: 0.9em; margin-bottom: 15px;">Found using AI-powered semantic search with Cloudflare Vectorize</p>
                \`;
                
                similar.forEach((item, index) => {
                    const score = scores.find(s => s.id === item.id.toString());
                    const percentage = score ? (score.score * 100).toFixed(1) : 'N/A';
                    const date = new Date(item.timestamp);
                    
                    html += \`
                        <div class="similar-item">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.85em; color: #666;">
                                <span>
                                    <strong>\${item.source}</strong>\${item.author ? ' \u2022 ' + item.author : ''}
                                    <span class="similarity-score">\${percentage}% match</span>
                                </span>
                                <span>
                                    <span class="badge \${item.sentiment}">\${item.sentiment}</span>
                                    \${date.toLocaleString()}
                                </span>
                            </div>
                            <div style="color: #333; line-height: 1.5;">\${escapeHtml(item.message)}</div>
                        </div>
                    \`;
                });
            }
            
            content.innerHTML = html;
        }
        
        // Close modal
        function closeSimilarModal() {
            document.getElementById('similarModal').classList.remove('show');
        }
        
        // Close modal when clicking outside
        document.getElementById('similarModal').addEventListener('click', (e) => {
            if (e.target.id === 'similarModal') {
                closeSimilarModal();
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSimilarModal();
            }
        });
        
        // Submit test feedback
        document.getElementById('testForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submitBtn');
            btn.disabled = true;
            btn.textContent = 'Submitting...';
            
            try {
                const formData = {
                    source: document.getElementById('source').value,
                    message: document.getElementById('message').value,
                    author: document.getElementById('author').value || null
                };
                
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to submit feedback');
                }
                
                // Clear form
                document.getElementById('message').value = '';
                document.getElementById('author').value = '';
                
                // Reload feedback and features
                await loadFeedback();
                await loadFeatureAnalysis();
                
                btn.textContent = '\u2713 Submitted!';
                setTimeout(() => {
                    btn.textContent = 'Submit Feedback';
                    btn.disabled = false;
                }, 2000);
            } catch (error) {
                showError('Failed to submit feedback: ' + error.message);
                btn.textContent = 'Submit Feedback';
                btn.disabled = false;
            }
        });
        
        // Utility functions
        function showError(message) {
            const errorDiv = document.getElementById('error');
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Test urgent feedback for Slack notifications
        async function testUrgentFeedback(level) {
            const resultDiv = document.getElementById('slackTestResult');
            resultDiv.style.display = 'block';
            resultDiv.style.background = '#f0f0f0';
            resultDiv.innerHTML = '\u23F3 Sending test feedback and analyzing urgency...';
            
            const testMessages = {
                critical: {
                    source: 'Support',
                    message: 'URGENT: Our payment system is down and customers cannot complete purchases. We are losing thousands of dollars per minute. This is a complete service outage!',
                    author: 'urgent.support@company.com'
                },
                high: {
                    source: 'GitHub',
                    message: 'Critical bug: The export feature is completely broken. Users cannot export their data and this is blocking all workflows. Multiple complaints received.',
                    author: 'developer@company.com'
                }
            };
            
            const testData = testMessages[level];
            
            try {
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(testData)
                });
                
                if (!response.ok) {
                    throw new Error('Failed to submit test feedback');
                }
                
                const data = await response.json();
                
                resultDiv.style.background = '#d4edda';
                resultDiv.innerHTML = '<strong>\u2705 Test feedback submitted!</strong><br>' +
                    '<span style="font-size: 0.9em; color: #666;">' +
                    'ID: #' + data.id + ' | Sentiment: ' + data.sentiment + '<br>' +
                    'AI will analyze urgency and send Slack notification if CRITICAL or HIGH.<br>' +
                    '<em>Check your Slack channel in a few seconds!</em>' +
                    '</span>';
                
                // Reload feedback to show the new entry
                setTimeout(() => {
                    loadFeedback();
                }, 1000);
                
            } catch (error) {
                resultDiv.style.background = '#f8d7da';
                resultDiv.innerHTML = '<strong>\u274C Error:</strong> ' + error.message;
            }
        }
        
        // Load feature analysis
        async function loadFeatureAnalysis() {
            try {
                const response = await fetch('/api/analyze-features');
                const data = await response.json();
                renderFeatureAnalysis(data);
            } catch (error) {
                console.error('Failed to load feature analysis:', error);
                document.getElementById('bestFeatures').innerHTML = '<p style="color: #666;">Failed to load analysis</p>';
                document.getElementById('worstFeatures').innerHTML = '<p style="color: #666;">Failed to load analysis</p>';
            }
        }
        
        // Render feature analysis
        function renderFeatureAnalysis(data) {
            const { bestFeatures, worstFeatures } = data;
            
            const renderList = (features, className) => {
                if (!features || features.length === 0) {
                    return '<p style="color: #666;">No data available</p>';
                }
                return features.map(f => \`
                    <div class="feature-item \${className}">
                        <div class="feature-name">\${escapeHtml(f.feature)}</div>
                        <div class="feature-mentions">\${f.mentions} mentions</div>
                    </div>
                \`).join('');
            };

            document.getElementById('bestFeatures').innerHTML = renderList(bestFeatures, 'best');
            document.getElementById('worstFeatures').innerHTML = renderList(worstFeatures, 'worst');
        }
        
        // Initial load
        loadFeedback();
        loadFeatureAnalysis();
        
        // Auto-refresh every 30 seconds
        setInterval(loadFeedback, 30000);
        setInterval(loadFeatureAnalysis, 60000);
    <\/script>
</body>
</html>
  `;
  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html;charset=UTF-8" }
  });
}
__name(handleDashboard, "handleDashboard");
export {
  FeedbackNotificationWorkflow,
  index_default as default
};
//# sourceMappingURL=index.js.map
