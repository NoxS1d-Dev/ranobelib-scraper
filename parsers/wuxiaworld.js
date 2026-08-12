const { logDebug } = require('../debug')

function extractSlug(url) {
    const parts = url.split('?')[0].split('/')
    const namePart = parts[parts.length - 1]
    return namePart.replace(/-\d+$/, '') 
}

const discover = async (page, rawUrl, chaptersRange, priorityTeams, isTargetChapter) => {
    let novelUrl = rawUrl
    
    if (rawUrl.includes('/chapter/')) {
        const slug = extractSlug(rawUrl)
        novelUrl = `https://wuxiaworld.eu/novel/${slug}`
    }

    await page.goto(novelUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    
    const links = await page.$$eval('a', anchors => {
        return anchors
            .filter(a => a.href.includes('/chapter/'))
            .map(a => ({ url: a.href, text: a.innerText }))
    })

    const chapters = []
    for (const link of links) {
        const match = link.url.match(/-(\d+)(?:-|$)/)
        const chapterNum = match ? match[1] : null
        
        if (chapterNum && isTargetChapter(chapterNum, chaptersRange)) {
            chapters.push({
                chapter: chapterNum,
                volume: 1,
                name: link.text.trim(),
                branch_id: null,
                team: 'WuxiaWorld',
                url: link.url
            })
        }
    }

    const uniqueChapters = Array.from(new Map(chapters.map(c => [c.chapter, c])).values())
    uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter))

    const slug = extractSlug(rawUrl)
    return { chapters: uniqueChapters, metadata: { slug } }
}

const extract = async (page, chap) => {
    logDebug(`Navigating to chapter URL: ${chap.url}`)
    await page.goto(chap.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    const paragraphs = await page.$$eval('div#chapterText', divs => 
        divs.map(d => d.textContent.trim()).filter(t => t.length > 0)
    )
    return paragraphs.join('\n\n')
}

module.exports = { discover, extract }
