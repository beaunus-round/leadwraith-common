module.exports = {
  client: require('./client'),
  models: {
    ClientConfig: require('./models/ClientConfig'),
    LeadEnrichment: require('./LeadEnrichment'),        
    JobLog: require('./JobLog'),                         
    FileUpload: require('./FileUpload')                 
  }
};