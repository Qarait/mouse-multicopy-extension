using System;
using System.Runtime.InteropServices;

namespace MouseMultiCopy.Windows
{
    internal static class NativeMethods
    {
        internal const int WmClipboardUpdate = 0x031D;
        internal const int WmHotKey = 0x0312;
        internal const uint ModAlt = 0x0001;
        internal const uint ModShift = 0x0004;
        internal const uint ModNoRepeat = 0x4000;
        internal const uint KeyEventKeyUp = 0x0002;
        internal const byte VirtualKeyControl = 0x11;
        internal const byte VirtualKeyV = 0x56;

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool AddClipboardFormatListener(IntPtr windowHandle);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool RemoveClipboardFormatListener(IntPtr windowHandle);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool RegisterHotKey(
            IntPtr windowHandle,
            int id,
            uint modifiers,
            uint virtualKey);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool UnregisterHotKey(IntPtr windowHandle, int id);

        [DllImport("user32.dll")]
        internal static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        internal static extern bool SetForegroundWindow(IntPtr windowHandle);

        [DllImport("user32.dll")]
        internal static extern void keybd_event(
            byte virtualKey,
            byte scanCode,
            uint flags,
            UIntPtr extraInfo);

        internal static void SendPaste()
        {
            keybd_event(VirtualKeyControl, 0, 0, UIntPtr.Zero);
            keybd_event(VirtualKeyV, 0, 0, UIntPtr.Zero);
            keybd_event(VirtualKeyV, 0, KeyEventKeyUp, UIntPtr.Zero);
            keybd_event(VirtualKeyControl, 0, KeyEventKeyUp, UIntPtr.Zero);
        }
    }
}
