const { getSupabaseClient } = require('../client');
const logger = require('../../utils/logger');

class JobLog {
  static async create(jobData) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('job_logs')
      .insert({
        ...jobData,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create job log: ${error.message}`);
    }
    
    logger.info(`Created job ${data.id} for ${jobData.client}`);
    return data;
  }

  static async updateProgress(jobId, metrics) {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('job_logs')
      .update(metrics)
      .eq('id', jobId);
    
    if (error) {
      logger.error(`Failed to update job progress: ${error.message}`);
    }
  }

  static async complete(jobId, finalMetrics = {}) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('job_logs')
      .update({
        ...finalMetrics,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to complete job: ${error.message}`);
    }
    
    logger.info(`Completed job ${jobId}`);
    return data;
  }

  static async fail(jobId, errorMessage) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('job_logs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to mark job as failed: ${error.message}`);
    }
    
    logger.error(`Job ${jobId} failed: ${errorMessage}`);
    return data;
  }
}

module.exports = JobLog;