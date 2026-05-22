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
  period: "Brunch" | "Lunch" | "Dinner";
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
  period?: Shift["period"];
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

type ContextMenuState = {
  x: number;
  y: number;
  shiftId: string;
};

type ServerMessage =
  | ({ type: "ready" } & AgentInfo)
  | { type: "history"; messages: ChatMessage[] }
  | { type: "ui_action"; action: { summary: string; changes: SchedulingChange[] } }
  | { type: "event"; event: any }
  | { type: "error"; message: string };

const USER_NAME_KEY = "pi-web-user-name";

const employees: Employee[] = [
  { id: "emp_ana", name: "Ana Rivera", role: "Manager", skills: ["closing", "cash"], availability: ["Mon", "Tue", "Wed", "Thu", "Fri"], attendanceRisk: "low" },
  { id: "emp_ben", name: "Ben Carter", role: "Cook", skills: ["grill", "prep"], availability: ["Mon", "Wed", "Fri", "Sat"], attendanceRisk: "medium" },
  { id: "emp_chen", name: "Chen Wu", role: "Server", skills: ["bar", "floor"], availability: ["Tue", "Wed", "Thu", "Sat", "Sun"], attendanceRisk: "low" },
  { id: "emp_dia", name: "Dia Patel", role: "Cook", skills: ["prep", "inventory"], availability: ["Thu", "Fri", "Sat", "Sun"], attendanceRisk: "high" },
  { id: "emp_eli", name: "Eli Moore", role: "Server", skills: ["floor", "training"], availability: ["Mon", "Tue", "Fri", "Sat"], attendanceRisk: "medium" },
  { id: "emp_fay", name: "Fay Okafor", role: "Host", skills: ["front", "phones"], availability: ["Wed", "Thu", "Fri", "Sat", "Sun"], attendanceRisk: "low" },
  { id: "emp_gus", name: "Gus Novak", role: "Manager", skills: ["opening", "cash"], availability: ["Sat", "Sun", "Mon", "Tue"], attendanceRisk: "low" },
  { id: "emp_hana", name: "Hana Kim", role: "Cook", skills: ["grill", "brunch"], availability: ["Sat", "Sun", "Mon", "Tue"], attendanceRisk: "low" },
  { id: "emp_ivy", name: "Ivy Brooks", role: "Server", skills: ["floor", "brunch"], availability: ["Thu", "Fri", "Sat", "Sun"], attendanceRisk: "low" },
  { id: "emp_jules", name: "Jules Martin", role: "Host", skills: ["front", "events"], availability: ["Mon", "Tue", "Wed", "Thu"], attendanceRisk: "medium" },
  { id: "emp_kai", name: "Kai Smith", role: "Server", skills: ["bar", "floor"], availability: ["Wed", "Thu", "Fri", "Sat", "Sun"], attendanceRisk: "low" },
  { id: "emp_lena", name: "Lena Torres", role: "Cook", skills: ["prep", "line"], availability: ["Mon", "Tue", "Wed", "Thu", "Fri"], attendanceRisk: "low" },
  { id: "emp_maya", name: "Maya Singh", role: "Manager", skills: ["closing", "training"], availability: ["Wed", "Thu", "Fri", "Sat", "Sun"], attendanceRisk: "medium" },
  { id: "emp_noah", name: "Noah Green", role: "Host", skills: ["phones", "front"], availability: ["Fri", "Sat", "Sun"], attendanceRisk: "low" },
  { id: "emp_omar", name: "Omar Reyes", role: "Server", skills: ["floor", "large-party"], availability: ["Mon", "Tue", "Wed", "Fri", "Sat"], attendanceRisk: "medium" },
  { id: "emp_pia", name: "Pia Rossi", role: "Server", skills: ["bar", "closing"], availability: ["Thu", "Fri", "Sat", "Sun"], attendanceRisk: "low" },
];

function servicePeriodsForDate(date: string): Shift["period"][] {
  return isWeekend(date) ? ["Brunch", "Lunch", "Dinner"] : ["Lunch", "Dinner"];
}

function generateInitialShifts(): Shift[] {
  const assignments: Record<string, string> = {
    "2026-06-01-Lunch-Manager-0": "emp_ana",
    "2026-06-01-Lunch-Cook-0": "emp_ben",
    "2026-06-02-Dinner-Server-0": "emp_chen",
    "2026-06-03-Lunch-Cook-0": "emp_dia",
    "2026-06-04-Dinner-Server-0": "emp_eli",
    "2026-06-05-Lunch-Host-0": "emp_fay",
    "2026-06-06-Dinner-Cook-0": "emp_dia",
  };

  return days.flatMap((day) => servicePeriodsForDate(day.date).flatMap((period) =>
    requiredRolesForDate(day.date).map((role, index) => {
      const { start, end } = roleStartEnd(role, period);
      const id = `${day.date}-${period}-${role}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const employeeId = assignments[`${day.date}-${period}-${role}-${index}`];
      return {
        id,
        date: day.date,
        period,
        start,
        end,
        role,
        employeeId,
        status: employeeId ? (employeeId === "emp_dia" ? "warning" : "assigned") : "open",
        note: employeeId === "emp_dia" ? "High absence risk" : undefined,
      } satisfies Shift;
    })
  ));
}

const days = [
  { date: "2026-06-01", label: "Mon 1" },
  { date: "2026-06-02", label: "Tue 2" },
  { date: "2026-06-03", label: "Wed 3" },
  { date: "2026-06-04", label: "Thu 4" },
  { date: "2026-06-05", label: "Fri 5" },
  { date: "2026-06-06", label: "Sat 6" },
  { date: "2026-06-07", label: "Sun 7" },
];

const initialShifts: Shift[] = generateInitialShifts();

function getStoredUserName() {
  return localStorage.getItem(USER_NAME_KEY) ?? "";
}

function normalizeUserName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 80);
}

function employeeName(id?: string) {
  return employees.find((employee) => employee.id === id)?.name ?? "Open";
}

function roleClass(role: string) {
  return `role-${role.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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

function isWeekend(date: string) {
  return ["Sat", "Sun"].includes(dayName(date));
}

function isBusyDay(date: string) {
  return isWeekend(date);
}

function requiredRolesForDate(date: string) {
  return ["Manager", "Cook", "Host", "Server", ...(isBusyDay(date) ? ["Server"] : [])];
}

function roleStartEnd(role: string, period: Shift["period"] = "Lunch") {
  if (period === "Brunch") return { start: "09:00", end: "13:00" };
  if (period === "Lunch") return { start: role === "Manager" ? "10:00" : "11:00", end: "15:00" };
  return { start: role === "Manager" ? "15:00" : "16:00", end: "22:00" };
}

function coverageForDate(shifts: Shift[], date: string) {
  const dayShifts = shifts.filter((shift) => shift.date === date);
  return servicePeriodsForDate(date).flatMap((period) =>
    requiredRolesForDate(date).map((role, index) => {
      const matching = dayShifts.filter((shift) => shift.period === period && shift.role === role);
      const shift = matching[index] ?? matching.find((item) => !item.employeeId) ?? matching[0];
      return { key: `${period}-${role}-${index}`, period, role, shift, covered: Boolean(shift?.employeeId) };
    })
  );
}

function buildSchedulingContext(messages: ChatMessage[], shifts: Shift[], selectedDate: string, employeeRoleFilter = "All") {
  const openShifts = shifts.filter((shift) => !shift.employeeId || shift.status === "open");
  const warnings = shifts.filter((shift) => shift.status === "warning" || shift.note);
  return {
    page: "schedule_proposal",
    app: "pi-web scheduling demo",
    proposalId: "proposal_demo_123",
    dateRange: [days[0].date, days.at(-1)!.date],
    selectedDate,
    employeeRoleFilter,
    visiblePanels: ["calendar", "employees", "assistant"],
    domain: {
      employees,
      shifts: shifts.map((shift) => ({ ...shift, employeeName: employeeName(shift.employeeId), day: dayName(shift.date) })),
      demandForecast: [
        { date: "2026-06-01", demand: "normal" },
        { date: "2026-06-06", demand: "high", note: "Saturday dinner spike" },
        { date: "2026-06-07", demand: "medium" },
      ],
      staffingRules: days.map((day) => ({
        date: day.date,
        requiredRoles: requiredRolesForDate(day.date),
        isBusyDay: isBusyDay(day.date),
        coverage: coverageForDate(shifts, day.date),
      })),
      laborRules: ["Every day needs at least one Manager, Cook, Host, and Server", "Busy days need two Servers", "Managers required for opening/closing", "Cook shifts need grill or prep skill", "Prefer low attendance-risk employees for critical weekend shifts"],
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
  const [userName, setUserName] = useState(getStoredUserName);
  const [loginName, setLoginName] = useState(getStoredUserName);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(userName ? "Connecting…" : "Enter your name to continue");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [selectedDate, setSelectedDate] = useState(days[0].date);
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState("All");
  const [collapsedPeriods, setCollapsedPeriods] = useState<Shift["period"][]>([]);
  const [activity, setActivity] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const assistantIdRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const wsUrl = useMemo(() => {
    if (!userName) return undefined;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const clientId = encodeURIComponent(normalizeUserName(userName));
    return `${protocol}//${location.host}/api/agent?clientId=${clientId}`;
  }, [userName]);

  useEffect(() => {
    if (!wsUrl) return;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("Starting pi session…");
      ws.send(JSON.stringify({ type: "context", context: buildSchedulingContext(messages, shifts, selectedDate, employeeRoleFilter) }));
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

  function login(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeUserName(loginName);
    if (!normalized) return;
    localStorage.setItem(USER_NAME_KEY, normalized);
    setUserName(normalized);
    setStatus("Connecting…");
  }

  function logout() {
    wsRef.current?.close();
    localStorage.removeItem(USER_NAME_KEY);
    setUserName("");
    setLoginName("");
    setConnected(false);
    setMessages([]);
    setAgentInfo(null);
    setStatus("Enter your name to continue");
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "context", context: buildSchedulingContext(messages, shifts, selectedDate, employeeRoleFilter) }));
    }
  }, [messages, shifts, selectedDate, employeeRoleFilter]);

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
            period: change.period ?? shift.period,
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
            period: change.period ?? "Lunch",
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
    wsRef.current.send(JSON.stringify({ type: "prompt", text, context: buildSchedulingContext(nextMessages, shifts, selectedDate, employeeRoleFilter) }));
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

  function isPeriodCollapsed(period: Shift["period"]) {
    return collapsedPeriods.includes(period);
  }

  function togglePeriod(period: Shift["period"]) {
    setCollapsedPeriods((current) => current.includes(period) ? current.filter((item) => item !== period) : [...current, period]);
  }

  function openShiftMenu(event: React.MouseEvent, shift: Shift) {
    event.preventDefault();
    event.stopPropagation();
    if (!shift.employeeId) return;
    setContextMenu({ x: event.clientX, y: event.clientY, shiftId: shift.id });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function startDraggingEmployee(event: React.DragEvent, employee: Employee) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/x-employee-id", employee.id);
    event.dataTransfer.setData("text/plain", employee.name);
  }

  function startDraggingShift(event: React.DragEvent, shift: Shift) {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-shift-id", shift.id);
    event.dataTransfer.setData("text/plain", `${shift.role} ${employeeName(shift.employeeId)}`);
  }

  function moveShiftToDate(shiftId: string, date: string) {
    const shift = shifts.find((item) => item.id === shiftId);
    if (!shift || shift.date === date) return;
    setShifts((current) => current.map((item) => item.id === shiftId ? { ...item, date } : item));
    setSelectedDate(date);
    setActivity((current) => [`Manual drag/drop: moved ${shift.role} (${employeeName(shift.employeeId)}) from ${dayName(shift.date)} to ${dayName(date)}`, ...current].slice(0, 6));
  }

  function assignEmployeeToShift(shiftId: string, employeeId: string, source = "Manual drag/drop") {
    const employee = employees.find((item) => item.id === employeeId);
    const shift = shifts.find((item) => item.id === shiftId);
    if (!employee || !shift) return;
    const duplicate = shifts.find((item) => item.id !== shiftId && item.date === shift.date && item.period === shift.period && item.employeeId === employeeId);
    if (duplicate) {
      setActivity((current) => [`Blocked: ${employee.name} is already assigned during ${shift.period} on ${dayName(shift.date)}`, ...current].slice(0, 6));
      return;
    }
    const warning = assignmentWarning(employee, shift);
    setShifts((current) => current.map((item) => item.id === shiftId ? {
      ...item,
      employeeId,
      status: warning ? "warning" : "assigned",
      note: warning,
    } : item));
    setActivity((current) => [`${source}: assigned ${employee.name} to ${shift.period} ${shift.role} on ${dayName(shift.date)} ${shift.start}–${shift.end}${warning ? ` (${warning})` : ""}`, ...current].slice(0, 6));
  }

  function unassignShift(shiftId: string, source = "Manual") {
    const shift = shifts.find((item) => item.id === shiftId);
    if (!shift) return;
    setShifts((current) => current.map((item) => item.id === shiftId ? { ...item, employeeId: undefined, status: "open", note: undefined } : item));
    setActivity((current) => [`${source}: cleared ${shift.period} ${shift.role} on ${dayName(shift.date)}`, ...current].slice(0, 6));
  }

  function assignEmployeeToSlot(date: string, period: Shift["period"], role: string, employeeId: string) {
    const slot = shifts.find((shift) => shift.date === date && shift.period === period && shift.role === role && !shift.employeeId)
      ?? shifts.find((shift) => shift.date === date && shift.period === period && shift.role === role);
    if (slot) assignEmployeeToShift(slot.id, employeeId);
  }

  function assignEmployeeToDate(date: string, employeeId: string) {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) return;
    const role = employee.role;
    const openShift = shifts.find((shift) => shift.date === date && shift.role === role && !shift.employeeId);
    if (openShift) {
      assignEmployeeToShift(openShift.id, employeeId);
      return;
    }
    const period = servicePeriodsForDate(date)[0];
    const { start, end } = roleStartEnd(role, period);
    const newShift: Shift = {
      id: `s_${crypto.randomUUID().slice(0, 8)}`,
      date,
      period,
      start,
      end,
      role,
      employeeId,
      status: "warning",
      note: `Extra ${role} added beyond base staffing requirement`,
    };
    const warning = assignmentWarning(employee, newShift);
    const finalShift = { ...newShift, status: warning ? "warning" as const : newShift.status, note: warning ?? newShift.note };
    setShifts((current) => [...current, finalShift]);
    setSelectedDate(date);
    setActivity((current) => [`Manual drag/drop: added ${employee.name} as ${period} ${role} on ${dayName(date)}${finalShift.note ? ` (${finalShift.note})` : ""}`, ...current].slice(0, 6));
  }

  function dropOnDay(event: React.DragEvent, date: string) {
    event.preventDefault();
    const shiftId = event.dataTransfer.getData("application/x-shift-id");
    const employeeId = event.dataTransfer.getData("application/x-employee-id");
    if (shiftId) moveShiftToDate(shiftId, date);
    else if (employeeId) assignEmployeeToDate(date, employeeId);
  }

  function dropEmployeeOnSlot(event: React.DragEvent, date: string, period: Shift["period"], role: string) {
    event.preventDefault();
    event.stopPropagation();
    const employeeId = event.dataTransfer.getData("application/x-employee-id");
    if (employeeId) assignEmployeeToSlot(date, period, role, employeeId);
  }

  function dropEmployeeOnShift(event: React.DragEvent, shiftId: string) {
    event.preventDefault();
    event.stopPropagation();
    const employeeId = event.dataTransfer.getData("application/x-employee-id");
    if (employeeId) assignEmployeeToShift(shiftId, employeeId);
  }

  const selectedShifts = shifts.filter((shift) => shift.date === selectedDate).sort((a, b) => `${a.period}-${a.start}-${a.role}`.localeCompare(`${b.period}-${b.start}-${b.role}`));
  const contextShift = contextMenu ? shifts.find((shift) => shift.id === contextMenu.shiftId) : undefined;
  const employeeRoles = ["All", ...Array.from(new Set(employees.map((employee) => employee.role))).sort()];
  const filteredEmployees = employeeRoleFilter === "All" ? employees : employees.filter((employee) => employee.role === employeeRoleFilter);
  const openCount = shifts.filter((shift) => !shift.employeeId || shift.status === "open").length;
  const warningCount = shifts.filter((shift) => shift.status === "warning" || shift.note).length;

  if (!userName) {
    return (
      <main className="login-screen">
        <form className="login-card" onSubmit={login}>
          <h1>Schedule Assistant Demo</h1>
          <p>Enter your name to reconnect to your saved chat session.</p>
          <input
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            placeholder="e.g. josh"
            autoFocus
          />
          <button disabled={!normalizeUserName(loginName)}>Continue</button>
          <small>Demo login only: your name is used as the local session key.</small>
        </form>
      </main>
    );
  }

  return (
    <main className="scheduler-app" onClick={closeContextMenu}>
      <section className="schedule-pane">
        <header className="schedule-nav">
          <div className="brand-block">
            <div className="brand-mark">π</div>
            <div>
              <h1>Schedule Proposal</h1>
              <p>Demo location · Week of Jun 1, 2026</p>
            </div>
          </div>
          <nav className="nav-links" aria-label="Schedule views">
            <button className="active">Schedule</button>
            <button>Employees</button>
            <button>Reports</button>
          </nav>
          <div className="nav-stats">
            <span>{shifts.length} shifts</span>
            <span>{openCount} open</span>
            <span>{warningCount} warnings</span>
          </div>
          <div className="quick-actions">
            <button onClick={() => sendPrompt("Analyze this schedule and tell me the biggest optimization opportunities. Do not apply changes yet.")} disabled={!connected}>Analyze</button>
            <button onClick={() => sendPrompt("Please fix the most obvious open shift or high-risk issue in the schedule UI, then explain what you changed.")} disabled={!connected}>Ask assistant to fix</button>
          </div>
          <div className="user-menu">
            <div className="avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{userName}</strong>
              <span>{connected ? "Connected" : "Offline"}</span>
            </div>
            <button className="secondary small" onClick={logout}>Switch</button>
          </div>
        </header>

        <div className="calendar-grid">
          {days.map((day) => {
            const dayShifts = shifts.filter((shift) => shift.date === day.date).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div
                key={day.date}
                className={`day-card ${selectedDate === day.date ? "selected" : ""}`}
                onClick={() => setSelectedDate(day.date)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropOnDay(event, day.date)}
              >
                <div className="day-title">
                  <strong>{day.label}</strong>
                  {isBusyDay(day.date) && <span>Busy · 2 servers</span>}
                </div>
                {servicePeriodsForDate(day.date).map((period) => (
                  <div key={period} className={`period-lane ${isPeriodCollapsed(period) ? "collapsed" : ""}`}>
                    <button className="period-title" onClick={(event) => { event.stopPropagation(); togglePeriod(period); }}>
                      <span>{isPeriodCollapsed(period) ? "▸" : "▾"}</span> {period}
                    </button>
                    {!isPeriodCollapsed(period) && dayShifts.filter((shift) => shift.period === period).map((shift) => (
                      <div
                        key={shift.id}
                        className={`shift-chip ${shift.status} ${roleClass(shift.role)} ${shift.employeeId ? "filled" : "empty-slot"}`}
                        draggable
                        onDragStart={(event) => startDraggingShift(event, shift)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => dropEmployeeOnShift(event, shift.id)}
                        onContextMenu={(event) => openShiftMenu(event, shift)}
                        title="Drag this shift to another day, drop an employee, or right-click assigned people"
                      >
                        <b>{shift.start} · {shift.role}</b>
                        <small>{employeeName(shift.employeeId)}</small>
                      </div>
                    ))}
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
              {servicePeriodsForDate(selectedDate).map((period) => (
                <div key={period} className="detail-lane">
                  <button className="detail-lane-title" onClick={() => togglePeriod(period)}>
                    <span>{isPeriodCollapsed(period) ? "▸" : "▾"}</span> {period}
                  </button>
                  {!isPeriodCollapsed(period) && selectedShifts.filter((shift) => shift.period === period).map((shift) => (
                    <article
                      key={shift.id}
                      className={`shift-row ${shift.status} ${roleClass(shift.role)} ${shift.employeeId ? "filled" : "empty-slot"}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropEmployeeOnShift(event, shift.id)}
                      draggable
                      onDragStart={(event) => startDraggingShift(event, shift)}
                      onContextMenu={(event) => openShiftMenu(event, shift)}
                    >
                      <div>
                        <strong>{shift.start}–{shift.end}</strong>
                        <span>{shift.role}</span>
                        {shift.note && <em>{shift.note}</em>}
                      </div>
                      <div className="shift-controls">
                        <select
                          value={shift.employeeId ?? ""}
                          onChange={(event) => {
                            const employeeId = event.target.value || undefined;
                            if (employeeId) {
                              assignEmployeeToShift(shift.id, employeeId, "Manual select");
                            } else {
                              unassignShift(shift.id);
                            }
                          }}
                        >
                          <option value="">Open shift</option>
                          {employees.filter((employee) => employee.role === shift.role || employee.skills.includes(shift.role.toLowerCase())).map((employee) => (
                            <option key={employee.id} value={employee.id}>{employee.name}</option>
                          ))}
                        </select>
                        <button className="secondary small" onClick={() => unassignShift(shift.id)} disabled={!shift.employeeId}>Clear</button>
                      </div>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <h2>Employees</h2>
              <select value={employeeRoleFilter} onChange={(event) => setEmployeeRoleFilter(event.target.value)}>
                {employeeRoles.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </div>
            <div className="employee-list">
              {filteredEmployees.map((employee) => (
                <article
                  key={employee.id}
                  className={`employee-card ${roleClass(employee.role)}`}
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
          </div>
          <button className="secondary small" onClick={abort} disabled={!connected}>Abort</button>
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

        {contextMenu && contextShift && (
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
            <strong>{employeeName(contextShift.employeeId)}</strong>
            <span>{contextShift.period} {contextShift.role} · {dayName(contextShift.date)}</span>
            <button onClick={() => { unassignShift(contextShift.id, "Context menu"); closeContextMenu(); }}>Remove from shift</button>
            <button onClick={() => { setEmployeeRoleFilter(contextShift.role); closeContextMenu(); }}>Show {contextShift.role}s</button>
            <button onClick={() => {
              sendPrompt(`Find a better replacement for ${employeeName(contextShift.employeeId)} on ${dayName(contextShift.date)} ${contextShift.period} ${contextShift.role}. Do not apply changes yet.`);
              closeContextMenu();
            }}>Ask assistant for replacement</button>
          </div>
        )}

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
