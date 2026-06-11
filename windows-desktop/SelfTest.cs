using System;
using System.IO;

namespace MouseMultiCopy.Windows
{
    internal static class SelfTest
    {
        public static int Run()
        {
            var root = Path.Combine(
                Path.GetTempPath(),
                "mouse-multicopy-windows-test-" + Guid.NewGuid().ToString("N"));
            var path = Path.Combine(root, "state.json");

            try
            {
                var store = new HighlightStore(path);
                var state = store.Load();
                state.MaxItems = 3;

                Require(store.Add(state, " Alpha ") == AddHighlightResult.Added, "first add");
                Require(store.Add(state, "Beta") == AddHighlightResult.Added, "second add");
                Require(store.Add(state, "Beta") == AddHighlightResult.Duplicate, "duplicate");
                Require(store.Add(state, "Gamma") == AddHighlightResult.Added, "third add");
                Require(
                    store.Add(state, "Delta") == AddHighlightResult.ReplacedOldest,
                    "overflow");
                Require(state.Highlights.Count == 3, "max count");
                Require(state.Highlights[0].Text == "Beta", "oldest replaced");

                var formatted = HighlightStore.FormatAll(state);
                Require(
                    formatted == "Beta" + Environment.NewLine + Environment.NewLine +
                        "Gamma" + Environment.NewLine + Environment.NewLine + "Delta",
                    "format");

                var reloaded = store.Load();
                Require(reloaded.Highlights.Count == 3, "persistence count");
                Require(reloaded.Highlights[2].Text == "Delta", "persistence content");

                Console.WriteLine("Mouse MultiCopy Windows self-test passed.");
                return 0;
            }
            catch (Exception exception)
            {
                Console.Error.WriteLine("Self-test failed: " + exception.Message);
                return 1;
            }
            finally
            {
                if (Directory.Exists(root))
                {
                    Directory.Delete(root, true);
                }
            }
        }

        private static void Require(bool condition, string name)
        {
            if (!condition)
            {
                throw new InvalidOperationException(name);
            }
        }
    }
}
