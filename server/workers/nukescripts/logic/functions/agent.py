from infra.general.create_log import logger, write_log

runner = None


def tag_value(tag):
    # Checks the agent tag and strips spaces
    if not isinstance(tag, str):
        raise RuntimeError("agent expects agent tag string")
    value = tag.strip()
    if not value:
        raise RuntimeError("agent missing tag")
    return value


def run(tag, prompt):
    # Sends the prompt to the agent runner
    prompt_str = str(prompt)
    if not runner:
        raise RuntimeError("agent runner not configured")
    try:
        agent_tag = tag_value(tag)
        result = runner(agent_tag, prompt_str)
        return result
    except Exception as e:
        write_log(logger, "error", f"Unhandled exception | nukescripts/agent | {e}")
        return str(e)
