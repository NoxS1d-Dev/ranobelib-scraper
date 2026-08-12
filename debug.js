const isExtended = process.env.EXTENDED_DEBUG === 'true'

function logInfo(message) {
    console.log(`[INFO] ${message}`)
}

function logDebug(message) {
    if (isExtended) {
        console.log(`[DEBUG] ${message}`)
    }
}

function logError(message) {
    console.error(`[ERROR] ${message}`)
}

module.exports = { logInfo, logDebug, logError }
