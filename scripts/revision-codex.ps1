<#
.SYNOPSIS
	Ejecuta la revisión de Codex sobre un commit de la rama de trabajo.

.DESCRIPTION
	Arma un prompt con instrucciones fijas, los archivos de contexto del cambio OpenSpec y el diff
	del commit (sin package-lock.json), y lo entrega a «codex review» por stdin con el sandbox en
	solo lectura. Codex no necesita leer archivos por su cuenta: todo lo que revisa va en el prompt,
	así que no puede abrir insumos/, storage/ ni .env*. Además se ejecuta dentro de un worktree
	temporal del commit, que no contiene esas rutas porque no están versionadas.

	Notas de compatibilidad (Codex 0.146 en Windows):
	- «--commit» no admite instrucciones propias, por eso el SHA y el diff van en el prompt.
	- El sandbox de Windows puede no iniciar; en ese caso Codex no ejecuta comandos y revisa solo
	  el prompt, que ya es autosuficiente.

	La salida completa (stdout y stderr) se guarda en el directorio indicado.

.EXAMPLE
	powershell -File scripts/revision-codex.ps1 -Sha 20f235d -Fase 0 -DirectorioSalida $env:TEMP\revisiones
#>
param(
	[Parameter(Mandatory = $true)][string]$Sha,
	[Parameter(Mandatory = $true)][string]$Fase,
	[string]$DirectorioSalida = (Join-Path $env:TEMP 'reportes-icsi-revisiones'),
	[string]$Ronda = '1',
	# El modelo de config.toml puede no estar disponible con cuenta de ChatGPT.
	[string]$Modelo = 'gpt-5.6-sol',
	[string[]]$ArchivosContexto = @(
		'openspec/changes/reportes-mantenimiento-for-icsi-rmt-01/design.md',
		'openspec/changes/reportes-mantenimiento-for-icsi-rmt-01/tasks.md'
	)
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$raiz = (git rev-parse --show-toplevel).Trim()
$shaCompleto = (git -C $raiz rev-parse --verify "$Sha^{commit}").Trim()
$corto = $shaCompleto.Substring(0, 7)

New-Item -ItemType Directory -Force $DirectorioSalida | Out-Null
$salida = Join-Path $DirectorioSalida "fase-$Fase-ronda-$Ronda-$corto.txt"
$temporal = [System.IO.Path]::GetTempPath()
$worktree = Join-Path $temporal "revision-codex-$corto-$PID"
$archivoPrompt = Join-Path $temporal "revision-codex-$corto-$PID.txt"

$instrucciones = @"
Revisa únicamente los cambios introducidos por el commit $shaCompleto. Corresponden a la fase
$Fase del cambio OpenSpec reportes-mantenimiento-for-icsi-rmt-01. El diff completo y los archivos
de contexto van al final de este mensaje; no necesitas ejecutar comandos. Reglas obligatorias:
- No abras, listes ni leas las rutas insumos/, storage/ ni ningún archivo .env* (salvo .env.example).
- No modifiques archivos ni ejecutes comandos que escriban en disco o accedan a la red.
- Prioriza errores de corrección, seguridad, pérdida de datos, fugas de datos personales y
  contradicciones con el diseño y las tareas del cambio OpenSpec.
- Para cada hallazgo indica: severidad (alta, media o baja), archivo, línea, descripción y la
  corrección sugerida. Si no hay hallazgos, dilo explícitamente.
- Responde en español.
"@

function Get-GitTexto([string[]]$argumentos) {
	$lineas = & git -C $raiz @argumentos
	if ($LASTEXITCODE -ne 0) { throw "git $($argumentos -join ' ') falló" }
	return ($lineas -join "`n")
}

# Rutas que nunca se envían a Codex, aunque llegaran a versionarse por error. .env.example se
# revisa aparte porque es el único archivo de entorno permitido.
$patronSensible = '(^|/)(insumos|storage)(/|$)|(^|/)\.env'
$excluidas = @(':(exclude)package-lock.json', ':(exclude)insumos', ':(exclude)storage',
	':(exclude,glob)**/insumos/**', ':(exclude,glob)**/storage/**', ':(exclude,glob)**/.env*')

foreach ($ruta in $ArchivosContexto) {
	if ($ruta.Replace('\', '/') -match $patronSensible) { throw "Ruta de contexto no permitida: $ruta" }
}

$archivosCommit = (Get-GitTexto @('-c', 'core.quotepath=off', 'show', '--name-only', '--format=',
		$shaCompleto)) -split "`n" | Where-Object { $_ }
$omitidos = $archivosCommit | Where-Object { $_ -match $patronSensible -and $_ -notmatch '(^|/)\.env\.example$' }
if ($omitidos) {
	Write-Warning "El commit contiene rutas sensibles que no se envían a Codex: $($omitidos -join ', ')"
}

$partes = New-Object System.Collections.Generic.List[string]
$partes.Add($instrucciones)
foreach ($ruta in $ArchivosContexto) {
	$contenido = Get-GitTexto @('show', "${shaCompleto}:$ruta")
	$partes.Add("`n===== CONTEXTO: $ruta (versión del commit) =====`n$contenido")
}
$diff = Get-GitTexto (@('-c', 'core.quotepath=off', 'show', '--format=fuller', '--no-ext-diff',
		'--unified=40', $shaCompleto, '--', '.') + $excluidas)
$partes.Add("`n===== DIFF DEL COMMIT $shaCompleto =====`n$diff")
$diffEjemplo = Get-GitTexto @('-c', 'core.quotepath=off', 'show', '--format=', '--no-ext-diff',
	$shaCompleto, '--', '.env.example')
if ($diffEjemplo) {
	$partes.Add("`n===== DIFF DE .env.example =====`n$diffEjemplo")
}
[System.IO.File]::WriteAllText($archivoPrompt, ($partes -join "`n"), (New-Object System.Text.UTF8Encoding $false))

$codigo = 1
try {
	git -C $raiz worktree add --detach $worktree $shaCompleto | Out-Null

	# cmd redirige stdin, stdout y stderr a archivos para conservar la salida en UTF-8 sin envolverla.
	Push-Location $worktree
	try {
		cmd /c "codex review -c sandbox_mode=read-only -c model=$Modelo - < `"$archivoPrompt`" > `"$salida`" 2>&1"
		$codigo = $LASTEXITCODE
	}
	finally {
		Pop-Location
	}
	Write-Output "Revisión guardada en: $salida (código de salida $codigo)"

	# Comprobación: ningún comando ejecutado por Codex debe tocar rutas excluidas.
	$patron = '(^|[\s/\\"''])(insumos|storage)([/\\]|\b)|\.env(?!\.example)'
	$comandos = Select-String -Path $salida -Encoding UTF8 -Context 0, 1 -Pattern '^exec$' |
		ForEach-Object { $_.Context.PostContext }
	$sospechosos = $comandos | Where-Object { $_ -match $patron }
	if ($sospechosos) {
		Write-Warning 'Codex ejecutó comandos que mencionan rutas excluidas; revisar manualmente:'
		$sospechosos | ForEach-Object { Write-Warning $_ }
	}
	else {
		Write-Output "Comandos ejecutados por Codex: $(@($comandos).Count); ninguno menciona insumos/, storage/ ni .env*."
	}
}
finally {
	Remove-Item -Force -ErrorAction SilentlyContinue $archivoPrompt
	if (Test-Path $worktree) {
		git -C $raiz worktree remove --force $worktree | Out-Null
	}
}
exit $codigo
