import sqlite3

def check_db():
    conn = sqlite3.connect('campusnet.db')
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, ip_address, status, model, version, uptime, cpu_usage, health_score FROM devices WHERE id='dev-fw-1'")
        row = cursor.fetchone()
        if row:
            print("==================================================")
            print("FIREWALL STATUS IN SQLITE DATABASE:")
            print(f"ID:         {row[0]}")
            print(f"Name:       {row[1]}")
            print(f"IP:         {row[2]}")
            print(f"Status:     {row[3]}")
            print(f"Model:      {row[4]}")
            print(f"Version:    {row[5]}")
            print(f"Uptime:     {row[6]}")
            print(f"CPU Usage:  {row[7]}%")
            print(f"Health:     {row[8]}%")
            print("==================================================")
        else:
            print("Firewall device 'dev-fw-1' not found in database.")
    except Exception as e:
        print(f"Error reading database: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    check_db()
