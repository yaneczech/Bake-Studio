use base64::Engine;
use serde::Serialize;
use std::process::Command;
use tauri::AppHandle;

use crate::ffmpeg_runtime;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FramePreviewPayload {
    data_url: String,
    frame: i64,
}

#[tauri::command]
pub fn render_source_frame_preview(
    app: AppHandle,
    path: String,
    frame: i64,
    max_width: Option<i64>,
) -> Result<FramePreviewPayload, String> {
    let ffmpeg = ffmpeg_runtime::resolve_ffmpeg_path(&app)?;
    let safe_frame = frame.max(0);
    let width = max_width.unwrap_or(960).clamp(240, 1920);
    let filter = format!("select=eq(n\\,{safe_frame}),scale=min({width}\\,iw):-2");

    let output = Command::new(ffmpeg)
        .args([
            "-v",
            "error",
            "-i",
            &path,
            "-vf",
            &filter,
            "-frames:v",
            "1",
            "-f",
            "image2pipe",
            "-vcodec",
            "png",
            "pipe:1",
        ])
        .output()
        .map_err(|error| format!("Failed to run ffmpeg preview render: {error}"))?;

    if !output.status.success() {
      let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
      return Err(if stderr.is_empty() {
          "ffmpeg failed to render a frame preview.".to_string()
      } else {
          stderr
      });
    }

    if output.stdout.is_empty() {
        return Err("ffmpeg did not return preview image data.".to_string());
    }

    let encoded = base64::engine::general_purpose::STANDARD.encode(output.stdout);

    Ok(FramePreviewPayload {
        data_url: format!("data:image/png;base64,{encoded}"),
        frame: safe_frame,
    })
}
