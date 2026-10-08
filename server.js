const path = require('path');
const express = require('express');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const maxFileSize = 10 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize },
    fileFilter: (request, file, callback) => callback(null, allowedTypes.has(file.mimetype))
});

// The Capacitor client is hosted on a different origin from the API. Keep the
// API usable from the configured mobile/web clients without allowing arbitrary
// origins in production.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Vary', 'Origin');
        response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader('Access-Control-Max-Age', '86400');
    }
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    next();
});

app.use(express.static(__dirname));

function getPurchaseLinks(partName, partNumber, source) {
    const searchTerm = [partNumber, partName].filter(Boolean).join(' ') || 'automotive part';
    const encodedSearch = encodeURIComponent(searchTerm);
    const links = [
        { label: 'Search eBay', url: `https://www.ebay.com/sch/i.html?_nkw=${encodedSearch}` },
        { label: 'Search Amazon', url: `https://www.amazon.com/s?k=${encodedSearch}` },
        { label: 'Search RockAuto', url: `https://www.rockauto.com/en/catalog/?q=${encodedSearch}` }
    ];
    if (source === 'oem') {
        links.unshift({ label: 'Search OEM parts', url: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(`${searchTerm} OEM`)}` });
    }
    return links;
}

function getVehicle(request) {
    try {
        const vehicle = JSON.parse(request.body.vehicle || '{}');
        return {
            year: String(vehicle.year || '').trim(),
            make: String(vehicle.make || '').trim(),
            model: String(vehicle.model || '').trim(),
            engine: String(vehicle.engine || '').trim()
        };
    } catch (error) {
        return { year: '', make: '', model: '', engine: '' };
    }
}

function vehicleLabel(vehicle) {
    return [vehicle.year, vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(' ');
}

function isValidSource(source) {
    return source === 'oem' || source === 'aftermarket';
}

async function lookupCatalog({ vehicle, partName, partNumber, source }) {
    const catalogUrl = process.env.CATALOG_API_URL;
    const provider = process.env.CATALOG_PROVIDER || 'not configured';
    if (!catalogUrl || !process.env.CATALOG_API_KEY) {
        return { catalogVerified: false, catalogProvider: provider, catalogStatus: 'No catalog provider configured' };
    }

    try {
        const catalogResponse = await fetch(catalogUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.CATALOG_API_KEY}`
            },
            body: JSON.stringify({ vehicle, partName, partNumber, source }),
            signal: AbortSignal.timeout(10000)
        });
        if (!catalogResponse.ok) throw new Error(`Catalog provider returned ${catalogResponse.status}.`);
        const catalogResult = await catalogResponse.json();
        return {
            catalogVerified: true,
            catalogProvider: provider,
            catalogStatus: 'Confirmed by catalog provider',
            fitmentSummary: catalogResult.fitmentSummary,
            crossReferences: Array.isArray(catalogResult.crossReferences) ? catalogResult.crossReferences : [],
            purchaseLinks: Array.isArray(catalogResult.purchaseLinks) ? catalogResult.purchaseLinks : []
        };
    } catch (error) {
        console.error(`Catalog lookup failed (${provider}):`, error.message);
        return { catalogVerified: false, catalogProvider: provider, catalogStatus: 'Catalog lookup unavailable' };
    }
}

app.post('/api/identify', upload.single('photo'), async (request, response) => {
    if (!request.file) {
        return response.status(400).json({ error: 'Please upload a JPG, PNG, or WEBP image under 10 MB.' });
    }

    const source = isValidSource(request.body.source) ? request.body.source : 'aftermarket';
    const vehicle = getVehicle(request);
    const vehicleText = vehicleLabel(vehicle) || 'an unspecified vehicle';

    if (!process.env.OPENAI_API_KEY) {
        const demoPart = 'Brake pad set';
        return response.json({
            demo: true, source, partName: demoPart,
            description: 'Demo response: add an OpenAI key to identify the uploaded component with vision.',
            confidence: 86, partNumber: null,
            fitmentSummary: `Demo fitment for ${vehicleText}. Add an exact vehicle and parts catalog to confirm compatibility.`,
            crossReferences: [
                { partNumber: 'DEMO-REF-001', brand: 'Example brand', notes: 'Candidate only' },
                { partNumber: 'DEMO-REF-002', brand: 'Example brand', notes: 'Candidate only' }
            ],
            catalogVerified: false,
            catalogProvider: process.env.CATALOG_PROVIDER || 'not configured',
            catalogStatus: 'Demo result; catalog not checked',
            purchaseLinks: getPurchaseLinks(demoPart, null, source)
        });
    }

    try {
        const image = request.file.buffer.toString('base64');
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            signal: AbortSignal.timeout(30000),
            body: JSON.stringify({
                model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                messages: [{ role: 'user', content: [
                    { type: 'text', text: `Identify this automotive part for ${vehicleText} and a ${source === 'oem' ? 'genuine OEM' : 'quality aftermarket'} purchase. Return JSON with partName, description, confidence (number 0-100), partNumber (string or null), and fitmentSummary. Do not invent an exact part number when it cannot be read.` },
                    { type: 'image_url', image_url: { url: `data:${request.file.mimetype};base64,${image}` } }
                ] }]
            })
        });
        if (!aiResponse.ok) throw new Error(`AI service returned ${aiResponse.status}.`);
        const completion = await aiResponse.json();
        const content = completion.choices?.[0]?.message?.content;
        if (!content) throw new Error('AI service returned an empty result.');
        const result = JSON.parse(content);
        if (!result.partName || typeof result.partName !== 'string') throw new Error('AI service returned an invalid result.');
        const catalogResult = await lookupCatalog({ vehicle, partName: result.partName, partNumber: result.partNumber, source });
        return response.json({
            ...result, source, vehicle, ...catalogResult,
            purchaseLinks: catalogResult.purchaseLinks?.length ? catalogResult.purchaseLinks : getPurchaseLinks(result.partName, result.partNumber, source),
            demo: false
        });
    } catch (error) {
        console.error(error);
        return response.status(502).json({ error: 'The identification service is unavailable right now.' });
    }
});

app.use((error, request, response, next) => {
    if (error instanceof multer.MulterError || error.message === 'File type not allowed') {
        return response.status(400).json({ error: 'Please upload a JPG, PNG, or WEBP image under 10 MB.' });
    }
    console.error(error);
    return response.status(500).json({ error: 'The server encountered an unexpected error.' });
});

app.listen(port, () => console.log(`WhatPart is running at http://localhost:${port}`));
