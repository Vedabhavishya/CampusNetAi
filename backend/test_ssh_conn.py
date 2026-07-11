import sys
import getpass
try:
    from netmiko import ConnectHandler
except ImportError:
    print("Netmiko is not installed. Please run: pip install netmiko")
    sys.exit(1)

def test_connection():
    print("==================================================")
    # 1. Gather Connection Details Safely
    host = input("Enter Juniper Device IP: ")
    username = input("Enter SSH Username: ")
    password = getpass.getpass("Enter SSH Password: ")
    
    print("\n[+] Establishing direct SSH connection...")
    
    device = {
        'device_type': 'juniper_junos',
        'host': host,
        'username': username,
        'password': password,
    }
    
    try:
        # 2. Connect
        connection = ConnectHandler(**device)
        print("[✓] SSH Connection Successful!\n")
        
        # 3. Test Command
        print("[+] Running command: 'show system uptime'")
        uptime_output = connection.send_command("show system uptime")
        print("\n--- Command Output Start ---")
        print(uptime_output)
        print("--- Command Output End ---\n")
        
        # 4. Test Telemetry Command
        print("[+] Running command: 'show chassis routing-engine'")
        chassis_output = connection.send_command("show chassis routing-engine")
        print("\n--- Command Output Start ---")
        print(chassis_output)
        print("--- Command Output End ---\n")
        
        connection.disconnect()
        print("[✓] Disconnected successfully.")
        
    except Exception as e:
        print(f"\n[✗] Connection Failed: {e}")

if __name__ == '__main__':
    test_connection()
