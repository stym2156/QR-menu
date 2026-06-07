export default function handler(_request, response) {
  response.status(200).json({
    ok: true,
    service: "shopqr-vercel-api",
    env: process.env.NODE_ENV ?? "development",
    time: new Date().toISOString(),
  });
}
