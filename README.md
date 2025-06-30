"# leadwraith-common" 
# Lead Enrichment Common Library

Shared utilities and database models for the lead enrichment pipeline.

## Installation

\```bash
npm install github:yourusername/lead-enrichment-common
\```

## Usage

\```javascript
const { db, logger, constants } = require('@yourusername/lead-enrichment-common');

// Use database models
const leads = await db.models.LeadEnrichment.findByStatus('client', 'pending');

// Use constants
const { STATUS, JOB_TYPES } = constants;

// Use logger
logger.info('Processing leads');
\```