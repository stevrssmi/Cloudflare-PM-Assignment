/**
 * Backfill Script for Vectorize
 * This script generates embeddings for all existing feedback in the database
 * Run this once to populate Vectorize with existing data
 * 
 * Usage: Add this as a route like /api/backfill-embeddings and call it once
 */

/**
 * GET /api/backfill-embeddings - Generate embeddings for all existing feedback
 * Add this route to your Worker's fetch handler
 */
async function handleBackfillEmbeddings(env, corsHeaders) {
  try {
    // Get all feedback that doesn't have embeddings yet
    const { results: allFeedback } = await env.DB.prepare(
      'SELECT id, message, source, sentiment FROM feedback ORDER BY id'
    ).all();

    if (!allFeedback || allFeedback.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No feedback to backfill',
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let errors = 0;
    const results = [];

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < allFeedback.length; i += batchSize) {
      const batch = allFeedback.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (feedback) => {
        try {
          // Generate embedding
          const embedding = await generateEmbedding(feedback.message, env);
          
          // Insert into Vectorize
          await env.VECTORIZE.insert([
            {
              id: feedback.id.toString(),
              values: embedding,
              metadata: {
                source: feedback.source,
                sentiment: feedback.sentiment,
                timestamp: new Date().toISOString()
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

      // Wait for current batch before starting next
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < allFeedback.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Backfill complete: ${processed} embeddings created, ${errors} errors`,
        processed,
        errors,
        total: allFeedback.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Add this route to your Worker's fetch handler:
// if (url.pathname === '/api/backfill-embeddings' && request.method === 'POST') {
//   return handleBackfillEmbeddings(env, corsHeaders);
// }
