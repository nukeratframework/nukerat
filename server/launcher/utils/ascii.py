draw = r'''
    ██████▄ ██ ██ ██  ██ ▄█▀██ ██▀█▄ ▄███ ▀██▀ 
███ █▓█ █▓█ ██ ██ ██ ██  ██ ▀▀ ██ ██ ██ ██ ██ ███
▓▓▓ █▒█ █▒█ ██ ██ ██▀█▄  ██▀▀  ██▀█▄ ██▀██ ██ ▓▓▓
▒▒▒ █░█ █░█ ██ ██ ██  ██ ██ ██ ██ ██ ██ ██ ██ ▒▒▒ 
░░░ █▒█ █▒█ ▀█▄█▀ ██  ██ ▀█▄██ ██ ██ ██ ██ ██ ░░░
┌── █▓█ █▓█ ─────────────────────────────────────┐
└─── ▀▀ ▀▀ ────» Post Exploitation Framework «───┘

'''

def banner():
    # Prints the startup ASCII banner
    c_top, c_bottom = (255, 255, 255), (150, 150, 150)
    lines = draw.splitlines()
    n = len(lines)
    result = []

    for li, line in enumerate(lines):
        t = li / (n - 1) if n > 1 else 0
        r, g, b = tuple(
            round(c_top[i] + (c_bottom[i] - c_top[i]) * t) for i in range(3)
        )
        row = ""

        for ch in line:
            if ch.strip():
                row += f"\033[38;2;{r};{g};{b}m{ch}"
            else:
                row += ch
        result.append(row)
    print("\n\033[0m".join(result) + "\033[0m")
