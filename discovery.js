const { initBrowser, saveJson, sleep } = require('./utils');
const { logInfo, logDebug, logError } = require('./debug');

async function discover() {
    const rawUrl = process.argv[2];
    const teamInput = process.argv[3] || "";
    const teams = teamInput.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0); 

    const startCh = parseFloat(process.argv[4]);
    const endCh = parseFloat(process.argv[5]);

    const minCh = Math.min(startCh, endCh);
    const maxCh = Math.max(startCh, endCh);

    const baseUrl = rawUrl.split('?')[0];
    const chaptersUrl = `${baseUrl}?section=chapters`;

    logDebug(`Target URL: ${chaptersUrl}`);
    logDebug(`Range: ${minCh} to ${maxCh}`);
    logDebug(`Team Priorities: ${teams.length > 0 ? teams.join(' > ') : 'None (First available)'}`);

    const { browser, page } = await initBrowser();

    const selectedLinks = new Map();
    const seenUrls = new Set();
    let scanComplete = false;
    let lowestLegitSeen = Infinity;
    let scrollAttempts = 0;

    try {
        logInfo('Loading page and starting chapters search...');
        await page.goto(chaptersUrl, { waitUntil: 'networkidle', timeout: 60000 });

        while (!scanComplete && scrollAttempts < 150) {
            const rawElements = await page.$$eval('a[href*="/read/"]', nodes => 
                nodes.map(n => ({ 
                    href: n.href, 
                    anchor: n.innerText.trim(),
                    containerText: n.parentElement ? n.parentElement.innerText.toLowerCase() : ""
                }))
            );

            const batch = [];
            for (const el of rawElements) {
                if (seenUrls.has(el.href)) continue;
                const match = el.href.match(/\/c(\d+(\.\d+)?)/);
                if (match) {
                    batch.push({ ...el, chNum: parseFloat(match[1]) });
                }
            }

            for (let i = 0; i < batch.length; i++) {
                const current = batch[i];
                seenUrls.add(current.href);
                
                logDebug(`Found Chapter: ${current.chNum} | Anchor: ${current.anchor} | URL: ${current.href}`);

                if (current.chNum < lowestLegitSeen) lowestLegitSeen = current.chNum;

                if (current.chNum >= minCh && current.chNum <= maxCh) {
                    let priority = Infinity;
                    let matchedTeam = "Default";

                    if (teams.length === 0) {
                        priority = 0;
                    } else {
                        for (let j = 0; j < teams.length; j++) {
                            if (current.anchor.toLowerCase().includes(teams[j]) || current.containerText.includes(teams[j])) {
                                priority = j;
                                matchedTeam = teams[j];
                                break;
                            }
                        }
                    }

                    if (!selectedLinks.has(current.chNum) || priority < selectedLinks.get(current.chNum).priority) {
                        selectedLinks.set(current.chNum, { url: current.href, team: matchedTeam, priority });
                        logDebug(`Selecting Ch ${current.chNum} from [${matchedTeam}]`);
                    }
                }
            }

            if (lowestLegitSeen <= minCh) {
                logInfo('Chapter scan complete.');
                scanComplete = true;
            } else {
                scrollAttempts++;
                await page.evaluate(() => window.scrollBy(0, 1500));
                await sleep(1500);
            }
        }

        if (selectedLinks.size === 0) {
            throw new Error('Zero chapters discovered. Range might be invalid.');
        }

        const outputData = Array.from(selectedLinks.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([chNum, data]) => ({
                chNum,
                url: data.url,
                team: data.team
            }));

        saveJson('chapters.json', outputData);
        logInfo(`Successfully saved ${outputData.length} links to chapters.json`);

    } catch (err) {
        logError(err.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

discover();
