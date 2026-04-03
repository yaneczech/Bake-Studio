use serde::Serialize;
use std::path::Path;
use std::process::Command;
use tauri::AppHandle;

use crate::ffmpeg_runtime;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceMediaPayload {
    path: String,
    file_name: String,
    duration_ms: i64,
    width: i64,
    height: i64,
    fps_nominal: f64,
    frame_count: i64,
    color_space: Option<String>,
    has_alpha: Option<bool>,
    audio_embedded: Option<bool>,
}

#[derive(Serialize, serde::Deserialize)]
struct FfprobePayload {
    streams: Option<Vec<FfprobeStream>>,
    format: Option<FfprobeFormat>,
}

#[derive(Serialize, serde::Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
    avg_frame_rate: Option<String>,
    r_frame_rate: Option<String>,
    nb_frames: Option<String>,
    pix_fmt: Option<String>,
}

#[derive(Serialize, serde::Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
    tags: Option<std::collections::HashMap<String, String>>,
}

#[tauri::command]
pub fn probe_source_media(app: AppHandle, path: String) -> Result<SourceMediaPayload, String> {
    let ffprobe = ffmpeg_runtime::resolve_ffprobe_path(&app)?;

    let output = Command::new(ffprobe)
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            &path,
        ])
        .output()
        .map_err(|error| format!("Failed to run ffprobe: {error}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "ffprobe failed to inspect the media.".to_string()
        } else {
            stderr
        });
    }

    let payload: FfprobePayload = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("ffprobe returned invalid JSON: {error}"))?;

    let streams = payload.streams.ok_or_else(|| "No streams found in ffprobe output.".to_string())?;
    let video_stream = streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("video"))
        .ok_or_else(|| "No video stream found in the source media.".to_string())?;

    let fps_nominal = parse_frame_rate(
        video_stream
            .avg_frame_rate
            .as_deref()
            .or(video_stream.r_frame_rate.as_deref()),
    )
    .ok_or_else(|| "Could not determine nominal FPS from ffprobe output.".to_string())?;

    let duration_ms = parse_duration_ms(payload.format.as_ref().and_then(|format| format.duration.as_deref()))
        .ok_or_else(|| "ffprobe did not provide valid duration.".to_string())?;

    let width = video_stream.width.unwrap_or_default();
    let height = video_stream.height.unwrap_or_default();

    if width < 1 || height < 1 {
      return Err("ffprobe did not provide valid dimensions.".to_string());
    }

    let explicit_frame_count = video_stream
        .nb_frames
        .as_deref()
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|value| *value > 0);

    let frame_count = explicit_frame_count.unwrap_or_else(|| {
        ((duration_ms as f64 / 1000.0) * fps_nominal).round().max(1.0) as i64
    });

    let file_name = Path::new(&path)
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Could not derive file name from source path.".to_string())?
        .to_string();

    Ok(SourceMediaPayload {
        path,
        file_name,
        duration_ms,
        width,
        height,
        fps_nominal,
        frame_count,
        color_space: payload
            .format
            .and_then(|format| format.tags)
            .and_then(|tags| tags.get("com.apple.quicktime.color-primaries").cloned()),
        has_alpha: Some(infer_alpha(video_stream.pix_fmt.as_deref())),
        audio_embedded: Some(streams.iter().any(|stream| stream.codec_type.as_deref() == Some("audio"))),
    })
}

fn parse_frame_rate(value: Option<&str>) -> Option<f64> {
    let value = value?;

    if let Some((numerator, denominator)) = value.split_once('/') {
        let numerator = numerator.parse::<f64>().ok()?;
        let denominator = denominator.parse::<f64>().ok()?;

        if denominator == 0.0 {
            return None;
        }

        let fps = numerator / denominator;
        return if fps > 0.0 { Some(fps) } else { None };
    }

    let fps = value.parse::<f64>().ok()?;
    if fps > 0.0 { Some(fps) } else { None }
}

fn parse_duration_ms(value: Option<&str>) -> Option<i64> {
    let seconds = value?.parse::<f64>().ok()?;
    if seconds <= 0.0 {
        return None;
    }

    Some((seconds * 1000.0).round() as i64)
}

fn infer_alpha(pixel_format: Option<&str>) -> bool {
    let Some(pixel_format) = pixel_format else {
        return false;
    };

    let pixel_format = pixel_format.to_ascii_lowercase();
    ["rgba", "bgra", "yuva", "argb", "abgr", "gbrap"]
        .iter()
        .any(|needle| pixel_format.contains(needle))
}
