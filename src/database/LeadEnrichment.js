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
}

module.exports = LeadEnrichment;