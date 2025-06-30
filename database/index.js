module.exports = {
  client: require('./client'),
  models: {
    ClientConfig: require('./models/ClientConfig'),
    LeadEnrichment: require('./models/LeadEnrichment'),
    JobLog: require('./models/JobLog'),
    FileUpload: require('./models/FileUpload')
  }
};