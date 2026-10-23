@echo off
set GIT="C:\Program Files\Git\cmd\git.exe"
cd /d D:\school
%GIT% init
%GIT% config user.name ismailsoloyt12-stack
%GIT% config user.email ismailsoloyt12-stack@users.noreply.github.com
%GIT% remote add origin https://github.com/ismailsoloyt12-stack/school-management.git
%GIT% add .
%GIT% commit -q -m "School management: Hifz module, teacher onboarding portal, and local SQLite persistence"
%GIT% branch -M main
%GIT% log --oneline -1
