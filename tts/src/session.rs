//! One speaking session: text tokens in, audio frames out, word by word.

use crate::frame::FrameEncoder;
use crate::schema;
use serde_json::{json, Value};

/// Stand-in speaking rate. A real engine derives frame count from the model.
const MS_PER_CHAR: f64 = 60.0;

pub struct Session {
    encoder: FrameEncoder,
    speed: f64,
    word_chars: u64,
}

impl Session {
    pub(crate) fn new(sample_rate: u32, speed: f64) -> Self {
        Session { encoder: FrameEncoder::new(sample_rate), speed, word_chars: 0 }
    }

    /// Feed a text token (an LLM token, a word, a whole line: any slice).
    /// Returns the audio frames that are ready, which is why speech starts
    /// long before the sentence is complete.
    pub fn push_text(&mut self, text: &str) -> Vec<Value> {
        for ch in text.chars() {
            if ch.is_whitespace() {
                self.close_word(1);
            } else {
                self.word_chars += 1;
            }
        }
        self.encoder.drain()
    }

    /// End the utterance: flushes the trailing audio, emits exactly one `end`
    /// event, and resets the session for the next line.
    pub fn finish(&mut self) -> Vec<Value> {
        self.close_word(0);
        let mut out = self.encoder.flush();
        let end = json!({"type": "end", "durationMs": self.encoder.spoken_ms()});
        debug_assert!(schema::event().is_valid(&end), "end off-contract: {end}");
        out.push(end);
        self.encoder.reset();
        out
    }

    fn close_word(&mut self, gap_chars: u64) {
        if self.word_chars == 0 {
            return;
        }
        let chars = (self.word_chars + gap_chars) as f64;
        let samples = self.encoder.samples_for_ms(chars * MS_PER_CHAR / self.speed);
        self.encoder.owe(samples);
        self.word_chars = 0;
    }
}
