async def build_tree(flat: dict) -> dict:
    # Turns the flat paths into a folder tree
    tree = {}

    for path, metadata in flat.items():
        parts = path.replace("\\", "/").split("/")
        parts = [p for p in parts if p]
        if not parts:
            parts = ["/"]
        node = tree
        for part in parts[:-1]:
            node = node.setdefault(part, {})
        node[parts[-1]] = metadata

    return tree


async def mark_expanded(node: dict) -> dict:
    # Marks each folder node as collapsed
    if "type" in node:
        return node

    node["expanded"] = False

    for value in node.values():
        if isinstance(value, dict):
            await mark_expanded(value)
    return node
