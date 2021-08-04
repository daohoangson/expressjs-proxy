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

  const { body: input, path } = req
  console.log('path', path)

  /**
   * Sending POST request to `/aHR0cDovL2RvbWFpbi5jb20=`
   * means proxying to `http://domain.com`
   * 
   * Sending POST request to `/aHR0cDovL2RvbWFpbi5jb20=/some/path`
   * means proxying to `http://domain.com/some/path`
   */
  const pathMatch = path.match(/^\/([^/]+)(.*)$/)
  if (!pathMatch) {
    return res.sendStatus(404)
  }

  const url = Buffer.from(pathMatch[1], 'base64').toString('ascii') + pathMatch[2]
  if (whitelist.length > 0) {
    if (whitelist.indexOf(url) === -1) {
      return res.sendStatus(403)
    }
  } else if (!url.match(/https?:\/\//)) {
    return res.sendStatus(404)
  }

  const inputHeaders = {}
  const reqHeaders = { ...req.headers }
  for (const headerKey in reqHeaders) {
    if (!reqHeaders.hasOwnProperty(headerKey)) {
      continue;
    }
    if (headerKey.startsWith('x-') || headerKey === 'content-type') {
      inputHeaders[headerKey] = reqHeaders[headerKey]
    }
  }
  console.log('input', url, inputHeaders, input)

  let remote;
  try {
    remote = await fetch(
      url,
      {
        method: 'POST',
        headers: inputHeaders,
        body: input,
      }
    )
  } catch (e) {
    console.error(e)
    return res.sendStatus(500)
  }
  const output = await remote.text()
  const { status, headers: remoteHeaders } = remote

  const outputContentType = remoteHeaders.get('content-type')
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