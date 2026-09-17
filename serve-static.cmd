@echo off
set PATH=%PATH%;C:\Program Files\nodejs
cd /d "%~dp0"
npx --yes serve out -l 4000
