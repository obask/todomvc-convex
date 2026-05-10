export default {
  async fetch(request: Request) {
    return Response.json({
      message: 'Hello from a Vercel function!',
      time: new Date().toISOString(),
      url: request.url,
    })
  },
}
