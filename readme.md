This involves secret creation and kv creation
An adequate bearer token can be generated with `openssl rand -base64 33`

```
# Preview doesn't have an environment until https://github.com/cloudflare/wrangler2/issues/1003 is solved
wrangler secret put BEARER_TOKEN
wrangler secret --env staging put BEARER_TOKEN
wrangler secret --env production put BEARER_TOKEN

wrangler secret put URL_SECRET
wrangler secret --env staging put URL_SECRET
wrangler secret --env production put URL_SECRET

wrangler kv:namespace create URLS --preview
wrangler kv:namespace --env staging create URLS
wrangler kv:namespace --env production create URLS
```

Copy the `wrangler.toml.example` to `wrangler.toml` and populate the variables accordingly.

```http
PUT /V HTTP/2
Host: cdyn.dev
content-type: text/plain
authorization: Bearer <BEARER_TOKEN>
content-length: 36

https://github.com/cendyne/short-url

HTTP/2 200 
date: Mon, 16 May 2022 01:30:22 GMT
content-type: text/plain;charset=UTF-8
content-length: 61

OK
https://cdyn.dev/V => https://github.com/cendyne/short-url
```