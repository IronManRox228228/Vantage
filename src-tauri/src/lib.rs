use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiPartInlineData {
    pub mime_type: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(untagged)]
pub enum GeminiPart {
    Text { text: String },
    InlineData { inline_data: GeminiPartInlineData },
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiContent {
    pub parts: Vec<GeminiPart>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GeminiRequest {
    pub contents: Vec<GeminiContent>,
}

/// Securely proxies Gemini Vision API calls from native Rust.
/// Prevents GEMINI_API_KEY from ever being exposed to client-side JS memory or network tools.
#[tauri::command]
async fn analyze_hmi_with_gemini(image_base64: String, prompt: String) -> Result<String, String> {
    dotenvy::dotenv().ok();

    let api_key = env::var("GEMINI_API_KEY")
        .or_else(|_| env::var("BATCH_API_KEY"))
        .map_err(|_| "GEMINI_API_KEY not set in environment or .env file".to_string())?;

    if api_key.trim().is_empty() {
        return Err("GEMINI_API_KEY is empty. Please configure it in your .env file.".to_string());
    }

    // Clean base64 header if present
    let clean_b64 = if let Some(idx) = image_base64.find(',') {
        &image_base64[idx + 1..]
    } else {
        &image_base64
    };

    let req_payload = GeminiRequest {
        contents: vec![GeminiContent {
            parts: vec![
                GeminiPart::Text { text: prompt },
                GeminiPart::InlineData {
                    inline_data: GeminiPartInlineData {
                        mime_type: "image/png".to_string(),
                        data: clean_b64.to_string(),
                    },
                },
            ],
        }],
    };

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={}",
        api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&req_payload)
        .send()
        .await
        .map_err(|e| format!("Network error communicating with Gemini API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("Gemini API error [{}]: {}", status, error_body));
    }

    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Gemini response body: {}", e))?;

    Ok(response_text)
}

/// Native Rust environment check
#[tauri::command]
fn get_env_status() -> Result<serde_json::Value, String> {
    dotenvy::dotenv().ok();

    let has_gemini = env::var("GEMINI_API_KEY").map(|k| !k.trim().is_empty()).unwrap_or(false);
    let has_supabase = env::var("VITE_SUPABASE_URL").map(|u| !u.trim().is_empty()).unwrap_or(false);

    Ok(serde_json::json!({
        "gemini_configured": has_gemini,
        "supabase_configured": has_supabase,
        "environment": "production"
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            analyze_hmi_with_gemini,
            get_env_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
