require('dotenv').config();

module.exports = {
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY
  },
  
  batchSizes: {
    ingestion: 1000,
    findymail: 100,
    aiEnrichment: 50,
    upload: 500
  },
  
  retryConfig: {
    maxRetries: 3,
    retryDelay: 5000
  }
};