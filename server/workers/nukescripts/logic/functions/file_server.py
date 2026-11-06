from infra.general.create_log import logger, write_log


class FileServerApi:
    upload_runner = None
    delete_runner = None

    def upload(self, port, path):
        # Uploads a file through the file server
        if not self.upload_runner:
            raise RuntimeError("file_server upload runner not configured")
        try:
            return self.upload_runner(int(port), str(path))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | nukescripts/file_server/upload | {e}")
            return str(e)

    def delete(self, port, nome):
        # Deletes a file from the file server
        if not self.delete_runner:
            raise RuntimeError("file_server delete runner not configured")
        try:
            return self.delete_runner(int(port), str(nome))
        except Exception as e:
            write_log(logger, "error", f"Unhandled exception | nukescripts/file_server/delete | {e}")
            return str(e)


file_server = FileServerApi()
