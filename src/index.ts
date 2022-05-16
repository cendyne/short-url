interface Environment {
  BEARER_TOKEN: string;
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

async function randomPath(env: Environment): Promise<string> {
  let writePath = '/';
  let buf = new Uint8Array(15);
  crypto.getRandomValues(buf);
  writePath = '/';
  for (let value of buf.values()) {
    writePath += ALPHABET.charAt(value % ALPHABET.length);
    if (writePath.length >= 4) {
      // at least three letters after the /
      if (!(await env.URLS.get(writePath))) {
        // This path has not been chosen!
        return writePath;
      }
    }
  }
  return writePath;
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
        writePath = await randomPath(env);
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
