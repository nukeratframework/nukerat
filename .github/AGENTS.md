# Project contextualization for AI agents

## About AGENTS.md
AGENTS.md guides and contextualizes AI agents working on NukeRat. It collects the information needed to understand the project and its structure.

## What is NukeRat?
NukeRat is a post-exploitation framework for Red Team operations that need more flexibility and customization to fit modern, complex environments.

## Features

### Armory

A library of BOF and .NET utilities, each adapted for NukeRat. As of 2026-11-05 it includes 550+ utilities. They are not shipped by default. Install them from the NukeRat client `terminal` tab with `armory install <utility>`, or install every available utility with `armory install all`.

### Communication

NukeRat supports four communication types:

- HTTP (external)
- TCP (relay/internal)
- SMB (relay/internal)
- Custom C2 (external)

For channels tied to external platforms such as Telegram or Discord, the operator uses custom C2, also called a custom channel inside NukeRat. A custom channel can also cover more specific transports such as DNS and DoH.

### Runtime evasion

Runtime evasion is a core focus of NukeRat. It includes:
- Indirect syscalls
- Stack spoofing
- Sleep mask (Ekko and Zilean)
- AMSI/ETW patch
- Custom injections (VirtualAlloc, section, and module stomping)
- Inline execution
- Dynamic library loading
- Runtime PE header patching

### Static evasion

Static evasion depends mainly on how far the implant is customized. Specific techniques include:
- String encryption (XOR and RC4)
- Custom junk code
- PE header manipulation

## Compatibility

| Item | Platform |
| --- | --- |
| Implants | Windows, Linux, macOS (ARM support) |
| Server | Linux |
| UI Client | Windows, Linux, macOS |

## Linux and macOS implants

Linux and macOS implants are not the main focus, but they are supported. That includes implant customization through preface code and BOF execution on Linux, plus string encryption for static evasion.

## Installation

### Linux

Clone the repository and run the full install (client and server).
```bash
git clone https://github.com/nukeratframework/nukerat && cd nukerat && sudo bash install.sh all
```

### Windows

Installs the NukeRat client. Windows supports the client only.
```bash
git clone https://github.com/nukeratframework/nukerat
cd nukerat/install
windows.bat client
```

### macOS

Installs the NukeRat client. macOS supports the client only.
```bash
git clone https://github.com/nukeratframework/nukerat && cd nukerat/install && sudo bash macos.sh client
```

## Fast setup

Quick guide from setup through the first implant (Linux server).

### 1) Install the server

Clone the repository and run the installer.

```bash
git clone https://github.com/nukeratframework/nukerat && cd nukerat && sudo bash install.sh
```

### 2) Create an operator key

The server requires an operator key. From the repository root:

```bash
./nukerat.py server key add test
```

The output looks like:

```text
test:z6MIe3MbZQL57Hx3fOthGZJ:oxcWICLu9Tnu7GyvwDiwVCRoER4ybKv...

Operator created successfully: test
```

Copy the generated key so you can paste it into the client.

### 3) Start the server

Starts the server on `0.0.0.0:9000` (default).

```bash
./nukerat.py server start
```

### 4) Open the client

```bash
./nukerat.py client start
```

### 5) Configure a server

In the top bar, go to **NukeRat** > **Servers** > **Add**. Paste the operator key, set port `9000` (default) and the server IP, then click **Auth**.

### 6) Configure a listener

This is the port the implant uses to communicate. Go to **NukeRat** > **Listeners** > **Add** and:

- Pick an identification name
- Select `Channel` in the **TYPE** field
- Leave `http` in the channel field
- Select the server you created earlier
- Set a port different from the server port
- Click **Create**

### 7) Build an implant

Go to **NukeRat** > **Implants** > **Add** and:

- In **COMPILE SERVER**, select the server you created earlier
- Choose the target operating system
- Click **Command and control** on the left and point C2 at the listener you created, for example `http://192.168.1.100:9000`
- Execute

### 8) Run the implant

Run the implant on the target machine. With the setup correct, a new session appears. To interact, open a terminal under **Tabs** > **Terminal** and, in the **Host** dropdown next to the tab name, select the session.

## NukeRat glossary

- `server`: Linux teamserver. The default port (`9000`) authenticates the client. It is not the implant callback port.
- `NukeRat client`: operator UI (Windows, Linux, macOS). Talks to the server with an operator key.
- `operator key`: credential in the form `name:id:secret`. Authenticates the client to the server, not the implant.
- `listener`: implant callback endpoint (HTTP, SMB, TCP, or custom). Uses a port distinct from the server port.
- `compile server`: server selected under **COMPILE SERVER** to build the implant. It is not the C2 listener.
- `implant`: binary on the target host (beacon). Formats: `exe`, `dll`, `shellcode` (Windows), `elf`/`so` (Linux), `app` (macOS).
- `stageless`: full implant with C2 built in. Protocols: HTTP, HTTPS, SMB, TCP, custom.
- `loader`: stager that downloads the implant from a stage URL. Protocols: HTTP and custom.
- `session`: active implant callback. This is what the **Host** dropdown selects for the terminal.
- `preface code`: code injected before `main` at compile time. Customization point for the implant, including junk code.
- `armory`: BOFs and .NET assemblies adapted for NukeRat. Not included in the install; added with `armory install`.
- `channel`: external transport from the implant to the server (HTTP or custom C2).
- `custom channel`: operator-implemented channel. Covers external platforms (Telegram, Discord) and transports such as DNS and DoH. Also called custom C2.
- `relay`: internal pivot between implants over TCP or SMB. It does not replace an external channel.
- `sleep mask`: in-memory obfuscation of the implant during sleep.
- `lolbin`: execution of a native Windows binary through the LOLBAS integration (`lolbin`, `lol-*`). Not part of the armory.
