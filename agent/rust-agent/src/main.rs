use packethalo_agent::LinuxHostProvider;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let endpoint = std::env::var("PACKETHALO_SERVER")
        .unwrap_or_else(|_| "http://127.0.0.1:8787/api/events".to_owned());
    let token = std::env::var("PACKETHALO_CONTROL_TOKEN").ok();
    let client = reqwest::Client::new();
    let mut provider = LinuxHostProvider::new();
    let mut interval = tokio::time::interval(Duration::from_millis(250));
    println!(
        "PacketHalo agent active — operating-system metadata only; packet contents are never inspected."
    );

    loop {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => break,
            _ = interval.tick() => {
                let Ok(events) = provider.poll() else { continue };
                if events.is_empty() { continue; }
                let mut request = client.post(&endpoint).header(CONTENT_TYPE, "application/json").json(&events);
                if let Some(secret) = token.as_deref() {
                    request = request.header(AUTHORIZATION, format!("Bearer {secret}"));
                }
                if let Err(error) = request.send().await {
                    // Never print request bodies or authorization headers.
                    eprintln!("Local server unavailable: {}", error.without_url());
                }
            }
        }
    }
}
