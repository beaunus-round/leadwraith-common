const { getSupabaseClient } = require('./client');

class FileUpload {
  static async create(fileData) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('file_uploads')
      .insert(fileData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create file upload: ${error.message}`);
    }
    
    return data;
  }

  static async updateStatus(id, status, additionalData = {}) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('file_uploads')
      .update({
        status,
        ...additionalData
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update file upload: ${error.message}`);
    }
    
    return data;
  }
}

module.exports = FileUpload;