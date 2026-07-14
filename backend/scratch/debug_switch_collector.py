import sys
import os
import dotenv

# Load environment variables
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
dotenv.load_dotenv()

from app.services.collectors.ex4100_collector import EX4100Collector

print("Connecting directly to live switch and running commands...")
collector = EX4100Collector()
collector.connect()
try:
    print("Running command: show vlans")
    output = collector.ssh_manager.run_command('cli -c "show vlans"')
    print(f"BYTES RECEIVED: {len(output)}")
    print("--- RAW OUTPUT ---")
    print(output)
    print("------------------")
finally:
    collector.disconnect()
