const fs = require('fs')
const path = require('path')
const { createBrowser } = require('./utils')
const { getParser } = require('./router')
const { logInfo, logError, logDebug } = require('./debug')

async function extract() {
    const rawUrl = process.argv[2]
    if (!rawUrl || !fs.existsSync('chapters.json') || !fs.existsSync('metadata.json')) {
        process.exit(1)
    }

    const chaptersData = JSON.parse(fs.readFileSync('chapters.json', 'utf8'))
    const metadata = JSON.parse(fs.readFileSync('metadata.json', 'utf8'))
    
    const isMergeEnabled = process.env.MERGE_CHAPTERS === 'true'
    let mergedContent = ''

    const outputDir = path.join(__dirname, 'output')
    const chaptersOutputDir = isMergeEnabled ? path.join(outputDir, 'chapters') : outputDir

    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
    if (!fs.existsSync(chaptersOutputDir)) fs.mkdirSync(chaptersOutputDir, { recursive: true })

    const parser = getParser(rawUrl)

    const browser = await createBrowser()
    const context = await browser.newContext()
    const page = await context.newPage()
    
    try {
        const baseUrl = rawUrl.split('?')[0]
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        await page.waitForTimeout(2000)
    } catch (e) {
        logDebug(`Base URL navigation timeout or error, proceeding anyway`)
    }

    for (const chap of chaptersData) {
        logInfo(`Fetching content for chapter ${chap.chapter}...`)

        let fetchSuccess = false
        let retryCount = 0
        const maxRetries = 3
        let cleanText = ""

        while (retryCount < maxRetries && !fetchSuccess) {
            try {
                cleanText = await parser.extract(page, chap, metadata)
                if (cleanText) {
                    fetchSuccess = true
                } else {
                    retryCount++
                    logDebug(`Attempt ${retryCount} failed. Retrying...`)
                    await page.waitForTimeout(1000)
                }
            } catch (error) {
                retryCount++
                logDebug(`Attempt ${retryCount} threw an error. Retrying...`)
                await page.waitForTimeout(1000)
            }
        }

        if (!fetchSuccess || !cleanText) {
            logError(`Failed to load chapter ${chap.chapter} after ${maxRetries} attempts. Stopping extraction.`)
            break
        }

        let header = ""
        if (rawUrl.includes('wuxiaworld')) {
            header = `Volume ${chap.volume} Chapter ${chap.chapter}`
        } else {
            const chapterTitle = chap.name ? ` - ${chap.name}` : ""
            header = `Volume ${chap.volume} Chapter ${chap.chapter}${chapterTitle} - ${chap.team}`
        }

        const contentWithHeader = `${header}\n\n${cleanText}`
        const chapterFilename = `${metadata.slug}_${chap.chapter}.txt`
        
        fs.writeFileSync(path.join(chaptersOutputDir, chapterFilename), contentWithHeader)

        if (isMergeEnabled && chaptersData.length > 1) {
            if (mergedContent !== '') mergedContent += '\n\n'
            mergedContent += contentWithHeader
        }
    }

    if (isMergeEnabled && chaptersData.length > 1 && mergedContent.trim() !== "") {
        fs.writeFileSync(path.join(outputDir, `${metadata.slug}.txt`), mergedContent.trim())
        logInfo(`Merged file saved successfully.`)
    }

    try {
        await browser.close()
    } catch (e) {}
}

extract()
