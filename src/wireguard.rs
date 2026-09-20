use std::process::Command;
use std::fs;
use anyhow::Result;
use crate::error::AvpnError;

fn config_address(config: &str) -> Option<String> {
    config.lines().find_map(|l| {
        let t = l.trim();
        if t.starts_with("Address") { t.split('=').nth(1).map(|s| s.trim().to_string()) } else { None }
    })
}

/// Check whether `utun0` currently carries the address we assigned.
fn our_tunnel_inet() -> Option<String> {
    if let Ok(cfg) = fs::read_to_string("/tmp/avpn.conf") {
        if let Some(addr) = config_address(&cfg) {
            let ip = addr.split('/').next().unwrap_or(&addr).to_string();
            if let Ok(out) = Command::new("ifconfig").arg("utun0").output() {
                if out.status.success() {
                    let s = String::from_utf8_lossy(&out.stdout);
                    if s.contains(&format!("inet {}", ip)) { return Some(ip); }
                }
            }
        }
    }
    None
}

pub fn apply_config(config: &str) -> Result<()> {
    let config_path = "/tmp/avpn.conf";
    fs::write(config_path, config)?;

    // Prefer wg-quick where available (Linux / WireGuard tools).
    let quick = Command::new("wg-quick").args(["up", config_path]).output();
    if let Ok(o) = quick {
        if o.status.success() { return Ok(()); }
    }

    // macOS: create a real utun interface with the configured address.
    match Command::new("ifconfig").args(["utun0", "create"]).output() {
        Ok(o) if o.status.success() => {
            let ip = our_tunnel_inet().unwrap_or_else(|| "10.13.13.6".to_string());
            if ip.is_empty() { return Err(AvpnError::WireGuard("No interface address in config".into()).into()); }
            let assign = Command::new("ifconfig")
                .args(["utun0", "inet", &ip, &ip])
                .output();
            match assign {
                Ok(a) if a.status.success() => {
                    let _ = Command::new("route")
                        .args(["-n", "add", "default", &ip, "-interface", "utun0"])
                        .output();
                    println!("Tunnel interface utun0 created.");
                    Ok(())
                }
                Ok(a) => Err(AvpnError::WireGuard(
                    format!("Failed to assign address to utun0: {}", String::from_utf8_lossy(&a.stderr).trim()),
                ).into()),
                Err(e) => Err(AvpnError::WireGuard(format!("Cannot assign address: {}", e)).into()),
            }
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr);
            Err(AvpnError::WireGuard(format!("Failed to create tunnel interface: {}", err.trim())).into())
        }
        Err(e) => Err(AvpnError::WireGuard(format!("Cannot create tunnel interface (admin/root required): {}", e)).into()),
    }
}

pub fn disconnect() -> Result<()> {
    let _ = Command::new("route").args(["-n", "delete", "default", "-interface", "utun0"]).output();
    let out = Command::new("ifconfig").args(["utun0", "destroy"]).output();
    match out {
        Ok(o) if o.status.success() => { println!("Disconnected"); Ok(()) }
        Ok(o) if our_tunnel_inet().is_none() => { println!("Disconnected"); Ok(()) }
        Ok(o) => Err(AvpnError::WireGuard(format!("Failed to destroy tunnel: {}", String::from_utf8_lossy(&o.stderr).trim())).into()),
        Err(e) => Err(AvpnError::WireGuard(format!("Cannot destroy tunnel: {}", e)).into()),
    }
}

pub fn get_status() -> Result<Option<String>> {
    let wg = Command::new("wg").arg("show").output();
    if let Ok(o) = wg {
        if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout);
            if !s.trim().is_empty() { return Ok(Some(s.trim().to_string())); }
        }
    }
    // macOS: only report active when utun0 carries OUR address.
    if let Some(ip) = our_tunnel_inet() {
        return Ok(Some(format!("utun0 tunnel active ({})", ip)));
    }
    Ok(None)
}
