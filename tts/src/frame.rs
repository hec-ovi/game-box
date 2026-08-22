//! Turns owed speech time into base64 PCM frame envelopes.

use crate::schema;
use base64::Engine as _;
use serde_json::{json, Value};

/// 12.5 Hz, the frame rate the Mimi codec streams at.
pub const FRAME_MS: u64 = 80;

pub struct FrameEncoder {
    sample_rate: u32,
    owed: u64,
    spoken: u64,
}

impl FrameEncoder {
    pub fn new(sample_rate: u32) -> Self {
        FrameEncoder { sample_rate, owed: 0, spoken: 0 }
    }

    pub fn frame_samples(&self) -> u64 {
        u64::from(self.sample_rate) * FRAME_MS / 1000
    }

    pub fn samples_for_ms(&self, ms: f64) -> u64 {
        (ms * f64::from(self.sample_rate) / 1000.0).round() as u64
    }

    /// Speech time that has been decided but not yet handed out as frames.
    pub fn owe(&mut self, samples: u64) {
        self.owed += samples;
    }

    /// Whole frames that are ready right now.
    pub fn drain(&mut self) -> Vec<Value> {
        let frame = self.frame_samples();
        let mut out = Vec::new();
        while self.owed >= frame {
            self.owed -= frame;
            out.push(self.emit(frame));
        }
        out
    }

    /// Everything left, including a short trailing frame.
    pub fn flush(&mut self) -> Vec<Value> {
        let mut out = self.drain();
        if self.owed > 0 {
            let rest = self.owed;
            self.owed = 0;
            out.push(self.emit(rest));
        }
        out
    }

    pub fn spoken_ms(&self) -> u64 {
        self.spoken * 1000 / u64::from(self.sample_rate.max(1))
    }

    pub fn reset(&mut self) {
        self.owed = 0;
        self.spoken = 0;
    }

    fn emit(&mut self, samples: u64) -> Value {
        self.spoken += samples;
        let pcm = vec![0u8; (samples * 2) as usize];
        let event = json!({
            "type": "frame",
            "mediaType": "audio/pcm;bits=16",
            "sampleRate": self.sample_rate,
            "channels": 1,
            "dataBase64": base64::engine::general_purpose::STANDARD.encode(pcm)
        });
        debug_assert!(schema::event().is_valid(&event), "frame off-contract: {event}");
        event
    }
}
