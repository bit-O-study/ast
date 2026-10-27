import { runResearch } from './research-harness.mjs';
import { TIMEFRAME_STRATEGIES } from '../src/research/timeframes.js';

await runResearch({ id: 'T024', slug: 'timeframes', title: '마감 집계 신호 연구',
  candidates: TIMEFRAME_STRATEGIES, specification: 'docs/tasks/T-024-timeframes.md' });
