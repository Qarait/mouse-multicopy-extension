(() => {
  const DEFAULT_STATE = Object.freeze({
    enabled: true,
    maxSlots: 12,
    minChars: 3,
    ignoreDuplicates: true,
    currentPage: "",
    outputFormat: "plain",
    includeSource: false,
    includePage: false,
    activeGroupId: "default",
    groups: [],
    clips: []
  });

  function normalizeState(state) {
    const maxSlots = clampNumber(state?.maxSlots, DEFAULT_STATE.maxSlots, 3, 50);
    const minChars = clampNumber(state?.minChars, DEFAULT_STATE.minChars, 1, 40);
    const groups = normalizeGroups(state, maxSlots);
    const activeGroupId = groups.some((group) => group.id === state?.activeGroupId)
      ? state.activeGroupId
      : groups[0].id;
    const normalizedGroups = groups.map((group) => group.id === activeGroupId && Array.isArray(state?.clips)
      ? { ...group, clips: normalizeClips(state.clips, maxSlots) }
      : group);
    const activeGroup = normalizedGroups.find((group) => group.id === activeGroupId) || normalizedGroups[0];

    return {
      enabled: typeof state?.enabled === "boolean" ? state.enabled : DEFAULT_STATE.enabled,
      maxSlots,
      minChars,
      ignoreDuplicates: typeof state?.ignoreDuplicates === "boolean" ? state.ignoreDuplicates : DEFAULT_STATE.ignoreDuplicates,
      currentPage: String(state?.currentPage || "").trim().slice(0, 40),
      outputFormat: ["numbered", "bullets", "plain"].includes(state?.outputFormat)
        ? state.outputFormat
        : DEFAULT_STATE.outputFormat,
      includeSource: typeof state?.includeSource === "boolean" ? state.includeSource : DEFAULT_STATE.includeSource,
      includePage: typeof state?.includePage === "boolean" ? state.includePage : DEFAULT_STATE.includePage,
      activeGroupId,
      activeGroup,
      groups: normalizedGroups,
      clips: activeGroup.clips
    };
  }

  function normalizeGroups(state, maxSlots) {
    const storedGroups = Array.isArray(state?.groups) ? state.groups : [];
    const groups = storedGroups
      .filter((group) => group && typeof group === "object")
      .map((group, index) => ({
        id: String(group.id || createGroupId(index)),
        name: String(group.name || `Session ${index + 1}`).trim().slice(0, 40) || `Session ${index + 1}`,
        clips: normalizeClips(group.clips, maxSlots)
      }))
      .filter((group) => group.id && group.name);

    if (groups.length) {
      return groups;
    }

    return [{
      id: DEFAULT_STATE.activeGroupId,
      name: "Default",
      clips: normalizeClips(state?.clips, maxSlots)
    }];
  }

  function normalizeClips(clips, maxSlots) {
    return Array.isArray(clips)
      ? clips
        .filter((clip) => clip && typeof clip.text === "string" && clip.text.trim())
        .slice(-maxSlots)
        .map((clip, index) => ({
          id: clip.id || createClipId(clip.capturedAt || index),
          text: clip.text,
          label: String(clip.label || "").trim().slice(0, 60),
          title: clip.title || "",
          url: clip.url || "",
          page: String(clip.page || "").trim().slice(0, 40),
          capturedAt: clip.capturedAt || 0
        }))
      : [];
  }

  function clampNumber(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
  }

  function createClipId(seed) {
    return `${seed}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function createGroupId(seed) {
    return `group-${seed}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function isValidClipIndex(clips, index) {
    return Number.isInteger(index) && index >= 0 && index < clips.length;
  }

  globalThis.MouseMultiCopyState = Object.freeze({
    DEFAULT_STATE,
    normalizeState,
    clampNumber,
    createClipId,
    createGroupId,
    isValidClipIndex
  });
})();
