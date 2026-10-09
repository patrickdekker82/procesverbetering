mod secrets;

use secrets::{KeyringStore, SecretStore, API_KEY_ACCOUNT};
use tauri_plugin_sql::{Migration, MigrationKind};

const DB_URL: &str = "sqlite:verbeterlus.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "fts",
            sql: include_str!("../migrations/0002_fts.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

struct Secrets(Box<dyn SecretStore>);

#[tauri::command]
fn set_api_key(state: tauri::State<'_, Secrets>, key: String) -> Result<(), String> {
    let key = secrets::validate_api_key(&key)?;
    state.0.set(API_KEY_ACCOUNT, key)
}

#[tauri::command]
fn has_api_key(state: tauri::State<'_, Secrets>) -> Result<bool, String> {
    Ok(state.0.get(API_KEY_ACCOUNT)?.is_some())
}

#[tauri::command]
fn get_api_key(state: tauri::State<'_, Secrets>) -> Result<Option<String>, String> {
    state.0.get(API_KEY_ACCOUNT)
}

#[tauri::command]
fn delete_api_key(state: tauri::State<'_, Secrets>) -> Result<(), String> {
    state.0.delete(API_KEY_ACCOUNT)
}

/// Writes a text file to a path the user picked in the save dialog (templates, exports).
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Geen bestandsnaam gekozen.".into());
    }
    std::fs::write(&path, contents).map_err(|e| format!("Opslaan mislukt: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Secrets(Box::new(KeyringStore)))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            set_api_key,
            has_api_key,
            get_api_key,
            delete_api_key,
            save_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Verbeterlus");
}
