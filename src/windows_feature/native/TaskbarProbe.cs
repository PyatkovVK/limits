using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
using System.Collections.Generic;
using System.Windows.Automation;

// Reads taskbar geometry and associates our top-level widget with Explorer.
// Chromium must retain its desktop HWND for native mouse input and capture.
// Explorer is never reparented. Tray activation may dismiss its overflow popup.
class TaskbarProbe {
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
  delegate bool EnumProc(IntPtr hwnd, IntPtr parameter);
  static uint Owner;
  static IntPtr Widget;
  static bool UseTaskbarParent = true;
  static Rect? RequestedBounds;
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] static extern bool IsChild(IntPtr parent, IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll", SetLastError = true)] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wparam, IntPtr lparam);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)] static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hwnd, EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int length);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

  static string Bounds(Rect r) { return "{\"x\":" + r.Left + ",\"y\":" + r.Top + ",\"width\":" + (r.Right-r.Left) + ",\"height\":" + (r.Bottom-r.Top) + "}"; }
  static string ClassName(IntPtr hwnd) { StringBuilder text = new StringBuilder(256); GetClassName(hwnd, text, text.Capacity); return text.ToString(); }
  static string ProcessName(IntPtr hwnd) {
    uint pid; GetWindowThreadProcessId(hwnd, out pid);
    try { using (Process process = Process.GetProcessById((int)pid)) return process.ProcessName.ToLowerInvariant(); }
    catch { return ""; }
  }
  static string OccupiedBounds(IntPtr taskbar, Rect bar, uint owner) {
    try {
      // Read actionable controls, not the full-width XAML/task-list container.
      // Names and alignment are irrelevant, so this works with localized shells.
      Condition controls = new OrCondition(
        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit),
        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.TabItem),
        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem),
        new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.CheckBox));
      List<string> rectangles = new List<string>();
      CacheRequest cache = new CacheRequest();
      cache.Add(AutomationElement.BoundingRectangleProperty);
      cache.Add(AutomationElement.IsOffscreenProperty);
      cache.Add(AutomationElement.ProcessIdProperty);
      using (cache.Activate()) {
        AutomationElement root = AutomationElement.FromHandle(taskbar);
        AutomationElementCollection elements = root.FindAll(TreeScope.Descendants, controls);
        foreach (AutomationElement element in elements) {
          try {
            if (element.Cached.IsOffscreen || element.Cached.ProcessId == owner) continue;
            System.Windows.Rect r = element.Cached.BoundingRectangle;
            if (r.IsEmpty || r.Width <= 0 || r.Height <= 0 || r.Height > (bar.Bottom - bar.Top) * 2 ||
                r.Bottom <= bar.Top || r.Top >= bar.Bottom || r.Right <= bar.Left || r.Left >= bar.Right) continue;
            Rect occupied = new Rect();
            occupied.Left = Math.Max(bar.Left, (int)Math.Floor(r.Left));
            occupied.Top = Math.Max(bar.Top, (int)Math.Floor(r.Top));
            occupied.Right = Math.Min(bar.Right, (int)Math.Ceiling(r.Right));
            occupied.Bottom = Math.Min(bar.Bottom, (int)Math.Ceiling(r.Bottom));
            rectangles.Add(Bounds(occupied));
          } catch (ElementNotAvailableException) { /* Explorer can replace a button during polling. */ }
        }
      }
      return "[" + String.Join(",", rectangles.ToArray()) + "]";
    } catch { return "null"; } // Preserve geometry reporting if accessibility is temporarily unavailable.
  }
  static bool IsShellIdentity(string cls, string process) {
    if (cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd" || cls == "Progman" || cls == "WorkerW" ||
        cls == "#32768" || cls == "ControlCenterWindow" || cls == "NotifyIconOverflowWindow" || cls == "TopLevelWindowForOverflowXamlIsland") return true;
    switch (process.ToLowerInvariant()) {
      case "explorer": case "startmenuexperiencehost": case "searchhost": case "searchapp":
      case "shellhost": case "shellexperiencehost": case "textinputhost": case "widgets": case "widgetservice": return true;
    }
    return false;
  }
  static bool IsShellWindow(IntPtr hwnd, IntPtr taskbar) {
    return hwnd == taskbar || IsShellIdentity(ClassName(hwnd), ProcessName(hwnd));
  }
  static bool IsShellFlyout(string cls, string process) {
    if (cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd" || cls == "Progman" || cls == "WorkerW" ||
        cls == "CabinetWClass" || cls == "ExploreWClass") return false;
    return IsShellIdentity(cls, process);
  }
  static bool AttachToTaskbar(IntPtr taskbar) {
    if (Widget == IntPtr.Zero || taskbar == IntPtr.Zero) return false;
    uint pid; GetWindowThreadProcessId(Widget, out pid);
    if (pid != Owner) return false; // Never change a foreign or recycled handle.
    if (GetWindow(Widget, 4) == taskbar) return true;
    // GWLP_HWNDPARENT sets the owner of a popup without making it WS_CHILD.
    // Reparenting Chromium into Explorer paints correctly but loses mouse input.
    SetWindowLongPtr(Widget, -8, taskbar);
    return GetWindow(Widget, 4) == taskbar;
  }
  static bool AboveTaskbar(IntPtr taskbar) {
    int count = 0;
    for (IntPtr hwnd = GetTopWindow(IntPtr.Zero); hwnd != IntPtr.Zero && count++ < 4096; hwnd = GetWindow(hwnd, 2)) {
      if (hwnd == Widget) return true;
      if (hwnd == taskbar) return false;
    }
    return false;
  }
  static bool DetachFromTaskbar() {
    uint pid; GetWindowThreadProcessId(Widget, out pid);
    if (pid != Owner) return false;
    SetWindowLongPtr(Widget, -8, IntPtr.Zero);
    return GetWindow(Widget, 4) == IntPtr.Zero;
  }
  static bool IsFullscreen(IntPtr foreground, uint owner, IntPtr taskbar, Rect monitor) {
    Rect front;
    uint foregroundPid; GetWindowThreadProcessId(foreground, out foregroundPid);
    // Maximized framed windows have invisible resize borders outside the monitor.
    return !IsZoomed(foreground) && (GetWindowLong(foreground, -16) & 0x00C00000) == 0 &&
      foregroundPid != owner && !IsShellWindow(foreground, taskbar) &&
      GetWindowRect(foreground, out front) && front.Left <= monitor.Left && front.Top <= monitor.Top &&
      front.Right >= monitor.Right && front.Bottom >= monitor.Bottom;
  }
  static string Query(uint owner, IntPtr foreground) {
    IntPtr taskbar = FindWindow("Shell_TrayWnd", null);
    Rect bar;
    if (taskbar == IntPtr.Zero || !GetWindowRect(taskbar, out bar)) return "{\"available\":false}";
    if (UseTaskbarParent) AttachToTaskbar(taskbar); else DetachFromTaskbar();
    bool attached = GetWindow(Widget, 4) == taskbar;
    if (RequestedBounds.HasValue) {
      Rect desired = RequestedBounds.Value;
      uint widgetPid; GetWindowThreadProcessId(Widget, out widgetPid);
      if (Widget != IntPtr.Zero && widgetPid == owner) {
        Point position = new Point { X = desired.Left, Y = desired.Top };
        SetWindowPos(Widget, attached ? IntPtr.Zero : new IntPtr(-1), position.X, position.Y,
          desired.Right-desired.Left, desired.Bottom-desired.Top, 0x0010 | 0x0200 | 0x4000);
      }
      RequestedBounds = null;
    }
    MonitorInfo monitor = new MonitorInfo(); monitor.Size = Marshal.SizeOf(typeof(MonitorInfo));
    if (!GetMonitorInfo(MonitorFromWindow(taskbar, 2), ref monitor)) return "{\"available\":false}";
    IntPtr tray = IntPtr.Zero;
    EnumChildWindows(taskbar, delegate(IntPtr hwnd, IntPtr parameter) {
      if (ClassName(hwnd) == "TrayNotifyWnd") tray = hwnd;
      return true;
    }, IntPtr.Zero);
    Rect trayRect;
    string trayJson = tray != IntPtr.Zero && GetWindowRect(tray, out trayRect) ? Bounds(trayRect) : "null";
    bool shellActive = IsShellWindow(foreground, taskbar);
    bool shellFlyout = IsShellFlyout(ClassName(foreground), ProcessName(foreground));
    bool fullscreen = IsFullscreen(foreground, owner, taskbar, monitor.Monitor);
    bool visible = IsWindowVisible(taskbar) && bar.Top < monitor.Monitor.Bottom - 8 && bar.Bottom > monitor.Monitor.Top + 8;
    return "{\"available\":true,\"visible\":" + (visible ? "true" : "false") + ",\"fullscreen\":" + (fullscreen ? "true" : "false") +
      ",\"shellActive\":" + (shellActive ? "true" : "false") + ",\"attached\":" + (attached ? "true" : "false") +
      ",\"shellFlyout\":" + (shellFlyout ? "true" : "false") +
      ",\"parented\":" + (GetAncestor(Widget, 1) == taskbar ? "true" : "false") +
      ",\"widgetVisible\":" + (IsWindowVisible(Widget) ? "true" : "false") +
      ",\"topmost\":" + ((GetWindowLong(Widget, -20) & 8) != 0 ? "true" : "false") +
      ",\"aboveTaskbar\":" + (AboveTaskbar(taskbar) ? "true" : "false") +
      ",\"bar\":" + Bounds(bar) + ",\"tray\":" + trayJson + ",\"occupied\":" + OccupiedBounds(taskbar, bar, owner) + ",\"monitor\":" + Bounds(monitor.Monitor) + "}";
  }
  static void Main(string[] args) {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { SetProcessDPIAware(); }
    if ((args.Length == 5 && args[0] == "--test-widget-click") || (args.Length == 6 && args[0] == "--test-widget-drag")) {
      Owner = UInt32.Parse(args[1]); Widget = new IntPtr(Int64.Parse(args[2]));
      uint pid; GetWindowThreadProcessId(Widget, out pid);
      Point point = new Point { X = Int32.Parse(args[3]), Y = Int32.Parse(args[4]) }, original;
      IntPtr input = WindowFromPoint(point);
      if (pid != Owner || !IsWindowVisible(Widget) || !IsWindowEnabled(Widget) ||
          !(input == Widget || IsChild(Widget, input)) || !GetCursorPos(out original)) { Environment.ExitCode = 1; return; }
      int delta = args.Length == 6 ? Int32.Parse(args[5]) : 0;
      Rect bounds; GetWindowRect(Widget, out bounds);
      if (Math.Abs(delta) > 100 || point.X + delta < bounds.Left || point.X + delta >= bounds.Right) { Environment.ExitCode = 1; return; }
      bool pressed = false;
      try {
        Point placed;
        if (!SetCursorPos(point.X, point.Y) || !GetCursorPos(out placed) || placed.X != point.X || placed.Y != point.Y) { Environment.ExitCode = 1; return; }
        input = WindowFromPoint(placed);
        if (!(input == Widget || IsChild(Widget, input))) { Environment.ExitCode = 1; return; }
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        pressed = true;
        System.Threading.Thread.Sleep(50);
        for (int step = 1; step <= 10 && delta != 0; step++) {
          SetCursorPos(point.X + delta * step / 10, point.Y);
          System.Threading.Thread.Sleep(30);
        }
        mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        pressed = false;
        System.Threading.Thread.Sleep(100);
      } finally {
        if (pressed) mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        SetCursorPos(original.X, original.Y);
      }
      Console.WriteLine("{\"nativeClick\":true,\"dragDelta\":" + delta + "}");
      return;
    }
    if (args.Length == 3 && args[0] == "--test-shell-window") {
      Console.WriteLine("{\"shell\":" + (IsShellIdentity(args[1], args[2]) ? "true" : "false") +
        ",\"flyout\":" + (IsShellFlyout(args[1], args[2]) ? "true" : "false") + "}");
      return;
    }
    if (args.Length == 1 && args[0] == "--dismiss-tray-overflow") {
      // A tray icon click can leave Explorer's overflow flyout open when a
      // frameless Electron panel takes focus. Ask Explorer to close its popup
      // so the chevron state resets too; SW_HIDE only hides the surface.
      // Restrict this to known Explorer popup classes, never the taskbar itself.
      foreach (string cls in new string[] { "NotifyIconOverflowWindow", "TopLevelWindowForOverflowXamlIsland" }) {
        IntPtr popup = FindWindow(cls, null);
        if (popup == IntPtr.Zero || !IsWindowVisible(popup)) continue;
        uint pid; GetWindowThreadProcessId(popup, out pid);
        try {
          using (Process process = Process.GetProcessById((int)pid)) {
            if (process.ProcessName.Equals("explorer", StringComparison.OrdinalIgnoreCase)) PostMessage(popup, 0x0010, IntPtr.Zero, IntPtr.Zero); // WM_CLOSE
          }
        } catch { /* Explorer may replace the popup during activation. */ }
      }
      return;
    }
    if (args.Length == 3 && args[0] == "--test-widget-order") {
      Owner = UInt32.Parse(args[1]); Widget = new IntPtr(Int64.Parse(args[2]));
      uint pid; GetWindowThreadProcessId(Widget, out pid);
      if (pid != Owner) { Environment.ExitCode = 1; return; }
      // Read the actual order before any test raises the owner. This also works
      // while the widget is hidden, so smoke checks can compare foreground focus.
      IntPtr taskbar = FindWindow("Shell_TrayWnd", null);
      bool attached = taskbar != IntPtr.Zero && GetWindow(Widget, 4) == taskbar;
      Rect widgetRect; GetWindowRect(Widget, out widgetRect);
      IntPtr input = WindowFromPoint(new Point { X = (widgetRect.Left + widgetRect.Right) / 2, Y = (widgetRect.Top + widgetRect.Bottom) / 2 });
      Console.WriteLine("{\"visible\":" + (IsWindowVisible(Widget) ? "true" : "false") +
        ",\"inputEnabled\":" + (IsWindowEnabled(Widget) ? "true" : "false") +
        ",\"receivesInput\":" + (input == Widget || IsChild(Widget, input) ? "true" : "false") +
        ",\"attached\":" + (attached ? "true" : "false") +
        ",\"aboveTaskbar\":" + (taskbar != IntPtr.Zero && AboveTaskbar(taskbar) ? "true" : "false") +
        ",\"topmost\":" + ((GetWindowLong(Widget, -20) & 8) != 0 ? "true" : "false") +
        ",\"foreground\":\"" + GetForegroundWindow().ToInt64() + "\"}");
      return;
    }
    if (args.Length == 3 && args[0] == "--test-window-mode") {
      uint testOwner = UInt32.Parse(args[1]);
      IntPtr testWindow = new IntPtr(Int64.Parse(args[2]));
      uint pid; GetWindowThreadProcessId(testWindow, out pid);
      if (pid != testOwner || !IsWindowVisible(testWindow)) { Environment.ExitCode = 1; return; }
      // Inspect only the caller's simulated window, independent of foreground focus.
      // This test does not query UI Automation while Electron waits for its result.
      MonitorInfo monitor = new MonitorInfo(); monitor.Size = Marshal.SizeOf(typeof(MonitorInfo));
      bool available = GetMonitorInfo(MonitorFromWindow(testWindow, 2), ref monitor);
      bool fullscreen = available && IsFullscreen(testWindow, 0, FindWindow("Shell_TrayWnd", null), monitor.Monitor);
      Console.WriteLine("{\"available\":" + (available ? "true" : "false") + ",\"fullscreen\":" + (fullscreen ? "true" : "false") + "}");
      return;
    }
    // Repeated owner raises are tested against a separate simulated taskbar in our app.
    // Do not raise, lower, click or change ownership of the real Windows taskbar.
    if (args.Length == 4 && (args[0] == "--test-ownership" || args[0] == "--test-owner-destroy")) {
      Owner = UInt32.Parse(args[1]); Widget = new IntPtr(Int64.Parse(args[2]));
      uint pid; GetWindowThreadProcessId(Widget, out pid);
      if (pid != Owner || !IsWindowVisible(Widget)) { Environment.ExitCode = 1; return; }
      IntPtr foreground = GetForegroundWindow();
      Rect before, after; GetWindowRect(Widget, out before);
      IntPtr originalOwner = GetWindow(Widget, 4);
      IntPtr simulatedTaskbar = new IntPtr(Int64.Parse(args[3]));
      uint simulatedPid; GetWindowThreadProcessId(simulatedTaskbar, out simulatedPid);
      if (simulatedPid != Owner || originalOwner != FindWindow("Shell_TrayWnd", null)) { Environment.ExitCode = 1; return; }
      bool ordered = AttachToTaskbar(simulatedTaskbar);
      if (args[0] == "--test-owner-destroy") {
        Console.WriteLine("{\"attached\":" + (ordered ? "true" : "false") + "}");
        Environment.ExitCode = ordered ? 0 : 1;
        return; // The Electron smoke test will destroy its own simulated owner.
      }
      for (int i = 0; i < 100 && ordered; i++) {
        SetWindowPos(simulatedTaskbar, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010);
        ordered = AboveTaskbar(simulatedTaskbar);
      }
      GetWindowRect(Widget, out after);
      bool ok = ordered && IsWindowVisible(Widget) && GetForegroundWindow() == foreground &&
        before.Left == after.Left && before.Top == after.Top && before.Right == after.Right && before.Bottom == after.Bottom;
      AttachToTaskbar(originalOwner);
      Console.WriteLine("{\"ownerRaises\":100,\"aboveOwner\":" + (ordered ? "true" : "false") + ",\"attached\":" + (GetWindow(Widget, 4) == originalOwner ? "true" : "false") +
        ",\"before\":" + Bounds(before) + ",\"after\":" + Bounds(after) + ",\"focusStable\":" + (GetForegroundWindow() == foreground ? "true" : "false") +
        ",\"stable\":" + (ok ? "true" : "false") + "}");
      Environment.ExitCode = ok ? 0 : 1;
      return;
    }
    Owner = args.Length > 0 ? UInt32.Parse(args[0]) : 0;
    Widget = args.Length > 1 ? new IntPtr(Int64.Parse(args[1])) : IntPtr.Zero;
    UseTaskbarParent = args.Length < 3 || args[2] != "overlay";
    string line;
    while ((line = Console.ReadLine()) != null) {
      string[] command = line.Split(' ');
      if (command[0] == "parent-overlay" || command[0] == "parent-taskbar") {
        UseTaskbarParent = command[0] == "parent-taskbar";
        int x, y, width, height;
        if (command.Length == 5 && Int32.TryParse(command[1], out x) && Int32.TryParse(command[2], out y) &&
            Int32.TryParse(command[3], out width) && Int32.TryParse(command[4], out height) && width > 0 && height > 0)
          RequestedBounds = new Rect { Left=x, Top=y, Right=x+width, Bottom=y+height };
      }
      else if (line != "query") break;
      try { Console.WriteLine(Query(Owner, GetForegroundWindow())); } catch { Console.WriteLine("{\"available\":false}"); }
      Console.Out.Flush();
    }
  }
}
