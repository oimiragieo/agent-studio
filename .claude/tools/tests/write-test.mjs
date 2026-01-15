import { writeFileSync } from "fs";
const content = process.argv[2];
writeFileSync(".claude/tools/tests/router-session-integration.test.mjs", content);
console.log("Written");