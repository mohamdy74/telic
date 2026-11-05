total 28
drwxr-xr-x  4 runner runner 4096 Nov  5 18:21 .
drwxr-xr-x 10 runner runner 4096 Nov  5 18:21 ..
-rw-r--r--  1 runner runner  471 Nov  5 18:21 nitro.json
-rw-r--r--  1 runner runner   26 Nov  5 18:21 package-lock.json
-rw-r--r--  1 runner runner   53 Nov  5 18:21 package.json
drwxr-xr-x  3 runner runner 4096 Nov  5 18:21 public
drwxr-xr-x  5 runner runner 4096 Nov  5 18:21 server
no wrangler config
WORKERD home=500
WORKERD settings=500
SETTINGS-BODY: <!doctype html> <html lang="en">   <head>     <meta charset="utf-8" />     <title>This page didn't load</title>     <meta name="viewport" content="width=device-width, initial-scale=1" />     <style>       body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; d

## wrangler.log tail
│ _ssr/rewards-Bk7HmbBt.mjs               │ esm  │ 0.42 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/router-BvnZYQcM.mjs                │ esm  │ 18.84 KiB   │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/routes-dWs13zaq.mjs                │ esm  │ 0.42 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/server-Bua50_pa.mjs                │ esm  │ 63.21 KiB   │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/settings-cRoDlcbu.mjs              │ esm  │ 8.97 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/ssr.mjs                            │ esm  │ 4.45 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/start-RKGGYzjZ.mjs                 │ esm  │ 1.50 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/store-CMr3l2uV.mjs                 │ esm  │ 7.26 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _ssr/tasks-DTPfCiQR.mjs                 │ esm  │ 0.42 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ _tanstack-start-manifest_v-DVhSFkVm.mjs │ esm  │ 1.75 KiB    │
├─────────────────────────────────────────┼──────┼─────────────┤
│ Total (32 modules)                      │      │ 1013.82 KiB │
└─────────────────────────────────────────┴──────┴─────────────┘
⎔ Starting local server...
[wrangler:info] ✨ Parsed 1 valid header rule.
[wrangler:info] Ready on http://localhost:8787
[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mError: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. https://developers.cloudflare.com/workers/runtime-apis/handlers/[0m

      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at null.<anonymous> (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71) (status 500)
  caused by: Error: Disallowed operation called within global scope. Asynchronous I/O (ex: fetch() or connect()), setting a timeout, and generating random values are not allowed within global scope. To fix this error, perform this operation within a handler. [4mhttps://developers.cloudflare.com/workers/runtime-apis/handlers/[0m
      at uid (file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:121:24)
      at file:///home/runner/work/telic/telic/.output/server/_ssr/store-CMr3l2uV.mjs:169:71


[wrangler:info] GET / 500 Internal Server Error (48ms)
[wrangler:info] GET / 500 Internal Server Error (8ms)
[wrangler:info] GET /settings 500 Internal Server Error (9ms)

## build.log tail
.output/server/_libs/h3-v2+rou3+srvx.mjs                  9.89 kB │ gzip:   3.06 kB
.output/server/_libs/tanstack__history.mjs               12.50 kB │ gzip:   3.70 kB
.output/server/_libs/h3+rou3+srvx.mjs                    16.61 kB │ gzip:   4.80 kB
.output/server/_libs/lucide-react.mjs                    17.38 kB │ gzip:   3.93 kB
.output/server/_libs/react+tanstack__react-query.mjs     17.65 kB │ gzip:   4.65 kB
.output/server/index.mjs                                 18.28 kB │ gzip:   4.91 kB
.output/server/_ssr/router-BvnZYQcM.mjs                  19.29 kB │ gzip:   4.92 kB
.output/server/_libs/@tanstack/router-core+[...].mjs     29.60 kB │ gzip:   7.98 kB
.output/server/_libs/tanstack__query-core.mjs            48.17 kB │ gzip:  10.70 kB
.output/server/_ssr/server-Bua50_pa.mjs                  64.72 kB │ gzip:  16.82 kB
.output/server/_libs/@tanstack/react-router+[...].mjs   754.47 kB │ gzip: 159.56 kB

[32m✓ built in 533ms[39m
[info] [nitro] Using auto generated worker name: `mohamdy74-telic`
[info] Generated [36m.output/server/wrangler.json[39m
[info] Generated [36m.wrangler/deploy/config.json[39m
[info] Generated [36m.output/public/_headers[39m
[info] Generated [36m.output/nitro.json[39m
[success] [nitro] You can preview this build using `npx vite preview`
[success] [nitro] You can deploy this build using `npx nitro deploy --prebuilt`
