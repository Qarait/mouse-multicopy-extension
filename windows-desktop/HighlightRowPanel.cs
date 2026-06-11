using System.Drawing;
using System.Windows.Forms;

namespace MouseMultiCopy.Windows
{
    internal sealed class HighlightRowPanel : Panel
    {
        public HighlightRowPanel()
        {
            DoubleBuffered = true;
            BackColor = Color.White;
            Margin = new Padding(0, 0, 0, 10);
            Padding = new Padding(10);
            AccentColor = Color.FromArgb(36, 72, 140);
        }

        public Color AccentColor { get; set; }

        protected override void OnPaint(PaintEventArgs eventArgs)
        {
            base.OnPaint(eventArgs);
            using (var accentBrush = new SolidBrush(AccentColor))
            {
                eventArgs.Graphics.FillRectangle(accentBrush, 0, 0, 4, Height);
            }
            using (var pen = new Pen(Color.FromArgb(218, 225, 221)))
            {
                eventArgs.Graphics.DrawRectangle(
                    pen,
                    0,
                    0,
                    Width - 1,
                    Height - 1);
            }
        }
    }
}
