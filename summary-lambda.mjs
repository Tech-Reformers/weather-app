// Summary_Service on AWS Lambda (function URL, response streaming). Same behavior as summary-server.mjs.
import { MAX_BODY_BYTES, validate, buildUserMessage, streamSummary, isCredentialError, logError } from './summary-core.mjs'

const modelId = process.env.BEDROCK_MODEL_ID
const region = process.env.AWS_REGION

function send(responseStream, status, text = '', headers = {}) {
  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  })
  stream.end(text)
}

export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  const http = (event.requestContext && event.requestContext.http) || {}
  const path = String(event.rawPath || '').slice(0, 200).replace(/[^\x20-\x7E]/g, '?')
  const method = String(http.method || '').slice(0, 20).replace(/[^\x20-\x7E]/g, '?')

  if (path !== '/api/summary') return send(responseStream, 404)
  if (method !== 'POST') return send(responseStream, 405, '', { Allow: 'POST' })

  let bodyText = event.body || ''
  if (event.isBase64Encoded) bodyText = Buffer.from(bodyText, 'base64').toString('utf8')
  if (Buffer.byteLength(bodyText) > MAX_BODY_BYTES) return send(responseStream, 413)

  const result = validate(bodyText)
  if (result.status) return send(responseStream, result.status)

  // Wait for the first chunk so early failures become real HTTP statuses.
  const iterator = streamSummary(modelId, region, buildUserMessage(result.city, result.periods))
  let first
  try {
    first = await iterator.next()
  } catch (err) {
    if (isCredentialError(err)) {
      console.error('Bedrock access denied or credentials missing.')
      return send(responseStream, 503, 'Summary service not available.')
    }
    logError(err)
    return send(responseStream, 502, 'Summary service error.')
  }

  const stream = awslambda.HttpResponseStream.from(responseStream, {
    statusCode: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
  try {
    let current = first
    while (!current.done) {
      stream.write(current.value)
      current = await iterator.next()
    }
  } catch (err) {
    logError(err)
  }
  stream.end()
})
