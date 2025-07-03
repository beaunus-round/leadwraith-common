const { getSupabaseClient } = require('./client');
const logger = require('../utils/logger');

class LeadEnrichment {
  static async findByStatus(client, status, limit = 100) {
    const supabase = getSupabaseClient();
    
    // Use the get_next_batch function to prevent duplicate processing
    const { data, error } = await supabase
      .rpc('get_next_batch', {
        p_client: client,
        p_status: status,
        p_limit: limit
      });
    
    if (error) {
      throw new Error(`Failed to find leads: ${error.message}`);
    }
    
    return data || [];
  }

  static async updateStatus(id, status, additionalData = {}) {
    const supabase = getSupabaseClient();
    
    const updateData = {
      status,
      ...additionalData
    };
    
    // Add timestamp if status indicates completion
    if (status.includes('enriched') || status === 'uploaded') {
      const timestampField = `${status.replace('_enriched', '')}_enriched_at`;
      if (timestampField === 'uploaded_enriched_at') {
        updateData.uploaded_at = new Date().toISOString();
      } else {
        updateData[timestampField] = new Date().toISOString();
      }
    }
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update lead: ${error.message}`);
    }
    
    logger.info(`Updated lead ${id} to status ${status}`);
    return data;
  }

  static async batchCreate(leads) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .insert(leads)
      .select();
    
    if (error) {
      throw new Error(`Failed to create leads: ${error.message}`);
    }
    
    logger.info(`Created ${data.length} new leads`);
    return data;
  }

  static async updateError(id, errorStage, errorMessage) {
    return this.updateStatus(id, `${errorStage}_failed`, {
      error_message: errorMessage,
      error_stage: errorStage
    });
  }

  // NEW METHODS FOR PHASE-BASED PROCESSING

  /**
   * Update lead's current processing phase
   * @param {string} id - Lead ID
   * @param {string} phase - Phase name
   */
  static async updatePhase(id, phase) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .update({ current_phase: phase })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update lead phase: ${error.message}`);
    }
    
    logger.debug(`Updated lead ${id} to phase ${phase}`);
    return data;
  }

  /**
   * Increment retry count for a lead
   * @param {string} id - Lead ID
   * @returns {number} New retry count
   */
  static async incrementRetryCount(id) {
    const supabase = getSupabaseClient();
    
    // First get current retry count
    const { data: lead, error: fetchError } = await supabase
      .from('lead_enrichments')
      .select('retry_count')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      throw new Error(`Failed to get lead retry count: ${fetchError.message}`);
    }
    
    const newRetryCount = (lead.retry_count || 0) + 1;
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .update({ retry_count: newRetryCount })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to increment retry count: ${error.message}`);
    }
    
    return newRetryCount;
  }

  /**
   * Find leads by phase for a client
   * @param {string} client - Client name
   * @param {string} phase - Phase to filter by
   * @param {number} limit - Maximum number of leads
   */
  static async findByPhase(client, phase, limit = 100) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .select('*')
      .eq('client', client)
      .eq('current_phase', phase)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to find leads by phase: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Find failed leads that can be retried
   * @param {string} client - Client name
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} limit - Maximum number of leads
   */
  static async findRetryableLeads(client, maxRetries = 3, limit = 100) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .select('*')
      .eq('client', client)
      .in('status', ['ai_failed', 'findymail_failed', 'upload_failed'])
      .lt('retry_count', maxRetries)
      .order('created_at', { ascending: true })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to find retryable leads: ${error.message}`);
    }
    
    return data || [];
  }

  /**
   * Get lead by ID
   * @param {string} id - Lead ID
   */
  static async getById(id) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('lead_enrichments')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      throw new Error(`Failed to get lead: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Get leads by job ID
   * @param {string} jobId - Job ID
   * @param {number} limit - Maximum number of leads
   * @param {number} offset - Offset for pagination
   */
  static async findByJobId(jobId, limit = 100, offset = 0) {
    const supabase = getSupabaseClient();
    
    const { data, error, count } = await supabase
      .from('lead_enrichments')
      .select('*', { count: 'exact' })
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);
    
    if (error) {
      throw new Error(`Failed to find leads by job: ${error.message}`);
    }
    
    return {
      leads: data || [],
      total: count || 0,
      hasMore: (offset + limit) < count
    };
  }

  /**
   * Update status and phase together
   * @param {string} id - Lead ID
   * @param {string} status - New status
   * @param {string} phase - New phase
   * @param {object} additionalData - Any other data to update
   */
  static async updateStatusAndPhase(id, status, phase, additionalData = {}) {
    return this.updateStatus(id, status, {
      ...additionalData,
      current_phase: phase
    });
  }
}

module.exports = LeadEnrichment;