const logger = require('./logger');

async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    retryDelay = 5000,
    onRetry = () => {}
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${retryDelay}ms...`, {
        error: error.message
      });
      
      await onRetry(attempt, error);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  throw lastError;
}

module.exports = { withRetry };