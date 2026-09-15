const path = require('path');
const express = require('express');
const multer = require('multer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (request, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        callback(null, allowedTypes.includes(file.mimetype));
    }
});

app.use(express.static(__dirname));

function getPurchaseLinks(partName, partNumber, source) {
    const searchTerm = [partNumber, partName].filter(Boolean).join(' ');
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
        return {};
    }
}

function vehicleLabel(vehicle) {
    return [vehicle.year, vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(' ');
}

async function lookupCatalog({ vehicle, partName, partNumber, source }) {
    const catalogUrl = process.env.CATALOG_API_URL;
    const provider = process.env.CATALOG_PROVIDER || 'not configured';

    if (!catalogUrl || !process.env.CATALOG_API_KEY) {
        return {
            catalogVerified: false,
            catalogProvider: provider,
            catalogStatus: 'No catalog provider configured'
        };
    }

    try {
        const catalogResponse = await fetch(catalogUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.CATALOG_API_KEY}`
            },
            body: JSON.stringify({ vehicle, partName, partNumber, source })
        });

        if (!catalogResponse.ok) throw new Error(`Catalog provider returned ${catalogResponse.status}.`);
        const catalogResult = await catalogResponse.json();
        return {
            catalogVerified: true,
            catalogProvider: provider,
            catalogStatus: 'Confirmed by catalog provider',
            fitmentSummary: catalogResult.fitmentSummary,
            crossReferences: catalogResult.crossReferences || [],
            purchaseLinks: catalogResult.purchaseLinks || []
        };
    } catch (error) {
        console.error(`Catalog lookup failed (${provider}):`, error.message);
        return {
            catalogVerified: false,
            catalogProvider: provider,
            catalogStatus: 'Catalog lookup unavailable'
        };
    }
}

app.post('/api/identify', upload.single('photo'), async (request, response) => {
    if (!request.file) {
        return response.status(400).json({ error: 'Please upload a JPG, PNG, or WEBP image.' });
    }

    const vehicle = getVehicle(request);
    const vehicleText = vehicleLabel(vehicle) || 'an unspecified vehicle';

    if (!process.env.OPENAI_API_KEY) {
        const demoPart = 'Brake pad set';
        return response.json({
            demo: true,
            source: request.body.source || 'aftermarket',
            partName: demoPart,
            description: 'Demo response: add an OpenAI key to identify the uploaded component with vision.',
            confidence: 86,
            partNumber: null,
            fitmentSummary: `Demo fitment for ${vehicleText}. Add an exact vehicle and parts catalog to confirm compatibility.`,
            crossReferences: [
                { partNumber: 'DEMO-REF-001', brand: 'Example brand', notes: 'Candidate only' },
                { partNumber: 'DEMO-REF-002', brand: 'Example brand', notes: 'Candidate only' }
            ],
            catalogVerified: false,
            catalogProvider: process.env.CATALOG_PROVIDER || 'not configured',
            catalogStatus: 'Demo result; catalog not checked',
            purchaseLinks: getPurchaseLinks(demoPart, null, request.body.source)
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
            body: JSON.stringify({
                model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
                response_format: { type: 'json_object' },
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: `Identify this automotive part for ${vehicleText} and a ${request.body.source === 'oem' ? 'genuine OEM' : 'quality aftermarket'} purchase. Return JSON with partName, description, confidence (0-100), partNumber, fitmentSummary, and crossReferences. crossReferences must be an array of objects with partNumber, brand, and notes. Never invent a part number; use null or an empty array when unknown. Treat fitment as a candidate until confirmed by a parts catalog.`
                        },
                        { type: 'image_url', image_url: { url: `data:${request.file.mimetype};base64,${image}` } }
                    ]
                }]
            })
        });

        if (!aiResponse.ok) throw new Error('The AI service returned an error.');
        const completion = await aiResponse.json();
        const result = JSON.parse(completion.choices[0].message.content);
        const catalogResult = await lookupCatalog({
            vehicle,
            partName: result.partName,
            partNumber: result.partNumber,
            source: request.body.source || 'aftermarket'
        });
        return response.json({
            ...result,
            source: request.body.source || 'aftermarket',
            vehicle,
            ...catalogResult,
            purchaseLinks: catalogResult.purchaseLinks?.length
                ? catalogResult.purchaseLinks
                : getPurchaseLinks(result.partName, result.partNumber, request.body.source),
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
    return next(error);
});

app.listen(port, () => {
    console.log(`WhatPart is running at http://localhost:${port}`);
});