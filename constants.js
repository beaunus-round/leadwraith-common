module.exports = {
  STATUS: {
    PENDING: 'pending',
    FINDYMAIL_ENRICHED: 'findymail_enriched',
    FINDYMAIL_FAILED: 'findymail_failed',
    AI_ENRICHED: 'ai_enriched',
    AI_FAILED: 'ai_failed',
    UPLOADED: 'uploaded',
    UPLOAD_FAILED: 'upload_failed'
  },
  
  JOB_TYPES: {
    INGESTION: 'ingestion',
    FINDYMAIL_ENRICHMENT: 'findymail_enrichment',
    AI_ENRICHMENT: 'ai_enrichment',
    UPLOAD: 'upload'
  },
  
  ERROR_STAGES: {
    INGESTION: 'ingestion',
    FINDYMAIL: 'findymail',
    AI_ENRICHMENT: 'ai_enrichment',
    UPLOAD: 'upload'
  },
  
  // NEW: Phase constants for the refactored AI enrichment service
  PHASES: {
    PENDING: 'pending',
    SCRAPING: 'scraping',
    RESEARCHING: 'researching',
    QUALIFYING: 'qualifying',
    GENERATING: 'generating',
    COMPLETED: 'completed'
  }
};