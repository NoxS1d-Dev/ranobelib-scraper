const { chromium } = require('playwright');
const fs = require('fs');

async function initBrowser() {
    const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    return { browser, page };
}

function saveJson(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

function loadJson(filename) {
    if (!fs.existsSync(filename)) return null;
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { initBrowser, saveJson, loadJson, sleep };
