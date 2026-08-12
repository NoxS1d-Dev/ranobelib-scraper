const { chromium } = require('playwright')

function isTargetChapter(chapterNumber, rangeString) {
    if (!rangeString || rangeString.trim() === "") return true

    const targetNum = parseFloat(chapterNumber)
    if (isNaN(targetNum)) return false

    const parts = rangeString.split(',')

    for (let part of parts) {
        part = part.trim()
        if (!part) continue

        if (part.includes('-')) {
            const bounds = part.split('-').map(n => parseFloat(n.trim()))
            if (bounds.length === 2 && !isNaN(bounds[0]) && !isNaN(bounds[1])) {
                if (targetNum >= Math.min(...bounds) && targetNum <= Math.max(...bounds)) {
                    return true
                }
            }
        } else {
            if (!isNaN(parseFloat(part)) && targetNum === parseFloat(part)) {
                return true
            }
        }
    }
    return false
}

async function createBrowser() {
    return await chromium.launch({ headless: true })
}

module.exports = {
    isTargetChapter,
    createBrowser
}
