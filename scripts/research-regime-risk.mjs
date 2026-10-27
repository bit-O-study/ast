import { runResearch } from './research-harness.mjs';
import { REGIME_RISK } from '../src/research/regime-risk.js';
await runResearch({ id: 'T029', slug: 'regime-risk', title: '국면 진입과 공통 위험관리',
  candidates: REGIME_RISK, specification: 'docs/tasks/T-029-regime-risk.md' });
