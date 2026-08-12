const { logDebug } = require('../debug')

function extractSlug(url) {
    let path = url.split('?')[0]
    path = path.replace(/\/$/, '')
    const parts = path.split('/')
    const lastPart = parts[parts.length - 1]
    
    if (path.includes('/chapter/')) {
        return lastPart.replace(/-\d+$/, '')
    }
    return lastPart
}

const discover = async (page, rawUrl, chaptersRange, priorityTeams, isTargetChapter) => {
    const slug = extractSlug(rawUrl)
    const chapters = []
    let novelUrl = rawUrl
    
    if (rawUrl.includes('/chapter/')) {
        novelUrl = `https://wuxiaworld.eu/novel/${slug}`
    }

    try {
        await page.goto(novelUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
        const links = await page.$$eval('a', anchors => {
            return anchors
                .filter(a => a.href.includes('/chapter/'))
                .map(a => ({ url: a.href, text: a.innerText }))
        })

        for (const link of links) {
            const urlParts = link.url.split('-')
            const chapterStr = urlParts[urlParts.length - 1]
            const chapterNum = parseFloat(chapterStr)
            
            if (!isNaN(chapterNum) && isTargetChapter(chapterNum, chaptersRange)) {
                chapters.push({
                    chapter: chapterNum,
                    volume: 1,
                    name: link.text.trim() || `Chapter ${chapterNum}`,
                    branch_id: null,
                    team: 'WuxiaWorld',
                    url: link.url
                })
            }
        }
    } catch (e) {
        logDebug(`Failed to parse DOM links. Relying on fallback generator.`)
    }

    if (chapters.length === 0 && chaptersRange) {
        logDebug(`Using primitive fallback to generate URLs directly based on range.`)
        const parts = chaptersRange.split(',')
        for (let part of parts) {
            part = part.trim()
            if (!part) continue
            
            if (part.includes('-')) {
                const bounds = part.split('-').map(n => parseFloat(n.trim()))
                if (bounds.length === 2 && !isNaN(bounds[0]) && !isNaN(bounds[1])) {
                    const min = Math.min(bounds[0], bounds[1])
                    const max = Math.max(bounds[0], bounds[1])
                    for (let i = min; i <= max; i++) {
                        chapters.push({
                            chapter: i,
                            volume: 1,
                            name: `Chapter ${i}`,
                            branch_id: null,
                            team: 'WuxiaWorld',
                            url: `https://wuxiaworld.eu/chapter/${slug}-${i}`
                        })
                    }
                }
            } else {
                const num = parseFloat(part)
                if (!isNaN(num)) {
                    chapters.push({
                        chapter: num,
                        volume: 1,
                        name: `Chapter ${num}`,
                        branch_id: null,
                        team: 'WuxiaWorld',
                        url: `https://wuxiaworld.eu/chapter/${slug}-${num}`
                    })
                }
            }
        }
    }

    const uniqueChapters = Array.from(new Map(chapters.map(c => [c.chapter, c])).values())
    uniqueChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter))

    return { chapters: uniqueChapters, metadata: { slug } }
}

const extract = async (page, chap) => {
    logDebug(`Navigating to chapter URL: ${chap.url}`)
    await page.goto(chap.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    
    const pageTitle = await page.evaluate(() => {
        const h1 = document.querySelector('h1')
        return h1 ? h1.innerText.trim() : ''
    })

    const paragraphs = await page.$$eval('div#chapterText', divs => 
        divs.map(d => d.textContent.trim()).filter(t => t.length > 0)
    )
    
    const text = paragraphs.join('\n\n')
    
    if (pageTitle) {
        return `${pageTitle}\n\n${text}`
    }
    return text
}

module.exports = { discover, extract }
