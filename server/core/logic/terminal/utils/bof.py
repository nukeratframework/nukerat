import base64
import binascii
import json
import shlex
from pathlib import Path

from ..mapping import commands
from .paths import armory_dir
from .txt_read import read_message


def strip_outer_quotes(text):
    # Strips the outer quotes from the text
    text_value = text.strip()
    if len(text_value) >= 2 and text_value[0] == text_value[-1] and text_value[0] in "\"'":
        return text_value[1:-1]
    return text_value


def is_single_string_path_schema(specs, parse_type):
    # Checks if the schema is one string path
    if parse_type != "positional":
        return False
    positional = [
        spec for spec in specs
        if not spec.get("flag") and spec.get("positional", True)
    ]
    if len(positional) != 1:
        return False
    return positional[0].get("type", "z") in ("z", "Z")


def tokenize_bof_args(raw, specs, parse_type):
    # Splits the bof args into tokens
    if not raw.strip():
        return []
    if is_single_string_path_schema(specs, parse_type):
        return [strip_outer_quotes(raw)]
    return shlex.split(raw, posix=False)


def pack_arg(type_prefix, value, params=None):
    # Packs one bof arg with its type prefix
    text_value = strip_outer_quotes(str(value))
    if type_prefix in ("i", "s"):
        return f"{type_prefix}:{int(value)}"
    if type_prefix == "b":
        blob = text_value[2:] if text_value.startswith("b:") else text_value
        blob = blob.strip()
        try:
            base64.b64decode(blob, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("BOF loader error: binary argument must be valid base64") from None
        return f"b:{blob}"
    if any(ch.isspace() for ch in text_value):
        return f'{type_prefix}:"{text_value}"'
    return f"{type_prefix}:{text_value}"


def parseNone(tokens, raw, schemaRaw, params, helpName):
    # Packs raw args when the schema is empty
    if not schemaRaw:
        if raw.strip():
            params["args"] = pack_arg("z", raw, params)
        return None, None
    if not tokens:
        return None, None
    helpText = read_message(f"tools/{helpName}.txt")
    if helpText:
        return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
    return None, "BOF loader error: Missing required parameters."


def parsePositional(specs, tokens, helpName, params=None):
    # Parses positional bof args
    slots = []
    filled = []
    flagIndex = {}
    positionalIndexes = []

    for index, spec in enumerate(specs):
        slots.append(None)
        filled.append(False)
        flagName = spec.get("flag")
        if flagName:
            flagIndex[flagName] = index
        elif spec.get("positional", True):
            positionalIndexes.append(index)

    extras = []
    positionalTokens = []
    cursor = 0

    while cursor < len(tokens):
        token = tokens[cursor]
        if len(token) >= 2 and token[1] == ":" and token[0] in "zZisb":
            extras.append(token)
            cursor += 1
            continue

        matchedFlag = None
        inlineValue = None
        if token.startswith("--") and "=" in token:
            matchedFlag, inlineValue = token.split("=", 1)
        elif token in flagIndex:
            matchedFlag = token

        if matchedFlag is not None and matchedFlag in flagIndex:
            slotIndex = flagIndex[matchedFlag]
            slotSpec = specs[slotIndex]
            if slotSpec.get("value") is not None:
                slots[slotIndex] = slotSpec["value"]
                filled[slotIndex] = True
                cursor += 1
            else:
                if inlineValue is None:
                    if cursor + 1 >= len(tokens):
                        helpText = read_message(f"tools/{helpName}.txt")
                        if helpText:
                            return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
                        return None, "BOF loader error: Missing required parameters."
                    inlineValue = tokens[cursor + 1]
                    cursor += 2
                else:
                    cursor += 1
                slots[slotIndex] = inlineValue
                filled[slotIndex] = True
            continue

        positionalTokens.append(token)
        cursor += 1

    positionalCursor = 0
    for token in positionalTokens:
        if positionalCursor >= len(positionalIndexes):
            extras.append(token)
            continue
        slotIndex = positionalIndexes[positionalCursor]
        slots[slotIndex] = token
        filled[slotIndex] = True
        positionalCursor += 1

    for index, spec in enumerate(specs):
        if not spec.get("required"):
            continue
        if spec.get("flag") and spec.get("value") is not None:
            continue
        if not filled[index] and slots[index] in (None, ""):
            helpText = read_message(f"tools/{helpName}.txt")
            if helpText:
                return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
            return None, "BOF loader error: Missing required parameters."

    packed = []
    for index, spec in enumerate(specs):
        value = slots[index]
        if value is None:
            value = spec.get("default")
            if value is None:
                value = 0 if spec.get("type") in ("i", "s") else ""
        typePrefix = spec.get("type", "z")
        packed.append(pack_arg(typePrefix, value, params))

    packed.extend(extras)
    return " ".join(packed), None


def parseNormalize(specs, tokens, helpName, params=None):
    # Parses normalized bof args
    slots = []
    filled = []
    flagIndex = {}
    positionalIndexes = []

    for index, spec in enumerate(specs):
        defaultValue = spec.get("default")
        if defaultValue is None:
            defaultValue = 0 if spec.get("type") in ("i", "s") else ""
        slots.append(defaultValue)
        filled.append(False)
        flagName = spec.get("flag")
        if flagName:
            flagIndex[flagName] = index
        elif spec.get("positional", True):
            positionalIndexes.append(index)

    extras = []
    positionalTokens = []
    cursor = 0

    while cursor < len(tokens):
        token = tokens[cursor]
        if len(token) >= 2 and token[1] == ":" and token[0] in "zZisb":
            extras.append(token)
            cursor += 1
            continue

        matchedFlag = None
        inlineValue = None
        if token.startswith("--") and "=" in token:
            matchedFlag, inlineValue = token.split("=", 1)
        elif token in flagIndex:
            matchedFlag = token

        if matchedFlag is not None and matchedFlag in flagIndex:
            slotIndex = flagIndex[matchedFlag]
            slotSpec = specs[slotIndex]
            if slotSpec.get("value") is not None:
                slots[slotIndex] = slotSpec["value"]
                filled[slotIndex] = True
                cursor += 1
            else:
                if inlineValue is None:
                    if cursor + 1 >= len(tokens):
                        helpText = read_message(f"tools/{helpName}.txt")
                        if helpText:
                            return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
                        return None, "BOF loader error: Missing required parameters."
                    inlineValue = tokens[cursor + 1]
                    cursor += 2
                else:
                    cursor += 1
                slots[slotIndex] = inlineValue
                filled[slotIndex] = True
            continue

        positionalTokens.append(token)
        cursor += 1

    positionalCursor = 0
    for token in positionalTokens:
        if positionalCursor >= len(positionalIndexes):
            extras.append(token)
            continue
        slotIndex = positionalIndexes[positionalCursor]
        slots[slotIndex] = token
        filled[slotIndex] = True
        positionalCursor += 1

    for index, spec in enumerate(specs):
        if not spec.get("required"):
            continue
        if spec.get("flag") and spec.get("value") is not None:
            continue
        if not filled[index] and slots[index] in (None, ""):
            helpText = read_message(f"tools/{helpName}.txt")
            if helpText:
                return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
            return None, "BOF loader error: Missing required parameters."

    packed = []
    for index, spec in enumerate(specs):
        value = slots[index]
        if value is None:
            value = spec.get("default")
            if value is None:
                value = 0 if spec.get("type") in ("i", "s") else ""
        typePrefix = spec.get("type", "z")
        packed.append(pack_arg(typePrefix, value, params))

    packed.extend(extras)
    return " ".join(packed), None


def parseNamed(specs, tokens, helpName, params=None):
    # Parses named bof args
    slots = []
    filled = []
    flagIndex = {}
    positionalIndexes = []

    for index, spec in enumerate(specs):
        defaultValue = spec.get("default")
        if defaultValue is None:
            defaultValue = 0 if spec.get("type") in ("i", "s") else ""
        slots.append(defaultValue)
        filled.append(False)
        flagName = spec.get("flag")
        if flagName:
            flagIndex[flagName] = index
        elif spec.get("positional", True):
            positionalIndexes.append(index)

    extras = []
    positionalTokens = []
    cursor = 0

    while cursor < len(tokens):
        token = tokens[cursor]
        if len(token) >= 2 and token[1] == ":" and token[0] in "zZisb":
            extras.append(token)
            cursor += 1
            continue

        matchedFlag = None
        inlineValue = None
        if token.startswith("--") and "=" in token:
            matchedFlag, inlineValue = token.split("=", 1)
        elif token in flagIndex:
            matchedFlag = token

        if matchedFlag is not None and matchedFlag in flagIndex:
            slotIndex = flagIndex[matchedFlag]
            slotSpec = specs[slotIndex]
            if slotSpec.get("value") is not None:
                slots[slotIndex] = slotSpec["value"]
                filled[slotIndex] = True
                cursor += 1
            else:
                if inlineValue is None:
                    if cursor + 1 >= len(tokens):
                        helpText = read_message(f"tools/{helpName}.txt")
                        if helpText:
                            return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
                        return None, "BOF loader error: Missing required parameters."
                    inlineValue = tokens[cursor + 1]
                    cursor += 2
                else:
                    cursor += 1
                slots[slotIndex] = inlineValue
                filled[slotIndex] = True
            continue

        positionalTokens.append(token)
        cursor += 1

    positionalCursor = 0
    for token in positionalTokens:
        if positionalCursor >= len(positionalIndexes):
            extras.append(token)
            continue
        slotIndex = positionalIndexes[positionalCursor]
        slots[slotIndex] = token
        filled[slotIndex] = True
        positionalCursor += 1

    for index, spec in enumerate(specs):
        if not spec.get("required"):
            continue
        if spec.get("flag") and spec.get("value") is not None:
            continue
        if not filled[index] and slots[index] in (None, ""):
            helpText = read_message(f"tools/{helpName}.txt")
            if helpText:
                return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
            return None, "BOF loader error: Missing required parameters."

    packed = []
    for index, spec in enumerate(specs):
        value = slots[index]
        if value is None:
            value = spec.get("default")
            if value is None:
                value = 0 if spec.get("type") in ("i", "s") else ""
        typePrefix = spec.get("type", "z")
        packed.append(pack_arg(typePrefix, value, params))

    packed.extend(extras)
    return " ".join(packed), None


def parseCustom(specs, tokens, helpName, params=None):
    # Parses custom bof args
    slots = []
    filled = []
    flagIndex = {}
    positionalIndexes = []

    for index, spec in enumerate(specs):
        defaultValue = spec.get("default")
        if defaultValue is None:
            defaultValue = 0 if spec.get("type") in ("i", "s") else ""
        slots.append(defaultValue)
        filled.append(False)
        flagName = spec.get("flag")
        if flagName:
            flagIndex[flagName] = index
        elif spec.get("positional", True):
            positionalIndexes.append(index)

    extras = []
    positionalTokens = []
    cursor = 0

    while cursor < len(tokens):
        token = tokens[cursor]
        if len(token) >= 2 and token[1] == ":" and token[0] in "zZisb":
            extras.append(token)
            cursor += 1
            continue

        matchedFlag = None
        inlineValue = None
        if token.startswith("--") and "=" in token:
            matchedFlag, inlineValue = token.split("=", 1)
        elif token in flagIndex:
            matchedFlag = token

        if matchedFlag is not None and matchedFlag in flagIndex:
            slotIndex = flagIndex[matchedFlag]
            slotSpec = specs[slotIndex]
            if slotSpec.get("value") is not None:
                slots[slotIndex] = slotSpec["value"]
                filled[slotIndex] = True
                cursor += 1
            else:
                if inlineValue is None:
                    if cursor + 1 >= len(tokens):
                        helpText = read_message(f"tools/{helpName}.txt")
                        if helpText:
                            return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
                        return None, "BOF loader error: Missing required parameters."
                    inlineValue = tokens[cursor + 1]
                    cursor += 2
                else:
                    cursor += 1
                slots[slotIndex] = inlineValue
                filled[slotIndex] = True
            continue

        positionalTokens.append(token)
        cursor += 1

    positionalCursor = 0
    for token in positionalTokens:
        if positionalCursor >= len(positionalIndexes):
            extras.append(token)
            continue
        slotIndex = positionalIndexes[positionalCursor]
        slots[slotIndex] = token
        filled[slotIndex] = True
        positionalCursor += 1

    for index, spec in enumerate(specs):
        if not spec.get("required"):
            continue
        if spec.get("flag") and spec.get("value") is not None:
            continue
        if not filled[index] and slots[index] in (None, ""):
            helpText = read_message(f"tools/{helpName}.txt")
            if helpText:
                return None, f"BOF loader error: Missing required parameters. See help below.\n\n{helpText}"
            return None, "BOF loader error: Missing required parameters."

    packed = []
    for index, spec in enumerate(specs):
        value = slots[index]
        if value is None:
            value = spec.get("default")
            if value is None:
                value = 0 if spec.get("type") in ("i", "s") else ""
        typePrefix = spec.get("type", "z")
        packed.append(pack_arg(typePrefix, value, params))

    packed.extend(extras)
    return " ".join(packed), None


def bof_sanitization(command, params):
    # Sanitizes bof args before the command is sent
    mode = params.get("mode")
    if mode not in ("bof", "bof_armory"):
        return None

    binName = None
    fileVal = params.get("file")
    if fileVal:
        binName = Path(fileVal).name

    if not binName:
        cmdEntry = commands["complete_list"].get(command, {})
        binName = cmdEntry.get("armory_bin")
    if not binName:
        return None

    jsonPath = armory_dir / "armory.json"
    if not jsonPath.is_file():
        return None

    with open(jsonPath, encoding="utf-8") as handle:
        catalog = json.load(handle)

    armoryEntry = None
    for item in catalog:
        if item.get("name") == binName and item.get("type") == "bof":
            armoryEntry = item
            break
    if not armoryEntry:
        return None

    parseType = armoryEntry.get("parse") or "positional"
    schemaRaw = armoryEntry.get("args") or {}

    raw = params.get("args")
    if not isinstance(raw, str):
        raw = ""

    helpName = params.get("raw") or command or binName.removesuffix(".x64.o").removesuffix(".o")

    if parseType == "none" or not schemaRaw:
        tokens = shlex.split(raw, posix=False) if raw.strip() else []
        packed, error = parseNone(tokens, raw, schemaRaw, params, helpName)
        return error

    orderedKeys = sorted(schemaRaw, key=lambda key: int(key))
    specs = [schemaRaw[key] for key in orderedKeys]
    tokens = tokenize_bof_args(raw, specs, parseType)

    if parseType == "positional":
        packed, error = parsePositional(specs, tokens, helpName, params)
    elif parseType == "normalize":
        packed, error = parseNormalize(specs, tokens, helpName, params)
    elif parseType == "named":
        packed, error = parseNamed(specs, tokens, helpName, params)
    elif parseType == "custom":
        packed, error = parseCustom(specs, tokens, helpName, params)
    else:
        packed, error = parsePositional(specs, tokens, helpName, params)

    if error:
        return error

    params["args"] = packed
    return None
