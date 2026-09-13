import { createVadServer } from "./api/server.js";
import { attachStreamEndpoint } from "./api/stream.js";

const port = Number(process.env.PORT ?? 4000);
const server = createVadServer();
attachStreamEndpoint(server);
server.listen(port, () => {
  console.log(`VAD backend listening on http://localhost:${port}`);
});
