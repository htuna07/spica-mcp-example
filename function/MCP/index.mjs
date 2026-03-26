/**
 * What could be done in the future:
 * - implement output schema with structured response as addition to the txt response
 * - additional flag for some tools, like readony etc.
 */

import { asToolDescriptor as authDescriptor } from "@spica-fn/Auth";

// ---------------------------------------------------------------------------
// MCP server — hand-rolled JSON-RPC 2.0, no external libraries
// Implements MCP Streamable HTTP transport (spec 2024-11-05)
//
// To register a new tool: import its descriptor and add it to toolDescriptors.
// ---------------------------------------------------------------------------

const toolDescriptors = [authDescriptor()];

// Shape passed to tools/list
const TOOLS = toolDescriptors.map(({ name, description, inputSchema }) => ({
  name,
  description,
  inputSchema,
}));

// Fast lookup for tools/call dispatch
const HANDLERS = new Map(toolDescriptors.map((d) => [d.name, d.handler]));

async function callTool(name, args = {}) {
  const handler = HANDLERS.get(name);
  if (!handler) throw { code: -32601, message: `Tool not found: ${name}` };
  return handler(args);
}

// JSON-RPC helpers
const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

// ---------------------------------------------------------------------------
// POST /mcp — client → server JSON-RPC (initialize, tools/list, tools/call …)
// ---------------------------------------------------------------------------
export async function post(req, res) {
  const msg = req.body;

  if (!msg || msg.jsonrpc !== "2.0" || !msg.method) {
    return res.status(400).send(err(null, -32600, "Invalid JSON-RPC request"));
  }

  const { id, method, params = {} } = msg;

  // Notifications (no id) require no response
  if (id === undefined || id === null) {
    return res.status(202).end();
  }

  try {
    let result;
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "auth-mcp", version: "1.0.0" },
        };
        break;

      case "ping":
        result = {};
        break;

      case "tools/list":
        result = { tools: TOOLS };
        break;

      case "tools/call": {
        const { name, arguments: args } = params;
        if (!name) return res.send(err(id, -32602, "Missing tool name"));
        result = await callTool(name, args);
        break;
      }

      default:
        return res.send(err(id, -32601, `Method not found: ${method}`));
    }

    return res.send(ok(id, result));
  } catch (e) {
    return res.send(err(id, e.code ?? -32603, e.message ?? "Internal error"));
  }
}

// ---------------------------------------------------------------------------
// DELETE /mcp — session termination
// ---------------------------------------------------------------------------
export async function del(req, res) {
  res.status(200).end();
}
