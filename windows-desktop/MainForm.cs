using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace MouseMultiCopy.Windows
{
    internal sealed class MainForm : Form
    {
        private static readonly Color Ink = Color.FromArgb(20, 35, 48);
        private static readonly Color Muted = Color.FromArgb(91, 105, 114);
        private static readonly Color Navy = Color.FromArgb(31, 62, 104);
        private static readonly Color Green = Color.FromArgb(24, 122, 69);
        private static readonly Color Canvas = Color.FromArgb(244, 247, 249);
        private static readonly Color Line = Color.FromArgb(218, 225, 230);
        private static readonly Color CopyBlue = Color.FromArgb(232, 241, 252);
        private static readonly Color CopyBlueText = Color.FromArgb(35, 82, 145);
        private static readonly Color PasteGreen = Color.FromArgb(229, 244, 235);
        private static readonly Color PasteGreenText = Color.FromArgb(22, 105, 58);
        private static readonly Color DeleteRed = Color.FromArgb(252, 236, 236);
        private static readonly Color DeleteRedText = Color.FromArgb(157, 48, 48);
        private static readonly Color[] RowAccents =
        {
            Color.FromArgb(48, 104, 176),
            Color.FromArgb(31, 132, 83),
            Color.FromArgb(205, 139, 38)
        };

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
            BackColor = Canvas;
            Font = new Font("Segoe UI", 9F);

            var header = BuildHeader(out _countLabel, out _collectToggle);
            var footer = BuildFooter(out _copyAllButton);
            _listPanel = new FlowLayoutPanel
            {
                Dock = DockStyle.Fill,
                FlowDirection = FlowDirection.TopDown,
                WrapContents = false,
                AutoScroll = true,
                Padding = new Padding(20, 18, 20, 18),
                BackColor = BackColor
            };
            _emptyLabel = new Label
            {
                AutoSize = false,
                Size = new Size(480, 150),
                Text = "COPY SOMETHING TO BEGIN\r\n\r\nUse Ctrl+C in Word, Notepad, a browser, or any other app.\r\nYour numbered highlights will appear here.",
                TextAlign = ContentAlignment.MiddleCenter,
                ForeColor = Muted,
                Font = new Font("Segoe UI", 10F),
                BackColor = Color.White,
                Margin = new Padding(0, 40, 0, 0)
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
                Height = 112,
                Padding = new Padding(22, 15, 22, 12),
                BackColor = Navy
            };
            var iconBox = new Panel
            {
                Location = new Point(22, 21),
                Size = new Size(46, 46),
                BackColor = Color.White
            };
            var iconText = new Label
            {
                Dock = DockStyle.Fill,
                Text = "MC",
                TextAlign = ContentAlignment.MiddleCenter,
                Font = new Font("Segoe UI Semibold", 11F, FontStyle.Bold),
                ForeColor = Navy
            };
            iconBox.Controls.Add(iconText);
            var title = new Label
            {
                AutoSize = true,
                Location = new Point(82, 18),
                Text = "Mouse MultiCopy",
                Font = new Font("Segoe UI Semibold", 17F, FontStyle.Bold),
                ForeColor = Color.White
            };
            var subtitle = new Label
            {
                AutoSize = true,
                Location = new Point(84, 52),
                Text = "Windows clipboard collector",
                Font = new Font("Segoe UI", 9F),
                ForeColor = Color.FromArgb(205, 220, 238)
            };
            countLabel = new Label
            {
                AutoSize = true,
                Location = new Point(23, 82),
                Font = new Font("Segoe UI Semibold", 8.5F),
                ForeColor = Color.FromArgb(220, 230, 241)
            };
            var toggle = new CheckBox
            {
                Appearance = Appearance.Button,
                AutoSize = false,
                Anchor = AnchorStyles.Top | AnchorStyles.Right,
                Location = new Point(panel.Width - 132, 28),
                Size = new Size(108, 36),
                Text = "Collecting",
                TextAlign = ContentAlignment.MiddleCenter,
                Checked = _state.Collecting,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI Semibold", 9F, FontStyle.Bold),
                BackColor = Color.FromArgb(213, 241, 224),
                ForeColor = Color.FromArgb(18, 91, 50),
                Cursor = Cursors.Hand
            };
            toggle.FlatAppearance.BorderSize = 0;
            toggle.CheckedChanged += delegate
            {
                _state.Collecting = toggle.Checked;
                StyleCollectToggle(toggle);
                _store.Save(_state);
                UpdateTrayText();
            };
            panel.Resize += delegate
            {
                toggle.Left = panel.ClientSize.Width - toggle.Width - 20;
            };
            panel.Controls.Add(iconBox);
            panel.Controls.Add(title);
            panel.Controls.Add(subtitle);
            panel.Controls.Add(countLabel);
            panel.Controls.Add(toggle);
            StyleCollectToggle(toggle);
            collectToggle = toggle;
            return panel;
        }

        private Panel BuildFooter(out Button copyAllButton)
        {
            var panel = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 146,
                Padding = new Padding(20, 13, 20, 16),
                BackColor = Color.White
            };
            var shortcutLabel = new Label
            {
                Dock = DockStyle.Top,
                Height = 22,
                Text = "Alt+Shift+A pastes all highlights into your last app",
                TextAlign = ContentAlignment.MiddleCenter,
                ForeColor = Muted,
                Font = new Font("Segoe UI", 8.5F)
            };
            copyAllButton = new Button
            {
                Dock = DockStyle.Top,
                Height = 50,
                FlatStyle = FlatStyle.Flat,
                BackColor = Green,
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
                Height = 40,
                ColumnCount = 2,
                RowCount = 1
            };
            secondary.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            secondary.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50F));
            var clearButton = CreateSecondaryButton("Clear all");
            var hideButton = CreateSecondaryButton("Minimize");
            clearButton.Click += delegate { ConfirmClear(); };
            hideButton.Click += delegate { WindowState = FormWindowState.Minimized; };
            secondary.Controls.Add(clearButton, 0, 0);
            secondary.Controls.Add(hideButton, 1, 0);

            panel.Controls.Add(secondary);
            panel.Controls.Add(copyAllButton);
            panel.Controls.Add(shortcutLabel);
            return panel;
        }

        private Button CreateSecondaryButton(string text)
        {
            var button = new Button
            {
                Dock = DockStyle.Fill,
                Margin = new Padding(0, 8, 6, 0),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(248, 250, 251),
                ForeColor = Ink,
                Text = text,
                Cursor = Cursors.Hand,
                Font = new Font("Segoe UI Semibold", 8.8F)
            };
            button.FlatAppearance.BorderColor = Line;
            return button;
        }

        private void StyleCollectToggle(CheckBox toggle)
        {
            toggle.Text = toggle.Checked ? "Collecting" : "Paused";
            toggle.BackColor = toggle.Checked
                ? Color.FromArgb(213, 241, 224)
                : Color.FromArgb(247, 226, 226);
            toggle.ForeColor = toggle.Checked
                ? Color.FromArgb(18, 91, 50)
                : Color.FromArgb(142, 46, 46);
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
            var availableWidth = Math.Max(420, _listPanel.ClientSize.Width - 48);

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

            _countLabel.Text = _state.Highlights.Count + " SAVED | LOCAL ONLY";
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
                Height = 108,
                AccentColor = RowAccents[index % RowAccents.Length]
            };

            var number = new Label
            {
                Location = new Point(16, 18),
                Size = new Size(36, 36),
                Text = (index + 1).ToString(),
                TextAlign = ContentAlignment.MiddleCenter,
                BackColor = RowAccents[index % RowAccents.Length],
                ForeColor = Color.White,
                Font = new Font("Segoe UI Semibold", 10F, FontStyle.Bold)
            };
            var buttonWidth = 62;
            var gap = 6;
            var actionWidth = buttonWidth * 3 + gap * 2;
            var itemTitle = new Label
            {
                Location = new Point(64, 15),
                Size = new Size(Math.Max(120, width - 84 - actionWidth), 22),
                Text = "Highlight " + (index + 1),
                AutoEllipsis = true,
                ForeColor = Ink,
                Font = new Font("Segoe UI Semibold", 9F, FontStyle.Bold)
            };
            var text = new Label
            {
                Location = new Point(64, 39),
                Size = new Size(Math.Max(120, width - 84 - actionWidth), 48),
                Text = item.Text,
                AutoEllipsis = true,
                ForeColor = Muted,
                Font = new Font("Segoe UI", 9F)
            };
            var actionsLeft = width - actionWidth - 14;
            var copy = CreateRowButton(
                "Copy",
                actionsLeft,
                37,
                buttonWidth,
                CopyBlue,
                CopyBlueText);
            var paste = CreateRowButton(
                "Paste",
                actionsLeft + buttonWidth + gap,
                37,
                buttonWidth,
                PasteGreen,
                PasteGreenText);
            var delete = CreateRowButton(
                "Delete",
                actionsLeft + (buttonWidth + gap) * 2,
                37,
                buttonWidth,
                DeleteRed,
                DeleteRedText);
            copy.Click += delegate { CopyText(item.Text, "Highlight " + (index + 1) + " copied"); };
            paste.Click += delegate { PasteTextToLastWindow(item.Text); };
            delete.Click += delegate
            {
                _store.RemoveAt(_state, index);
                RenderHighlights();
            };

            row.Controls.Add(number);
            row.Controls.Add(itemTitle);
            row.Controls.Add(text);
            row.Controls.Add(copy);
            row.Controls.Add(paste);
            row.Controls.Add(delete);
            return row;
        }

        private Button CreateRowButton(
            string text,
            int left,
            int top,
            int width,
            Color background,
            Color foreground)
        {
            var button = new Button
            {
                Text = text,
                Location = new Point(left, top),
                Size = new Size(width, 34),
                FlatStyle = FlatStyle.Flat,
                BackColor = background,
                ForeColor = foreground,
                Cursor = Cursors.Hand,
                Font = new Font("Segoe UI Semibold", 8.5F)
            };
            button.FlatAppearance.BorderSize = 0;
            button.FlatAppearance.MouseOverBackColor = ControlPaint.Light(background, 0.08F);
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
