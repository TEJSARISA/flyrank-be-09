'use strict';

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// In-memory job store
const jobs = {};

// ── Worker: process a job with retries ───────────────────────────────────
async function processJob(job) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      job.status = 'running';
      job.attempt = attempt;
      job.updatedAt = new Date().toISOString();

      // Simulate slow work (e.g. an AI API call)
      const result = await doWork(job.payload);

      job.status = 'done';
      job.result = result;
      job.updatedAt = new Date().toISOString();
      return;
    } catch (err) {
      job.lastError = err.message;
      job.updatedAt = new Date().toISOString();

      if (attempt < MAX_RETRIES) {
        job.status = 'retrying';
        await sleep(RETRY_DELAY_MS * attempt);
      } else {
        job.status = 'failed';
      }
    }
  }
}

// Simulate slow AI/work operation (replace with real Groq/OpenAI call)
async function doWork(payload) {
  await sleep(1000); // simulate latency
  return {
    summary: `Processed: ${JSON.stringify(payload)}`,
    processedAt: new Date().toISOString(),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── POST /jobs ──────────────────────────────────────────────────────────────────────
app.post('/jobs', (req, res) => {
  const payload = req.body;

  if (!payload || Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'Request body (payload) is required' });
  }

  const id = crypto.randomUUID();
  const job = {
    id,
    status: 'queued',
    payload,
    attempt: 0,
    result: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  jobs[id] = job;

  // Fire-and-forget: do not await
  processJob(job).catch((err) => {
    job.status = 'failed';
    job.lastError = err.message;
    job.updatedAt = new Date().toISOString();
  });

  return res.status(202).json({
    id,
    status: 'queued',
    statusUrl: `/jobs/${id}`,
  });
});

// ── GET /jobs/:id (status polling) ─────────────────────────────────────────────
app.get('/jobs/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json(job);
});

// ── GET /jobs (list all) ───────────────────────────────────────────────────────
app.get('/jobs', (req, res) => {
  return res.json(Object.values(jobs));
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Background job server listening on port ${PORT}`));

module.exports = app;
