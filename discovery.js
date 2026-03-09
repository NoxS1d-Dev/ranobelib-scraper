const fs = require('fs');
const { createBrowser, extractBookSlug } = require('./utils');

function isTargetChapter(chapterNumber, rangeString) {
    if (!rangeString || rangeString.trim() === "") return true;

    const targetNum = parseFloat(chapterNumber);
    if (isNaN(targetNum)) return false;

    const parts = rangeString.split(',');

    for (let part of parts) {
        part = part.trim();
        if (!part) continue;

        if (part.includes('-')) {
            const bounds = part.split('-').map(n => parseFloat(n.trim()));
            if (bounds.length === 2 && !isNaN(bounds[0]) && !isNaN(bounds[1])) {
                if (targetNum >= Math.min(...bounds) && targetNum <= Math.max(...bounds)) {
                    return true;
                }
            }
        } else {
            if (!isNaN(parseFloat(part)) && targetNum === parseFloat(part)) {
                return true;
            }
        }
    }
    return false;
}

async function discover() {
    const rawUrl = process.argv[2];
    if (!rawUrl) process.exit(1);

    const teamNamesStr = process.argv[3] || "";
    const chaptersRange = process.argv[4] || "";

    const baseUrl = rawUrl.split('?')[0];
    const chaptersUrl = `${baseUrl}?section=chapters`;

    const priorityTeams = teamNamesStr.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

    const bookSlug = extractBookSlug(rawUrl);

    console.log(`[INFO] Target Link: ${rawUrl}`);
    console.log(`[INFO] Priority Teams: ${priorityTeams.length > 0 ? priorityTeams.join(', ') : 'None'}`);
    console.log(`[INFO] Target Chapters: ${chaptersRange || 'All'}`);
    console.log(`[INFO] Intercepting network requests for chapter data and slug...`);

    const browser = await createBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    let rawChaptersData = null;
    let fetchedSlug = null;

    page.on('response', async (response) => {
        const url = response.url();
        const resourceType = response.request().resourceType();

        if (resourceType === 'fetch' || resourceType === 'xhr') {
            if (url.includes('/chapters')) {
                try {
                    const json = await response.json();
                    if (json?.data && Array.isArray(json.data)) {
                        rawChaptersData = json.data;
                    }
                } catch (e) {}
            } else if (url.includes(bookSlug)) {
                try {
                    const json = await response.json();
                    if (json?.data && json.data.slug) {
                        fetchedSlug = json.data.slug;
                    }
                } catch (e) {}
            }
        }
    });

    try {
        await page.goto(chaptersUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        for (let i = 0; i < 10; i++) {
            if (rawChaptersData && fetchedSlug) break;
            await page.waitForTimeout(1000);
        }
    } catch (e) {}

    if (!rawChaptersData || !fetchedSlug) {
        await browser.close();
        process.exitCode = 1;
        return;
    }

    const selectedChapters = [];

    for (const chapter of rawChaptersData) {
        if (!isTargetChapter(chapter.number, chaptersRange) || !chapter.branches?.length) {
            continue;
        }

        let bestBranch = chapter.branches[0];
        let bestPriorityIndex = Infinity;

        if (priorityTeams.length > 0) {
            for (const branch of chapter.branches) {
                if (!branch.teams?.length) continue;

                const teamName = branch.teams[0].name.toLowerCase();
                const teamSlug = branch.teams[0].slug.toLowerCase();

                for (let i = 0; i < priorityTeams.length; i++) {
                    if (teamName.includes(priorityTeams[i]) || teamSlug.includes(priorityTeams[i])) {
                        if (i < bestPriorityIndex) {
                            bestPriorityIndex = i;
                            bestBranch = branch;
                        }
                    }
                }
            }
        }

        selectedChapters.push({
            chapter: chapter.number,
            volume: chapter.volume,
            name: chapter.name || "",
            branch_id: bestBranch.branch_id,
            team: bestBranch.teams?.[0]?.name || "Unknown"
        });
    }

    selectedChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter));

    console.log(`[INFO] Saving chapter information to chapters.json...`);
    fs.writeFileSync('chapters.json', JSON.stringify(selectedChapters, null, 2));

    console.log(`[INFO] Saving title information to info.json...`);
    fs.writeFileSync('info.json', JSON.stringify({ slug: fetchedSlug }, null, 2));

    await browser.close();
}

discover();
