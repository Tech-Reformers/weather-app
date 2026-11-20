// Summary_Service: receives forecast periods and (task 2.2) streams a Bedrock summary.
import http from 'node:http'
import { MAX_BODY_BYTES, validate, buildUserMessage, streamSummary, isCredentialError, logError } from './summary-core.mjs'

const MAX_LOG_PATH = 200

// Configuration (read once at startup)
const modelId = process.env.BEDROCK_MODEL_ID
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
const port = Number(process.env.SUMMARY_PORT) || 8081

if (!modelId || !region) {
  console.error('Summary_Service cannot start: set BEDROCK_MODEL_ID and AWS_REGION (or AWS_DEFAULT_REGION).')
  process.exit(1)
}

// One line per request: timestamp, method, path, status. Never logs the body.
function log(method, path, status) {
  const safeMethod = String(method).replace(/[^\x20-\x7E]/g, '?').slice(0, 20)
  const safePath = String(path).replace(/[^\x20-\x7E]/g, '?').slice(0, MAX_LOG_PATH)
  console.log(`${new Date().toISOString()} ${safeMethod} ${safePath} ${status}`)
}

// Reads the body as a string. Rejects with { status: 413 } once it exceeds 8192 bytes.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'])
    if (declared > MAX_BODY_BYTES) {
      req.resume()
      reject({ status: 413 })
      return
    }
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      if (tooLarge) return
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        tooLarge = true
        chunks.length = 0
        return // keep draining so the 413 response can be delivered
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (tooLarge) reject({ status: 413 })
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', () => reject({ status: 400 }))
  })
}

// Waits for the first chunk before sending headers so early failures become real HTTP statuses.
async function sendSummary(req, res, userMessage) {
  let clientGone = false
  const iterator = streamSummary(modelId, region, userMessage)
  res.on('close', () => {
    if (!res.writableEnded) {
      clientGone = true
      iterator.return().catch(() => {}) // stop streaming on client disconnect
    }
  })

  let first
  try {
    first = await iterator.next()
  } catch (err) {
    if (clientGone) return
    if (isCredentialError(err)) {
      console.error("AWS credentials missing or expired. Run 'aws sso login' in your terminal and try again.")
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end('Summary service not available.')
    } else {
      logError(err)
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end('Summary service error.')
    }
    return
  }
  if (clientGone) return

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'Transfer-Encoding': 'chunked',
  })
  try {
    let current = first
    while (!current.done) {
      if (clientGone) return
      res.write(current.value)
      current = await iterator.next()
    }
    res.end()
  } catch (err) {
    if (clientGone) return
    logError(err)
    res.destroy()
  }
}

function sendStatus(res, status, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers })
  res.end()
}

const server = http.createServer(async (req, res) => {
  const rawPath = (req.url || '').split('?')[0]
  res.on('finish', () => log(req.method, rawPath, res.statusCode))

  if (rawPath !== '/api/summary') {
    req.resume()
    sendStatus(res, 404)
    return
  }
  if (req.method !== 'POST') {
    req.resume()
    sendStatus(res, 405, { Allow: 'POST' })
    return
  }

  let bodyText
  try {
    bodyText = await readBody(req)
  } catch (err) {
    sendStatus(res, err && err.status ? err.status : 400)
    return
  }

  const result = validate(bodyText)
  if (result.status) {
    sendStatus(res, result.status)
    return
  }

  try {
    await sendSummary(req, res, buildUserMessage(result.city, result.periods))
  } catch {
    if (!res.headersSent) sendStatus(res, 502)
    else res.destroy()
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Summary_Service listening on http://127.0.0.1:${port}`)
})
