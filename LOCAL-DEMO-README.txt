ONLINE STORE - LOCAL DEMO
=========================

This project uses LOCAL PostgreSQL. No Neon account is required.

FAST START ON WINDOWS
---------------------
1. Install and start Docker Desktop.
2. Double-click START-DEMO.cmd.
3. Wait until Next.js reports Ready.
4. Open: http://127.0.0.1:3000

ADMIN LOGIN
-----------
Username: admin
Password: admin
Role: SUPER_ADMIN

LOCAL DATABASE
--------------
The PostgreSQL database runs only on this computer in Docker:
Host: 127.0.0.1
Port: 5432
Database: online_store
User: postgres
Password: postgres

The database is stored in a local Docker volume and survives normal stop/start.

DEMO CLEANUP
------------
DEMO_MODE=true
DEMO_DATA_TTL_MINUTES=15

START-DEMO.cmd starts a separate local cleanup scheduler. It checks every 5 minutes
and removes eligible demo/customer data older than 15 minutes through the protected
internal cleanup endpoint. Catalog/configuration data and the test SUPER_ADMIN are preserved.

STOP
----
Double-click STOP-DEMO.cmd.
This stops Node.js and PostgreSQL but keeps local database data.

FULL LOCAL DATABASE RESET
-------------------------
Double-click RESET-LOCAL-DATABASE.cmd and type RESET.
This deletes only the local demo database volume, recreates PostgreSQL, applies migrations,
seeds the generic demo catalog, and recreates admin/admin.

IMPORTANT
---------
This is a demo/development configuration. Do not expose postgres:postgres or admin/admin
on a public production server.
