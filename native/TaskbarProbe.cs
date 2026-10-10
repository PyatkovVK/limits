using System;
using System.Runtime.InteropServices;
using System.Text;

// Read-only Win32 geometry probe. No injection, reparenting or Explorer changes.
class TaskbarProbe {
  [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
  delegate bool EnumProc(IntPtr hwnd, IntPtr parameter);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string name);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
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
  static string Query(uint owner) {
    IntPtr taskbar = FindWindow("Shell_TrayWnd", null);
    Rect bar;
    if (taskbar == IntPtr.Zero || !GetWindowRect(taskbar, out bar)) return "{\"available\":false}";
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
    string cls = ClassName(foreground);
    bool fullscreen = foregroundPid != owner && cls != "Progman" && cls != "WorkerW" && foreground != taskbar &&
      GetWindowRect(foreground, out front) && front.Left <= monitor.Monitor.Left && front.Top <= monitor.Monitor.Top &&
      front.Right >= monitor.Monitor.Right && front.Bottom >= monitor.Monitor.Bottom;
    bool visible = IsWindowVisible(taskbar) && bar.Top < monitor.Monitor.Bottom - 8 && bar.Bottom > monitor.Monitor.Top + 8;
    return "{\"available\":true,\"visible\":" + (visible ? "true" : "false") + ",\"fullscreen\":" + (fullscreen ? "true" : "false") +
      ",\"bar\":" + Bounds(bar) + ",\"tray\":" + trayJson + ",\"monitor\":" + Bounds(monitor.Monitor) + "}";
  }
  static void Main(string[] args) {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { SetProcessDPIAware(); }
    uint owner = args.Length > 0 ? UInt32.Parse(args[0]) : 0;
    string line;
    while ((line = Console.ReadLine()) != null) {
      if (line != "query") break;
      try { Console.WriteLine(Query(owner)); } catch { Console.WriteLine("{\"available\":false}"); }
      Console.Out.Flush();
    }
  }
}
