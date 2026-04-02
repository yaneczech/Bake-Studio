import { createMemo } from "solid-js";
import {
  createFrameMapping,
  createProject,
  type BakeStudioProject,
} from "@bake-studio/project-model";
import { validateBakeStudioProject } from "@vijual-bake-studio/project-model";
import {
  createManifestHardRuleReport,
  projectToVjbManifest,
} from "@vijual-bake-studio/vjb-core";

const project: BakeStudioProject = createProject({
  title: "Club Loop Prototype",
  source: {
    path: "/Volumes/media/club_loop.mov",
    fileName: "club_loop.mov",
    durationMs: 124000,
    width: 1920,
    height: 1080,
    fpsNominal: 30,
    frameCount: 3720,
    colorSpace: "bt709",
    hasAlpha: false,
  },
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
  markers: [
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
      id: "m_hit",
      index: 2,
      label: "Hit",
      sourceFrame: 900,
      state: {
        mode: "pingpong",
        direction: -1,
        speed: 1,
      },
    },
  ],
});

export function App() {
  const mapping = createMemo(() =>
    createFrameMapping(project.source.fpsNominal, resolveTargetFps(project)),
  );
  const validation = createMemo(() => validateBakeStudioProject(project));
  const manifest = createMemo(() =>
    projectToVjbManifest(project, {
      path: "media/master.mov",
      width: project.source.width,
      height: project.source.height,
      fps: mapping().targetFps,
      frameCount: mapping().sourceToBakedFrame(project.source.frameCount - 1) + 1,
      durationMs: project.source.durationMs,
      codec: project.bake.output.codec,
      alpha: Boolean(project.source.hasAlpha && project.bake.output.codec === "prores_4444"),
    }),
  );
  const hardRuleReport = createMemo(() => createManifestHardRuleReport(manifest()));

  return (
    <main class="app-shell">
      <section class="hero">
        <p class="eyebrow">Bake Studio</p>
        <h1>VJB authoring scaffold for Tauri + SolidJS.</h1>
        <p class="lede">
          Source markers stay in source frame space. VJB export is generated in baked
          frame space against the target FPS.
        </p>
      </section>

      <section class="grid">
        <article class="panel">
          <h2>Project</h2>
          <dl>
            <div>
              <dt>Title</dt>
              <dd>{project.title}</dd>
            </div>
            <div>
              <dt>Source FPS</dt>
              <dd>{project.source.fpsNominal}</dd>
            </div>
            <div>
              <dt>Target FPS</dt>
              <dd>{mapping().targetFps}</dd>
            </div>
            <div>
              <dt>Markers</dt>
              <dd>{project.markers.length}</dd>
            </div>
          </dl>
        </article>

        <article class="panel">
          <h2>Validation</h2>
          <p>{validation().valid ? "Project model is valid." : "Project model has issues."}</p>
          <ul>
            {validation().errors.map((error) => (
              <li>{error}</li>
            ))}
          </ul>
        </article>

        <article class="panel">
          <h2>Manifest hard rules</h2>
          <p>
            {hardRuleReport().valid
              ? "Manifest passes current hard-rule checks."
              : "Manifest violates hard-rule checks."}
          </p>
          <ul>
            {hardRuleReport().errors.map((error) => (
              <li>{error}</li>
            ))}
          </ul>
        </article>
      </section>

      <section class="panel">
        <h2>Marker mapping preview</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Source Frame</th>
              <th>Baked Frame</th>
              <th>Mode</th>
            </tr>
          </thead>
          <tbody>
            {project.markers.map((marker) => (
              <tr>
                <td>{marker.id}</td>
                <td>{marker.sourceFrame}</td>
                <td>{mapping().sourceToBakedFrame(marker.sourceFrame)}</td>
                <td>{marker.state.mode ?? project.transport.defaultMode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="panel">
        <h2>Export preview</h2>
        <pre>{JSON.stringify(manifest(), null, 2)}</pre>
      </section>
    </main>
  );
}

function resolveTargetFps(project: BakeStudioProject): number {
  return project.bake.targetFps === "auto" ? 120 : project.bake.targetFps;
}
