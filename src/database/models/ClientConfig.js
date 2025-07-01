const { getSupabaseClient } = require('../client');

class ClientConfig {
  static async getByClient(clientName) {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('client_config')
      .select('*')
      .eq('client', clientName)
      .single();
    
    if (error) {
      throw new Error(`Failed to get client config: ${error.message}`);
    }
    
    return data;
  }

  static async getApiKey(clientName, keyType) {
    const config = await this.getByClient(clientName);
    const prefix = config[`${keyType}_api_key`] || 'LEADWRAITH';
    
    // Get actual key from environment
    const envKey = `${prefix}_${keyType.toUpperCase()}`;
    const apiKey = process.env[envKey];
    
    if (!apiKey) {
      throw new Error(`API key not found: ${envKey}`);
    }
    
    return apiKey;
  }

  static async getFolderPath(clientName, folderType) {
    const config = await this.getByClient(clientName);
    const folderKey = `folder_${folderType}`;
    return config[folderKey];
  }
}

module.exports = ClientConfig;