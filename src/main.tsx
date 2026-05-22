import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
};

type Employee = {
  id: string;
  name: string;
  role: string;
  skills: string[];
  availability: string[];
  attendanceRisk: "low" | "medium" | "high";
};

type Shift = {
  id: string;
  date: string;
  start: string;
  end: string;
  role: string;
  employeeId?: string;
  status: "open" | "assigned" | "warning";
  note?: string;
};

type SchedulingChange = {
  type: string;
  shiftId?: string;
  employeeId?: string;
  date?: string;
  role?: string;
  start?: string;
  end?: string;
  status?: string;
  note?: string;
};

type AgentInfo = {
  sessionId: string;
  model?: string;
  cwd?: string;
  tools?: string[];
};

type ServerMessage =
  | ({ type: "ready" } & AgentInfo)
  | { type: "history"; messages: ChatMessage[] }
  | { type: "ui_action"; action: { summary: string; changes: SchedulingChange[] } }
  | { type: "event"; event: any }
  | { type: "error"; message: string };

const CLIENT_ID_KEY = "pi-web-client-id";

const employees: Employee[] = [
  { id: "emp_ana", name: "Ana Rivera", role: "Manager", skills: ["closing", "cash"], availability: ["Mon", "Tue", "Wed", "Thu", "Fri"], attendanceRisk: "low" },
  { id: "emp_ben", name: "Ben Carter", role: "Cook", skills: ["grill", "prep"], availability: ["Mon", "Wed", "Fri", "Sat"], attendanceRisk: "medium" },
  { id: "emp_chen", name: "Chen Wu", role: "Server", skills: ["bar", "floor"], availability: ["Tue", "Wed", "Thu", "Sat", "Sun"], attendanceRisk: "low" },
  { id: "emp_dia", name: "Dia Patel", role: "Cook", skills: ["prep", "inventory"], availability: ["Thu", "Fri", "Sat", "Sun"], attendanceRisk: "high" },
  { id: "emp_eli", name: "Eli Moore", role: "Server", skills: ["floor", "training"], availability: ["Mon", "Tue", "Fri", "Sat"], attendanceRisk: "medium" },
  { id: "emp_fay", name: "Fay Okafor", role: "Host", skills: ["front", "phones"], availability: ["Wed", "Thu", "Fri", "Sat", "Sun"], attendanceRisk: "low" },
];

const initialShifts: Shift[] = [
  { id: "s1", date: "2026-06-01", start: "08:00", end: "16:00", role: "Manager", employeeId: "emp_ana", status: "assigned" },
  { id: "s2", date: "2026-06-01", start: "10:00", end: "18:00", role: "Cook", employeeId: "emp_ben", status: "assigned" },
  { id: "s3", date: "2026-06-01", start: "16:00", end: "22:00", role: "Server", status: "open", note: "Dinner coverage gap" },
  { id: "s4", date: "2026-06-02", start: "09:00", end: "15:00", role: "Host", status: "open" },
  { id: "s5", date: "2026-06-02", start: "15:00", end: "23:00", role: "Server", employeeId: "emp_chen", status: "assigned" },
  { id: "s6", date: "2026-06-03", start: "07:00", end: "15:00", role: "Cook", employeeId: "emp_dia", status: "warning", note: "High absence risk" },
  { id: "s7", date: "2026-06-04", start: "12:00", end: "20:00", role: "Server", employeeId: "emp_eli", status: "assigned" },
  { id: "s8", date: "2026-06-05", start: "08:00", end: "16:00", role: "Host", employeeId: "emp_fay", status: "assigned" },
  { id: "s9", date: "2026-06-06", start: "16:00", end: "23:00", role: "Cook", employeeId: "emp_dia", status: "warning", note: "Saturday demand spike" },
  { id: "s10", date: "2026-06-06", start: "17:00", end: "23:00", role: "Server", status: "open", note: "Need experienced floor coverage" },
  { id: "s11", date: "2026-06-07", start: "10:00", end: "18:00", role: "Manager", status: "open" },
];

const days = [
  { date: "2026-06-01", label: "Mon 1" },
  { date: "2026-06-02", label: "Tue 2" },
  { date: "2026-06-03", label: "Wed 3" },
  { date: "2026-06-04", label: "Thu 4" },
  { date: "2026-06-05", label: "Fri 5" },
  { date: "2026-06-06", label: "Sat 6" },
  { date: "2026-06-07", label: "Sun 7" },
];

function getClientId() {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(CLIENT_ID_KEY, id);
  return id;
}

function employeeName(id?: string) {
  return employees.find((employee) => employee.id === id)?.name ?? "Open";
}

function dayName(date: string) {
  return days.find((day) => day.date === date)?.label.split(" ")[0] ?? "";
}

function canWorkShift(employee: Employee, shift: Shift) {
  return employee.role === shift.role || employee.skills.includes(shift.role.toLowerCase());
}

function assignmentWarning(employee: Employee, shift: Shift) {
  const day = dayName(shift.date);
  if (!canWorkShift(employee, shift)) return `${employee.name} is not normally a ${shift.role}`;
  if (!employee.availability.includes(day)) return `${employee.name} is not listed as available on ${day}`;
  if (employee.attendanceRisk === "high") return `${employee.name} has high attendance risk`;
  return undefined;
}

function buildSchedulingContext(messages: ChatMessage[], shifts: Shift[], selectedDate: string) {
  const openShifts = shifts.filter((shift) => !shift.employeeId || shift.status === "open");
  const warnings = shifts.filter((shift) => shift.status === "warning" || shift.note);
  return {
    page: "schedule_proposal",
    app: "pi-web scheduling demo",
    proposalId: "proposal_demo_123",
    dateRange: [days[0].date, days.at(-1)!.date],
    selectedDate,
    visiblePanels: ["calendar", "employees", "assistant"],
    domain: {
      employees,
      shifts: shifts.map((shift) => ({ ...shift, employeeName: employeeName(shift.employeeId), day: dayName(shift.date) })),
      demandForecast: [
        { date: "2026-06-01", demand: "normal" },
        { date: "2026-06-06", demand: "high", note: "Saturday dinner spike" },
        { date: "2026-06-07", demand: "medium" },
      ],
      laborRules: ["Managers required for opening/closing", "Cook shifts need grill or prep skill", "Prefer low attendance-risk employees for critical weekend shifts"],
      openShiftCount: openShifts.length,
      warningCount: warnings.length,
    },
    chat: {
      messageCount: messages.length,
      lastMessage: messages.at(-1) ? { role: messages.at(-1)!.role, textPreview: messages.at(-1)!.text.slice(0, 240) } : null,
    },
    capabilities: {
      assistantCanInspectCurrentSchedule: true,
      assistantCanApplyUiChangesWithTool: true,
      supportedUiChanges: ["assign_employee", "unassign_employee", "add_shift", "remove_shift", "update_shift", "focus_date"],
    },
  };
}

function App() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting…");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [selectedDate, setSelectedDate] = useState(days[0].date);
  const [activity, setActivity] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const wsUrl = useMemo(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const clientId = encodeURIComponent(getClientId());
    return `${protocol}//${location.host}/api/agent?clientId=${clientId}`;
  }, []);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("Starting pi session…");
      ws.send(JSON.stringify({ type: "context", context: buildSchedulingContext(messages, shifts, selectedDate) }));
    };
    ws.onclose = () => {
      setConnected(false);
      setStatus("Disconnected");
    };
    ws.onerror = () => setStatus("WebSocket error");
    ws.onmessage = (raw) => {
      const message = JSON.parse(raw.data) as ServerMessage;
      handleServerMessage(message);
    };

    return () => ws.close();
  }, [wsUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "context", context: buildSchedulingContext(messages, shifts, selectedDate) }));
    }
  }, [messages, shifts, selectedDate]);

  function appendMessage(message: ChatMessage) {
    setMessages((current) => [...current, message]);
  }

  function appendAssistantDelta(delta: string) {
    setMessages((current) => {
      const id = assistantIdRef.current ?? crypto.randomUUID();
      assistantIdRef.current = id;
      const index = current.findIndex((m) => m.id === id);
      if (index === -1) return [...current, { id, role: "assistant", text: delta }];
      const next = [...current];
      next[index] = { ...next[index], text: next[index].text + delta };
      return next;
    });
  }

  function applyUiAction(action: { summary: string; changes: SchedulingChange[] }) {
    setActivity((current) => [`Assistant: ${action.summary}`, ...current].slice(0, 6));
    setShifts((current) => {
      let next = [...current];
      for (const change of action.changes) {
        if (change.type === "assign_employee" && change.shiftId && change.employeeId) {
          next = next.map((shift) => shift.id === change.shiftId ? { ...shift, employeeId: change.employeeId, status: "assigned", note: change.note ?? shift.note } : shift);
        } else if (change.type === "unassign_employee" && change.shiftId) {
          next = next.map((shift) => shift.id === change.shiftId ? { ...shift, employeeId: undefined, status: "open", note: change.note ?? shift.note } : shift);
        } else if (change.type === "remove_shift" && change.shiftId) {
          next = next.filter((shift) => shift.id !== change.shiftId);
        } else if (change.type === "update_shift" && change.shiftId) {
          next = next.map((shift) => shift.id === change.shiftId ? {
            ...shift,
            date: change.date ?? shift.date,
            start: change.start ?? shift.start,
            end: change.end ?? shift.end,
            role: change.role ?? shift.role,
            status: (change.status as Shift["status"] | undefined) ?? shift.status,
            note: change.note ?? shift.note,
          } : shift);
        } else if (change.type === "add_shift" && change.date && change.role && change.start && change.end) {
          next = [...next, {
            id: `s_${crypto.randomUUID().slice(0, 8)}`,
            date: change.date,
            start: change.start,
            end: change.end,
            role: change.role,
            employeeId: change.employeeId,
            status: change.employeeId ? "assigned" : "open",
            note: change.note,
          }];
        }
      }
      return next;
    });
    const focus = action.changes.find((change) => change.type === "focus_date" && change.date);
    if (focus?.date) setSelectedDate(focus.date);
  }

  function handleServerMessage(message: ServerMessage) {
    if (message.type === "ready") {
      setConnected(true);
      setAgentInfo(message);
      setStatus(`Ready${message.model ? ` · ${message.model}` : ""}`);
      return;
    }

    if (message.type === "history") {
      setMessages(message.messages);
      return;
    }

    if (message.type === "ui_action") {
      applyUiAction(message.action);
      return;
    }

    if (message.type === "error") {
      appendMessage({ id: crypto.randomUUID(), role: "system", text: message.message });
      return;
    }

    const event = message.event;
    switch (event.type) {
      case "agent_start":
        assistantIdRef.current = crypto.randomUUID();
        setStatus("Thinking…");
        break;
      case "message_update":
        if (event.assistantMessageEvent?.type === "text_delta") appendAssistantDelta(event.assistantMessageEvent.delta);
        break;
      case "tool_execution_start":
        appendMessage({ id: crypto.randomUUID(), role: "tool", text: `Running ${event.toolName}…` });
        break;
      case "agent_end":
        assistantIdRef.current = null;
        setStatus("Ready");
        break;
    }
  }

  function sendPrompt(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const nextMessages = [...messages, { id: crypto.randomUUID(), role: "user" as const, text }];
    setMessages(nextMessages);
    wsRef.current.send(JSON.stringify({ type: "prompt", text, context: buildSchedulingContext(nextMessages, shifts, selectedDate) }));
    setInput("");
  }

  async function copyMessage(message: ChatMessage) {
    await navigator.clipboard.writeText(message.text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1200);
  }

  function abort() {
    wsRef.current?.send(JSON.stringify({ type: "abort" }));
  }

  function startDraggingEmployee(event: React.DragEvent, employee: Employee) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-employee-id", employee.id);
    event.dataTransfer.setData("text/plain", employee.name);
  }

  function assignEmployeeToShift(shiftId: string, employeeId: string, source = "Manual drag/drop") {
    const employee = employees.find((item) => item.id === employeeId);
    const shift = shifts.find((item) => item.id === shiftId);
    if (!employee || !shift) return;
    const warning = assignmentWarning(employee, shift);
    setShifts((current) => current.map((item) => item.id === shiftId ? {
      ...item,
      employeeId,
      status: warning ? "warning" : "assigned",
      note: warning,
    } : item));
    setActivity((current) => [`${source}: assigned ${employee.name} to ${shift.role} on ${dayName(shift.date)} ${shift.start}–${shift.end}${warning ? ` (${warning})` : ""}`, ...current].slice(0, 6));
  }

  function dropEmployeeOnShift(event: React.DragEvent, shiftId: string) {
    event.preventDefault();
    event.stopPropagation();
    const employeeId = event.dataTransfer.getData("application/x-employee-id");
    if (employeeId) assignEmployeeToShift(shiftId, employeeId);
  }

  const selectedShifts = shifts.filter((shift) => shift.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start));
  const openCount = shifts.filter((shift) => !shift.employeeId || shift.status === "open").length;
  const warningCount = shifts.filter((shift) => shift.status === "warning" || shift.note).length;

  return (
    <main className="scheduler-app">
      <section className="schedule-pane">
        <header className="schedule-header">
          <div>
            <h1>Schedule Proposal</h1>
            <p>Demo location · Week of Jun 1, 2026 · {shifts.length} shifts · {openCount} open · {warningCount} warnings</p>
          </div>
          <div className="quick-actions">
            <button onClick={() => sendPrompt("Analyze this schedule and tell me the biggest optimization opportunities. Do not apply changes yet.")} disabled={!connected}>Analyze</button>
            <button onClick={() => sendPrompt("Please fix the most obvious open shift or high-risk issue in the schedule UI, then explain what you changed.")} disabled={!connected}>Ask assistant to fix</button>
          </div>
        </header>

        <div className="calendar-grid">
          {days.map((day) => {
            const dayShifts = shifts.filter((shift) => shift.date === day.date).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div key={day.date} className={`day-card ${selectedDate === day.date ? "selected" : ""}`} onClick={() => setSelectedDate(day.date)}>
                <strong>{day.label}</strong>
                {dayShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className={`shift-chip ${shift.status}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => dropEmployeeOnShift(event, shift.id)}
                    title="Drop an employee here to assign them"
                  >
                    {shift.start} {shift.role} · {employeeName(shift.employeeId)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="detail-grid">
          <section className="panel">
            <h2>{days.find((day) => day.date === selectedDate)?.label} shifts</h2>
            <div className="shift-list">
              {selectedShifts.map((shift) => (
                <article
                  key={shift.id}
                  className={`shift-row ${shift.status}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => dropEmployeeOnShift(event, shift.id)}
                >
                  <div>
                    <strong>{shift.start}–{shift.end}</strong>
                    <span>{shift.role}</span>
                    {shift.note && <em>{shift.note}</em>}
                  </div>
                  <select
                    value={shift.employeeId ?? ""}
                    onChange={(event) => {
                      const employeeId = event.target.value || undefined;
                      if (employeeId) {
                        assignEmployeeToShift(shift.id, employeeId, "Manual select");
                      } else {
                        setShifts((current) => current.map((s) => s.id === shift.id ? { ...s, employeeId: undefined, status: "open", note: undefined } : s));
                      }
                    }}
                  >
                    <option value="">Open shift</option>
                    {employees.filter((employee) => employee.role === shift.role || employee.skills.includes(shift.role.toLowerCase())).map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.name}</option>
                    ))}
                  </select>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Employees</h2>
            <div className="employee-list">
              {employees.map((employee) => (
                <article
                  key={employee.id}
                  className="employee-card"
                  draggable
                  onDragStart={(event) => startDraggingEmployee(event, employee)}
                  title="Drag onto a shift to assign"
                >
                  <strong>{employee.name}</strong>
                  <span>{employee.role} · {employee.skills.join(", ")}</span>
                  <small>Available: {employee.availability.join(", ")} · Risk: {employee.attendanceRisk}</small>
                </article>
              ))}
            </div>
          </section>
        </div>

        {activity.length > 0 && (
          <section className="activity panel">
            <h2>Assistant UI actions</h2>
            {activity.map((item, index) => <p key={index}>{item}</p>)}
          </section>
        )}
      </section>

      <aside className="assistant-pane">
        <header>
          <div>
            <h1>Assistant</h1>
            <p>{status}</p>
            {agentInfo && <small>{agentInfo.tools?.join(", ")}</small>}
          </div>
          <button onClick={abort} disabled={!connected}>Abort</button>
        </header>

        <section className="messages">
          {messages.length === 0 && <div className="empty">Ask about coverage, risk, open shifts, or tell the assistant to update the schedule.</div>}
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <div className="message-header">
                <strong>{message.role}</strong>
                <button className="copy-button" onClick={() => copyMessage(message)}>{copiedMessageId === message.id ? "Copied" : "Copy"}</button>
              </div>
              <pre>{message.text}</pre>
            </article>
          ))}
          <div ref={bottomRef} />
        </section>

        <footer>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendPrompt();
              }
            }}
            placeholder="Ask: can this be optimized? assign Chen to the open Saturday server shift…"
            disabled={!connected}
          />
          <button onClick={() => sendPrompt()} disabled={!connected || !input.trim()}>Send</button>
        </footer>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
