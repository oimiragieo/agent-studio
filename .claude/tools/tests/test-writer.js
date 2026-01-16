const fs = require('fs');
const path = '.claude/tools/tests/router-session-integration.test.mjs';
module.exports = { write: c => fs.writeFileSync(path, c) };
