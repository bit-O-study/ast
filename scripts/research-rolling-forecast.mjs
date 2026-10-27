import { runResearch } from './research-harness.mjs';
import { FORECAST_STRATEGIES } from '../src/research/rolling-forecast.js';

await runResearch({ id: 'T025', slug: 'rolling-forecast', title: '순차 기대수익 연구',
  candidates: FORECAST_STRATEGIES, specification: 'docs/tasks/T-025-rolling-forecast.md' });
