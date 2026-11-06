from utils.querys import generate_tag

from .steps.compilation.core import main as compile_implant


async def main(body):
    # Creates a tag and starts the implant build
    tag = generate_tag()
    return await compile_implant(body, tag)
