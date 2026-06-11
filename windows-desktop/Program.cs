using System;
using System.Threading;
using System.Windows.Forms;

namespace MouseMultiCopy.Windows
{
    internal static class Program
    {
        private const string MutexName = "MouseMultiCopy.Windows.Desktop";

        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "--self-test")
            {
                return SelfTest.Run();
            }
            if (args.Length > 1 && args[0] == "--render-test")
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (var form = new MainForm())
                {
                    form.SavePreview(args[1]);
                }
                return 0;
            }

            bool createdNew;
            using (var mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew)
                {
                    MessageBox.Show(
                        "Mouse MultiCopy is already running in the system tray.",
                        "Mouse MultiCopy",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                    return 0;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new MainForm());
                return 0;
            }
        }
    }
}
