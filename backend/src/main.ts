import { createVadServer } from "./api/server.js";

const port = Number(process.env.PORT ?? 4000);
createVadServer().listen(port, () => {
  console.log(`VAD backend listening on http://localhost:${port}`);
});
