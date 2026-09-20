# 🛡️ Aether VPN — macOS Application

A powerful VPN client built for macOS with a beautiful Electron GUI interface.

## Features

- 🌐 **Beautiful Electron GUI** — Built with Electron + Next.js
- 🛡️ **Secure & Private** — End-to-end encryption
- ⚡ **Fast Connection** — High-speed VPN servers
- 🔑 **Key Management** — Generate and manage VPN keys
- 📊 **Status Monitoring** — Real-time connection status
- ⚙️ **Settings Panel** — Auto-connect, kill switch, DNS blocking

## Quick Start

### Option 1: Download DMG
Download `Aether_VPN_GUI.dmg` from the Releases page and install.

### Option 2: Build from Source

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run the app
pnpm start
```

## Requirements

- macOS 10.13 or higher
- Apple Silicon or Intel
- Internet connection

## Usage

1. Open the app from Applications or double-click the DMG
2. Login with your email (Option 2)
3. Select a server and click Connect
4. Enjoy secure browsing!

## Commands (CLI)

The underlying CLI can also be used directly:

```bash
./avpn --help
./avpn auth login <email>
./avpn servers list
./avpn vpn connect
./avpn vpn disconnect
./avpn vpn status
./avpn vpn keys
./avpn config show
```

## Tech Stack

- **Electron** — Desktop application framework
- **Next.js** — Web frontend framework
- **Rust** — CLI backend (`avpn`)
- **VLESS/WireGuard** — VPN protocol

## License

Apache 2.0 License

## Credits

Built from the [Aether VPN](https://github.com/skygenesisenterprise/aether-vpn) project.
