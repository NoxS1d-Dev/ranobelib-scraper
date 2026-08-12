const { logError } = require('./debug')
const ranobelibParser = require('./parsers/ranobelib')
const wuxiaworldParser = require('./parsers/wuxiaworld')

const ROUTE_MAP = {
    'ranobelib.me': ranobelibParser,
    'cdnlibs.org': ranobelibParser,
    'wuxiaworld.eu': wuxiaworldParser
}

function getParser(url) {
    try {
        const hostname = new URL(url).hostname
        for (const [domain, parser] of Object.entries(ROUTE_MAP)) {
            if (hostname.includes(domain)) {
                return parser
            }
        }
    } catch (e) {
        logError(`Invalid URL provided: ${url}`)
        process.exit(1)
    }

    logError(`Unsupported site structure for URL: ${url}`)
    process.exit(1)
}

module.exports = { getParser }
