using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MouseMultiCopy.Windows
{
    internal sealed class MainForm : Form
    {
        private const int ToggleHotKeyId = 100;
        private const int PasteAllHotKeyId = 101;
        private const uint VirtualKeyA = 0x41;
        private const uint VirtualKeyV = 0x56;

        private readonly HighlightStore _store;
        private readonly AppState _state;
        private readonly Icon _appIcon;
        private readonly Label _countLabel;
        private readonly Label _emptyLabel;
        private readonly FlowLayoutPanel _listPanel;
        private readonly Button _copyAllButton;
        private readonly CheckBox _collectToggle;
        private readonly NotifyIcon _trayIcon;
        private readonly System.Windows.Forms.Timer _foregroundTimer;
        private IntPtr _lastExternalWindow;
        private string _ignoredClipboardText;
        private DateTime _ignoreClipboardUntil;
        private bool _allowExit;

        public MainForm()
        {
            _store = new HighlightStore();
            _state = _store.Load();
            _appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            Text = "Mouse MultiCopy";
            if (_appIcon != null)
            {
                Icon = _appIcon;
            }
            MinimumSize = new Size(500, 500);
            Size = new Size(620, 700);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(244, 248, 245);
            Font = new Font("Segoe UI", 9F);

            var header = BuildHeader(out _countLabel, out _collectToggle);
            var footer = BuildFooter(out _copyAllButton);
            _listPanel = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoScroll = true,
                Padding = new Padding(18, 14, 18, 14),
                BackColor = BackColor
            };
            _emptyLabel = new Label
            {
                AutoSize = false,
                Size = new Size(480, 110),
                Text = "Copy text anywhere in Windows.\r\nYour numbered highlights will appear here.",
                TextAlign = ContentAlignment.MiddleCenter,
                ForeColor = Color.FromArgb(86, 100, 93),
                Font = new Font("Segoe UI", 11F),
                Margin = new Padding(0, 34, 0, 0)
            };

            Controls.Add(_listPanel);
            Controls.Add(footer);
            Controls.Add(header);

            _trayIcon = BuildTrayIcon();
            _foregroundTimer = new System.Windows.Forms.Timer { Interval = 250 };
            _foregroundTimer.Tick += TrackForegroundWindow;
            _foregroundTimer.Start();

            Resize += delegate { RenderHighlights(); };
            FormClosing += HandleFormClosing;
            RenderHighlights();
        }

        protected override void OnHandleCreated(EventArgs eventArgs)
        {
            base.OnHandleCreated(eventArgs);
            NativeMethods.AddClipboardFormatListener(Handle);
            NativeMethods.RegisterHotKey(
                Handle,
                ToggleHotKeyId,
                NativeMethods.ModAlt | NativeMethods.ModShift | NativeMethods.ModNoRepeat,
                VirtualKeyV);
            NativeMethods.RegisterHotKey(
                Handle,
                PasteAllHotKeyId,
                NativeMethods.ModAlt | NativeMethods.ModShift | NativeMethods.ModNoRepeat,
                VirtualKeyA);
        }

        protected override void OnHandleDestroyed(EventArgs eventArgs)
        {
            NativeMethods.RemoveClipboardFormatListener(Handle);
            NativeMethods.UnregisterHotKey(Handle, ToggleHotKeyId);
            NativeMethods.UnregisterHotKey(Handle, PasteAllHotKeyId);
            base.OnHandleDestroyed(eventArgs);
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == NativeMethods.WmClipboardUpdate)
            {
                BeginInvoke((MethodInvoker)CaptureClipboardText);
            }
            else if (message.Msg == NativeMethods.WmHotKey)
            {
                var id = message.WParam.ToInt32();
                if (id == ToggleHotKeyId)
                {
                    ToggleWindow();
                }
                else if (id == PasteAllHotKeyId)
                {
                    PasteTextToLastWindow(HighlightStore.FormatAll(_state));
                }
            }

            base.WndProc(ref message);
        }

        internal void SavePreview(string path)
        {
            WindowState = FormWindowState.Normal;
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-10000, -10000);
            Show();
            Application.DoEvents();
            PerformLayout();
            _listPanel.PerformLayout();
            Refresh();
            Application.DoEvents();

            using (var bitmap = new Bitmap(ClientSize.Width, ClientSize.Height))
            {
                DrawToBitmap(bitmap, new Rectangle(Point.Empty, ClientSize));
                bitmap.Save(path, System.Drawing.Imaging.ImageFormat.Png);
            }
            Hide();
        }

        private Panel BuildHeader(out Label countLabel, out CheckBox collectToggle)
        {
            var panel = new Panel
            {
                Dock = DockStyle.Top,
                Height = 96,
                Padding = new Padding(20, 15, 20, 10),
                BackColor = Color.White
            };
            var title = new Label
            {
                AutoSize = true,
                Location = new Point(20, 14),
                Text = "Mouse MultiCopy",
                Font = new Font("Segoe UI Semibold", 18F, FontStyle.Bold),
                ForeColor = Color.FromArgb(20, 35, 28)
            };
            countLabel = new Label
            {
                AutoSize = true,
                Location = new Point(23, 55),
                ForeColor = Color.FromArgb(86, 100, 93)
            };
            var toggle = new CheckBox
            {
                AutoSize = true,
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(panel.Width - 126, 24),
                Text = "Collect",
                Checked = _state.Collecting,
                Font = new Font("Segoe UI Semibold", 10F)
            };
            toggle.CheckedChanged += delegate
            {
                _state.Collecting = toggle.Checked;
                _store.Save(_state);
                UpdateTrayText();
            };
            panel.Resize += delegate
            {
                toggle.Left = panel.ClientSize.Width - toggle.Width - 20;
            };
            panel.Controls.Add(title);
            panel.Controls.Add(countLabel);
            panel.Controls.Add(toggle);
            collectToggle = toggle;
            return panel;
        }

        private Panel BuildFooter(out Button copyAllButton)
        {
            var panel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 124,
                Padding = new Padding(18, 12, 18, 16),
                BackColor = Color.White
            };
            copyAllButton = new Button
            {
                Dock = DockStyle.Top,
                Height = 48,
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(23, 107, 58),
                ForeColor = Color.White,
                Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                Text = "Copy All",
                Cursor = Cursors.Hand
            };
            copyAllButton.FlatAppearance.BorderSize = 0;
            copyAllButton.Click += delegate { CopyAll(false); };

            var secondary = new TableLayoutPanel
            {
                Dock = DockStyle.Bottom,
                Height = 38,
                ColumnCount = 2,
                RowCount = 1
            };
            secondary.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            secondary.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            var clearButton = CreateSecondaryButton("Clear all");
            var hideButton = CreateSecondaryButton("Hide to tray");
            clearButton.Click += delegate { ConfirmClear(); };
            hideButton.Click += delegate { HideToTray(); };
            secondary.Controls.Add(clearButton, 0, 0);
            secondary.Controls.Add(hideButton, 1, 0);

            panel.Controls.Add(copyAllButton);
            panel.Controls.Add(secondary);
            return panel;
        }

        private Button CreateSecondaryButton(string text)
        {
            var button = new Button
            {
                Dock = DockStyle.Fill,
                Margin = new Padding(0, 8, 6, 0),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.White,
                ForeColor = Color.FromArgb(20, 35, 28),
                Text = text,
                Cursor = Cursors.Hand
            };
            button.FlatAppearance.BorderColor = Color.FromArgb(210, 220, 214);
            return button;
        }

        private NotifyIcon BuildTrayIcon()
        {
            var menu = new ContextMenuStrip();
            menu.Items.Add("Open Mouse MultiCopy", null, delegate { ShowWindow(); });
            menu.Items.Add("Copy all", null, delegate { CopyAll(false); });
            menu.Items.Add("Pause / resume", null, delegate
            {
                _collectToggle.Checked = !_collectToggle.Checked;
            });
            menu.Items.Add("Clear all", null, delegate { ConfirmClear(); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Exit", null, delegate
            {
                _allowExit = true;
                Close();
            });

            var icon = new NotifyIcon
            {
                Icon = _appIcon ?? SystemIcons.Application,
                Text = "Mouse MultiCopy",
                Visible = true,
                ContextMenuStrip = menu
            };
            icon.DoubleClick += delegate { ToggleWindow(); };
            return icon;
        }

        private void CaptureClipboardText()
        {
            if (!_state.Collecting || !Clipboard.ContainsText())
            {
                return;
            }

            string text;
            try
            {
                text = HighlightStore.NormalizeText(Clipboard.GetText());
            }
            catch (ExternalException)
            {
                return;
            }

            if (text.Length == 0)
            {
                return;
            }
            if (DateTime.UtcNow <= _ignoreClipboardUntil &&
                string.Equals(text, _ignoredClipboardText, StringComparison.Ordinal))
            {
                return;
            }

            var result = _store.Add(_state, text);
            if (result == AddHighlightResult.Added ||
                result == AddHighlightResult.ReplacedOldest)
            {
                RenderHighlights();
                var number = _state.Highlights.Count;
                var preview = text.Replace("\r", " ").Replace("\n", " ");
                if (preview.Length > 54)
                {
                    preview = preview.Substring(0, 51) + "...";
                }
                var prefix = result == AddHighlightResult.ReplacedOldest
                    ? "Oldest highlight replaced. "
                    : string.Empty;
                ShowCaptureNotification(
                    prefix + "Highlight " + number + " saved",
                    preview);
            }
        }

        private void RenderHighlights()
        {
            _listPanel.SuspendLayout();
            _listPanel.Controls.Clear();
            var availableWidth = Math.Max(420, _listPanel.ClientSize.Width - 44);

            if (_state.Highlights.Count == 0)
            {
                _emptyLabel.Width = availableWidth;
                _listPanel.Controls.Add(_emptyLabel);
            }
            else
            {
                for (var index = 0; index < _state.Highlights.Count; index += 1)
                {
                    _listPanel.Controls.Add(BuildHighlightRow(index, availableWidth));
                }
            }

            _countLabel.Text = _state.Highlights.Count + " saved highlight" +
                (_state.Highlights.Count == 1 ? string.Empty : "s");
            _copyAllButton.Enabled = _state.Highlights.Count > 0;
            _copyAllButton.Text = _state.Highlights.Count > 0
                ? "Copy All " + _state.Highlights.Count
                : "Copy All";
            UpdateTrayText();
            _listPanel.ResumeLayout();
        }

        private Control BuildHighlightRow(int index, int width)
        {
            var item = _state.Highlights[index];
            var row = new HighlightRowPanel
            {
                Width = width,
                Height = 100
            };

            var number = new Label
            {
                Location = new Point(12, 14),
                Size = new Size(38, 38),
                Text = (index + 1).ToString(),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = Color.FromArgb(20, 35, 28),
                ForeColor = Color.White,
                Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold)
            };
            var buttonWidth = 60;
            var gap = 6;
            var actionWidth = buttonWidth * 3 + gap * 2;
            var text = new Label
            {
                Location = new Point(62, 12),
                Size = new Size(Math.Max(120, width - 82 - actionWidth), 70),
                Text = item.Text,
                AutoEllipsis = true,
                ForeColor = Color.FromArgb(20, 35, 28),
                Font = new Font("Segoe UI", 9.5F)
            };
            var actionsLeft = width - actionWidth - 12;
            var copy = CreateRowButton("Copy", actionsLeft, 28, buttonWidth);
            var paste = CreateRowButton("Paste", actionsLeft + buttonWidth + gap, 28, buttonWidth);
            var delete = CreateRowButton("Delete", actionsLeft + (buttonWidth + gap) * 2, 28, buttonWidth);
            copy.Click += delegate { CopyText(item.Text, "Highlight " + (index + 1) + " copied"); };
            paste.Click += delegate { PasteTextToLastWindow(item.Text); };
            delete.Click += delegate
            {
                _store.RemoveAt(_state, index);
                RenderHighlights();
            };

            row.Controls.Add(number);
            row.Controls.Add(text);
            row.Controls.Add(copy);
            row.Controls.Add(paste);
            row.Controls.Add(delete);
            return row;
        }

        private Button CreateRowButton(string text, int left, int top, int width)
        {
            var button = new Button
            {
                Text = text,
                Location = new Point(left, top),
                Size = new Size(width, 34),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.White,
                ForeColor = Color.FromArgb(20, 35, 28),
                Cursor = Cursors.Hand,
                Font = new Font("Segoe UI Semibold", 8.5F)
            };
            button.FlatAppearance.BorderColor = Color.FromArgb(210, 220, 214);
            return button;
        }

        private void CopyAll(bool paste)
        {
            var text = HighlightStore.FormatAll(_state);
            if (text.Length == 0)
            {
                return;
            }
            if (paste)
            {
                PasteTextToLastWindow(text);
            }
            else
            {
                CopyText(text, "All highlights copied");
            }
        }

        private void CopyText(string text, string confirmation)
        {
            if (!SetClipboardText(text))
            {
                MessageBox.Show(
                    "Windows could not access the clipboard. Please try again.",
                    "Mouse MultiCopy",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }
            ShowCaptureNotification(confirmation, "Paste anywhere with Ctrl+V.");
        }

        private void PasteTextToLastWindow(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                return;
            }
            if (!SetClipboardText(text))
            {
                return;
            }

            var target = _lastExternalWindow;
            Hide();
            if (target != IntPtr.Zero)
            {
                NativeMethods.SetForegroundWindow(target);
            }

            var timer = new System.Windows.Forms.Timer { Interval = 140 };
            timer.Tick += delegate
            {
                timer.Stop();
                timer.Dispose();
                NativeMethods.SendPaste();
            };
            timer.Start();
        }

        private bool SetClipboardText(string text)
        {
            _ignoredClipboardText = text;
            _ignoreClipboardUntil = DateTime.UtcNow.AddSeconds(2);
            for (var attempt = 0; attempt < 5; attempt += 1)
            {
                try
                {
                    Clipboard.SetText(text);
                    return true;
                }
                catch (ExternalException)
                {
                    Thread.Sleep(30);
                }
            }
            return false;
        }

        private void ConfirmClear()
        {
            if (_state.Highlights.Count == 0)
            {
                return;
            }
            var result = MessageBox.Show(
                "Delete all saved highlights?",
                "Mouse MultiCopy",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);
            if (result == DialogResult.Yes)
            {
                _store.Clear(_state);
                RenderHighlights();
            }
        }

        private void TrackForegroundWindow(object sender, EventArgs eventArgs)
        {
            var foreground = NativeMethods.GetForegroundWindow();
            if (foreground != IntPtr.Zero && foreground != Handle)
            {
                _lastExternalWindow = foreground;
            }
        }

        private void ShowCaptureNotification(string title, string message)
        {
            _trayIcon.BalloonTipTitle = title;
            _trayIcon.BalloonTipText = message;
            _trayIcon.ShowBalloonTip(1800);
        }

        private void UpdateTrayText()
        {
            var status = _state.Collecting ? "collecting" : "paused";
            var text = "Mouse MultiCopy - " + _state.Highlights.Count + " saved, " + status;
            _trayIcon.Text = text.Length > 63 ? text.Substring(0, 63) : text;
        }

        private void ToggleWindow()
        {
            if (Visible)
            {
                HideToTray();
            }
            else
            {
                ShowWindow();
            }
        }

        private void ShowWindow()
        {
            Show();
            WindowState = FormWindowState.Normal;
            Activate();
        }

        private void HideToTray()
        {
            Hide();
            ShowCaptureNotification(
                "Mouse MultiCopy is still collecting",
                "Double-click the tray icon or press Alt+Shift+V to reopen.");
        }

        private void HandleFormClosing(object sender, FormClosingEventArgs eventArgs)
        {
            if (!_allowExit && eventArgs.CloseReason == CloseReason.UserClosing)
            {
                eventArgs.Cancel = true;
                HideToTray();
                return;
            }

            _foregroundTimer.Stop();
            _trayIcon.Visible = false;
            _trayIcon.Dispose();
        }
    }
}
