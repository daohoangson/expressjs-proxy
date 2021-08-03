const bodyParser = require('body-parser')
const express = require('express')
const fetch = require('node-fetch')

const app = express()
const port = 3000

app.use(bodyParser.text({ type: '*/*' }))

const { PROXY_WHITELIST: whitelistStr } = process.env
const whitelist = (whitelistStr || '').split(/[, ]+/).filter((w) => !!w)
console.log('whitelist', whitelist)

app.post('*', async (req, res) => {
  console.time('proxy');

  const { body: input, headers: { ['content-type']: inputContentType }, path } = req

  /**
   * Sending POST request to `/aHR0cHM6Ly9hcGlleC5qdW5vLnZuL29zcy1wb3MtZ2F0ZS0xL2d1cnUvY2FydF9jb25zdW1lcg==`
   * means proxying to `https://apiex.juno.vn/oss-pos-gate-1/guru/cart_consumer`
   */
  const url = Buffer.from(path.substr(1), 'base64').toString('ascii')
  if (whitelist.length > 0) {
    if (whitelist.indexOf(url) === -1) {
      return res.sendStatus(403)
    }
  } else if (!url.match(/https?:\/\//)) {
    return res.sendStatus(404)
  }

  const inputHeaders = {}
  if (inputContentType) {
    inputHeaders['Content-Type'] = inputContentType
  }
  console.log('input', url, inputHeaders, input)

  const remote = await fetch(
    url,
    {
      method: 'POST',
      headers: inputHeaders,
      body: input,
    }
  )
  const output = await remote.text()
  const { status, headers } = remote

  const outputContentType = headers.get('content-type')
  if (outputContentType) {
    res.setHeader('Content-Type', outputContentType)
  }

  res.status(status).send(output)
  console.log('output', status, outputContentType, output)

  console.timeEnd('proxy');
})

app.listen(port, () => {
  console.log(`proxy app listening at http://localhost:${port}`)
})