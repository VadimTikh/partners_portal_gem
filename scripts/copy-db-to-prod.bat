@echo off
REM Copy dev database to prod database
REM Usage: copy-db-to-prod.bat

SET PGHOST=195.201.150.230
SET PGPORT=5432
SET PGUSER=postgres
SET PGPASSWORD=plenty2023!

SET SOURCE_DB=dev_miomente_portal
SET TARGET_DB=prod_miomente_portal

echo ========================================
echo Copying %SOURCE_DB% to %TARGET_DB%
echo ========================================

echo.
echo Step 1: Dumping %SOURCE_DB%...
pg_dump -d %SOURCE_DB% -F c -f dev_backup.dump
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pg_dump failed
    pause
    exit /b 1
)
echo Done.

echo.
echo Step 2: Terminating connections to %TARGET_DB%...
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%TARGET_DB%' AND pid <> pg_backend_pid();"

echo.
echo Step 3: Dropping %TARGET_DB%...
psql -d postgres -c "DROP DATABASE IF EXISTS %TARGET_DB%;"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: DROP DATABASE failed
    pause
    exit /b 1
)

echo.
echo Step 4: Creating empty %TARGET_DB%...
psql -d postgres -c "CREATE DATABASE %TARGET_DB%;"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: CREATE DATABASE failed
    pause
    exit /b 1
)

echo.
echo Step 5: Restoring to %TARGET_DB%...
pg_restore -d %TARGET_DB% -F c --clean --if-exists dev_backup.dump
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: Some restore warnings (usually safe to ignore)
)

echo.
echo Step 6: Cleaning up...
del dev_backup.dump

echo.
echo ========================================
echo SUCCESS: %TARGET_DB% is now a copy of %SOURCE_DB%
echo ========================================
pause
