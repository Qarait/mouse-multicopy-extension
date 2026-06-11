using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Web.Script.Serialization;

namespace MouseMultiCopy.Windows
{
    internal sealed class HighlightItem
    {
        public string Id { get; set; }
        public string Text { get; set; }
        public string CreatedAtUtc { get; set; }
    }

    internal sealed class AppState
    {
        public AppState()
        {
            Collecting = true;
            MaxItems = 12;
            Highlights = new List<HighlightItem>();
        }

        public bool Collecting { get; set; }
        public int MaxItems { get; set; }
        public List<HighlightItem> Highlights { get; set; }
    }

    internal enum AddHighlightResult
    {
        Added,
        ReplacedOldest,
        Duplicate,
        Ignored
    }

    internal sealed class HighlightStore
    {
        private readonly string _statePath;
        private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer();

        public HighlightStore()
            : this(Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Mouse MultiCopy",
                "state.json"))
        {
        }

        internal HighlightStore(string statePath)
        {
            _statePath = statePath;
        }

        public AppState Load()
        {
            try
            {
                if (!File.Exists(_statePath))
                {
                    return new AppState();
                }

                var state = _serializer.Deserialize<AppState>(File.ReadAllText(_statePath));
                return Normalize(state);
            }
            catch
            {
                return new AppState();
            }
        }

        public void Save(AppState state)
        {
            var directory = Path.GetDirectoryName(_statePath);
            if (!Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var tempPath = _statePath + ".tmp";
            File.WriteAllText(tempPath, _serializer.Serialize(Normalize(state)));

            if (File.Exists(_statePath))
            {
                File.Replace(tempPath, _statePath, null);
            }
            else
            {
                File.Move(tempPath, _statePath);
            }
        }

        public AddHighlightResult Add(AppState state, string text)
        {
            var normalizedText = NormalizeText(text);
            if (normalizedText.Length == 0)
            {
                return AddHighlightResult.Ignored;
            }

            foreach (var item in state.Highlights)
            {
                if (string.Equals(item.Text, normalizedText, StringComparison.Ordinal))
                {
                    return AddHighlightResult.Duplicate;
                }
            }

            var replaced = false;
            while (state.Highlights.Count >= state.MaxItems)
            {
                state.Highlights.RemoveAt(0);
                replaced = true;
            }

            state.Highlights.Add(new HighlightItem
            {
                Id = Guid.NewGuid().ToString("N"),
                Text = normalizedText,
                CreatedAtUtc = DateTime.UtcNow.ToString("o")
            });
            Save(state);
            return replaced ? AddHighlightResult.ReplacedOldest : AddHighlightResult.Added;
        }

        public void RemoveAt(AppState state, int index)
        {
            if (index < 0 || index >= state.Highlights.Count)
            {
                return;
            }

            state.Highlights.RemoveAt(index);
            Save(state);
        }

        public void Clear(AppState state)
        {
            state.Highlights.Clear();
            Save(state);
        }

        public static string FormatAll(AppState state)
        {
            var builder = new StringBuilder();
            for (var index = 0; index < state.Highlights.Count; index += 1)
            {
                if (index > 0)
                {
                    builder.AppendLine();
                    builder.AppendLine();
                }
                builder.Append(state.Highlights[index].Text);
            }
            return builder.ToString();
        }

        internal static string NormalizeText(string text)
        {
            return string.IsNullOrWhiteSpace(text) ? string.Empty : text.Trim();
        }

        private static AppState Normalize(AppState state)
        {
            if (state == null)
            {
                state = new AppState();
            }
            if (state.MaxItems < 3 || state.MaxItems > 50)
            {
                state.MaxItems = 12;
            }
            if (state.Highlights == null)
            {
                state.Highlights = new List<HighlightItem>();
            }

            state.Highlights.RemoveAll(delegate(HighlightItem item)
            {
                return item == null || string.IsNullOrWhiteSpace(item.Text);
            });
            while (state.Highlights.Count > state.MaxItems)
            {
                state.Highlights.RemoveAt(0);
            }
            return state;
        }
    }
}
