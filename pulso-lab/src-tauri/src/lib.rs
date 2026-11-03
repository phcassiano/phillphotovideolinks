mod system;

#[tauri::command]
fn system_overview() -> Result<system::Overview, String> {
    system::overview()
}

#[tauri::command]
fn memory_usage() -> Result<system::Memory, String> {
    system::memory()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![system_overview, memory_usage])
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Pulso Lab");
}
