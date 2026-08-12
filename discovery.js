const fs = require('fs')
const { createBrowser, isTargetChapter } = require('./utils')
const { getParser } = require('./router')
const { logInfo, logError } = require('./debug')

async function discover() {
    const rawUrl = process.argv[2]
    if (!rawUrl) process.exit(1)

    const teamNamesStr = process.argv[3] || ""
    const chaptersRange = process.argv[4] || ""

    const priorityTeams = teamNamesStr.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0)

    logInfo(`Target Link: ${rawUrl}`)
    logInfo(`Priority Teams: ${priorityTeams.length > 0 ? priorityTeams.join(', ') : 'None'}`)
    logInfo(`Target Chapters: ${chaptersRange || 'All'}`)

    const parser = getParser(rawUrl)
    
    const browser = await createBrowser()
    const context = await browser.newContext()
    const page = await context.newPage()

    const { chapters, metadata } = await parser.discover(page, rawUrl, chaptersRange, priorityTeams, isTargetChapter)

    if (!chapters || chapters.length === 0 || !metadata) {
        logError(`No chapters discovered or failed to get book metadata`)
        await browser.close()
        process.exitCode = 1
        return
    }

    logInfo(`Discovered ${chapters.length} chapters. Saving to chapters.json`)
    fs.writeFileSync('chapters.json', JSON.stringify(chapters, null, 2))
    
    logInfo(`Saving book metadata to metadata.json`)
    fs.writeFileSync('metadata.json', JSON.stringify(metadata, null, 2))

    await browser.close()
}

discover()
