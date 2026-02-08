use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchOptions {
    pub method: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    pub body: Option<String>,
    #[serde(default = "default_response_type")]
    pub response_type: String,
}

fn default_response_type() -> String {
    "text".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchResponse {
    pub status: u16,
    pub text: Option<String>,
    pub bytes: Option<Vec<u8>>,
    pub headers: HashMap<String, String>,
}

#[tauri::command]
pub async fn fetch(url: String, options: FetchOptions) -> Result<FetchResponse, String> {
    let method = options.method.unwrap_or_else(|| "GET".to_string());
    let response_type = options.response_type.to_lowercase();
    let client = reqwest::Client::new();

    let mut request = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        _ => return Err(format!("Unsupported HTTP method: {}", method)),
    };

    // Add headers if provided
    if let Some(headers) = options.headers {
        for (key, value) in headers {
            request = request.header(key, value);
        }
    }

    // Add body if provided
    if let Some(body) = options.body {
        request = request.body(body);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    let headers: HashMap<String, String> = response
        .headers()
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect();

    let (text, bytes) = match response_type.as_str() {
        "bytes" => {
            let bytes_data = response
                .bytes()
                .await
                .map_err(|e| format!("Failed to read response body: {}", e))?
                .to_vec();
            (None, Some(bytes_data))
        }
        _ => {
            let text_data = response
                .text()
                .await
                .map_err(|e| format!("Failed to read response body: {}", e))?;
            (Some(text_data), None)
        }
    };

    Ok(FetchResponse {
        status,
        text,
        bytes,
        headers,
    })
}
