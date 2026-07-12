@echo off
echo Actualizando la tarea programada PodmanAutoStartAdmin...
powershell -Command "$trigger = New-ScheduledTaskTrigger -AtLogOn; $principal = New-ScheduledTaskPrincipal -UserId '%USERDOMAIN%\%USERNAME%' -LogonType Interactive -RunLevel Highest; Set-ScheduledTask -TaskName 'PodmanAutoStartAdmin' -Trigger $trigger -Principal $principal"
echo.
echo Tarea actualizada exitosamente. Ya puedes cerrar esta ventana.
pause
