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
        }

        protected override void OnPaint(PaintEventArgs eventArgs)
        {
            base.OnPaint(eventArgs);
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
