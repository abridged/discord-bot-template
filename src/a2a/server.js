// Allow connecting to managed Postgres with custom CAs (dev/staging)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0';

const express = require('express');
const { A2AExpressApp } = require('@a2a-js/sdk/server/express');
const { DefaultRequestHandler, InMemoryTaskStore } = require('@a2a-js/sdk/server');
const { buildSubjectDid, buildCommunityId, buildMembershipKey } = require('../services/intuition/ids');
const intuitionSetup = require('../services/intuition/setup');
const { configureClient, API_URL_DEV } = require('@0xintuition/graphql');
const { search, sync } = require('@0xintuition/sdk');
const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');
const { setupModels } = require('../quizDatabase');
// Initialize quiz DB once at startup to avoid per-request sync/connection churn
const quizDbReady = setupModels();
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = Number(process.env.A2A_PORT || 41241);
const BASE_URL = process.env.A2A_PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Minimal Agent Card for the Quiz Agent (A2A v0.3 compatible shape)
const agentCard = {
  name: 'Collab.Land Quiz Agent',
  description: 'Attests that a user (smart account) belongs to a Discord community after quiz completion',
  url: BASE_URL,
  protocolVersion: '0.3',
  version: '1.0.0',
  preferredTransport: 'JSONRPC',
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  capabilities: {},
  skills: [
    {
      id: 'register_community_member',
      name: 'Register Community Member',
      description: 'Record a smart-account user\'s membership in a Discord community (post-quiz)',
      tags: ['quiz', 'registry']
    }
  ]
};

// Health endpoint for quick checks
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'a2a-quiz-agent', timestamp: new Date().toISOString() });
});

// Serve Agent Card per A2A discovery convention
app.get('/.well-known/agent-card.json', (_req, res) => {
  res.json(agentCard);
});

// ---------- Minimal A2A runtime: register_community_member skill ----------

// Simple in-memory dedupe to mask indexing lag in search results
const inflightMemberships = new Set();

// Basic metrics
const metrics = {
  written: 0,
  skippedLocal: 0,
  skippedRemote: 0,
  writeErrors: 0,
  searchErrors: 0
};

function randomId() {
  return 'r-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function jitter(ms, pct = 0.2) {
  const d = ms * pct;
  return Math.max(0, Math.round(ms + (Math.random() * 2 - 1) * d));
}

async function withRetry(fn, { attempts, delays, onRetry }) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(i + 1);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = jitter(delays[i] || 0);
        if (onRetry) try { onRetry(err, i + 1, delay); } catch(_){}
        await sleep(delay);
        continue;
      }
      throw lastErr;
    }
  }
}

// Init GraphQL client
configureClient({ apiUrl: process.env.INTUITION_GRAPHQL_URL || API_URL_DEV });
const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.INTUITION_RPC_URL || process.env.RPC_URL || 'https://sepolia.base.org') });

const taskStore = new InMemoryTaskStore();

const executor = {
  async execute(requestContext, eventBus) {
    try {
      const { task } = requestContext;
      const userMessage = requestContext.userMessage;
      const requestId = randomId();
      const startedAt = Date.now();

      const log = (level, data) => {
        try {
          console.log(JSON.stringify({
            ts: new Date().toISOString(),
            level,
            requestId,
            ...data
          }));
        } catch (_) {}
      };

      // Accept either task-based or message-based invocation
      const textFromTask = task?.input?.parts?.find(p => p.kind === 'text')?.text;
      const textFromMessage = userMessage?.parts?.find(p => p.kind === 'text')?.text;

      let payload = {};
      try {
        payload = JSON.parse(textFromTask || textFromMessage || '{}');
      } catch (_) {
        payload = {};
      }

      const skill = task?.skillId || payload?.skillId;
      if (skill !== 'register_community_member') {
        eventBus.publish({ kind: 'message', role: 'agent', messageId: String(Date.now()), parts: [{ kind: 'text', text: 'unsupported skill' }] });
        eventBus.finished();
        return;
      }

      const { smartAccountAddress, chainId, guildId, completedAt } = payload;

      if (!smartAccountAddress || !chainId || !guildId) {
        throw new Error('missing required fields: smartAccountAddress, chainId, guildId');
      }

      const subjectDid = buildSubjectDid(chainId, smartAccountAddress);
      const communityId = buildCommunityId(guildId);
      const membershipKey = buildMembershipKey(subjectDid, communityId);

      log('info', { skillId: 'register_community_member', action: 'localCheck', subjectDid, guildId: String(guildId), membershipKey });

      // Fast-path dedupe while an attestation is being written or recently written
      if (inflightMemberships.has(membershipKey)) {
        log('info', { action: 'localCheck', outcome: 'inflight', durationMs: Date.now() - startedAt });
        eventBus.publish({ kind: 'message', role: 'agent', messageId: String(Date.now()), parts: [{ kind: 'text', text: `skipped: in-progress (${membershipKey})` }] });
        eventBus.finished();
        return;
      }

      // Persistent local dedupe first (DB)
      const quizDb = await quizDbReady;
      try {
        const existingLocal = await quizDb.MembershipRegistration.findOne({ where: { membershipKey } });
        if (existingLocal) {
          metrics.skippedLocal++;
          // On-chain verify check: if txHash exists and not yet verified, try once.
          let verified = !!existingLocal.verifyOnChainAt;
          try {
            if (existingLocal.txHash && !verified) {
              const receipt = await publicClient.getTransactionReceipt({ hash: existingLocal.txHash });
              if (receipt && receipt.blockNumber) {
                await quizDb.MembershipRegistration.update(
                  { verifyOnChainAt: new Date() },
                  { where: { id: existingLocal.id } }
                );
                verified = true;
              }
            }
          } catch (verr) {
            log('warn', { action: 'verifyOnChain', errorMessage: verr.message });
          }
          const verifyNote = verified ? ' verified' : '';
          log('info', { action: 'localCheck', outcome: 'found', verified, durationMs: Date.now() - startedAt });
          eventBus.publish({ kind: 'message', role: 'agent', messageId: String(Date.now()), parts: [{ kind: 'text', text: `skipped: already attested (local${verifyNote}) (${membershipKey})` }] });
          eventBus.finished();
          return;
        }
        log('info', { action: 'localCheck', outcome: 'not_found' });
      } catch (dbErr) {
        log('warn', { action: 'localCheck', outcome: 'error', errorMessage: dbErr.message });
      }

      // Secondary dedupe: search for existing membership attestation by this agent (publisher)
      const trusted = [];
      if (intuitionSetup?.account?.address) {
        trusted.push(intuitionSetup.account.address.toLowerCase());
      }
      if (process.env.A2A_TRUSTED_PUBLISHER && /^0x[0-9a-fA-F]{40}$/.test(process.env.A2A_TRUSTED_PUBLISHER)) {
        trusted.push(process.env.A2A_TRUSTED_PUBLISHER.toLowerCase());
      }

      log('info', { action: 'remoteSearch', trustedCount: trusted.length });

      const results = await withRetry(
        async (attempt) => {
          const r = await search([
            { type: 'community_membership' },
            { subject: subjectDid },
            { community: communityId }
          ], trusted.length ? trusted : []);
          return r;
        },
        {
          attempts: 3,
          delays: [250, 750, 1500],
          onRetry: (err, attempt, delay) => {
            metrics.searchErrors++;
            log('warn', { action: 'remoteSearch', attempt, retryInMs: delay, errorMessage: err?.message });
          }
        }
      );

      const exists = results && Object.keys(results).length > 0;
      if (exists) {
        metrics.skippedRemote++;
        log('info', { action: 'remoteSearch', outcome: 'found', durationMs: Date.now() - startedAt });
        eventBus.publish({ kind: 'message', role: 'agent', messageId: String(Date.now()), parts: [{ kind: 'text', text: `skipped: already attested (${membershipKey})` }] });
        eventBus.finished();
        return;
      }
      log('info', { action: 'remoteSearch', outcome: 'not_found' });

      // Write attestation (flat KV)
      const data = {
        [membershipKey]: {
          type: 'community_membership',
          subject: subjectDid,
          community: communityId,
          attestedBy: 'did:collabland:quiz-agent',
          timestamp: completedAt || new Date().toISOString()
        }
      };

      inflightMemberships.add(membershipKey);

      // Capture tx hash from SDK logs if not directly returned
      let txHash = null;
      const originalLog = console.log;
      try {
        console.log = (...args) => {
          try {
            const joined = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
            const match = joined.match(/0x[a-fA-F0-9]{64}/);
            if (match && !txHash) txHash = match[0];
          } catch (_) {}
          return originalLog.apply(console, args);
        };
      } catch (_) {}

      await withRetry(
        async (attempt) => {
          log('info', { action: 'write', attempt });
          const res = await sync({
            walletClient: intuitionSetup.walletClient,
            publicClient: intuitionSetup.publicClient,
            address: intuitionSetup.address
          }, data);
          return res;
        },
        {
          attempts: 2,
          delays: [1000, 3000],
          onRetry: (err, attempt, delay) => {
            metrics.writeErrors++;
            log('warn', { action: 'write', attempt, retryInMs: delay, errorMessage: err?.message });
          }
        }
      );

      try { console.log = originalLog; } catch (_) {}

      // Persist local record
      try {
        await quizDb.MembershipRegistration.create({
          subjectDid,
          guildId,
          membershipKey,
          attestedAt: new Date(),
          txHash: txHash || null
        });
      } catch (dbErr) {
        log('warn', { action: 'persistLocal', outcome: 'error', errorMessage: dbErr.message });
      }

      const suffix = txHash ? ` tx=${txHash}` : '';
      metrics.written++;
      log('info', { action: 'final', outcome: 'ok_written', txHash, durationMs: Date.now() - startedAt, metrics });
      eventBus.publish({ kind: 'message', role: 'agent', messageId: String(Date.now()), parts: [{ kind: 'text', text: `ok: written (${membershipKey})${suffix}` }] });
      eventBus.finished();
      // Keep the key for a grace period (5 minutes) to allow indexers to catch up
      setTimeout(() => inflightMemberships.delete(membershipKey), 300000);
    } catch (err) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'error', errorMessage: err.message }));
      eventBus.publish({ kind: 'message', role: 'agent', messageId: String(Date.now()), parts: [{ kind: 'text', text: `error: ${err.message}` }] });
      eventBus.finished();
      // Best-effort cleanup on error
      // Note: membershipKey might be undefined if parsing failed; guard against that
      try {
        if (typeof membershipKey === 'string') inflightMemberships.delete(membershipKey);
      } catch (_) {}
    }
  },
  async cancelTask(_taskId, _eventBus) {}
};

const requestHandler = new (require('@a2a-js/sdk/server').DefaultRequestHandler)(agentCard, taskStore, executor);
const a2aApp = new A2AExpressApp(requestHandler).setupRoutes(express(), '');
app.use(a2aApp);

let server = null;
if (!process.env.VERCEL && process.env.SERVERLESS !== 'true') {
  server = app.listen(PORT, () => {
    console.log(`[A2A] Quiz Agent server listening on ${BASE_URL}`);
    console.log(`[A2A] Agent Card: ${BASE_URL}/.well-known/agent-card.json`);
  });
}

process.on('SIGTERM', () => {
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  if (server) {
    server.close(() => process.exit(0));
  } else {
    process.exit(0);
  }
});

module.exports = app;


