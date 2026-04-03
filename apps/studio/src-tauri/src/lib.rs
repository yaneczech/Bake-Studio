mod ffmpeg_runtime;
mod probe;
mod preview;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            probe::probe_source_media,
            preview::render_source_frame_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vijual Bake Studio");
}
