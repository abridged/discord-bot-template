const axios = require('axios');

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

async function registerCommunityMember(params, log = () => {}) {
  const { smartAccountAddress, chainId, guildId, completedAt } = params;
  if (!smartAccountAddress || !chainId || !guildId) {
    throw new Error('registerCommunityMember: missing required fields');
  }

  const base = process.env.A2A_PUBLIC_BASE_URL || `http://localhost:${process.env.A2A_PORT || 41241}`;
  const requestId = randomId();
  const payload = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'message/send',
    params: {
      message: {
        messageId: `m-${Date.now()}`,
        parts: [
          {
            kind: 'text',
            text: JSON.stringify({
              skillId: 'register_community_member',
              smartAccountAddress,
              chainId,
              guildId,
              completedAt: completedAt || new Date().toISOString()
            })
          }
        ]
      },
      configuration: { blocking: true }
    }
  };

  const attemptCall = async () => {
    const res = await axios.post(`${base}/`, payload, {
      headers: { 'content-type': 'application/json' },
      timeout: 15000
    });
    return res.data;
  };

  try {
    log('info', { event: 'a2a_call', requestId, guildId: String(guildId) });
    const data = await withRetry(attemptCall, {
      attempts: 2,
      delays: [1000, 2500],
      onRetry: (err, attempt, delay) => log('warn', { event: 'a2a_retry', attempt, delayMs: delay, error: err?.message })
    });

    const txt = data?.result?.parts?.[0]?.text || data?.error?.message || '';
    log('info', { event: 'a2a_result', requestId, outcome: txt });
    return txt;
  } catch (err) {
    log('error', { event: 'a2a_error', requestId, error: err.message });
    throw err;
  }
}

module.exports = {
  registerCommunityMember
};


