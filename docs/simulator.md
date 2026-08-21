# Simulator and replay

The simulator is the default capture provider and a permanent product feature. It makes visual design, demos, tests and documentation repeatable without network permissions.

## Scenes

PacketHalo includes 24 scenes: Movie Night, Netflix Premiere, YouTube, Spotify, Discord Call, Zoom Meeting, Gaming Session, Steam Download, Software Update, Smart Home Morning, Security Camera Upload, Phone Backup, Large Git Clone, Rust Build, Docker Pull, Windows Update, Linux Package Update, Suspicious Beacon, IoT Device, Night Mode, Airport Wi-Fi, Coffee Shop, Office Network and Developer Laptop.

Each scene defines only plausible synthetic metadata profiles. Named classifications have a confidence level. The suspicious beacon is deliberately low-confidence and identified as an unclassified VPS, not asserted malware.

## Determinism

The PRNG is seeded with the scene ID and user seed. Given the same scene, seed and epoch, the generated event sequence is byte-for-byte identical. Use a seed to reproduce a visual bug or a demo take.

## Recording

Recording captures validated `FlowEvent` values, the scene ID, seed and relative duration. Stop recording to reveal the timeline. You can pause, scrub to any point, replay, and change playback speed. Recordings contain no packet contents because their only event type is the privacy-gated protocol contract.

The headless simulator can feed the local server:

```bash
PACKETHALO_SCENARIO=developer-laptop \
PACKETHALO_SEED=demo-7 \
pnpm --filter @packethalo/simulator dev
```
