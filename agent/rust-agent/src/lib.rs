//! PacketHalo reads operating-system connection tables, never packet bytes.
//! The intentionally narrow model below cannot represent a payload.

use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct SocketKey {
    pub local_ip: IpAddr,
    pub local_port: u16,
    pub remote_ip: IpAddr,
    pub remote_port: u16,
    pub transport: Transport,
    pub inode: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Transport {
    Tcp,
    Udp,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeoPoint {
    pub latitude: f64,
    pub longitude: f64,
    pub country_code: &'static str,
    pub country: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Classification {
    pub label: &'static str,
    pub category: &'static str,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowEvent {
    pub id: String,
    pub timestamp: u64,
    pub duration_ms: u64,
    pub direction: &'static str,
    pub local_ip: String,
    pub remote_ip: String,
    pub local_port: u16,
    pub remote_port: u16,
    pub protocol: &'static str,
    pub transport: Transport,
    pub geo: GeoPoint,
    pub asn: u32,
    pub organization: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub process_icon: Option<String>,
    pub device_id: &'static str,
    pub device_name: &'static str,
    pub device_kind: &'static str,
    pub bytes: u64,
    pub packets: u64,
    pub confidence: f64,
    pub capture_source: &'static str,
    pub classification: Classification,
}

pub struct LinuxHostProvider {
    seen: HashSet<SocketKey>,
    sequence: u64,
}

impl Default for LinuxHostProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl LinuxHostProvider {
    #[must_use]
    pub fn new() -> Self {
        Self {
            seen: HashSet::new(),
            sequence: 0,
        }
    }

    /// Returns only newly observed sockets. Closed sockets disappear from the
    /// deduplication set, so a later connection with the same tuple is visible.
    pub fn poll(&mut self) -> io::Result<Vec<FlowEvent>> {
        let process_names = process_names_by_inode();
        let mut current = HashSet::new();
        for (path, transport, ipv6) in [
            ("/proc/net/tcp", Transport::Tcp, false),
            ("/proc/net/tcp6", Transport::Tcp, true),
            ("/proc/net/udp", Transport::Udp, false),
            ("/proc/net/udp6", Transport::Udp, true),
        ] {
            let Ok(contents) = fs::read_to_string(path) else {
                continue;
            };
            current.extend(parse_proc_table(&contents, transport, ipv6));
        }

        let mut events = Vec::new();
        for socket in current.difference(&self.seen) {
            if socket.remote_ip.is_unspecified() || socket.remote_port == 0 {
                continue;
            }
            events.push(to_flow_event(
                socket,
                process_names.get(&socket.inode).cloned(),
                self.sequence,
            ));
            self.sequence += 1;
        }
        self.seen = current;
        Ok(events)
    }
}

#[must_use]
pub fn parse_proc_table(contents: &str, transport: Transport, ipv6: bool) -> Vec<SocketKey> {
    contents
        .lines()
        .skip(1)
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            fields.next()?;
            let local = fields.next()?;
            let remote = fields.next()?;
            let state = fields.next()?;
            // TCP state 0A is LISTEN: it is not a communication with a remote host.
            if transport == Transport::Tcp && state == "0A" {
                return None;
            }
            let (local_ip, local_port) = parse_address(local, ipv6)?;
            let (remote_ip, remote_port) = parse_address(remote, ipv6)?;
            let inode = fields.nth(5)?.parse().ok()?;
            Some(SocketKey {
                local_ip,
                local_port,
                remote_ip,
                remote_port,
                transport,
                inode,
            })
        })
        .collect()
}

fn parse_address(value: &str, ipv6: bool) -> Option<(IpAddr, u16)> {
    let (address, port) = value.split_once(':')?;
    let port = u16::from_str_radix(port, 16).ok()?;
    if ipv6 {
        if address.len() != 32 {
            return None;
        }
        let mut bytes = [0_u8; 16];
        for (word_index, chunk) in address.as_bytes().chunks(8).enumerate() {
            let chunk = std::str::from_utf8(chunk).ok()?;
            let word = u32::from_str_radix(chunk, 16).ok()?.to_le_bytes();
            bytes[word_index * 4..word_index * 4 + 4].copy_from_slice(&word);
        }
        Some((IpAddr::V6(Ipv6Addr::from(bytes)), port))
    } else {
        let raw = u32::from_str_radix(address, 16).ok()?;
        Some((IpAddr::V4(Ipv4Addr::from(raw.to_le_bytes())), port))
    }
}

fn to_flow_event(socket: &SocketKey, process: Option<String>, sequence: u64) -> FlowEvent {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_millis() as u64);
    let (label, category, confidence, protocol) =
        classify_port(socket.remote_port, socket.transport);
    let process_icon = process
        .as_ref()
        .and_then(|name| name.chars().next())
        .map(|character| character.to_uppercase().collect());
    FlowEvent {
        id: format!("linux-{timestamp:x}-{sequence:x}"),
        timestamp,
        duration_ms: 0,
        direction: if is_private(socket.local_ip) && !is_private(socket.remote_ip) {
            "outbound"
        } else {
            "inbound"
        },
        local_ip: socket.local_ip.to_string(),
        remote_ip: socket.remote_ip.to_string(),
        local_port: socket.local_port,
        remote_port: socket.remote_port,
        protocol,
        transport: socket.transport,
        geo: GeoPoint {
            latitude: 0.0,
            longitude: 0.0,
            country_code: "XX",
            country: "Unknown",
        },
        asn: 0,
        organization: "Unclassified network",
        process,
        process_icon,
        device_id: "linux-host",
        device_name: "Linux host",
        device_kind: "laptop",
        // /proc socket tables do not expose reliable per-flow byte counters.
        // Zero is honest; the server may enrich these from another provider.
        bytes: 0,
        packets: 0,
        confidence,
        capture_source: "linux-host",
        classification: Classification {
            label,
            category,
            confidence,
        },
    }
}

fn classify_port(
    port: u16,
    transport: Transport,
) -> (&'static str, &'static str, f64, &'static str) {
    match (port, transport) {
        (53, Transport::Udp | Transport::Tcp) => ("Possible DNS", "system", 0.95, "DNS"),
        (80, Transport::Tcp) => ("Possible web service", "unknown", 0.72, "HTTP"),
        (443, Transport::Tcp) => ("Encrypted service", "unknown", 0.68, "TLS"),
        (443, Transport::Udp) => ("Possible HTTP/3 service", "unknown", 0.58, "QUIC"),
        (22, Transport::Tcp) => ("Possible SSH", "development", 0.86, "SSH"),
        _ => ("Unclassified connection", "unknown", 0.25, "Unknown"),
    }
}

fn is_private(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(address) => address.is_private() || address.is_loopback(),
        IpAddr::V6(address) => address.is_loopback() || address.is_unique_local(),
    }
}

fn process_names_by_inode() -> HashMap<u64, String> {
    let mut result = HashMap::new();
    let Ok(processes) = fs::read_dir("/proc") else {
        return result;
    };
    for process in processes.flatten() {
        if !process
            .file_name()
            .to_string_lossy()
            .bytes()
            .all(|byte| byte.is_ascii_digit())
        {
            continue;
        }
        let path = process.path();
        let name = fs::read_to_string(path.join("comm"))
            .ok()
            .map(|value| value.trim().to_owned());
        let Some(name) = name else { continue };
        let Ok(descriptors) = fs::read_dir(path.join("fd")) else {
            continue;
        };
        for descriptor in descriptors.flatten() {
            let Ok(target) = fs::read_link(descriptor.path()) else {
                continue;
            };
            if let Some(inode) = socket_inode(&target) {
                result.entry(inode).or_insert_with(|| name.clone());
            }
        }
    }
    result
}

fn socket_inode(path: &Path) -> Option<u64> {
    let value = path.to_string_lossy();
    value
        .strip_prefix("socket:[")?
        .strip_suffix(']')?
        .parse()
        .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_linux_ipv4_without_payload_access() {
        let table = "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt uid timeout inode\n   0: 2A01A8C0:C350 1201D8AC:01BB 01 0:0 0:0 0 1000 0 424242\n";
        let sockets = parse_proc_table(table, Transport::Tcp, false);
        assert_eq!(sockets.len(), 1);
        assert_eq!(sockets[0].local_ip.to_string(), "192.168.1.42");
        assert_eq!(sockets[0].remote_port, 443);
        assert_eq!(sockets[0].inode, 424_242);
    }

    #[test]
    fn ignores_listening_sockets() {
        let table = "  sl  local_address rem_address st tx rx tr tm retr uid timeout inode\n0: 00000000:1F90 00000000:0000 0A 0:0 0:0 0 0 0 99\n";
        assert!(parse_proc_table(table, Transport::Tcp, false).is_empty());
    }

    #[test]
    fn serialized_event_has_no_content_fields() {
        let socket = SocketKey {
            local_ip: "192.168.1.2".parse().unwrap(),
            local_port: 55_000,
            remote_ip: "1.1.1.1".parse().unwrap(),
            remote_port: 443,
            transport: Transport::Tcp,
            inode: 4,
        };
        let json =
            serde_json::to_string(&to_flow_event(&socket, Some("browser".into()), 1)).unwrap();
        for forbidden in ["payload", "body", "cookie", "password", "token"] {
            assert!(!json.contains(forbidden));
        }
    }
}
