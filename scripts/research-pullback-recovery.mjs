import { runResearch } from './research-harness.mjs';
import { PULLBACK_RECOVERY } from '../src/research/pullback-recovery.js';
await runResearch({ id: 'T030', slug: 'pullback-recovery', title: '상승국면 눌림 회복',
  candidates: PULLBACK_RECOVERY, specification: 'docs/tasks/T-030-pullback-recovery.md' });
