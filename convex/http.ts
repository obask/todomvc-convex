import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { getPublicJwk } from "./simpleAuth/jwt";

const http = httpRouter();

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async () => {
    const jwk = await getPublicJwk();
    return new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=300",
      },
    });
  }),
});

export default http;
