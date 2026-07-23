import { createTimelineMcpServer } from "../src/mcp/server";

async function main() {
  try {
    const server = createTimelineMcpServer("demo-user");
    console.log("MCP Server created:", server.name);
    
    // List tools using the standard MCP server method
    const tools = await server.listTools();
    console.log("Registered Tools count:", tools.tools.length);
    console.log("Tools:", JSON.stringify(tools.tools, null, 2));
  } catch (error) {
    console.error("Error testing MCP server tools:", error);
  }
}

main();
