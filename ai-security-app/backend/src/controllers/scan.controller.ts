// src/controllers/scan.controller.ts
import { Response } from 'express';
import { Scan } from '../models/Scan';
import { Billing } from '../models/Billing';
import { AuthRequest, ApiResponse } from '../types';


// replaces your existing router.post('/api/scan-results', ...)
import { mapSeverity } from '../utils/mapSeverity';

const saveScanResults = async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const raw = req.body.results;
    console.log(raw,"this is from controller") // the ScanResult object from VS Code extension
    if (!raw) {
      res.status(400).json({ success: false, message: 'No results provided.' });
      return;
    }

    // Map incoming findings to schema shape
    interface MappedFinding {
  ruleId:         string;
  category:       string;
  description:    string;
  severity:       'info' | 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  file:           string;
  line:           unknown;
  fingerprint:    string;
}

const findings: MappedFinding[] = (raw.findings ?? []).map((f: any) => ({
  ruleId:         f.ruleId,
  category:       f.ruleId?.split('.').pop() ?? 'unknown',
  description:    f.message ?? 'No description',
  severity:       mapSeverity(f.severity),
  recommendation: f.fix ?? 'Review the flagged code and apply remediation guidance.',
  file:           f.file,
  line:           f.line,
  fingerprint:    f.fingerprint,
}));

const hasCritical = findings.some(f => f.severity === 'critical');
const hasHigh     = findings.some(f => f.severity === 'high');
const hasMedium   = findings.some(f => f.severity === 'medium');
const threatLevel = hasCritical ? 'critical'
                  : hasHigh    ? 'high'
                  : hasMedium  ? 'medium'
                  : findings.length > 0 ? 'low'
                  : 'none';
    const scan = await Scan.create({
      userId:      req.user?.id,
      type:        'semgrep',
      target:      raw.meta?.target ?? 'unknown',
      status:      'completed',
      threatLevel,
      findings,
      duration:    0,
      summary:     raw.summary,
    });

    // Update billing
    const billing = await Billing.findOne({ userId: req.user?.id });
    if (billing) { billing.scansUsed += 1; await billing.save(); }

    res.status(201).json({ success: true, message: 'Scan saved.', data: { scanId: scan._id } });
  } catch (err) {
    console.error('scan-results error:', err);
    res.status(500).json({ success: false, message: 'Failed to save scan results.' });
  }
};


// write oter api endpoints to get the scan results for a user and to get the details of a specific scan by id
// alway return 10 recent scans for the user when they hit the endpoint to get their scans. and also return the total number of scans they have done so far.
const getUserScans = async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const scans = await Scan.find({ userId: req.user?.id }).sort({ createdAt: -1 }).limit(10);
    const totalScans = await Scan.countDocuments({ userId: req.user?.id });
    res.json({ success: true, message: 'User scans fetched.', data: { scans, totalScans } });
  } catch (err) {
    console.error('get-user-scans error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve user scans.' });
  }
};

const getScanById = async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const scan = await Scan.findOne({ _id: req.params.id, userId: req.user?.id });
    if (!scan) {
      res.status(404).json({ success: false, message: 'Scan not found.' });
      return;
    }
    res.json({ success: true, message: 'Scan fetched.', data: scan });
  } catch (err) {
    console.error('get-scan-by-id error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve scan.' });
  }
};

const deleteScan = async (req: AuthRequest, res: Response<ApiResponse>) => {
  try {
    const scan = await Scan.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!scan) {
      res.status(404).json({ success: false, message: 'Scan not found.' });
      return;
    }
    res.json({ success: true, message: 'Scan deleted.' });
  } catch (err) {
    console.error('delete-scan error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete scan.' });
  }
};


export { saveScanResults, getUserScans, getScanById, deleteScan };
