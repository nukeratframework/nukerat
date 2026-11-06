import subprocess
from pathlib import Path

python3 = Path(__file__).resolve().parents[2] / "venv" / "bin" / "python3"

def venv_list():
    # Lists the python packages installed in the venv
    subprocess.run([str(python3), "-m", "pip", "list"], check=True)

def venv_install(package):
    # Installs a python package in the venv
    subprocess.run([str(python3), "-m", "pip", "install", package], check=True)

def venv_uninstall(package):
    # Uninstalls a python package from the venv
    subprocess.run([str(python3), "-m", "pip", "uninstall", "-y", package], check=True)
