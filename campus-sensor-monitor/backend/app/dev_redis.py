import sys
import fakeredis

def main():
    print("Starting in-memory Redis server on 127.0.0.1:6379...", flush=True)
    server = fakeredis.TcpFakeServer(("127.0.0.1", 6379))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Stopping Redis server...", flush=True)
        server.shutdown()

if __name__ == "__main__":
    main()
