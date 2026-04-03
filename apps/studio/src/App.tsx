import { createEffect, createMemo, createSignal, Match, onCleanup, Show, Switch } from "solid-js";
import { open } from "@tauri-apps/plugin-dialog";
import CirclePlusIcon from "lucide-solid/icons/circle-plus";
import ChevronDownIcon from "lucide-solid/icons/chevron-down";
import ChevronRightIcon from "lucide-solid/icons/chevron-right";
import SettingsIcon from "lucide-solid/icons/settings";
import Trash2Icon from "lucide-solid/icons/trash-2";
import logoUrl from "../../../src/vbs-logo.png";
import {
  createFrameMapping,
  createProject,
  type BakeProject,
  type MarkerMode,
  type SourceMedia,
  type SourceMarker,
} from "@vijual-bake-studio/project-model";
import { projectToVjbManifest, validateManifest } from "@vijual-bake-studio/vjb-core";
import { detectLocale, getMessages, interpolate, type Locale, type StepId } from "./lib/i18n";
import { probeSourceMediaViaTauri, renderSourceFramePreviewViaTauri } from "./lib/tauri";

type ImportStatus = {
  state: "idle" | "loading" | "success" | "error";
  message: string;
};

const STEP_ORDER: StepId[] = ["source", "markers", "bake", "export"];
const MIN_SPEED = -1;
const MAX_SPEED = 1;

export function App() {
  const [locale, setLocale] = createSignal<Locale>(detectLocale());
  const [activeStep, setActiveStep] = createSignal<StepId>("source");
  const [showOptions, setShowOptions] = createSignal(false);
  const [showTechnicalPreview, setShowTechnicalPreview] = createSignal(false);
  const [sourcePath, setSourcePath] = createSignal("");
  const [project, setProject] = createSignal<BakeProject | null>(null);
  const [bundleName, setBundleName] = createSignal("");
  const [selectedMarkerId, setSelectedMarkerId] = createSignal<string | null>(null);
  const [draftMarkerFrame, setDraftMarkerFrame] = createSignal(0);
  const [draggingMarkerId, setDraggingMarkerId] = createSignal<string | null>(null);
  const [framePreviewUrl, setFramePreviewUrl] = createSignal<string | null>(null);
  const [framePreviewLoading, setFramePreviewLoading] = createSignal(false);

  const messages = createMemo(() => getMessages(locale()));
  const [importStatus, setImportStatus] = createSignal<ImportStatus>({
    state: "idle",
    message: messages().import.initialMessage,
  });

  const hasProject = createMemo(() => project() !== null);
  const mapping = createMemo(() => {
    const currentProject = project();
    return currentProject
      ? createFrameMapping(currentProject.source.fpsNominal, resolveTargetFps(currentProject))
      : null;
  });
  const manifest = createMemo(() => {
    const currentProject = project();
    const currentMapping = mapping();
    if (!currentProject || !currentMapping) {
      return null;
    }

    return projectToVjbManifest(currentProject, {
      path: "media/master.mov",
      width: currentProject.source.width,
      height: currentProject.source.height,
      fps: currentMapping.targetFps,
      frameCount: currentMapping.sourceToBakedFrame(currentProject.source.frameCount - 1) + 1,
      durationMs: currentProject.source.durationMs,
      codec: currentProject.bake.output.codec,
      alpha: Boolean(currentProject.source.hasAlpha && currentProject.bake.output.codec === "prores_4444"),
    });
  });
  const manifestValidation = createMemo(() => {
    const currentManifest = manifest();
    return currentManifest ? validateManifest(currentManifest) : null;
  });
  const decimalFormatter = createMemo(
    () =>
      new Intl.NumberFormat(locale(), {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
  );
  const fpsFormatter = createMemo(
    () =>
      new Intl.NumberFormat(locale(), {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
  );

  const currentProject = () => project();
  const currentMapping = () => mapping();
  const currentManifest = () => manifest();
  const currentValidation = () => manifestValidation();
  const previewFrame = createMemo(() => (activeStep() === "markers" ? draftMarkerFrame() : 0));
  const sortedMarkers = createMemo(() => {
    const currentProject = project();
    return currentProject ? normalizeMarkers(currentProject.markers) : [];
  });
  const selectedMarker = createMemo(() => {
    const markerId = selectedMarkerId();
    if (!markerId) {
      return null;
    }

    return sortedMarkers().find((marker) => marker.id === markerId) ?? null;
  });

  createEffect(() => {
    const currentProject = project();
    if (!currentProject) {
      setSelectedMarkerId(null);
      setDraftMarkerFrame(0);
      setFramePreviewUrl(null);
      return;
    }

    const currentSelectedId = selectedMarkerId();
    const existing = currentSelectedId ? currentProject.markers.find((marker) => marker.id === currentSelectedId) : null;

    if (!existing && currentProject.markers.length) {
      setSelectedMarkerId(currentProject.markers[0]?.id ?? null);
    }

    const maxFrame = Math.max(currentProject.source.frameCount - 1, 0);
    if (draftMarkerFrame() > maxFrame) {
      setDraftMarkerFrame(maxFrame);
    }
  });

  createEffect(() => {
    const currentProject = project();
    const frame = previewFrame();

    if (!currentProject) {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setFramePreviewLoading(true);
        const preview = await renderSourceFramePreviewViaTauri(currentProject.source.path, frame, 1280);
        if (!cancelled && preview.frame === frame) {
          setFramePreviewUrl(preview.dataUrl);
        }
      } catch {
        if (!cancelled) {
          setFramePreviewUrl(null);
        }
      } finally {
        if (!cancelled) {
          setFramePreviewLoading(false);
        }
      }
    }, 120);

    onCleanup(() => {
      cancelled = true;
      window.clearTimeout(timeout);
    });
  });

  function updateProject(updater: (current: BakeProject) => BakeProject) {
    setProject((current) => {
      if (!current) {
        return current;
      }

      const nextProject = updater(current);

      return {
        ...nextProject,
        markers: normalizeMarkers(nextProject.markers),
        updatedAt: new Date().toISOString(),
      };
    });
  }

  function stepAvailable(step: StepId): boolean {
    if (step === "source") {
      return true;
    }

    if (step === "markers") {
      return hasProject();
    }

    return false;
  }

  function addMarkerAtCurrentFrame() {
    const currentProject = project();
    if (!currentProject) {
      return;
    }

    const sourceFrame = Math.max(0, Math.min(draftMarkerFrame(), currentProject.source.frameCount - 1));
    const nextIndex = currentProject.markers.length + 1;
    const markerId = `m_${nextIndex.toString().padStart(2, "0")}`;

    updateProject((projectValue) => ({
      ...projectValue,
      markers: [
        ...projectValue.markers,
        normalizeMarker({
          id: markerId,
          index: nextIndex,
          label: `Marker ${nextIndex}`,
          sourceFrame,
          state: {
            mode: "loop",
            direction: 1,
            speed: 1,
          },
        }),
      ],
    }));

    setSelectedMarkerId(markerId);
  }

  function updateSelectedMarker(patch: Partial<SourceMarker> & { state?: Partial<SourceMarker["state"]> }) {
    const markerId = selectedMarkerId();
    if (!markerId) {
      return;
    }

    updateProject((projectValue) => ({
      ...projectValue,
      markers: projectValue.markers.map((marker) => {
        if (marker.id !== markerId) {
          return marker;
        }

        return normalizeMarker({
          ...marker,
          ...patch,
          state: patch.state ? { ...marker.state, ...patch.state } : marker.state,
        });
      }),
    }));
  }

  function setSelectedMarkerSpeed(nextSpeed: number) {
    const marker = selectedMarker();
    if (!marker) {
      return;
    }

    const clampedSpeed = clampNumber(nextSpeed, MIN_SPEED, MAX_SPEED);
    const nextDirection = clampedSpeed < 0 ? -1 : clampedSpeed > 0 ? 1 : marker.state.direction ?? 1;

    updateSelectedMarker({
      state: {
        speed: clampedSpeed,
        direction: nextDirection,
      },
    });
  }

  function setSelectedMarkerDirection(nextDirection: -1 | 1) {
    const marker = selectedMarker();
    if (!marker) {
      return;
    }

    const magnitude = clampNumber(Math.max(Math.abs(marker.state.speed ?? 1), 0.1), 0.1, MAX_SPEED);
    setSelectedMarkerSpeed(nextDirection * magnitude);
  }

  function nudgeDraftMarkerFrame(delta: number) {
    const currentProject = project();
    if (!currentProject) {
      return;
    }

    setDraftMarkerFrame((current) => clampFrame(current + delta, currentProject.source.frameCount));
  }

  function handleFrameKeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 10 : 1;
    nudgeDraftMarkerFrame(direction * step);
  }

  function removeSelectedMarker() {
    const markerId = selectedMarkerId();
    if (!markerId) {
      return;
    }

    updateProject((projectValue) => {
      const markers = projectValue.markers
        .filter((marker) => marker.id !== markerId)
        .map((marker, index) => ({
          ...marker,
          index: index + 1,
        }));

      return {
        ...projectValue,
        markers,
      };
    });

    setSelectedMarkerId(null);
  }

  function beginMarkerDrag(event: PointerEvent & { currentTarget: HTMLDivElement }, markerId: string, frameCount: number) {
    event.preventDefault();
    const rulerElement = event.currentTarget.parentElement as HTMLDivElement | null;
    if (!rulerElement) {
      return;
    }

    setSelectedMarkerId(markerId);
    const startX = event.clientX;
    let hasDragged = false;

    const applyPointerFrame = (clientX: number) => {
      const nextFrame = frameFromPointer(clientX, rulerElement.getBoundingClientRect(), frameCount);
      updateProject((projectValue) => ({
        ...projectValue,
        markers: projectValue.markers.map((marker) =>
          marker.id === markerId ? normalizeMarker({ ...marker, sourceFrame: nextFrame }) : marker,
        ),
      }));
      setDraftMarkerFrame(nextFrame);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!hasDragged && Math.abs(moveEvent.clientX - startX) < 6) {
        return;
      }

      if (!hasDragged) {
        hasDragged = true;
        setDraggingMarkerId(markerId);
      }

      applyPointerFrame(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      setDraggingMarkerId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <main class="app-shell" lang={locale()}>
      <header class="topbar topbar-unframed">
        <div class="topbar-left">
          <nav class="topbar-nav step-switcher" aria-label="Workspace sections">
            {STEP_ORDER.map((step, index) => (
              <button
                class={`nav-tab ${activeStep() === step ? "nav-tab-active" : ""}`}
                disabled={!stepAvailable(step)}
                onClick={() => setActiveStep(step)}
              >
                <span class="nav-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{messages().steps[step]}</span>
              </button>
            ))}
          </nav>
        </div>

        <div class="topbar-center">
          <img class="brand-logo brand-logo-large" src={logoUrl} alt="Vijual Bake Studio logo" />
        </div>

        <div class="status-strip">
          <Show when={currentProject()}>
            {(loadedProject) => (
              <>
                <div
                  class={`status-pill status-pill-truncate ${loadedProject().source.fileName.length > 28 ? "status-pill-marquee" : ""}`}
                  title={loadedProject().source.fileName}
                >
                  <span class="status-pill-text">{loadedProject().source.fileName}</span>
                </div>
                <div class="status-pill status-pill-active">
                  {fpsFormatter().format(loadedProject().source.fpsNominal)} FPS
                </div>
                <div class="status-pill">
                  {messages().status.target} {currentMapping()?.targetFps ?? "—"} FPS
                </div>
                <div class="status-pill">
                  {decimalFormatter().format(loadedProject().source.durationMs / 1000)} {messages().status.durationUnit}
                </div>
              </>
            )}
          </Show>

          <div class="options-shell">
            <button
              class={`icon-button ${showOptions() ? "icon-button-active" : ""}`}
              aria-label={messages().locale.label}
              onClick={() => setShowOptions((value) => !value)}
            >
              <SettingsIcon size={16} />
            </button>
            <Show when={showOptions()}>
              <div class="options-popover">
                <p class="section-label">{messages().locale.label}</p>
                <div class="locale-toggle" aria-label={messages().locale.label}>
                  <button
                    class={`locale-button ${locale() === "en" ? "locale-button-active" : ""}`}
                    onClick={() => setLocale("en")}
                  >
                    {messages().locale.english}
                  </button>
                  <button
                    class={`locale-button ${locale() === "cs" ? "locale-button-active" : ""}`}
                    onClick={() => setLocale("cs")}
                  >
                    {messages().locale.czech}
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </div>
      </header>

      <section class="workspace workspace-fixed">
        <section class="main-stage">
          <Switch>
            <Match when={activeStep() === "source"}>
              <Show
                when={currentProject()}
                fallback={<EmptyStage title={messages().empty.sourceTitle} body={messages().empty.sourceBody} />}
              >
                {(loadedProject) => (
                  <article class="surface-panel preview-panel panel-fill">
                    <div class="surface-header">
                      <div>
                        <p class="section-label">{messages().preview.label}</p>
                        <h2>{messages().preview.title}</h2>
                      </div>
                      <div class="surface-meta">
                        <span>{loadedProject().source.width}×{loadedProject().source.height}</span>
                        <span>{loadedProject().bake.output.codec}</span>
                      </div>
                    </div>

                    <div class="preview-stage">
                      <div
                        class="preview-frame"
                        style={{
                          "aspect-ratio": `${loadedProject().source.width} / ${loadedProject().source.height}`,
                        }}
                      >
                        <Show when={framePreviewUrl()}>
                          {(previewUrl) => <img class="preview-image" src={previewUrl()} alt={loadedProject().title} />}
                        </Show>
                        <div class="preview-grid" />
                        <div class="preview-overlay">
                          <p class="preview-title">{loadedProject().title}</p>
                        </div>
                        <div class="preview-badge">
                          {currentValidation()?.valid ? messages().preview.ready : messages().preview.issues}
                        </div>
                        <Show when={framePreviewLoading()}>
                          <div class="preview-loading">Loading preview…</div>
                        </Show>
                      </div>
                    </div>

                    <div class="info-strip">
                      <MetricCard label={messages().preview.frames} value={loadedProject().source.frameCount} />
                      <MetricCard
                        label={messages().preview.baked}
                        value={currentManifest()?.media.primaryVideo.frameCount ?? "—"}
                      />
                      <MetricCard label={messages().preview.markers} value={loadedProject().markers.length} />
                      <MetricCard
                        label={messages().preview.alpha}
                        value={loadedProject().source.hasAlpha ? messages().preview.yes : messages().preview.no}
                      />
                    </div>
                  </article>
                )}
              </Show>
            </Match>

            <Match when={activeStep() === "markers"}>
              <Show when={currentProject()} fallback={<EmptyStage title={messages().empty.lockedTitle} body={messages().empty.lockedBody} />}>
                {(loadedProject) => (
                  <Show when={currentMapping()}>
                    {(loadedMapping) => (
                      <article class="surface-panel timeline-panel panel-fill">
                        <div class="surface-header">
                          <div>
                            <h2>{messages().steps.markers}</h2>
                          </div>
                          <div class="surface-meta">
                            <span>{messages().timeline.mapping}</span>
                          </div>
                        </div>

                        <div class="marker-stage">
                          <div class="marker-stage-header">
                            <div class="marker-monitor">
                              <div
                                class="preview-frame preview-frame-marker"
                                style={{
                                  "aspect-ratio": `${loadedProject().source.width} / ${loadedProject().source.height}`,
                                }}
                              >
                                <Show when={framePreviewUrl()}>
                                  {(previewUrl) => (
                                    <img class="preview-image" src={previewUrl()} alt={`${loadedProject().title} frame ${draftMarkerFrame()}`} />
                                  )}
                                </Show>
                                <div class="preview-grid" />
                                <Show when={framePreviewLoading()}>
                                  <div class="preview-loading">Loading preview…</div>
                                </Show>
                              </div>
                            </div>

                            <div class="timeline-toolbar-actions">
                              <label class="frame-readout" for="marker-current-frame">
                                <span class="section-label">{messages().markersPanel.currentFrame}</span>
                                <input
                                  id="marker-current-frame"
                                  class="frame-input"
                                  type="number"
                                  min="0"
                                  max={Math.max(loadedProject().source.frameCount - 1, 0)}
                                  value={draftMarkerFrame()}
                                  onInput={(event) =>
                                    setDraftMarkerFrame(
                                      clampFrame(Number(event.currentTarget.value), loadedProject().source.frameCount),
                                    )
                                  }
                                  onKeyDown={handleFrameKeydown}
                                />
                              </label>
                            </div>
                          </div>

                          <div class="frame-scrubber frame-scrubber-main">
                            <input
                              id="marker-frame-range"
                              class="range-input"
                              type="range"
                              min="0"
                              max={Math.max(loadedProject().source.frameCount - 1, 0)}
                              value={draftMarkerFrame()}
                              onInput={(event) => setDraftMarkerFrame(Number(event.currentTarget.value))}
                              onKeyDown={handleFrameKeydown}
                            />
                          </div>

                          <div class="timeline-ruler timeline-ruler-large">
                            {sortedMarkers().map((marker) => (
                              <div
                                class={`timeline-marker ${selectedMarkerId() === marker.id ? "timeline-marker-selected" : ""} ${draggingMarkerId() === marker.id ? "timeline-marker-dragging" : ""}`}
                                style={{
                                  left: `${markerPositionPercent(marker.sourceFrame, loadedProject().source.frameCount)}%`,
                                }}
                                onClick={() => {
                                  setSelectedMarkerId(marker.id);
                                  setDraftMarkerFrame(marker.sourceFrame);
                                }}
                                onPointerDown={(event) =>
                                  beginMarkerDrag(event, marker.id, loadedProject().source.frameCount)
                                }
                                title={marker.label || marker.id}
                              >
                                <span>{marker.label || marker.id}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div class="marker-list-panel marker-list-docked">
                          <div class="marker-list-header">
                            <div />
                            <button class="accent-button" onClick={addMarkerAtCurrentFrame}>
                              <CirclePlusIcon size={16} />
                              {messages().markersPanel.addMarker}
                            </button>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>{messages().timeline.id}</th>
                                <th>{messages().timeline.sourceFrame}</th>
                                <th>{messages().timeline.bakedFrame}</th>
                                <th>{messages().timeline.mode}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedMarkers().map((marker) => (
                                <tr
                                  class={selectedMarkerId() === marker.id ? "marker-row marker-row-selected" : "marker-row"}
                                  onClick={() => {
                                    setSelectedMarkerId(marker.id);
                                    setDraftMarkerFrame(marker.sourceFrame);
                                  }}
                                >
                                  <td>{marker.id}</td>
                                  <td>{marker.sourceFrame}</td>
                                  <td>{loadedMapping().sourceToBakedFrame(marker.sourceFrame)}</td>
                                  <td>{marker.state.mode ?? loadedProject().transport.defaultMode}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    )}
                  </Show>
                )}
              </Show>
            </Match>

            <Match when={activeStep() === "bake"}>
              <Show when={currentProject()} fallback={<EmptyStage title={messages().empty.lockedTitle} body={messages().empty.lockedBody} />}>
                {(loadedProject) => (
                  <Show when={currentMapping()}>
                    {(loadedMapping) => (
                      <article class="surface-panel panel-fill">
                        <div class="surface-header">
                          <div>
                            <p class="section-label">{messages().bakeSettings.step}</p>
                            <h2>{messages().bakeSettings.title}</h2>
                          </div>
                        </div>

                        <div class="wizard-grid">
                          <MetricCard label={messages().bakeSettings.targetFps} value={`${loadedMapping().targetFps} FPS`} />
                          <MetricCard label={messages().bakeSettings.codec} value={loadedProject().bake.output.codec} />
                          <MetricCard label={messages().bakeSettings.precision} value={loadedProject().bake.aiEngine.precision ?? "—"} />
                          <MetricCard label={messages().bakeSettings.transport} value={loadedProject().transport.defaultMode} />
                        </div>
                      </article>
                    )}
                  </Show>
                )}
              </Show>
            </Match>

            <Match when={activeStep() === "export"}>
              <Show when={currentProject()} fallback={<EmptyStage title={messages().empty.lockedTitle} body={messages().empty.lockedBody} />}>
                {(loadedProject) => (
                  <Show when={currentManifest()}>
                    {(loadedManifest) => (
                      <Show when={currentValidation()}>
                        {(loadedValidation) => (
                          <article class="surface-panel export-panel panel-fill">
                            <div class="surface-header">
                              <div>
                                <p class="section-label">{messages().validation.step}</p>
                                <h2>{messages().exportPanel.title}</h2>
                              </div>
                              <span class={`state-badge state-${loadedValidation().valid ? "success" : "error"}`}>
                                {loadedValidation().valid ? messages().validation.pass : messages().validation.issues}
                              </span>
                            </div>

                            <p class="technical-summary">{messages().exportPanel.summary}</p>

                            <div class="wizard-grid">
                              <MetricCard label={messages().exportPanel.bundle} value={loadedManifest().bundleId} mono />
                              <MetricCard label={messages().exportPanel.media} value={loadedManifest().media.primaryVideo.path} mono />
                            </div>

                            <Show when={loadedValidation().errors.length}>
                              <ul>
                                {loadedValidation().errors.map((error) => (
                                  <li>{error}</li>
                                ))}
                              </ul>
                            </Show>

                            <Show when={!loadedValidation().errors.length}>
                              <p class="status-message">{messages().validation.successMessage}</p>
                            </Show>

                            <button
                              class="technical-toggle"
                              onClick={() => setShowTechnicalPreview((value) => !value)}
                            >
                              <div>
                                <p class="section-label">{messages().manifest.label}</p>
                                <h2>{messages().manifest.toggle}</h2>
                                <p class="technical-summary">{messages().manifest.summary}</p>
                              </div>
                              <span class="technical-icon">
                                <Show when={showTechnicalPreview()} fallback={<ChevronRightIcon size={16} />}>
                                  <ChevronDownIcon size={16} />
                                </Show>
                              </span>
                            </button>

                            <Show when={showTechnicalPreview()}>
                              <div class="technical-stack">
                                <pre>{JSON.stringify(loadedManifest(), null, 2)}</pre>
                                <pre>{JSON.stringify(loadedProject().source, null, 2)}</pre>
                              </div>
                            </Show>
                          </article>
                        )}
                      </Show>
                    )}
                  </Show>
                )}
              </Show>
            </Match>
          </Switch>
        </section>

        <aside class="side-rail">
          <Switch>
            <Match when={activeStep() === "source"}>
              <article class="panel">
                <div class="panel-header">
                  <div>
                    <p class="section-label">{messages().import.step}</p>
                    <h2>{messages().import.title}</h2>
                  </div>
                  <span class={`state-badge state-${importStatus().state}`}>
                    {messages().status[importStatus().state]}
                  </span>
                </div>

                <label class="settings-row" for="source-path">
                  <span>{messages().import.sourcePath}</span>
                  <input
                    id="source-path"
                    value={sourcePath()}
                    onInput={(event) => setSourcePath(event.currentTarget.value)}
                  />
                </label>

                <label class="settings-row" for="bundle-name">
                  <span>{messages().import.bundleName}</span>
                  <input
                    id="bundle-name"
                    value={bundleName()}
                    onInput={(event) => {
                      const value = event.currentTarget.value;
                      setBundleName(value);
                      setProject((current) => {
                        if (!current) {
                          return current;
                        }

                        return {
                          ...current,
                          title: value,
                          updatedAt: new Date().toISOString(),
                        };
                      });
                    }}
                  />
                </label>

                <div class="button-row">
                  <button
                    class="ghost-button"
                    onClick={() => void handlePickSource(setSourcePath, setImportStatus, locale())}
                  >
                    {messages().import.browse}
                  </button>
                  <button
                    class="accent-button"
                    onClick={() =>
                      void handleProbeImport(
                        sourcePath(),
                        setProject,
                        setImportStatus,
                        setBundleName,
                        setSelectedMarkerId,
                        setDraftMarkerFrame,
                        setActiveStep,
                        locale(),
                      )
                    }
                  >
                    {messages().import.probe}
                  </button>
                </div>
                <button
                  class="full-button"
                  onClick={() =>
                    void handlePickAndProbe(
                      setSourcePath,
                      setProject,
                      setImportStatus,
                      setBundleName,
                      setSelectedMarkerId,
                      setDraftMarkerFrame,
                      setActiveStep,
                      locale(),
                    )
                  }
                >
                  {messages().import.pickAndProbe}
                </button>
                <p class="status-message">{importStatus().message}</p>
              </article>

              <Show when={currentProject()}>
                {(loadedProject) => (
                  <article class="panel">
                    <div class="panel-header">
                      <div>
                        <p class="section-label">{messages().sourceDetail.label}</p>
                        <h2>{messages().sourceDetail.title}</h2>
                      </div>
                    </div>
                    <dl>
                      <div>
                        <dt>{messages().sourceDetail.file}</dt>
                        <dd>{loadedProject().source.fileName}</dd>
                      </div>
                      <div>
                        <dt>{messages().sourceDetail.resolution}</dt>
                        <dd>{loadedProject().source.width}×{loadedProject().source.height}</dd>
                      </div>
                      <div>
                        <dt>{messages().sourceDetail.fps}</dt>
                        <dd>{loadedProject().source.fpsNominal}</dd>
                      </div>
                      <div>
                        <dt>{messages().sourceDetail.duration}</dt>
                        <dd>{decimalFormatter().format(loadedProject().source.durationMs / 1000)} {messages().status.durationUnit}</dd>
                      </div>
                    </dl>
                  </article>
                )}
              </Show>
            </Match>

            <Match when={activeStep() === "markers"}>
              <Show when={currentProject()} fallback={<SideNotice title={messages().empty.lockedTitle} body={messages().empty.lockedBody} />}>
                {(loadedProject) => (
                  <article class="panel">
                    <div class="panel-header">
                      <div>
                        <h2>{messages().markersPanel.selectedMarker}</h2>
                      </div>
                    </div>
                    <div class="inspector-metrics">
                      <MetricCard label={messages().preview.markers} value={loadedProject().markers.length} />
                      <MetricCard label={messages().markersPanel.transport} value={loadedProject().transport.defaultMode} />
                    </div>

                    <div class="marker-editor">
                      <Show when={selectedMarker()} fallback={<p class="status-message">{messages().markersPanel.noSelection}</p>}>
                        {(marker) => (
                          <>
                            <section class="inspector-group">
                              <div class="inspector-group-header">
                                <p class="section-label">{messages().markersPanel.identity}</p>
                              </div>

                              <label class="settings-row" for="marker-label">
                                <span>{messages().markersPanel.label}</span>
                                <input
                                  id="marker-label"
                                  value={marker().label ?? ""}
                                  onInput={(event) => updateSelectedMarker({ label: event.currentTarget.value })}
                                />
                              </label>

                              <label class="settings-row" for="marker-frame">
                                <span>{messages().markersPanel.sourceFrame}</span>
                                <input
                                  id="marker-frame"
                                  type="number"
                                  min="0"
                                  max={Math.max(loadedProject().source.frameCount - 1, 0)}
                                  value={marker().sourceFrame}
                                  onInput={(event) => {
                                    const nextFrame = clampFrame(Number(event.currentTarget.value), loadedProject().source.frameCount);
                                    updateSelectedMarker({ sourceFrame: nextFrame });
                                    setDraftMarkerFrame(nextFrame);
                                  }}
                                  onKeyDown={handleFrameKeydown}
                                />
                                <small class="field-hint">{messages().markersPanel.sourceFrameHint}</small>
                              </label>

                              <label class="settings-row" for="marker-id">
                                <span>{messages().timeline.id}</span>
                                <input id="marker-id" value={marker().id} readOnly />
                              </label>
                            </section>

                            <section class="inspector-group">
                              <div class="inspector-group-header">
                                <p class="section-label">{messages().markersPanel.playback}</p>
                              </div>

                              <label class="settings-row" for="marker-mode">
                                <span>{messages().timeline.mode}</span>
                                <div class="select-wrap">
                                  <select
                                    id="marker-mode"
                                    value={marker().state.mode ?? loadedProject().transport.defaultMode}
                                    onChange={(event) =>
                                      updateSelectedMarker({ state: { mode: event.currentTarget.value as MarkerMode } })
                                    }
                                  >
                                    <option value="once">once</option>
                                    <option value="loop">loop</option>
                                    <option value="pingpong">pingpong</option>
                                    <option value="hold">hold</option>
                                  </select>
                                  <span class="select-icon" aria-hidden="true">
                                    <ChevronDownIcon size={16} />
                                  </span>
                                </div>
                              </label>

                              <div class="settings-row">
                                <span>{messages().markersPanel.direction}</span>
                                <div class="button-row marker-direction-row">
                                  <button
                                    class={(marker().state.speed ?? 1) < 0 ? "accent-button" : "ghost-button"}
                                    onClick={() => setSelectedMarkerDirection(-1)}
                                  >
                                    {messages().markersPanel.reverse}
                                  </button>
                                  <button
                                    class={(marker().state.speed ?? 1) >= 0 ? "accent-button" : "ghost-button"}
                                    onClick={() => setSelectedMarkerDirection(1)}
                                  >
                                    {messages().markersPanel.forward}
                                  </button>
                                </div>
                              </div>

                              <label class="settings-row" for="marker-speed">
                                <span>{messages().markersPanel.speed}</span>
                                <input
                                  id="marker-speed"
                                  type="number"
                                  step="0.1"
                                  min={MIN_SPEED}
                                  max={MAX_SPEED}
                                  value={marker().state.speed ?? 1}
                                  onInput={(event) => {
                                    const nextSpeed = Number(event.currentTarget.value);
                                    if (Number.isFinite(nextSpeed)) {
                                      setSelectedMarkerSpeed(nextSpeed);
                                    }
                                  }}
                                />
                              </label>
                            </section>

                            <section class="inspector-group inspector-group-actions">
                              <div class="inspector-group-header">
                                <p class="section-label">{messages().markersPanel.actions}</p>
                              </div>
                              <button class="ghost-button ghost-button-danger" onClick={removeSelectedMarker}>
                                <Trash2Icon size={16} />
                                {messages().markersPanel.removeMarker}
                              </button>
                            </section>
                          </>
                        )}
                      </Show>
                    </div>
                  </article>
                )}
              </Show>
            </Match>

            <Match when={activeStep() === "bake"}>
              <Show when={currentProject()} fallback={<SideNotice title={messages().empty.lockedTitle} body={messages().empty.lockedBody} />}>
                {(loadedProject) => (
                  <Show when={currentMapping()}>
                    {(loadedMapping) => (
                      <article class="panel">
                        <div class="panel-header">
                          <div>
                            <p class="section-label">{messages().bakeSettings.step}</p>
                            <h2>{messages().bakeSettings.title}</h2>
                          </div>
                        </div>
                        <dl>
                          <div>
                            <dt>{messages().bakeSettings.targetFps}</dt>
                            <dd>{loadedMapping().targetFps} FPS</dd>
                          </div>
                          <div>
                            <dt>{messages().bakeSettings.codec}</dt>
                            <dd>{loadedProject().bake.output.codec}</dd>
                          </div>
                          <div>
                            <dt>{messages().bakeSettings.precision}</dt>
                            <dd>{loadedProject().bake.aiEngine.precision}</dd>
                          </div>
                          <div>
                            <dt>{messages().bakeSettings.transport}</dt>
                            <dd>{loadedProject().transport.defaultMode}</dd>
                          </div>
                        </dl>
                      </article>
                    )}
                  </Show>
                )}
              </Show>
            </Match>

            <Match when={activeStep() === "export"}>
              <Show when={currentValidation()} fallback={<SideNotice title={messages().empty.lockedTitle} body={messages().empty.lockedBody} />}>
                {(loadedValidation) => (
                  <article class="panel">
                    <div class="panel-header">
                      <div>
                        <p class="section-label">{messages().validation.step}</p>
                        <h2>{messages().validation.title}</h2>
                      </div>
                      <span class={`state-badge state-${loadedValidation().valid ? "success" : "error"}`}>
                        {loadedValidation().valid ? messages().validation.pass : messages().validation.issues}
                      </span>
                    </div>
                    <Show when={loadedValidation().errors.length} fallback={<p class="status-message">{messages().validation.successMessage}</p>}>
                      <ul>
                        {loadedValidation().errors.map((error) => (
                          <li>{error}</li>
                        ))}
                      </ul>
                    </Show>
                  </article>
                )}
              </Show>
            </Match>
          </Switch>
        </aside>
      </section>
    </main>
  );
}

function MetricCard(props: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div class="info-chip">
      <span class="info-label">{props.label}</span>
      <strong class={props.mono ? "metric-mono" : ""}>{props.value}</strong>
    </div>
  );
}

function EmptyStage(props: { title: string; body: string }) {
  return (
    <article class="surface-panel panel-fill empty-stage">
      <div class="empty-stage-inner">
        <div class="empty-stage-badge">01</div>
        <h2>{props.title}</h2>
        <p>{props.body}</p>
      </div>
    </article>
  );
}

function SideNotice(props: { title: string; body: string }) {
  return (
    <article class="panel">
      <div class="panel-header">
        <h2>{props.title}</h2>
      </div>
      <p class="status-message">{props.body}</p>
    </article>
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function clampFrame(value: number, frameCount: number): number {
  return Math.round(clampNumber(value, 0, Math.max(frameCount - 1, 0)));
}

function normalizeMarker(marker: SourceMarker): SourceMarker {
  const rawSpeed = marker.state.speed ?? marker.state.direction ?? 1;
  const speed = clampNumber(rawSpeed, MIN_SPEED, MAX_SPEED);
  const direction = speed < 0 ? -1 : speed > 0 ? 1 : marker.state.direction ?? 1;

  return {
    ...marker,
    sourceFrame: Math.max(0, Math.round(marker.sourceFrame)),
    state: {
      ...marker.state,
      speed,
      direction,
    },
  };
}

function normalizeMarkers(markers: SourceMarker[]): SourceMarker[] {
  return [...markers]
    .map(normalizeMarker)
    .sort((left, right) => {
      if (left.sourceFrame === right.sourceFrame) {
        return left.index - right.index;
      }

      return left.sourceFrame - right.sourceFrame;
    })
    .map((marker, index) => ({
      ...marker,
      index: index + 1,
    }));
}

function markerPositionPercent(sourceFrame: number, frameCount: number): number {
  const normalized = frameCount <= 1 ? 0 : sourceFrame / (frameCount - 1);
  return clampNumber(normalized * 100, 0, 100);
}

function frameFromPointer(clientX: number, rect: DOMRect, frameCount: number): number {
  if (frameCount <= 1 || rect.width <= 0) {
    return 0;
  }

  const relative = clampNumber((clientX - rect.left) / rect.width, 0, 1);
  return clampFrame(relative * (frameCount - 1), frameCount);
}

function resolveTargetFps(project: BakeProject): number {
  return project.bake.targetFps === "auto" ? 120 : project.bake.targetFps;
}

function createBakeProject(source: SourceMedia): BakeProject {
  return createProject({
    title: source.fileName.replace(/\.[^.]+$/, "") || "Untitled Clip",
    source,
    bake: {
      targetFps: 120,
      upscale: { enabled: false },
      output: {
        container: "mov",
        codec: "hap_q",
      },
      aiEngine: {
        id: "rife-ncnn-vulkan",
        model: "rife-v4.6",
        version: "4.6",
        precision: "fp16",
      },
    },
    transport: {
      defaultMode: "loop",
      defaultDirection: 1,
      defaultSpeed: 1,
      seekMode: "frame-accurate",
      quantizeUnit: "marker",
    },
    markers: normalizeMarkers([
      {
        id: "m_intro",
        index: 1,
        label: "Intro",
        sourceFrame: 0,
        state: {
          mode: "loop",
          direction: 1,
          speed: 1,
        },
      },
      {
        id: "m_mid",
        index: 2,
        label: "Mid",
        sourceFrame: Math.max(1, Math.floor(source.frameCount / 2)),
        state: {
          mode: "pingpong",
          direction: -1,
          speed: 1,
        },
      },
    ]),
  });
}

async function handleProbeImport(
  path: string,
  setProject: (project: BakeProject | null) => void,
  setImportStatus: (status: ImportStatus) => void,
  setBundleName: (value: string) => void,
  setSelectedMarkerId: (value: string | null) => void,
  setDraftMarkerFrame: (value: number) => void,
  setActiveStep: (value: StepId) => void,
  locale: Locale,
) {
  const messages = getMessages(locale);
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    setImportStatus({
      state: "error",
      message: messages.import.emptyPath,
    });
    return;
  }

  setImportStatus({
    state: "loading",
    message: messages.import.probing,
  });

  try {
    const source = await probeSourceMediaViaTauri(normalizedPath);
    const nextProject = createBakeProject(source);
    setBundleName(nextProject.title);
    setProject(nextProject);
    setSelectedMarkerId(nextProject.markers[0]?.id ?? null);
    setDraftMarkerFrame(nextProject.markers[0]?.sourceFrame ?? 0);
    setActiveStep("markers");
    setImportStatus({
      state: "success",
      message: interpolate(messages.import.imported, {
        fileName: source.fileName,
        fps: new Intl.NumberFormat(locale, {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        }).format(source.fpsNominal),
      }),
    });
  } catch (error) {
    setImportStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handlePickSource(
  setSourcePath: (path: string) => void,
  setImportStatus: (status: ImportStatus) => void,
  locale: Locale,
) {
  const messages = getMessages(locale);
  try {
    const selected = await pickSourcePath();
    if (!selected) {
      setImportStatus({
        state: "idle",
        message: messages.import.cancelled,
      });
      return;
    }

    setSourcePath(selected);
    setImportStatus({
      state: "idle",
      message: interpolate(messages.import.selected, {
        path: selected,
      }),
    });
  } catch (error) {
    setImportStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handlePickAndProbe(
  setSourcePath: (path: string) => void,
  setProject: (project: BakeProject | null) => void,
  setImportStatus: (status: ImportStatus) => void,
  setBundleName: (value: string) => void,
  setSelectedMarkerId: (value: string | null) => void,
  setDraftMarkerFrame: (value: number) => void,
  setActiveStep: (value: StepId) => void,
  locale: Locale,
) {
  const messages = getMessages(locale);
  try {
    const selected = await pickSourcePath();
    if (!selected) {
      setImportStatus({
        state: "idle",
        message: messages.import.cancelled,
      });
      return;
    }

    setSourcePath(selected);
    await handleProbeImport(
      selected,
      setProject,
      setImportStatus,
      setBundleName,
      setSelectedMarkerId,
      setDraftMarkerFrame,
      setActiveStep,
      locale,
    );
  } catch (error) {
    setImportStatus({
      state: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function pickSourcePath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Video",
        extensions: ["mov", "mp4", "mkv", "m4v", "avi", "webm"],
      },
    ],
  });

  if (!selected) {
    return null;
  }

  return Array.isArray(selected) ? selected[0] ?? null : selected;
}
