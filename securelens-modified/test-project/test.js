const path = require('path');
const fs = require('fs');

// Import compiled JS version of your service
const { SemgrepService } = require('../out/services/semgrepService')
// adjust path if needed

async function runTests() {
  const service = new SemgrepService();

  const testFolder = path.resolve('./test-project'); // folder to scan

  console.log("\n==============================");
  console.log("1️⃣ Testing scanPath()");
  console.log("==============================");

  try {
    const result = await service.scanPath(testFolder);
    console.log("Scan Summary:", result.summary);
  } catch (err) {
    console.error("scanPath failed:", err.message);
  }

  console.log("\n==============================");
  console.log("2️⃣ Testing findRulesFile()");
  console.log("==============================");

  try {
    const rules = service.findRulesFile(__dirname);
    console.log("Rules file found:", rules);
  } catch (err) {
    console.error("findRulesFile failed:", err.message);
  }

  console.log("\n==============================");
  console.log("3️⃣ Testing runSemgrep()");
  console.log("==============================");

  try {
    const abs = path.resolve(testFolder);
    const res = await service.runSemgrep(abs, "p/secrets", "ALL");
    console.log("Findings count:", res.summary.totalFindings);
  } catch (err) {
    console.error("runSemgrep failed:", err.message);
  }

  console.log("\n==============================");
  console.log("4️⃣ Testing buildResult()");
  console.log("==============================");

  try {
    const mockRaw = {
      version: "1.0.0",
      results: [
        {
          check_id: "test-rule",
          path: "test.js",
          start: { line: 5, col: 1 },
          end: { line: 5, col: 10 },
          extra: {
            message: "Test vulnerability",
            severity: "WARNING",
            lines: "const password = '123456';"
          }
        }
      ],
      errors: []
    };

    const build = service.buildResult(mockRaw, "test-path", "test-config");
    console.log("Build Result:", build.summary);
  } catch (err) {
    console.error("buildResult failed:", err.message);
  }

  console.log("\n==============================");
  console.log("5️⃣ Testing mergeResults()");
  console.log("==============================");

  try {
    const sampleResult = {
      meta: {},
      summary: {},
      findings: [
        {
          id: "1",
          ruleId: "rule1",
          severity: "ERROR",
          message: "Test",
          file: "a.js",
          line: { start: 1, end: 1 },
          column: { start: 1, end: 2 }
        }
      ],
      findingsByFile: {},
      errors: []
    };

    const merged = service.mergeResults([sampleResult, sampleResult], "target");
    console.log("Merged findings:", merged.findings.length);
  } catch (err) {
    console.error("mergeResults failed:", err.message);
  }

  console.log("\n==============================");
  console.log("6️⃣ Testing normalizeSeverity()");
  console.log("==============================");

  console.log(service.normalizeSeverity("error"));
  console.log(service.normalizeSeverity("warning"));
  console.log(service.normalizeSeverity("info"));
  console.log(service.normalizeSeverity("random"));

}

runTests();