# Lead Enrichment System - Complete Setup Guide

## System Overview
A 4-stage pipeline that processes LinkedIn URLs through email discovery, AI personalization, and campaign upload.

**Pipeline Flow:**
```
CSV Upload → Extract LinkedIn URLs → Find Emails (Findymail) → AI Personalization → Upload to Email Platform
```

## Database Schema

```sql
-- Lead Enrichment System - Simplified Schema
-- Focus on core functionality only

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CLIENT CONFIGURATION TABLE
-- =====================================================
-- One row per client with all their settings

CREATE TABLE client_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Google Drive folder structure
    parent_folder_id VARCHAR(255) NOT NULL,
    folder_logs VARCHAR(255) NOT NULL,
    folder_ingestion_backup VARCHAR(255) NOT NULL,
    folder_email_enrichment_fail VARCHAR(255) NOT NULL,
    folder_email_enrichment_ready VARCHAR(255) NOT NULL,
    folder_ingestion VARCHAR(255) NOT NULL,
    folder_ai_enrichment_ready VARCHAR(255) NOT NULL,
    folder_ai_enrichment_failure VARCHAR(255) NOT NULL,
    folder_ai_enrichment_backup VARCHAR(255) NOT NULL,
    folder_campaign_upload_rejected VARCHAR(255) NOT NULL,
    folder_campaign_upload_ready VARCHAR(255) NOT NULL,
    folder_campaign_upload_success VARCHAR(255) NOT NULL,
    
    -- API Key prefixes (actual keys in env vars)
    findymail_api_key VARCHAR(255) DEFAULT 'LEADWRAITH',
    gpt_api_key VARCHAR(255) DEFAULT 'LEADWRAITH',
    perplexity_api_key VARCHAR(255) DEFAULT 'LEADWRAITH',
    smartlead_api_key VARCHAR(255) DEFAULT 'LEADWRAITH',
    bison_api_key VARCHAR(255) DEFAULT 'LEADWRAITH',
    bison_workspace_id VARCHAR(255),
    
    -- Configuration
    segments JSONB DEFAULT '[]'::jsonb,
    services JSONB DEFAULT '[]'::jsonb,
    enrichment_prompts JSONB DEFAULT '[]'::jsonb,
    enrichment_roles JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_config_client ON client_config(client);

-- =====================================================
-- 2. LEAD ENRICHMENTS TABLE
-- =====================================================
-- Main table tracking each lead through the pipeline

CREATE TABLE lead_enrichments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client VARCHAR(255) NOT NULL,
    job_id UUID,
    
    -- Lead identification
    linkedin_url VARCHAR(500) NOT NULL,
    
    -- Findymail results
    email VARCHAR(255),
    email_status VARCHAR(50),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    full_name VARCHAR(255),
    job_title VARCHAR(255),
    company_name VARCHAR(255),
    company_domain VARCHAR(255),
    company_linkedin_url VARCHAR(500),
    findymail_response JSONB,
    
    -- AI enrichment results
    ai_enrichment_response JSONB,
    confidence_score NUMERIC(3,2),
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending',
    uploaded_to VARCHAR(50),
    upload_campaign_id VARCHAR(255),
    
    -- Error tracking
    error_message TEXT,
    error_stage VARCHAR(50),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    findymail_enriched_at TIMESTAMP WITH TIME ZONE,
    ai_enriched_at TIMESTAMP WITH TIME ZONE,
    uploaded_at TIMESTAMP WITH TIME ZONE
);

-- Essential indexes only
CREATE INDEX idx_lead_enrichments_client_status ON lead_enrichments(client, status);
CREATE INDEX idx_lead_enrichments_job_id ON lead_enrichments(job_id);
CREATE INDEX idx_lead_enrichments_linkedin_url ON lead_enrichments(linkedin_url);
CREATE INDEX idx_lead_enrichments_created_at ON lead_enrichments(created_at DESC);

-- =====================================================
-- 3. JOB LOGS TABLE
-- =====================================================
-- Simple job tracking for monitoring

CREATE TABLE job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client VARCHAR(255) NOT NULL,
    job_type VARCHAR(50) NOT NULL,
    
    -- Basic info
    input_file_name VARCHAR(255),
    total_records INTEGER DEFAULT 0,
    successful_records INTEGER DEFAULT 0,
    failed_records INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_logs_client ON job_logs(client);
CREATE INDEX idx_job_logs_status ON job_logs(status);

-- =====================================================
-- 4. FILE UPLOADS TABLE
-- =====================================================
-- Track files uploaded through frontend

CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    
    -- File info
    file_name VARCHAR(255) NOT NULL,
    google_drive_file_id VARCHAR(255),
    
    -- Processing
    status VARCHAR(50) DEFAULT 'uploaded',
    job_id UUID REFERENCES job_logs(id),
    total_rows INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_file_uploads_client ON file_uploads(client);

-- =====================================================
-- HELPFUL VIEWS
-- =====================================================

-- Pipeline status overview
CREATE VIEW pipeline_status AS
SELECT 
    client,
    status,
    COUNT(*) as count,
    DATE(created_at) as date
FROM lead_enrichments
GROUP BY client, status, DATE(created_at)
ORDER BY date DESC, client, status;

-- Job summary
CREATE VIEW recent_jobs AS
SELECT 
    client,
    job_type,
    status,
    total_records,
    successful_records,
    failed_records,
    started_at,
    completed_at,
    EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM job_logs
WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC;

-- =====================================================
-- SIMPLE HELPER FUNCTION
-- =====================================================

-- Get next batch of leads to process
CREATE OR REPLACE FUNCTION get_next_batch(
    p_client VARCHAR,
    p_status VARCHAR,
    p_limit INTEGER DEFAULT 100
)
RETURNS SETOF lead_enrichments AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM lead_enrichments
    WHERE client = p_client
    AND status = p_status
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED; -- Prevents duplicate processing
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE client_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_enrichments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Users can only see their own client data
CREATE POLICY "client_isolation" ON lead_enrichments
    FOR ALL USING (
        client IN (
            SELECT client FROM client_config WHERE user_id = auth.uid()
        )
    );

-- Service role has full access
CREATE POLICY "service_role_all" ON lead_enrichments
    FOR ALL USING (auth.role() = 'service_role');

-- Apply similar policies to other tables
CREATE POLICY "client_config_owner" ON client_config
    FOR ALL USING (user_id = auth.uid() OR auth.role() = 'service_role');

CREATE POLICY "job_logs_client" ON job_logs
    FOR ALL USING (
        client IN (
            SELECT client FROM client_config WHERE user_id = auth.uid()
        ) OR auth.role() = 'service_role'
    );

CREATE POLICY "file_uploads_owner" ON file_uploads
    FOR ALL USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_config_updated_at 
    BEFORE UPDATE ON client_config 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Setting Up a New Client

### Step 1: Create Google Drive Folder Structure
Create these 12 folders in Google Drive for the client:
```
Parent Folder/
├── Logs/
├── Ingestion Folder/              # Where CSVs are uploaded
├── Initial Ingestion Backup/
├── Email Address Enrichment Ready/
├── Email Address Enrichment Fail/
├── AI Enrichment Ready/
├── AI Enrichment Failure/
├── AI Enrichment Backup/
├── Cold Email Campaign Upload Ready/
├── Cold Email Campaign Upload Success/
└── Cold Email Campaign Upload Rejected/
```

### Step 2: Get Folder IDs
For each folder, copy the ID from the URL:
- Example URL: `https://drive.google.com/drive/folders/1ABC123xyz`
- Folder ID: `1ABC123xyz`

### Step 3: Insert Client Configuration
```sql
INSERT INTO client_config (
    client,
    parent_folder_id,
    folder_logs,
    folder_ingestion,
    folder_ingestion_backup,
    folder_email_enrichment_ready,
    folder_email_enrichment_fail,
    folder_ai_enrichment_ready,
    folder_ai_enrichment_failure,
    folder_ai_enrichment_backup,
    folder_campaign_upload_ready,
    folder_campaign_upload_success,
    folder_campaign_upload_rejected,
    findymail_api_key,
    gpt_api_key,
    perplexity_api_key,
    smartlead_api_key,
    bison_api_key,
    bison_workspace_id,
    segments,
    services,
    enrichment_roles,
    enrichment_prompts
) VALUES (
    'Your Client Name',
    'parent_folder_id_here',
    'logs_folder_id_here',
    'ingestion_folder_id_here',
    'ingestion_backup_id_here',
    'email_ready_id_here',
    'email_fail_id_here',
    'ai_ready_id_here',
    'ai_failure_id_here',
    'ai_backup_id_here',
    'campaign_ready_id_here',
    'campaign_success_id_here',
    'campaign_rejected_id_here',
    'LEADWRAITH',  -- or 'CLIENTNAME' for custom key
    'LEADWRAITH',  -- or 'CLIENTNAME' for custom key
    'LEADWRAITH',
    'LEADWRAITH',
    'LEADWRAITH',
    NULL,  -- or 'workspace-id' for Bison
    '["B2B SaaS", "Enterprise Software"]',
    '["Book Writing", "Brand Strategy"]',
    '[{"role": "CEO", "description": ""}, {"role": "Founder", "description": ""}]',
    '[]'  -- Add enrichment prompts here
);
```

### Step 4: Add API Keys to Environment Variables
If using custom API keys, add to each service's `.env` file:
```bash
# Default keys (your keys)
LEADWRAITH_FINDYMAIL=your_findymail_api_key
LEADWRAITH_GPT=your_openai_api_key
LEADWRAITH_PERPLEXITY=your_perplexity_api_key
LEADWRAITH_SMARTLEAD=your_smartlead_api_key
LEADWRAITH_BISON=your_bison_api_key

# Client-specific keys (if they have their own)
CLIENTNAME_FINDYMAIL=their_findymail_api_key
CLIENTNAME_GPT=their_openai_api_key
```

## Status Flow

Each lead progresses through these statuses:
1. `pending` - Initial state after CSV upload
2. `findymail_enriched` - Email found successfully
3. `ai_enriched` - AI personalization complete  
4. `uploaded` - Sent to email platform

Failed states:
- `findymail_failed` - Email discovery failed
- `ai_failed` - AI enrichment failed
- `upload_failed` - Upload to platform failed

## Common Library Usage

### In any service, use the common library like this:

```javascript
// Import the common library
const { 
  db, 
  logger, 
  constants, 
  config 
} = require('@yourusername/lead-enrichment-common');

// Get the next batch of leads to process
const leads = await db.models.LeadEnrichment.findByStatus(
  'Client Name',                    // The client name from client_config
  constants.STATUS.PENDING,         // Status to look for
  config.batchSizes.findymail      // How many to get (default: 100)
);

// Process each lead
for (const lead of leads) {
  try {
    // Your processing logic here
    const result = await processLead(lead);
    
    // Update lead status on success
    await db.models.LeadEnrichment.updateStatus(
      lead.id,
      constants.STATUS.FINDYMAIL_ENRICHED,
      {
        email: result.email,
        first_name: result.firstName,
        last_name: result.lastName,
        findymail_response: result
      }
    );
    
  } catch (error) {
    // Update lead with error
    await db.models.LeadEnrichment.updateError(
      lead.id,
      'findymail',
      error.message
    );
  }
}

// Create a job log
const job = await db.models.JobLog.create({
  client: 'Client Name',
  job_type: constants.JOB_TYPES.FINDYMAIL_ENRICHMENT
});

// Update job progress
await db.models.JobLog.updateProgress(job.id, {
  processed_records: 50,
  successful_records: 45,
  failed_records: 5
});

// Complete the job
await db.models.JobLog.complete(job.id);

// Log activities
logger.info('Processing complete', { 
  jobId: job.id, 
  processed: 50 
});
```

## Service-Specific Instructions

### 1. Ingestion Service
- Monitors `folder_ingestion` for new CSV files
- Extracts LinkedIn URLs
- Creates records in `lead_enrichments` with status `pending`
- Backs up original file to `folder_ingestion_backup`

### 2. Findymail Enrichment Service
- Gets leads with status `pending`
- Calls Findymail API to find emails
- Updates status to `findymail_enriched` or `findymail_failed`
- Stores results in `folder_email_enrichment_ready` or `folder_email_enrichment_fail`

### 3. AI Enrichment Service
- Gets leads with status `findymail_enriched`
- Uses GPT/Perplexity to analyze and personalize
- Updates status to `ai_enriched` or `ai_failed`
- Stores results in `folder_ai_enrichment_ready` or `folder_ai_enrichment_failure`

### 4. Upload Service
- Gets leads with status `ai_enriched`
- Uploads to Email Bison or Smartlead
- Updates status to `uploaded` or `upload_failed`
- Stores results in `folder_campaign_upload_success` or `folder_campaign_upload_rejected`

## Monitoring Queries

```sql
-- Check pipeline status for a client
SELECT * FROM pipeline_status WHERE client = 'Your Client Name';

-- View recent jobs
SELECT * FROM recent_jobs WHERE client = 'Your Client Name';

-- Check for stuck leads
SELECT status, COUNT(*), MIN(created_at) as oldest
FROM lead_enrichments 
WHERE client = 'Your Client Name'
GROUP BY status;

-- Get error summary
SELECT 
  error_stage,
  COUNT(*) as error_count,
  MAX(created_at) as most_recent
FROM lead_enrichments
WHERE client = 'Your Client Name'
  AND error_message IS NOT NULL
GROUP BY error_stage;
```

## Environment Variables Needed

Each service needs these in `.env`:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key

# Service identification
SERVICE_NAME=findymail-enrichment
PORT=3001

# Processing settings
BATCH_SIZE=100
RATE_LIMIT_PER_MINUTE=100
MAX_RETRIES=3

# API Keys (as configured in client_config)
LEADWRAITH_FINDYMAIL=your_default_findymail_key
LEADWRAITH_GPT=your_default_openai_key
# Add client-specific keys as needed
```

## Quick Checklist for New Service

When creating a new service:
1. ✅ Install common library: `npm install github:yourusername/lead-enrichment-common`
2. ✅ Create `.env` file with Supabase credentials
3. ✅ Import common library components
4. ✅ Use status constants from `constants.STATUS`
5. ✅ Use job types from `constants.JOB_TYPES`
6. ✅ Always create job logs for tracking
7. ✅ Handle errors with proper status updates
8. ✅ Use the logger for all output