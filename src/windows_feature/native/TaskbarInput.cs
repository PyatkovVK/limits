using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Collections.Concurrent;

partial class TaskbarProbe {
  [StructLayout(LayoutKind.Sequential)] struct MouseData { public Point Position; public uint Data, Flags, Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Sequential)] struct Message { public IntPtr Window; public uint Id; public UIntPtr WParam; public IntPtr LParam; public uint Time; public Point Position; public uint Private; }
  delegate IntPtr MouseProc(int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll", SetLastError = true)] static extern IntPtr SetWindowsHookEx(int id, MouseProc proc, IntPtr module, uint thread);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern int GetMessage(out Message message, IntPtr hwnd, uint min, uint max);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref Message message);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
  static readonly MouseProc InputCallback = OnMouse;
  static readonly ConcurrentQueue<string> InputQueue = new ConcurrentQueue<string>();
  static readonly AutoResetEvent InputPending = new AutoResetEvent(false);
  static string CapturedButton;

  // Chromium paints correctly as an Explorer child, but its native input path
  // assumes a desktop window. Forward only this widget's mouse gestures, never
  // input over another app or a shell popup. A drag retains capture until up.
  static IntPtr OnMouse(int code, IntPtr message, IntPtr data) {
    if (code < 0) return CallNextHookEx(IntPtr.Zero, code, message, data);
    uint pid; GetWindowThreadProcessId(Widget, out pid);
    if (pid != Owner || !IsWindowVisible(Widget) || (GetWindowLong(Widget, -16) & 0x40000000) == 0) {
      CapturedButton = null;
      return CallNextHookEx(IntPtr.Zero, code, message, data);
    }
    int id = message.ToInt32();
    if (id != 0x0200 && id != 0x0201 && id != 0x0202 && id != 0x0204 && id != 0x0205)
      return CallNextHookEx(IntPtr.Zero, code, message, data);
    // Idle hovering keeps the normal Windows cursor path. Only clicks and a
    // gesture started on our widget need forwarding/capture.
    if (id == 0x0200 && CapturedButton == null) return CallNextHookEx(IntPtr.Zero, code, message, data);
    MouseData mouse = (MouseData)Marshal.PtrToStructure(data, typeof(MouseData));
    IntPtr hit = WindowFromPoint(mouse.Position);
    if (CapturedButton == null && hit != Widget && !IsChild(Widget, hit))
      return CallNextHookEx(IntPtr.Zero, code, message, data);
    string button = id == 0x0204 || id == 0x0205 ? "right" : CapturedButton ?? "left";
    bool down = id == 0x0201 || id == 0x0204;
    bool up = id == 0x0202 || id == 0x0205;
    if (down) CapturedButton = button;
    bool pressed = CapturedButton != null && !up;
    if (up) CapturedButton = null;
    InputQueue.Enqueue("{\"input\":{\"type\":\"" + (down ? "mouseDown" : up ? "mouseUp" : "mouseMove") +
      "\",\"button\":\"" + button + "\",\"pressed\":" + (pressed ? "true" : "false") +
      ",\"x\":" + mouse.Position.X + ",\"y\":" + mouse.Position.Y + "}}");
    InputPending.Set();
    // Real hardware movement must reach Windows so it updates the cursor.
    // Suppress only button messages; Chromium must not receive duplicate clicks.
    return id == 0x0200 ? CallNextHookEx(IntPtr.Zero, code, message, data) : new IntPtr(1);
  }
  static void StartInput() {
    // Neither accessibility queries nor pipe writes may block the hook thread.
    Thread writer = new Thread(delegate() {
      while (true) {
        InputPending.WaitOne();
        string line;
        while (InputQueue.TryDequeue(out line)) {
          try { Console.WriteLine(line); Console.Out.Flush(); } catch { return; }
        }
      }
    });
    writer.IsBackground = true; writer.Start();
    ManualResetEvent ready = new ManualResetEvent(false);
    IntPtr installedHook = IntPtr.Zero;
    Thread input = new Thread(delegate() {
      IntPtr hook = SetWindowsHookEx(14, InputCallback, GetModuleHandle(null), 0);
      installedHook = hook; ready.Set();
      if (hook == IntPtr.Zero) return;
      try { Message message; while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0) { TranslateMessage(ref message); DispatchMessage(ref message); } }
      finally { UnhookWindowsHookEx(hook); }
    });
    input.IsBackground = true; input.Start();
    if (!ready.WaitOne(1000) || installedHook == IntPtr.Zero)
      throw new InvalidOperationException("Could not start taskbar mouse input.");
  }
}
