export type Locale = "en" | "cs";
export type StepId = "source" | "markers" | "bake" | "export";

type Messages = {
  steps: {
    source: string;
    markers: string;
    bake: string;
    export: string;
  };
  status: {
    target: string;
    durationUnit: string;
    idle: string;
    loading: string;
    success: string;
    error: string;
  };
  preview: {
    label: string;
    title: string;
    subtitle: string;
    ready: string;
    issues: string;
    frames: string;
    baked: string;
    markers: string;
    alpha: string;
    yes: string;
    no: string;
  };
  timeline: {
    label: string;
    title: string;
    mapping: string;
    id: string;
    sourceFrame: string;
    bakedFrame: string;
    mode: string;
  };
  manifest: {
    label: string;
    title: string;
    toggle: string;
    summary: string;
  };
  import: {
    step: string;
    title: string;
    sourcePath: string;
    bundleName: string;
    browse: string;
    probe: string;
    pickAndProbe: string;
    initialMessage: string;
    emptyPath: string;
    probing: string;
    imported: string;
    selected: string;
    cancelled: string;
  };
  sourceDetail: {
    label: string;
    title: string;
    file: string;
    resolution: string;
    fps: string;
    duration: string;
  };
  bakeSettings: {
    step: string;
    title: string;
    targetFps: string;
    codec: string;
    precision: string;
    transport: string;
  };
  validation: {
    step: string;
    title: string;
    pass: string;
    issues: string;
    successMessage: string;
  };
  importPreview: {
    label: string;
    title: string;
  };
  locale: {
    label: string;
    english: string;
    czech: string;
  };
  empty: {
    sourceTitle: string;
    sourceBody: string;
    lockedTitle: string;
    lockedBody: string;
  };
  markersPanel: {
    title: string;
    summary: string;
    transport: string;
    monitor: string;
    addMarker: string;
    removeMarker: string;
    currentFrame: string;
    selectedMarker: string;
    noSelection: string;
    identity: string;
    playback: string;
    actions: string;
    showList: string;
    hideList: string;
    label: string;
    sourceFrame: string;
    sourceFrameHint: string;
    direction: string;
    speed: string;
    forward: string;
    reverse: string;
  };
  exportPanel: {
    title: string;
    summary: string;
    bundle: string;
    media: string;
  };
};

const messages: Record<Locale, Messages> = {
  en: {
    steps: {
      source: "Source",
      markers: "Markers",
      bake: "Bake",
      export: "Export",
    },
    status: {
      target: "Target",
      durationUnit: "s",
      idle: "idle",
      loading: "loading",
      success: "success",
      error: "error",
    },
    preview: {
      label: "Output Preview",
      title: "Primary Video Surface",
      subtitle: "Source-space authoring. Baked-space transport.",
      ready: "Manifest Ready",
      issues: "Manifest Issues",
      frames: "Frames",
      baked: "Baked",
      markers: "Markers",
      alpha: "Alpha",
      yes: "yes",
      no: "no",
    },
    timeline: {
      label: "Timeline",
      title: "Marker Mapping",
      mapping: "Source → Baked",
      id: "ID",
      sourceFrame: "Source Frame",
      bakedFrame: "Baked Frame",
      mode: "Mode",
    },
    manifest: {
      label: "Manifest",
      title: "Export Preview",
      toggle: "Technical Preview",
      summary: "Manifest JSON and import payload",
    },
    import: {
      step: "Step 1",
      title: "Import Source",
      sourcePath: "Source Path",
      bundleName: "VJB File Name",
      browse: "Browse...",
      probe: "Probe",
      pickAndProbe: "Pick And Probe",
      initialMessage:
        "Pick a local source clip, probe it through Tauri, and generate a real Bake project from source media metadata.",
      emptyPath: "Provide a local source path before probing.",
      probing: "Probing source media...",
      imported: "Imported clip at {fps} FPS.",
      selected: "Selected {path}. Click Probe to inspect it.",
      cancelled: "File selection cancelled.",
    },
    sourceDetail: {
      label: "Source Detail",
      title: "Source Media",
      file: "File",
      resolution: "Resolution",
      fps: "FPS",
      duration: "Duration",
    },
    bakeSettings: {
      step: "Step 3",
      title: "Bake Settings",
      targetFps: "Target FPS",
      codec: "Codec",
      precision: "Precision",
      transport: "Transport",
    },
    validation: {
      step: "Step 4",
      title: "Validation",
      pass: "pass",
      issues: "issues",
      successMessage: "Schema and hard rules are currently passing.",
    },
    importPreview: {
      label: "Raw Payload",
      title: "Import Preview",
    },
    locale: {
      label: "Language",
      english: "EN",
      czech: "CZ",
    },
    empty: {
      sourceTitle: "Start with a source clip",
      sourceBody: "Pick a local video first. Marker authoring, bake configuration, and export become available after a successful probe.",
      lockedTitle: "This step is not ready yet",
      lockedBody: "Import and probe a source clip first.",
    },
    markersPanel: {
      title: "Marker State",
      summary: "Source-authored cues are mapped into baked playback frames.",
      transport: "Default transport",
      monitor: "Current Frame Monitor",
      addMarker: "Add Marker",
      removeMarker: "Remove Marker",
      currentFrame: "Current Frame",
      selectedMarker: "Selected Marker",
      noSelection: "No marker selected.",
      identity: "Identity",
      playback: "Playback",
      actions: "Actions",
      showList: "Show Marker List",
      hideList: "Hide Marker List",
      label: "Label",
      sourceFrame: "Marker Source Frame",
      sourceFrameHint: "Updates the marker position and moves the scrubber.",
      direction: "Direction",
      speed: "Speed",
      forward: "Forward",
      reverse: "Reverse",
    },
    exportPanel: {
      title: "Export Package",
      summary: "Validation and technical preview live here, not in the main authoring flow.",
      bundle: "Bundle ID",
      media: "Primary media",
    },
  },
  cs: {
    steps: {
      source: "Zdroj",
      markers: "Markery",
      bake: "Bake",
      export: "Export",
    },
    status: {
      target: "Cíl",
      durationUnit: "s",
      idle: "idle",
      loading: "načítání",
      success: "hotovo",
      error: "chyba",
    },
    preview: {
      label: "Náhled výstupu",
      title: "Primární video plocha",
      subtitle: "Autorování v source-space. Playback v baked-space.",
      ready: "Manifest připraven",
      issues: "Manifest má problémy",
      frames: "Snímky",
      baked: "Baked",
      markers: "Markery",
      alpha: "Alpha",
      yes: "ano",
      no: "ne",
    },
    timeline: {
      label: "Timeline",
      title: "Mapování markerů",
      mapping: "Zdroj → Baked",
      id: "ID",
      sourceFrame: "Zdrojový snímek",
      bakedFrame: "Baked snímek",
      mode: "Režim",
    },
    manifest: {
      label: "Manifest",
      title: "Náhled exportu",
      toggle: "Technický náhled",
      summary: "Manifest JSON a import payload",
    },
    import: {
      step: "Krok 1",
      title: "Načíst zdroj",
      sourcePath: "Cesta ke zdroji",
      bundleName: "Název VJB souboru",
      browse: "Vybrat...",
      probe: "Analyzovat",
      pickAndProbe: "Vybrat a analyzovat",
      initialMessage:
        "Vyber lokální zdrojový klip, analyzuj ho přes Tauri a vytvoř z něj skutečný Bake project.",
      emptyPath: "Před analýzou zadej lokální cestu ke zdroji.",
      probing: "Analyzuji zdrojové médium...",
      imported: "Načteno při {fps} FPS.",
      selected: "Vybráno {path}. Klikni na Analyzovat pro kontrolu.",
      cancelled: "Výběr souboru byl zrušen.",
    },
    sourceDetail: {
      label: "Detail zdroje",
      title: "Zdrojové médium",
      file: "Soubor",
      resolution: "Rozlišení",
      fps: "FPS",
      duration: "Délka",
    },
    bakeSettings: {
      step: "Krok 3",
      title: "Nastavení bake",
      targetFps: "Cílové FPS",
      codec: "Codec",
      precision: "Přesnost",
      transport: "Transport",
    },
    validation: {
      step: "Krok 4",
      title: "Validace",
      pass: "ok",
      issues: "problémy",
      successMessage: "Schema i hard rules aktuálně procházejí.",
    },
    importPreview: {
      label: "Raw payload",
      title: "Náhled importu",
    },
    locale: {
      label: "Jazyk",
      english: "EN",
      czech: "CZ",
    },
    empty: {
      sourceTitle: "Začni zdrojovým klipem",
      sourceBody: "Nejdřív vyber lokální video. Marker editor, bake konfigurace i export se zpřístupní až po úspěšné analýze.",
      lockedTitle: "Tento krok zatím není připravený",
      lockedBody: "Nejdřív naimportuj a analyzuj zdrojový klip.",
    },
    markersPanel: {
      title: "Stav markerů",
      summary: "Cue body autorované ve source prostoru se mapují do baked playback snímků.",
      transport: "Výchozí transport",
      monitor: "Náhled aktuálního snímku",
      addMarker: "Přidat marker",
      removeMarker: "Smazat marker",
      currentFrame: "Aktuální snímek",
      selectedMarker: "Vybraný marker",
      noSelection: "Není vybraný žádný marker.",
      identity: "Identita",
      playback: "Playback",
      actions: "Akce",
      showList: "Zobrazit seznam markerů",
      hideList: "Skrýt seznam markerů",
      label: "Název",
      sourceFrame: "Zdrojový snímek markeru",
      sourceFrameHint: "Upraví pozici markeru a posune scrubber.",
      direction: "Směr",
      speed: "Rychlost",
      forward: "Vpřed",
      reverse: "Zpět",
    },
    exportPanel: {
      title: "Export balíčku",
      summary: "Validace a technický náhled patří sem, ne do hlavního autorského flow.",
      bundle: "Bundle ID",
      media: "Primární médium",
    },
  },
};

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const preferred = navigator.languages?.[0] ?? navigator.language ?? "en";
  return preferred.toLowerCase().startsWith("cs") ? "cs" : "en";
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
