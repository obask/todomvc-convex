export const config = { runtime: 'edge' };

export default function handler(request: Request) {
  return Response.json({
    message: 'Hello from a Vercel function!',
    time: new Date().toISOString(),
    url: request.url,
  });
}
