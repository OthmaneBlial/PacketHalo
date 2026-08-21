use packethalo_agent::{LinuxHostProvider, event_endpoint};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use std::time::Duration;

#[tokio::main]
async fn main() {
    let endpoint = std::env::var("PACKETHALO_SERVER")
        .unwrap_or_else(|_| "http://127.0.0.1:8787/api/events".to_owned());
    let endpoint = event_endpoint(
        &endpoint,
        std::env::var("PACKETHALO_ALLOW_REMOTE").is_ok_and(|value| value == "1"),
    )
    .unwrap_or_else(|error| {
        eprintln!("Configuration error: {error}");
        std::process::exit(2);
    });
    let token = std::env::var("PACKETHALO_CONTROL_TOKEN").ok();
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("TLS client initialization should succeed");
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
                let mut request = client.post(endpoint.as_str()).header(CONTENT_TYPE, "application/json").json(&events);
                if let Some(secret) = token.as_deref() {
                    request = request.header(AUTHORIZATION, format!("Bearer {secret}"));
                }
                match request.send().await {
                    Ok(response) if response.status().is_success() => {}
                    Ok(response) => eprintln!("Local server rejected metadata (HTTP {}).", response.status().as_u16()),
                    Err(error) => {
                        // Never print request bodies, endpoints, or authorization headers.
                        eprintln!("Local server unavailable: {}", error.without_url());
                    }
                }
            }
        }
    }
}
