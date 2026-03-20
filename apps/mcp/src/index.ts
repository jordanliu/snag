import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/register-tools.js";
import { WebSocketBridge } from "./bridge/websocket-bridge.js";

const bridge = new WebSocketBridge();
const server = new McpServer({
  name: "dom-mcp",
  version: "0.0.0",
});

registerTools(server, bridge);

async function main() {
  await bridge.start();
  await server.connect(new StdioServerTransport());

  const shutdown = async () => {
    await Promise.allSettled([server.close(), bridge.close()]);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });
}

main().catch(async (error: unknown) => {
  console.error("Failed to start dom-mcp:", error);
  await Promise.allSettled([server.close(), bridge.close()]);
  process.exit(1);
});
