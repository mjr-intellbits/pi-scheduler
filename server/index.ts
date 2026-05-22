import express from "express";
import { createServer, type IncomingMessage } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";
import { Type } from "typebox";
import {
  AuthStorage,
  createAgentSession,
  defineTool,
  ModelRegistry,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

type ClientMessage =
  | { type: "context"; context: unknown }
  | { type: "prompt"; text: string; context?: unknown }
  | { type: "abort" };

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
};

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/api/agent" });
const port = Number(process.env.PORT ?? 8787);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(__dirname, "../dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function getClientId(req: IncomingMessage): string {
  const url = new URL(req.url ?? "/", "http://localhost");
  return (url.searchParams.get("clientId") ?? "default").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "default";
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function toChatMessages(messages: unknown[]): ChatMessage[] {
  return messages.flatMap((message, index) => {
    if (!message || typeof message !== "object" || !("role" in message)) return [];
    const role = message.role === "user" ? "user" : message.role === "assistant" ? "assistant" : "system";
    const text = textFromContent("content" in message ? message.content : undefined).trim();
    if (!text) return [];
    return [{ id: `history-${index}`, role, text } satisfies ChatMessage];
  });
}

wss.on("connection", async (ws, req) => {
  let session: Awaited<ReturnType<typeof createAgentSession>>["session"] | undefined;
  let unsubscribe: (() => void) | undefined;
  let currentAppContext: unknown = {
    page: "pi_web_chat",
    note: "No app context has been sent by the browser yet.",
  };

  try {
    const cwd = process.cwd();
    const clientId = getClientId(req);
    const sessionDir = path.join(cwd, ".pi-web", "sessions", clientId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const sessionManager = SessionManager.continueRecent(cwd, sessionDir);
    const getCurrentAppContext = defineTool({
      name: "get_current_app_context",
      label: "Get Current App Context",
      description: "Returns the current semantic state of the browser app: page, selected entities, visible panels, filters, unsaved changes, and other UI/domain context supplied by the frontend.",
      parameters: Type.Object({}),
      execute: async () => ({
        content: [{ type: "text", text: JSON.stringify(currentAppContext, null, 2) }],
        details: { context: currentAppContext },
      }),
    });

    const applySchedulingChanges = defineTool({
      name: "apply_scheduling_changes",
      label: "Apply Scheduling Changes",
      description: "Apply visible changes to the scheduling UI. Use this for user-approved changes such as assigning/unassigning employees, adding/removing shifts, updating shift times/statuses, or focusing a date. Inspect current context first. Prefer explaining proposed changes before applying unless the user explicitly asks you to make the change. After using this tool, respond to the user with a short natural-language summary using bullets when helpful. Do not show JSON or tool payloads.",
      parameters: Type.Object({
        summary: Type.String({ description: "Short human-readable summary of what will change." }),
        changes: Type.Array(Type.Object({
          type: Type.String({ description: "One of: assign_employee, unassign_employee, add_shift, remove_shift, update_shift, focus_date" }),
          shiftId: Type.Optional(Type.String()),
          employeeId: Type.Optional(Type.String()),
          date: Type.Optional(Type.String({ description: "YYYY-MM-DD" })),
          role: Type.Optional(Type.String()),
          period: Type.Optional(Type.String({ description: "Brunch, Lunch, or Dinner" })),
          start: Type.Optional(Type.String({ description: "HH:mm" })),
          end: Type.Optional(Type.String({ description: "HH:mm" })),
          status: Type.Optional(Type.String()),
          note: Type.Optional(Type.String()),
        })),
      }),
      execute: async (_toolCallId, params) => {
        send(ws, { type: "ui_action", action: params });
        return {
          content: [{ type: "text", text: `Sent ${params.changes.length} scheduling UI change(s): ${params.summary}` }],
          details: params,
        };
      },
    });

    const result = await createAgentSession({
      cwd,
      authStorage,
      modelRegistry,
      sessionManager,
      // Browser demos should start conservative. Add "bash", "edit", "write" only
      // after you have auth, sandboxing, and user confirmation in place.
      tools: ["read", "grep", "find", "ls", "get_current_app_context", "apply_scheduling_changes"],
      customTools: [getCurrentAppContext, applySchedulingChanges],
    });

    session = result.session;
    send(ws, {
      type: "ready",
      sessionId: session.sessionId,
      model: session.model ? `${session.model.provider}/${session.model.id}` : undefined,
      cwd,
      tools: ["read", "grep", "find", "ls", "get_current_app_context", "apply_scheduling_changes"],
    });
    send(ws, { type: "history", messages: toChatMessages(session.messages) });

    unsubscribe = session.subscribe((event) => send(ws, { type: "event", event }));
  } catch (error) {
    send(ws, { type: "error", message: error instanceof Error ? error.message : String(error) });
    ws.close();
    return;
  }

  ws.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as ClientMessage;
      if (!session) return;

      if (message.type === "context") {
        currentAppContext = message.context;
      } else if (message.type === "prompt") {
        if ("context" in message) currentAppContext = message.context;
        await session.prompt(message.text, {
          streamingBehavior: session.isStreaming ? "followUp" : undefined,
        });
      } else if (message.type === "abort") {
        await session.abort();
      }
    } catch (error) {
      send(ws, { type: "error", message: error instanceof Error ? error.message : String(error) });
    }
  });

  ws.on("close", () => {
    unsubscribe?.();
    session?.dispose();
  });
});

server.listen(port, () => {
  console.log(`pi web agent server listening on http://localhost:${port}`);
});
