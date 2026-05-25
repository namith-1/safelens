// ✅ SAFE vscode mock (won’t crash even if vscode not installed)
try {
  require.resolve('vscode');
} catch {
  require.cache['vscode'] = {
    exports: {
      workspace: {
        getConfiguration: () => ({
          get: () => 'ALL'
        })
      }
    }
  };
}
const safelens_path = __dirname + '../../media/safelens-rules.yaml';

const path = require('path');

// ✅ correct path (based on your structure)
const { SemgrepService } = require('../../out/services/semgrepService');

const service = SemgrepService()


