# Overview

Process injection for stageless tasks. Decodes task input, picks an allocation mode, writes shellcode or PE bytes into a remote process, and starts execution via `createThreadEx`.
