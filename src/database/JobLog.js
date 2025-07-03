const { getSupabaseClient } = require('./client');
const logger = require('../utils/logger');

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

  // NEW METHODS FOR ASYNC JOB PROCESSING

  /**
   * Update job progress percentage (0-100)
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress percentage
   */
  static async updateProgressPercentage(jobId, progress) {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('job_logs')
      .update({ progress: Math.min(100, Math.max(0, progress)) })
      .eq('id', jobId);
    
    if (error) {
      logger.error(`Failed to update job progress percentage: ${error.message}`);
    }
  }

  /**
   * Update current processing phase
   * @param {string} jobId - Job ID
   * @param {string} phase - Current phase name
   */
  static async updatePhase(jobId, phase) {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('job_logs')
      .update({ current_phase: phase })
      .eq('id', jobId);
    
    if (error) {
      logger.error(`Failed to update job phase: ${error.message}`);
    }
  }

  /**
   * Update both progress and phase in one call
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress percentage
   * @param {string} phase - Current phase name
   * @param {object} additionalMetrics - Any other metrics to update
   */
  static async updateProgressAndPhase(jobId, progress, phase, additionalMetrics = {}) {
    const supabase = getSupabaseClient();
    
    const updateData = {
      progress: Math.min(100, Math.max(0, progress)),
      current_phase: phase,
      ...additionalMetrics
    };
    
    const { error } = await supabase
      .from('job_logs')
      .update(updateData)
      .eq('id', jobId);
    
    if (error) {
      logger.error(`Failed to update job progress and phase: ${error.message}`);
    }
  }

  /**
   * Get job by ID
   * @param {string} jobId - Job ID
   * @returns {object} Job data
   */
  static async getById(jobId) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('job_logs')
      .select('*')
      .eq('id', jobId)
      .single();
    
    if (error) {
      throw new Error(`Failed to get job: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Get active jobs for a client
   * @param {string} client - Client name
   * @returns {array} Active jobs
   */
  static async getActiveJobs(client) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('job_logs')
      .select('*')
      .eq('client', client)
      .in('status', ['running', 'pending'])
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to get active jobs: ${error.message}`);
    }
    
    return data || [];
  }
}

module.exports = JobLog;