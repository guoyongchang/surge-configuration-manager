mod commands;
mod generator;
mod models;
mod store;
mod subscription;

use store::Store;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            let store = Store::new(app_data_dir);
            app.manage(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_subscriptions,
            commands::add_subscription,
            commands::refresh_subscription,
            commands::remove_subscription,
            commands::get_remote_rule_sets,
            commands::add_remote_rule_set,
            commands::remove_remote_rule_set,
            commands::get_individual_rules,
            commands::add_individual_rule,
            commands::remove_individual_rule,
            commands::reorder_individual_rules,
            commands::get_extra_nodes,
            commands::add_extra_node,
            commands::remove_extra_node,
            commands::get_output_config,
            commands::update_output_config,
            commands::generate_config,
            commands::get_build_history,
            commands::clear_build_history,
            commands::preview_config,
            commands::check_for_update,
            commands::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
