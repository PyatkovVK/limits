using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

// Reads taskbar geometry. The widget is an owned top-level window of the taskbar:
// Windows maintains their order atomically, without post-click z-order repairs.
// Only our widget is changed; Explorer is neither modified nor reparented.
class TaskbarProbe {
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
  delegate bool EnumProc(IntPtr hwnd, IntPtr parameter);
  static uint Owner;
  static IntPtr Widget;
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)] static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr hwnd, EnumProc callback, IntPtr parameter);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int length);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();

  static string Bounds(Rect r) { return "{\"x\":" + r.Left + ",\"y\":" + r.Top + ",\"width\":" + (r.Right-r.Left) + ",\"height\":" + (r.Bottom-r.Top) + "}"; }
  static string ClassName(IntPtr hwnd) { StringBuilder text = new StringBuilder(256); GetClassName(hwnd, text, text.Capacity); return text.ToString(); }
  static bool IsShellWindow(IntPtr hwnd, IntPtr taskbar) {
    string cls = ClassName(hwnd);
    if (hwnd == taskbar || cls == "Shell_SecondaryTrayWnd" || cls == "Progman" || cls == "WorkerW" || cls == "#32768") return true;
    uint pid; GetWindowThreadProcessId(hwnd, out pid);
    try {
      using (Process process = Process.GetProcessById((int)pid)) {
        switch (process.ProcessName.ToLowerInvariant()) {
          case "explorer": case "startmenuexperiencehost": case "searchhost": case "searchapp":
          case "shellexperiencehost": case "textinputhost": case "widgets": case "widgetservice": return true;
        }
      }
    } catch { /* A foreground process can exit while being inspected. */ }
    return false;
  }
  static bool AttachToTaskbar(IntPtr taskbar) {
    if (Widget == IntPtr.Zero || taskbar == IntPtr.Zero) return false;
    uint pid; GetWindowThreadProcessId(Widget, out pid);
    if (pid != Owner) return false; // Never change a foreign or recycled handle.
    if (GetWindow(Widget, 4) == taskbar) return true;
    SetWindowLongPtr(Widget, -8, taskbar); // GWLP_HWNDPARENT changes ownership, not parenting.
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
  static string Query(uint owner) {
    IntPtr taskbar = FindWindow("Shell_TrayWnd", null);
    Rect bar;
    if (taskbar == IntPtr.Zero || !GetWindowRect(taskbar, out bar)) return "{\"available\":false}";
    bool attached = AttachToTaskbar(taskbar);
    MonitorInfo monitor = new MonitorInfo(); monitor.Size = Marshal.SizeOf(typeof(MonitorInfo));
    if (!GetMonitorInfo(MonitorFromWindow(taskbar, 2), ref monitor)) return "{\"available\":false}";
    IntPtr tray = IntPtr.Zero;
    EnumChildWindows(taskbar, delegate(IntPtr hwnd, IntPtr parameter) {
      if (ClassName(hwnd) == "TrayNotifyWnd") tray = hwnd;
      return true;
    }, IntPtr.Zero);
    Rect trayRect;
    string trayJson = tray != IntPtr.Zero && GetWindowRect(tray, out trayRect) ? Bounds(trayRect) : "null";
    IntPtr foreground = GetForegroundWindow(); Rect front;
    uint foregroundPid; GetWindowThreadProcessId(foreground, out foregroundPid);
    bool shellActive = IsShellWindow(foreground, taskbar);
    // A maximized framed window can extend past all monitor edges (invisible resize borders).
    // Only a borderless, non-maximized foreground window is a fullscreen candidate.
    bool fullscreen = !IsZoomed(foreground) && (GetWindowLong(foreground, -16) & 0x00C00000) == 0 &&
      foregroundPid != owner && !shellActive &&
      GetWindowRect(foreground, out front) && front.Left <= monitor.Monitor.Left && front.Top <= monitor.Monitor.Top &&
      front.Right >= monitor.Monitor.Right && front.Bottom >= monitor.Monitor.Bottom;
    bool visible = IsWindowVisible(taskbar) && bar.Top < monitor.Monitor.Bottom - 8 && bar.Bottom > monitor.Monitor.Top + 8;
    return "{\"available\":true,\"visible\":" + (visible ? "true" : "false") + ",\"fullscreen\":" + (fullscreen ? "true" : "false") +
      ",\"shellActive\":" + (shellActive ? "true" : "false") + ",\"attached\":" + (attached ? "true" : "false") +
      ",\"bar\":" + Bounds(bar) + ",\"tray\":" + trayJson + ",\"monitor\":" + Bounds(monitor.Monitor) + "}";
  }
  static void Main(string[] args) {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { SetProcessDPIAware(); }
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
      Console.WriteLine("{\"ownerRaises\":100,\"aboveOwner\":" + (ordered ? "true" : "false") + ",\"attached\":" + (GetWindow(Widget, 4) == originalOwner ? "true" : "false") + ",\"stable\":" + (ok ? "true" : "false") + "}");
      Environment.ExitCode = ok ? 0 : 1;
      return;
    }
    Owner = args.Length > 0 ? UInt32.Parse(args[0]) : 0;
    Widget = args.Length > 1 ? new IntPtr(Int64.Parse(args[1])) : IntPtr.Zero;
    string line;
    while ((line = Console.ReadLine()) != null && line == "query") {
      try { Console.WriteLine(Query(Owner)); } catch { Console.WriteLine("{\"available\":false}"); }
      Console.Out.Flush();
    }
  }
}
