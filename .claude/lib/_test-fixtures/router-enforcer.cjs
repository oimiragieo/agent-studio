const intentKeywords = {
  developer: ['fix', 'bug'],
  qa: ['test', 'testing'],
};

const INTENT_TO_AGENT = {
  developer: 'developer',
  qa: 'qa',
};

module.exports = { intentKeywords, INTENT_TO_AGENT };
