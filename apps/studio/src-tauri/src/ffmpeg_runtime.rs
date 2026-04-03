use std::env;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

pub fn resolve_ffprobe_path(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_binary_path(app, "ffprobe")
}

#[allow(dead_code)]
pub fn resolve_ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_binary_path(app, "ffmpeg")
}

fn resolve_binary_path(app: &AppHandle, binary_name: &str) -> Result<PathBuf, String> {
    let executable_name = executable_name(binary_name);
    let asset_name = asset_name(binary_name);

    let mut candidates: Vec<PathBuf> = Vec::new();
    let mut asset_candidates: Vec<PathBuf> = Vec::new();

    if let Some(env_path) = env_override(binary_name) {
        candidates.push(env_path);
    }

    candidates.push(repo_resource_path(&executable_name));
    asset_candidates.push(repo_resource_path(&asset_name));

    if let Ok(resource_dir) = app.path().resource_dir() {
        asset_candidates.push(
            resource_dir
                .join("resources")
                .join("ffmpeg")
                .join(&asset_name),
        );
        candidates.push(resource_dir.join("resources").join("ffmpeg").join(&executable_name));
        asset_candidates.push(resource_dir.join("ffmpeg").join(&asset_name));
        candidates.push(resource_dir.join("ffmpeg").join(&executable_name));
        asset_candidates.push(resource_dir.join("bin").join(&asset_name));
        candidates.push(resource_dir.join("bin").join(&executable_name));
        asset_candidates.push(resource_dir.join(&asset_name));
        candidates.push(resource_dir.join(&executable_name));
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(parent) = current_exe.parent() {
            candidates.push(parent.join("ffmpeg").join(&executable_name));
            candidates.push(parent.join("bin").join(&executable_name));
            candidates.push(parent.join(&executable_name));
        }
    }

    if let Some(found) = candidates.into_iter().find(|candidate| is_executable_file(candidate)) {
        return Ok(found);
    }

    if let Some(asset) = asset_candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
    {
        return materialize_runtime_binary(app, binary_name, &asset);
    }

    if let Ok(system_path) = which::which(binary_name) {
        return Ok(system_path);
    }

    Err(format!(
        "{binary_name} was not found. Set {} to an explicit binary path, place the runtime asset in src-tauri/resources/ffmpeg for development, install FFmpeg system-wide, or bundle the binary inside the app resources.",
        env_var_name(binary_name)
    ))
}

fn repo_resource_path(executable_name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("resources")
        .join("ffmpeg")
        .join(executable_name)
}

fn env_override(binary_name: &str) -> Option<PathBuf> {
    let value = env::var_os(env_var_name(binary_name))?;
    let path = PathBuf::from(value);
    if path.as_os_str().is_empty() {
        return None;
    }

    Some(path)
}

fn env_var_name(binary_name: &str) -> &'static str {
    match binary_name {
        "ffprobe" => "VIJUAL_BAKE_STUDIO_FFPROBE_PATH",
        "ffmpeg" => "VIJUAL_BAKE_STUDIO_FFMPEG_PATH",
        _ => "VIJUAL_BAKE_STUDIO_BINARY_PATH",
    }
}

fn asset_name(binary_name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{binary_name}.exe.bin")
    } else {
        format!("{binary_name}.bin")
    }
}

fn executable_name(binary_name: &str) -> String {
    if cfg!(target_os = "windows") {
        format!("{binary_name}.exe")
    } else {
        binary_name.to_string()
    }
}

fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}

fn materialize_runtime_binary(
    app: &AppHandle,
    binary_name: &str,
    asset_path: &Path,
) -> Result<PathBuf, String> {
    let runtime_dir = app
        .path()
        .app_local_data_dir()
        .or_else(|_| app.path().app_cache_dir())
        .unwrap_or_else(|_| env::temp_dir())
        .join("ffmpeg-runtime");

    fs::create_dir_all(&runtime_dir)
        .map_err(|error| format!("Failed to create FFmpeg runtime directory: {error}"))?;

    let target_path = runtime_dir.join(executable_name(binary_name));
    fs::copy(asset_path, &target_path).map_err(|error| {
        format!(
            "Failed to materialize {} from {}: {error}",
            binary_name,
            asset_path.display()
        )
    })?;

    #[cfg(unix)]
    {
        let mut permissions = fs::metadata(&target_path)
            .map_err(|error| format!("Failed to read runtime binary metadata: {error}"))?
            .permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&target_path, permissions)
            .map_err(|error| format!("Failed to mark runtime binary executable: {error}"))?;
    }

    Ok(target_path)
}
