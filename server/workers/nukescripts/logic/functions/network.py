from infra.general.create_log import logger, write_log


class NetworkApi:
    add_socks_runner = None
    add_forward_runner = None
    remove_runner = None
    restart_runner = None

    def add_socks(self, host_tag, port, user="", password=""):
        # Opens a socks session on the host
        if not self.add_socks_runner:
            raise RuntimeError("network add_socks runner not configured")
        try:
            return self.add_socks_runner(str(host_tag), int(port), str(user or ""), str(password or ""))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | nukescripts/network/add_socks | {e}")
            return str(e)

    def add_forward(self, host_tag, local_port, target_host, target_port):
        # Opens a port forward on the host
        if not self.add_forward_runner:
            raise RuntimeError("network add_forward runner not configured")
        try:
            return self.add_forward_runner(
                str(host_tag),
                int(local_port),
                str(target_host),
                int(target_port),
            )
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | nukescripts/network/add_forward | {e}")
            return str(e)

    def remove(self, session_id):
        # Removes a network session
        if not self.remove_runner:
            raise RuntimeError("network remove runner not configured")
        try:
            return self.remove_runner(str(session_id))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | nukescripts/network/remove | {e}")
            return str(e)

    def restart(self, session_id):
        # Restarts a network session
        if not self.restart_runner:
            raise RuntimeError("network restart runner not configured")
        try:
            return self.restart_runner(str(session_id))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | nukescripts/network/restart | {e}")
            return str(e)


network = NetworkApi()
