const fs = require('fs');
const path = require('path');
const { extractBookSlug, createBrowser } = require('./utils');

async function extract() {
    const rawUrl = process.argv[2];
    if (!rawUrl || !fs.existsSync('chapters.json')) {
        process.exit(1);
    }

    const chaptersData = JSON.parse(fs.readFileSync('chapters.json', 'utf8'));
    const bookSlug = extractBookSlug(rawUrl);
    const baseUrl = rawUrl.split('?')[0];
    const isMergeEnabled = process.env.MERGE_CHAPTERS === 'true';
    let mergedContent = '';

    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const browser = await createBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(6000); 
    } catch (e) {}

    for (const chap of chaptersData) {
        const apiUrl = `https://api.cdnlibs.org/api/manga/${bookSlug}/chapter?branch_id=${chap.branch_id}&number=${chap.chapter}&volume=${chap.volume}`;

        try {
            const result = await page.evaluate(async (url) => {
                const res = await fetch(url);
                if (!res.ok) return { error: true };
                return { data: await res.json() };
            }, apiUrl);

            if (result.error || !result.data) continue;

            let fullText = "";
            const doc = result.data.data?.content || result.data.content;

            if (doc?.content && Array.isArray(doc.content)) {
                for (const block of doc.content) {
                    if (block.type === "paragraph" && block.content) {
                        fullText += block.content
                            .filter(item => item.type === "text")
                            .map(item => item.text)
                            .join("") + "\n";
                    }
                }
            }

            const cleanText = fullText.trim();
            if (cleanText) {
                fs.writeFileSync(path.join(outputDir, `chapter_${chap.chapter}.txt`), cleanText);

                if (isMergeEnabled) {
                    mergedContent += `\n\n=== ${chap.chapter} ===\n\n${cleanText}`;
                }
            }

        } catch (error) {}

        await page.waitForTimeout(Math.floor(Math.random() * 3000) + 2000);
    }

    if (isMergeEnabled && mergedContent.trim() !== "") {
        fs.writeFileSync(path.join(outputDir, 'book.txt'), mergedContent.trim());
    }

    await browser.close();
}

extract();
