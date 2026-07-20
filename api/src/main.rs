#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("GAME_BOX_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8976);
    // Loopback only, by design: see docs/DECISIONS.md D1.
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .unwrap_or_else(|e| panic!("cannot bind 127.0.0.1:{port}: {e}"));
    println!("game-box listening on http://127.0.0.1:{port}");
    axum::serve(listener, gb_api::app()).await.expect("server error");
}
