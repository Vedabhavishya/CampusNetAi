import paramiko
import time
import logging

class SSHManager:
    """
    Manages SSH sessions using Paramiko. Exposes clean methods to connect,
    disconnect, and execute CLI commands while measuring execution time,
    bytes received, and tracking success/failure statistics.
    """
    def __init__(self):
        self.client = None
        self.host = None
        self.port = 22
        self.username = None
        self.password = None
        self.timeout = 10
        self.stats = {
            "connected": False,
            "poll_count": 0,
            "failed_polls": 0,
            "last_seen": None,
            "last_successful_poll": None,
            "last_failed_poll": None,
            "response_time_ms": 0,
            "ssh_latency_ms": 0
        }

    def connect(self, host: str, port: int, username: str, password: str, timeout: int = 10) -> bool:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.timeout = timeout

        if self.client:
            try:
                transport = self.client.get_transport()
                if transport and transport.is_active():
                    self.stats["connected"] = True
                    return True
            except Exception:
                pass
            self.disconnect()

        start_time = time.time()
        try:
            print(f"[SSHManager] Connecting to {self.host}:{self.port}...", flush=True)
            self.client = paramiko.SSHClient()
            self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            self.client.connect(
                hostname=self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                timeout=self.timeout,
                banner_timeout=self.timeout
            )
            connection_latency = int((time.time() - start_time) * 1000)
            self.stats["ssh_latency_ms"] = connection_latency
            self.stats["connected"] = True
            self.stats["last_seen"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            print(f"[SSHManager] Connected | Authentication Success | Latency: {connection_latency}ms", flush=True)
            return True
        except paramiko.AuthenticationException as e:
            print(f"[SSHManager] Authentication Failure connecting to {self.host}: {e}", flush=True)
            self.stats["connected"] = False
            self.stats["last_failed_poll"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self.stats["failed_polls"] += 1
            self.disconnect()
            raise e
        except Exception as e:
            print(f"[SSHManager] Connection Failure connecting to {self.host}: {e}", flush=True)
            self.stats["connected"] = False
            self.stats["last_failed_poll"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self.stats["failed_polls"] += 1
            self.disconnect()
            raise e

    def disconnect(self):
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
            self.client = None
            self.stats["connected"] = False
            print("[SSHManager] Disconnect | Connection Closed", flush=True)

    def run_command(self, command: str, timeout: int = 10) -> str:
        if not self.client:
            raise Exception("SSH connection is not established.")

        start_time = time.time()
        try:
            print(f"[SSHManager] Command: '{command}'", flush=True)
            stdin, stdout, stderr = self.client.exec_command(command, timeout=timeout)
            exit_status = stdout.channel.recv_exit_status()
            
            output = stdout.read().decode('utf-8', errors='ignore')
            err_output = stderr.read().decode('utf-8', errors='ignore')
            
            exec_time = time.time() - start_time
            bytes_received = len(output) + len(err_output)
            print(f"[SSHManager] Bytes Received: {bytes_received} | Execution Time: {exec_time:.3f}s", flush=True)
            
            if exit_status != 0:
                print(f"[SSHManager] Command Error Output: {err_output}", flush=True)
                return output or ""
            
            return output
        except Exception as e:
            print(f"[SSHManager] Collector Errors running '{command}': {e}", flush=True)
            raise e
