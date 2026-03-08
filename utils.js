const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

function extractBookSlug(url) {
    let path = url.split('?')[0];
    path = path.replace(/^https?:\/\/[^/]+\/ru\//, '');
    path = path.replace(/^(?:book|manga)\//, '');
    return path.split('/')[0];
}

async function createBrowser() {
    return await chromium.launch({ headless: true });
}

module.exports = {
    extractBookSlug,
    createBrowser
};
