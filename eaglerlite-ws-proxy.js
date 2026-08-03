#!/usr/bin/env node
/**
 * EaglerLite WebSocket Proxy Server
 *
 * A simple WebSocket-to-WebSocket proxy that gives EaglerLite connections
 * a real origin instead of "Origin: null" (which about:blank tabs produce).
 *
 * HOW IT WORKS:
 *   1. EaglerLite's optimizer wraps window.WebSocket to rewrite URLs:
 *      wss://game-server.com → wss://this-proxy/?target=wss%3A%2F%2Fgame-server.com
 *   2. This proxy receives the WebSocket, parses the ?target= query param
 *   3. Creates a new WebSocket to the target (with a real origin)
 *   4. Tunnels frames bidirectionally
 *
 * DEPLOYMENT:
 *   Option A — Local (for testing):
 *     npm install ws
 *     node eaglerlite-ws-proxy.js
 *     # Proxy runs on ws://localhost:8080
 *     # In EaglerLite, enter: ws://localhost:8080
 *
 *   Option B — Render.com (free tier, recommended):
 *     1. Create a new Web Service on render.com
 *     2. Connect your repo (or use this file)
 *     3. Build command: npm install ws
 *     4. Start command: node eaglerlite-ws-proxy.js
 *     5. Your proxy URL: wss://your-app.onrender.com
 *
 *   Option C — Railway / Fly.io / Heroku:
 *     Similar to Render. Make sure the port is read from process.env.PORT.
 *
 *   Option D — With TLS (for wss://):
 *     Put behind nginx/Caddy with a TLS cert, OR use a platform that
 *     provides TLS automatically (Render, Railway, etc.).
 *
 * SECURITY NOTE:
 *   This is an open proxy — anyone with the URL can use it. For production:
 *   - Add an API key (check ?key= query param against a secret)
 *   - Add rate limiting (max connections per IP)
 *   - Add a target whitelist (only allow specific game servers)
 *   See the SECURITY section below for how to enable these.
 *
 * License: Apache 2.0 (same as EaglerLite)
 */

const http = require('http');
const WebSocket = require('ws');

// === CONFIGURATION ===

const PORT = process.env.PORT || 8080;

// SECURITY: Set an API key to restrict access. Leave empty for no auth.
// If set, clients must include ?key=<API_KEY> in their proxy URL.
const API_KEY = process.env.PROXY_API_KEY || '';

// SECURITY: Max concurrent connections per IP (0 = unlimited)
const MAX_CONN_PER_IP = 0;

// SECURITY: Optional target whitelist. If non-empty, only these targets are allowed.
// Example: ['wss://anarchy.playit.plus', 'wss://mc.voidsent.net']
const TARGET_WHITELIST = [];

// === RATE LIMITING ===

const connCounts = new Map(); // ip → count

function checkRateLimit(ip) {
    if (MAX_CONN_PER_IP <= 0) return true;
    const count = connCounts.get(ip) || 0;
    if (count >= MAX_CONN_PER_IP) return false;
    connCounts.set(ip, count + 1);
    return true;
}

function releaseConn(ip) {
    if (MAX_CONN_PER_IP <= 0) return;
    const count = connCounts.get(ip) || 0;
    if (count <= 1) connCounts.delete(ip);
    else connCounts.set(ip, count - 1);
}

// === TARGET WHITELIST CHECK ===

function isTargetAllowed(targetUrl) {
    if (TARGET_WHITELIST.length === 0) return true;
    return TARGET_WHITELIST.some(allowed => targetUrl.startsWith(allowed));
}

// === PROXY SERVER ===

const server = http.createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/' || req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('EaglerLite WebSocket Proxy — OK');
        return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Use WebSocket to connect.');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs, req) => {
    const clientIp = req.socket.remoteAddress;

    // Parse the target URL from query string
    const urlObj = new URL(req.url, 'http://localhost');
    const targetUrl = urlObj.searchParams.get('target');

    // Check API key if configured
    if (API_KEY) {
        const key = urlObj.searchParams.get('key');
        if (key !== API_KEY) {
            console.log(`[REJECT] ${clientIp} — invalid API key`);
            clientWs.close(1008, 'Unauthorized');
            return;
        }
    }

    // Validate target URL
    if (!targetUrl) {
        console.log(`[REJECT] ${clientIp} — no target URL`);
        clientWs.close(1008, 'Missing target URL');
        return;
    }

    if (!targetUrl.startsWith('ws://') && !targetUrl.startsWith('wss://')) {
        console.log(`[REJECT] ${clientIp} — invalid target: ${targetUrl}`);
        clientWs.close(1008, 'Target must be ws:// or wss://');
        return;
    }

    // Check whitelist
    if (!isTargetAllowed(targetUrl)) {
        console.log(`[REJECT] ${clientIp} — target not whitelisted: ${targetUrl}`);
        clientWs.close(1008, 'Target not allowed');
        return;
    }

    // Check rate limit
    if (!checkRateLimit(clientIp)) {
        console.log(`[REJECT] ${clientIp} — rate limited`);
        clientWs.close(1008, 'Too many connections');
        return;
    }

    console.log(`[CONNECT] ${clientIp} → ${targetUrl}`);

    // Connect to the target server
    let targetWs;
    try {
        targetWs = new WebSocket(targetUrl, {
            // Set a real Origin header so the target doesn't see "null"
            headers: {
                'Origin': 'https://eaglerlite-proxy.local',
                'User-Agent': 'EaglerLite-WebSocket-Proxy/1.0'
            }
        });
    } catch (e) {
        console.log(`[ERROR] ${clientIp} — failed to create target WebSocket: ${e.message}`);
        clientWs.close(1008, 'Failed to connect to target');
        releaseConn(clientIp);
        return;
    }

    let targetOpened = false;
    let closed = false;

    function cleanup() {
        if (closed) return;
        closed = true;
        releaseConn(clientIp);
        try { if (targetWs.readyState === WebSocket.OPEN || targetWs.readyState === WebSocket.CONNECTING) targetWs.close(); } catch(_) {}
        try { if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) clientWs.close(); } catch(_) {}
    }

    // Target → Client
    targetWs.on('open', () => {
        targetOpened = true;
        console.log(`[OPEN] ${clientIp} → ${targetUrl}`);
    });

    targetWs.on('message', (data, isBinary) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            try { clientWs.send(data, { binary: isBinary }); } catch(_) { cleanup(); }
        }
    });

    // Client → Target
    clientWs.on('message', (data, isBinary) => {
        if (targetWs.readyState === WebSocket.OPEN) {
            try { targetWs.send(data, { binary: isBinary }); } catch(_) { cleanup(); }
        }
    });

    // Close handlers
    targetWs.on('close', (code, reason) => {
        console.log(`[CLOSE] ${clientIp} ← ${targetUrl} (code: ${code})`);
        if (clientWs.readyState === WebSocket.OPEN) {
            try { clientWs.close(code, reason); } catch(_) {}
        }
        cleanup();
    });

    clientWs.on('close', () => {
        console.log(`[CLOSE] ${clientIp} (client disconnected)`);
        cleanup();
    });

    // Error handlers
    targetWs.on('error', (err) => {
        console.log(`[ERROR] ${clientIp} — target error: ${err.message}`);
        if (!targetOpened) {
            try { clientWs.close(1008, 'Target connection failed'); } catch(_) {}
        }
        cleanup();
    });

    clientWs.on('error', () => {
        cleanup();
    });
});

server.listen(PORT, () => {
    console.log(`[EaglerLite WebSocket Proxy] Listening on port ${PORT}`);
    console.log(`[EaglerLite WebSocket Proxy] API key: ${API_KEY ? 'enabled' : 'disabled'}`);
    console.log(`[EaglerLite WebSocket Proxy] Max conns/IP: ${MAX_CONN_PER_IP || 'unlimited'}`);
    console.log(`[EaglerLite WebSocket Proxy] Target whitelist: ${TARGET_WHITELIST.length ? TARGET_WHITELIST.join(', ') : 'disabled (all targets allowed)'}`);
});
