interface Environment {
  BEARER_TOKEN: string;
  URL_SECRET: string;
  URLS: KVNamespace;
}

function compare(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  
  var mismatch = a.length === b.length ? 0 : 1;
  if (mismatch) {
    b = a;
  }
  
  for (var i = 0, il = a.length; i < il; ++i) {
    mismatch |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  
  return mismatch === 0;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
interface PathResult {
  found: boolean,
  path: string,
}
async function importKey(secret: string) {
  return await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}
async function hmac(key: CryptoKey, message: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}
async function randomPath(env: Environment, url: URL, message: string): Promise<PathResult> {
  let path = '/';
  // Makes it seem random from the outside.
  // Use an hmac of the data
  const key = await importKey(env.URL_SECRET);
  const hash = await hmac(key, message);
  path = '/';
  for (let value of hash.values()) {
    path += ALPHABET.charAt(value % ALPHABET.length);
    if (path.length >= 4) {
      // at least three letters after the /
      let found = await env.URLS.get(path);
      if (!found) {
        // This path has not been chosen!
        return {path, found: false};
      } else if (found === message) {
        return {path, found: true};
      }
    }
  }
  return {path, found: false};
} 

export default {
  async fetch(request: Request, env: Environment): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method == "PUT") {
      let text = await request.text();
      let authorization = request.headers.get("Authorization");
      if (authorization && authorization.startsWith("Bearer ")) {
        if (!compare(authorization.substring(7), env.BEARER_TOKEN)) {
          return this.unauthenticatedRequest();
        }
      } else {
        return this.unauthenticatedRequest();
      }
      let writePath = path;
      if (path === '/' && !url.searchParams.get('root')) {
        // only let it stay '/' if there's a query for it
        let result = await randomPath(env, url, text);
        if (result.found) {
          // No need to create a duplicate
          return new Response(`OK\n${url.protocol}//${url.host}${result.path} => ${text}`);
        } else {
          writePath = result.path;
        }
      }
      return this.putPath(url, writePath, env, text);
    } else if (request.method == "GET") {
      return this.getPath(path, env);
    } else {
      return this.invalidRequest();
    }
  },
  async putPath(url: URL, path: string, env: Environment, text: string): Promise<Response> {
    await env.URLS.put(path, text);
    return new Response(`OK\n${url.protocol}//${url.host}${path} => ${text}`);
  },
  async getPath(path: string, env: Environment): Promise<Response> {
    let result = await env.URLS.get(path);
    if (!result) {
      return new Response(`Nothing here! '${path}'`, {
        status: 404,
      });
    }
    return new Response(`Go to <a href=\"${result}\">${result}</a>`, {
      status: 302,
      headers: new Headers({
        "Location": result
      })
    });
  },
  invalidRequest(): Response {
    return new Response(`Unsupported request`, {
      status: 400
    });
  },
  unauthenticatedRequest(): Response {
    return new Response(`Unauthenticated request`, {
      status: 401
    });
  }
};
