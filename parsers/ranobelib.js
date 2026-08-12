const { logDebug } = require('../debug')

function extractBookSlug(url) {
    let path = url.split('?')[0]
    path = path.replace(/^https?:\/\/[^/]+\/ru\//, '')
    path = path.replace(/^(?:book|manga)\//, '')
    return path.split('/')[0]
}

const discover = async (page, rawUrl, chaptersRange, priorityTeams, isTargetChapter) => {
    const baseUrl = rawUrl.split('?')[0]
    const chaptersUrl = `${baseUrl}?section=chapters`
    const bookSlug = extractBookSlug(rawUrl)

    let rawChaptersData = null
    let fetchedSlug = null

    const responseHandler = async (response) => {
        const url = response.url()
        const resourceType = response.request().resourceType()

        if (resourceType === 'fetch' || resourceType === 'xhr') {
            if (url.includes('/chapters')) {
                try {
                    const json = await response.json()
                    if (json?.data && Array.isArray(json.data)) rawChaptersData = json.data
                } catch (e) {}
            } else if (url.includes(bookSlug)) {
                try {
                    const json = await response.json()
                    if (json?.data && json.data.slug) fetchedSlug = json.data.slug
                } catch (e) {}
            }
        }
    }

    page.on('response', responseHandler)

    try {
        await page.goto(chaptersUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        let attempt = 0
        while (attempt < 10) {
            if (rawChaptersData && fetchedSlug) break
            await page.waitForTimeout(1000)
            attempt++
        }
    } catch (e) {}

    page.off('response', responseHandler)

    if (!rawChaptersData || !fetchedSlug) return { chapters: [], metadata: null }

    const selectedChapters = []
    for (const chapter of rawChaptersData) {
        if (!isTargetChapter(chapter.number, chaptersRange) || !chapter.branches?.length) continue

        let bestBranch = chapter.branches[0]
        let bestPriorityIndex = Infinity

        if (priorityTeams.length > 0) {
            for (const branch of chapter.branches) {
                if (!branch.teams?.length) continue
                const teamName = branch.teams[0].name.toLowerCase()
                const teamSlug = branch.teams[0].slug.toLowerCase()

                for (const [i, priority] of priorityTeams.entries()) {
                    if (teamName.includes(priority) || teamSlug.includes(priority)) {
                        if (i < bestPriorityIndex) {
                            bestPriorityIndex = i
                            bestBranch = branch
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
        })
    }

    selectedChapters.sort((a, b) => parseFloat(a.chapter) - parseFloat(b.chapter))
    return { chapters: selectedChapters, metadata: { slug: fetchedSlug } }
}

const extract = async (page, chap, metadata) => {
    const apiUrl = `https://api.cdnlibs.org/api/manga/${metadata.slug}/chapter?branch_id=${chap.branch_id}&number=${chap.chapter}&volume=${chap.volume}`

    logDebug(`Requesting API: ${apiUrl}`)
    const result = await page.evaluate(async (url) => {
        const res = await fetch(url)
        if (!res.ok) return { error: true }
        return { data: await res.json() }
    }, apiUrl)

    if (result.error || !result.data) return null

    const doc = result.data.data?.content || result.data.content
    let fullText = ""

    if (typeof doc === 'string') {
        fullText = doc.replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').trim() + '\n'
    } else if (doc?.content && Array.isArray(doc.content)) {
        for (const block of doc.content) {
            if (block.type === "paragraph" && block.content) {
                fullText += block.content.filter(item => item.type === "text").map(item => item.text).join("") + "\n"
            }
        }
    }
    return fullText.trim()
}

module.exports = { discover, extract }
