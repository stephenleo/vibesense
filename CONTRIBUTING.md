# Contributing to VibeSense

Thank you for your interest in contributing to VibeSense!

## Build Prerequisites

VibeSense uses `node-hid`, a native Node.js addon that requires platform-specific build tools if no prebuilt binary is available for your platform.

### macOS

**Recommended:** Prebuilt NAPI binaries ship for `darwin-arm64` and `darwin-x64`. Build tools are only required as a fallback if prebuilt binaries are unavailable.

Ensure Xcode Command Line Tools are installed:

```bash
xcode-select --install
```

### Linux

Install the required build tools and HID/USB development headers:

```bash
# Debian / Ubuntu
sudo apt-get install build-essential libudev-dev libusb-1.0-0-dev

# Fedora / RHEL
sudo dnf install gcc gcc-c++ make systemd-devel libusb1-devel
```

**udev rules (non-root HID access):**

By default, HID devices require root access on Linux. To allow non-root access, create a udev rules file:

```bash
sudo tee /etc/udev/rules.d/99-vibesense.rules <<'EOF'
SUBSYSTEM=="hidraw", GROUP="plugdev", MODE="0664"
SUBSYSTEM=="usb", ATTRS{idVendor}=="054c", GROUP="plugdev", MODE="0664"
SUBSYSTEM=="usb", ATTRS{idVendor}=="045e", GROUP="plugdev", MODE="0664"
EOF
sudo udevadm control --reload-rules && sudo udevadm trigger
```

Then add your user to the `plugdev` group:

```bash
sudo usermod -aG plugdev $USER
# Log out and back in for the group change to take effect
```

Vendor IDs:
- `054c` — Sony (DualSense controller)
- `045e` — Microsoft (Xbox controller)

### Windows

> **Note:** Windows support is planned for a future release. The current MVP targets macOS.

Visual Studio Build Tools are required:

1. Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Install the "Desktop development with C++" workload

### Node.js Version

Use the Node.js version that matches VSCode's embedded Electron runtime. VSCode 1.85+ embeds Node.js 20.x LTS (NAPI). Check your VSCode version:

```bash
code --version
```

We recommend using [nvm](https://github.com/nvm-sh/nvm) to manage Node.js versions:

```bash
nvm install 20
nvm use 20
```

---

## Development Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/stephenleo/vibesense.git
cd vibesense
npm install
```

The `postinstall` script automatically runs `electron-rebuild -f -w node-hid` to rebuild the native `node-hid` module against VSCode's Electron runtime. No manual rebuild command is required.

If the automatic rebuild fails (e.g., Electron version mismatch), run it manually with an explicit version:

```bash
./node_modules/.bin/electron-rebuild -f -w node-hid --version <electron-version>
```

To find VSCode's Electron version:

```bash
node -e "const p=require('/Applications/Visual Studio Code.app/Contents/Resources/app/package.json'); console.log(p.dependencies.electron)"
# On Linux: adjust the path to your VSCode installation
```

---

## Build Commands

| Command | Description |
|---|---|
| `npm run build` | Production webpack build (both extension host + webview bundles) |
| `npm run build:dev` | Development webpack build with source maps |
| `npm run watch` | Watch mode for iterative development |
| `npm run typecheck` | TypeScript type checking (zero errors expected) |
| `npm run lint` | ESLint code quality check (zero errors expected) |

---

## Packaging (VSIX)

VibeSense ships platform-specific VSIX packages to include only the correct prebuilt `node-hid` binary for each target platform. There are 4 supported targets:

| Target | Platform |
|---|---|
| `darwin-arm64` | macOS Apple Silicon (M1/M2/M3) |
| `darwin-x64` | macOS Intel |
| `linux-x64` | Linux x64 |
| `win32-x64` | Windows x64 |

To package for a specific platform:

```bash
vsce package --target darwin-arm64
vsce package --target darwin-x64
vsce package --target linux-x64
vsce package --target win32-x64
```

The `**/*.node` entry in `.vscodeignore` ensures that only the platform-appropriate prebuilt binary is included in each VSIX. `vsce package --target <platform>` handles binary selection automatically — no manual filtering is needed.

---

## Architecture Notes

- `node-hid` and `dualsense-ts` are **extension host only** — never import them from `src/webview/` or `src/shared/`
- `node-hid` is externalized from webpack (`externals: { 'node-hid': 'commonjs node-hid' }`) — it must never be bundled
- The async `node-hid` API (`device.readAsync()`, `device.on('data', ...)`) must be used to avoid blocking the Node.js event loop (see `NFR-P1` latency budget)

## License

[MIT](LICENSE)
