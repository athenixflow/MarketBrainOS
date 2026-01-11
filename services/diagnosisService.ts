
import { SystemContracts, getFeatureMetrics, analyzeMarketingAngle, runTestLabComparison, auditConversion } from './geminiService';
import { DiagnosticResult } from '../types';

export class DiagnosisEngine {
  
  static async runFullSuite(): Promise<DiagnosticResult[]> {
    const results: DiagnosticResult[] = [];
    const timestamp = Date.now();

    // 1. SYSTEM HEALTH CHECKS
    const metrics = getFeatureMetrics();
    Object.entries(metrics).forEach(([feature, data]: [string, any]) => {
      if (data.circuitState !== 'CLOSED') {
        results.push({
          id: `health_${feature}`,
          category: 'SYSTEM_HEALTH',
          name: `Circuit Health: ${feature}`,
          status: 'FAIL',
          message: `Circuit is ${data.circuitState}. Failures: ${data.consecutiveFailures}`,
          timestamp
        });
      } else {
        results.push({
          id: `health_${feature}`,
          category: 'SYSTEM_HEALTH',
          name: `Circuit Health: ${feature}`,
          status: 'PASS',
          timestamp
        });
      }
    });

    // 2. CONTRACT INTEGRITY & FUZZING (Offline)
    Object.entries(SystemContracts).forEach(([name, contract]) => {
      // A. Reject Null/Undefined Inputs
      try {
        contract.inputValidator(null);
        results.push({ id: `contract_${name}_null`, category: 'CONTRACT', name: `${name}: Input Fuzzing (Null)`, status: 'FAIL', message: 'Accepted null input', timestamp });
      } catch {
        results.push({ id: `contract_${name}_null`, category: 'CONTRACT', name: `${name}: Input Fuzzing (Null)`, status: 'PASS', timestamp });
      }

      // B. Reject Empty Objects (if applicable)
      try {
        contract.inputValidator({});
        results.push({ id: `contract_${name}_empty`, category: 'CONTRACT', name: `${name}: Input Fuzzing (Empty)`, status: 'FAIL', message: 'Accepted empty object', timestamp });
      } catch {
        results.push({ id: `contract_${name}_empty`, category: 'CONTRACT', name: `${name}: Input Fuzzing (Empty)`, status: 'PASS', timestamp });
      }

      // C. Output Schema Validation (Mocking invalid output)
      // This ensures we don't return "guesswork" to the user.
      try {
        contract.outputValidator({ invalid_schema: true });
        results.push({ id: `contract_${name}_out`, category: 'CONTRACT', name: `${name}: Output Schema Enforcement`, status: 'FAIL', message: 'Accepted invalid output schema', timestamp });
      } catch {
        results.push({ id: `contract_${name}_out`, category: 'CONTRACT', name: `${name}: Output Schema Enforcement`, status: 'PASS', timestamp });
      }
    });

    // 3. VALIDATION LOGIC CHECKS (Meta-Testing)
    // We explicitly test that our validators correctly identify partial/malformed data.
    
    // AngleMiner Strict Array Check
    try {
      SystemContracts.AngleMiner.outputValidator({ 
        prime: [{ title: 'Missing hook' }], // Missing required fields
        supporting: [], 
        exploratory: [] 
      });
      results.push({ id: 'val_angle_strict', category: 'CONTRACT', name: 'AngleMiner: Strict Array Validation', status: 'FAIL', message: 'Accepted malformed array items', timestamp });
    } catch {
      results.push({ id: 'val_angle_strict', category: 'CONTRACT', name: 'AngleMiner: Strict Array Validation', status: 'PASS', timestamp });
    }

    // 4. INTEGRATION FAILURE PATHS
    // We intentionally send bad data to the service functions to ensure they throw expected errors *before* calling AI.
    
    // Test: AngleMiner Invalid Input
    try {
      await analyzeMarketingAngle({ product: "Too short" });
      results.push({ id: 'int_angle_fail', category: 'INTEGRATION', name: 'AngleMiner: Catch Invalid Input', status: 'FAIL', message: 'Did not throw on invalid input', timestamp });
    } catch (e: any) {
      if (e.message.includes("Contract Violation")) {
        results.push({ id: 'int_angle_fail', category: 'INTEGRATION', name: 'AngleMiner: Catch Invalid Input', status: 'PASS', timestamp });
      } else {
        results.push({ id: 'int_angle_fail', category: 'INTEGRATION', name: 'AngleMiner: Catch Invalid Input', status: 'WARN', message: `Threw unexpected error: ${e.message}`, timestamp });
      }
    }

    // Test: TestLab Insufficient Variants
    try {
      await runTestLabComparison('Angles', ['Single Variant']);
      results.push({ id: 'int_testlab_fail', category: 'INTEGRATION', name: 'TestLab: Catch Insufficient Variants', status: 'FAIL', message: 'Accepted single variant', timestamp });
    } catch (e: any) {
      if (e.message.includes("Contract Violation")) {
        results.push({ id: 'int_testlab_fail', category: 'INTEGRATION', name: 'TestLab: Catch Insufficient Variants', status: 'PASS', timestamp });
      } else {
         results.push({ id: 'int_testlab_fail', category: 'INTEGRATION', name: 'TestLab: Catch Insufficient Variants', status: 'WARN', message: `Threw unexpected error: ${e.message}`, timestamp });
      }
    }

    // Test: Conversion Doctor Empty Input
    try {
      await auditConversion('', 'Landing Page');
      results.push({ id: 'int_audit_fail', category: 'INTEGRATION', name: 'ConversionDoctor: Catch Empty Input', status: 'FAIL', message: 'Accepted empty input', timestamp });
    } catch (e: any) {
      if (e.message.includes("Contract Violation")) {
        results.push({ id: 'int_audit_fail', category: 'INTEGRATION', name: 'ConversionDoctor: Catch Empty Input', status: 'PASS', timestamp });
      } else {
        results.push({ id: 'int_audit_fail', category: 'INTEGRATION', name: 'ConversionDoctor: Catch Empty Input', status: 'WARN', message: `Threw unexpected error: ${e.message}`, timestamp });
      }
    }

    return results;
  }
}
