const { initBrowser, loadJson, sleep } = require('./utils');
const { logInfo, logDebug, logError } = require('./debug');
const fs = require('fs');
const path = require('path');

async function extract() {
    const chapters = loadJson('chapters.json');
    if (!chapters) {
        logError('chapters.json not found!');
        process.exit(1);
    }

    const { browser, page } = await initBrowser();
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    try {
        logInfo(`Starting download of ${chapters.length} chapters...`);
        
        for (const chapter of chapters) {
            const { chNum, url, team } = chapter;
            logInfo(`Processing Chapter ${chNum}`);
            logDebug(`Target URL: ${url} | Team: ${team}`);
            
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
            await sleep(2000);

            const content = await page.evaluate(() => {
                const contentNode = document.querySelector('.node-doc.text-content');
                
                if (!contentNode) return null;

                let lines = contentNode.innerText.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                
                return lines.join('\n');
            });

            if (content) {
                fs.writeFileSync(path.join(outputDir, `chapter_${chNum}.txt`), content);
                logDebug(`Saved text to: chapter_${chNum}.txt`);
            } else {
                logInfo(`Skipped chapter ${chNum}. Text element not found.`);
            }
        }
    } catch (err) {
        logError(err.message);
    } finally {
        await browser.close();
        logInfo('Extraction task finished.');
    }
}

extract();
