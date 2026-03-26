// Pure authentication logic — no HTTP, no MCP coupling
export async function _login(username, password) {
  if (username === "admin" && password === "password") {
    return { statusCode: 200, success: true, token: "fake-jwt-token" };
  }
  return {
    statusCode: 401,
    success: false,
    message: "Invalid username or password",
  };
}

// HTTP trigger handler — wraps pure logic for Spica HTTP trigger
export async function login(req, res) {
  const { username, password } = req.body;
  const result = await _login(username, password);
  return res.status(result.statusCode).send(result);
}

// MCP tool descriptor — owned by Auth, consumed by the MCP aggregator
export function asToolDescriptor() {
  return {
    name: "login",
    description: "Authenticate a user with username and password",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "The username to authenticate",
        },
        password: { type: "string", description: "The user's password" },
      },
      required: ["username", "password"],
    },
    async handler({ username, password }) {
      const result = await _login(username, password);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: !result.success,
      };
    },
  };
}
