const express = require('express');
const multer = require('multer');
require('dotenv').config();
const { lookupCatalog } = require('./catalogAdapter');

const app = express();
const port = Number(process.env.PORT) || 3000;
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const FREE_SCAN_LIMIT = 8;
const scanCounts = new Map();
const feedbackLog = [];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize },
    fileFilter: (req, file, cb) => cb(null, allowedTypes.has(file.mimetype))
});

const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Access-Control-Max-Age', '86400');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use(express.static(__dirname));
app.use(express.json());

function clientKey(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function getPurchaseLinks(partName, partNumber, source) {
    const searchTerm = [partNumber, partName].filter(Boolean).join(' ') || 'automotive part';
    const encoded = encodeURIComponent(searchTerm);

    const ebayCamp = process.env.AFFILIATE_EBAY_CAMPID || '';
    const amazonTag = process.env.AFFILIATE_AMAZON_TAG || '';
    const rockAff = process.env.AFFILIATE_ROCKAUTO || '';

    let ebay = `https://www.ebay.com/sch/i.html?_nkw=${encoded}`;
    if (ebayCamp) ebay += `&campid=${ebayCamp}&mkcid=1&mkrid=711-53200-19255-0&toolid=10001`;

    let amazon = `https://www.amazon.com/s?k=${encoded}`;
    if (amazonTag) amazon += `&tag=${amazonTag}`;

    let rock = `https://www.rockauto.com/en/catalog/?q=${encoded}`;
    if (rockAff) rock += `&aff=${rockAff}`;

    const links = [
        { label: 'Search eBay', url: ebay },
        { label: 'Search Amazon', url: amazon },
        { label: 'Search RockAuto', url: rock }
    ];

    if (source === 'oem') {
        links.unshift({
            label: 'Search OEM parts',
            url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchTerm + ' OEM')}`
        });
    }
    return links;
}

function getVehicle(req) {
    try {
        const v = JSON.parse(req.body.vehicle || '{}');
        return {
            year: String(v.year || '').trim(),
            make: String(v.make || '').trim(),
            model: String(v.model || '').trim(),
            engine: String(v.engine || '').trim()
        };
    } catch {
        return { year: '', make: '', model: '', engine: '' };
    }
}

function vehicleLabel(v) {
    return [v.year, v.make, v.model, v.engine].filter(Boolean).join(' ');
}

function isValidSource(s) {
    return s === 'oem' || s === 'aftermarket';
}

function openAIError(status, code) {
    if (status === 401) return 'OpenAI rejected the API key. Check it and restart.';
    if (status === 403) return 'This key lacks access to the model.';
    if (status === 429 && code === 'insufficient_quota') return 'No OpenAI quota left. Check billing.';
    if (status === 429) return 'Rate limited. Try again shortly.';
    if (status === 400 && code === 'model_not_found') return 'Vision model unavailable.';
    if (status >= 500) return 'OpenAI is down. Try again.';
    return `OpenAI error (HTTP ${status}).`;
}

app.post('/api/identify', upload.single('photo'), async (req, res) => {
    const key = clientKey(req);
    const used = scanCounts.get(key) || 0;
    if (used >= FREE_SCAN_LIMIT) {
        return res.status(402).json({
            error: `Free limit reached (${FREE_SCAN_LIMIT}). Upgrade for confirmed catalog results.`,
            upgrade: true,
            scansRemaining: 0
        });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'Upload a JPG, PNG, or WEBP under 10 MB.' });
    }

    const source = isValidSource(req.body.source) ? req.body.source : 'aftermarket';
    const vehicle = getVehicle(req);
    const vehicleText = vehicleLabel(vehicle) || 'an unspecified vehicle';

    if (!process.env.OPENAI_API_KEY) {
        scanCounts.set(key, used + 1);
        return res.json({
            demo: true,
            source,
            partName: 'Brake pad set',
            description: 'Demo result. Add an OpenAI key for real vision identification.',
            confidence: 86,
            partNumber: null,
            fitmentSummary: `Demo fitment for ${vehicleText}.`,
            crossReferences: [
                { partNumber: 'DEMO-001', brand: 'Example', notes: 'Candidate only' },
                { partNumber: 'DEMO-002', brand: 'Example', notes: 'Candidate only' }
            ],
            catalogVerified: false,
            catalogProvider: process.env.CATALOG_PROVIDER || 'not configured',
            catalogStatus: 'Demo — catalog not checked',
            purchaseLinks: getPurchaseLinks('Brake pad set', null, source),
            scansRemaining: FREE_SCAN_LIMIT - (used + 1)
        });
    }

    try {
        const image = req.file.buffer.toString('base64');
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            signal: AbortSignal.timeout(30000),
            body: JSON.stringify({
                model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: `Identify this automotive part for ${vehicleText} (${source}). Return JSON: partName, description, confidence (0-100), partNumber (string or null), fitmentSummary. Never invent a part number.` },
                        { type: 'image_url', image_url: { url: `data:${req.file.mimetype};base64,${image}` } }
                    ]
                }]
            })
        });

        if (!aiRes.ok) {
            const body = await aiRes.json().catch(() => ({}));
            const err = new Error(openAIError(aiRes.status, body.error?.code));
            err.publicMessage = err.message;
            throw err;
        }

        const completion = await aiRes.json();
        const content = completion.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty AI result.');
        const result = JSON.parse(content);
        if (!result.partName) throw new Error('Invalid AI result.');

        const catalog = await lookupCatalog({ vehicle, partName: result.partName, partNumber: result.partNumber, source });
        scanCounts.set(key, used + 1);

        res.json({
            ...result,
            source,
            vehicle,
            ...catalog,
            purchaseLinks: catalog.purchaseLinks?.length ? catalog.purchaseLinks : getPurchaseLinks(result.partName, result.partNumber, source),
            demo: false,
            scansRemaining: FREE_SCAN_LIMIT - (used + 1)
        });
    } catch (err) {
        console.error('Identify failed:', err.message);
        res.status(502).json({ error: err.publicMessage || 'Identification service unavailable.' });
    }
});

app.post('/api/feedback', (req, res) => {
    const { correct, partName, partNumber, notes, vehicle } = req.body || {};
    const entry = {
        timestamp: new Date().toISOString(),
        correct: Boolean(correct),
        partName, partNumber, notes, vehicle,
        ip: clientKey(req)
    };
    feedbackLog.push(entry);
    console.log('Feedback:', entry);
    res.json({ ok: true });
});

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Image too large or invalid type (max 10 MB, JPG/PNG/WEBP).' });
    }
    console.error(err);
    res.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => console.log(`WhatPart running at http://localhost:${port}`));
