/**
 * Catalog adapter skeleton for WhatPart.
 *
 * Recommended most affordable real option right now: PartsTech
 * - Genuine free tier ($0) with unlimited parts lookup, suppliers, VIN, diagrams
 * - Partner External API available for embedding
 * - Paid starts ~$45-50/mo for more features
 * - Docs / signup: https://partstech.com/ and their partner API surface
 *
 * Other options (higher cost / enterprise):
 * - WHI Nexpart / Solutions
 * - Epicor
 * - TecDoc (more EU)
 *
 * Contract:
 * Input:  { vehicle, partName, partNumber, source }
 * Output: { catalogVerified, catalogProvider, catalogStatus, fitmentSummary, crossReferences, purchaseLinks }
 */

async function genericLookup({ vehicle, partName, partNumber, source }) {
    const catalogUrl = process.env.CATALOG_API_URL;
    const apiKey = process.env.CATALOG_API_KEY;
    const provider = process.env.CATALOG_PROVIDER || 'generic';

    if (!catalogUrl || !apiKey) {
        return demoFallback(vehicle, partName, partNumber, provider);
    }

    try {
        const response = await fetch(catalogUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({ vehicle, partName, partNumber, source }),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`Provider returned ${response.status}`);
        }

        const data = await response.json();
        return {
            catalogVerified: true,
            catalogProvider: provider,
            catalogStatus: 'Confirmed by catalog provider',
            fitmentSummary: data.fitmentSummary || '',
            crossReferences: Array.isArray(data.crossReferences) ? data.crossReferences : [],
            purchaseLinks: Array.isArray(data.purchaseLinks) ? data.purchaseLinks : []
        };
    } catch (error) {
        console.error(`Catalog lookup failed (${provider}):`, error.message);
        return {
            catalogVerified: false,
            catalogProvider: provider,
            catalogStatus: 'Catalog lookup unavailable',
            fitmentSummary: '',
            crossReferences: [],
            purchaseLinks: []
        };
    }
}

function demoFallback(vehicle, partName, partNumber, provider = 'not configured') {
    const vehicleText = [vehicle.year, vehicle.make, vehicle.model, vehicle.engine].filter(Boolean).join(' ') || 'unspecified vehicle';
    return {
        catalogVerified: false,
        catalogProvider: provider,
        catalogStatus: 'AI candidate — catalog not connected yet (PartsTech free tier recommended)',
        fitmentSummary: `Candidate fitment for ${vehicleText}. Connect PartsTech or another catalog for confirmed interchange.`,
        crossReferences: [
            { partNumber: partNumber || 'CAND-001', brand: 'Example aftermarket', notes: 'Candidate only — verify before ordering' },
            { partNumber: 'CAND-002', brand: 'Example OEM equivalent', notes: 'Candidate only' }
        ],
        purchaseLinks: []
    };
}

// Placeholder for a PartsTech-specific mapper once you have partner credentials.
// Replace the body with real calls to https://api.partstech.com (or beta) after auth.
async function partsTechLookup({ vehicle, partName, partNumber, source }) {
    // TODO: implement once you have PartsTech partner API key + endpoint docs.
    // Typical flow: auth → search by part number / vehicle → map to our contract.
    console.log('PartsTech adapter called — using demo until credentials are set');
    return demoFallback(vehicle, partName, partNumber, 'PartsTech (stub)');
}

async function lookupCatalog(params) {
    const provider = (process.env.CATALOG_PROVIDER || '').toLowerCase();

    if (provider === 'partstech') {
        return partsTechLookup(params);
    }

    return genericLookup(params);
}

module.exports = { lookupCatalog };
