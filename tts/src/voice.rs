//! Voices the engine can speak. The stand-in ships a fixed list; a real engine
//! (Kyutai Pocket TTS) reports the voices of the loaded checkpoint here.

const VOICES: &[&str] = &["default", "narrator", "villager", "guard"];

pub fn all() -> &'static [&'static str] {
    VOICES
}

pub fn is_known(voice: &str) -> bool {
    VOICES.contains(&voice)
}
