<#
.SYNOPSIS
	Ejecuta la revisión de Codex sobre un commit de la rama de trabajo.

.DESCRIPTION
	Arma un prompt con instrucciones fijas, los archivos de contexto del trabajo (plan, diseño o
	tareas) y el diff del commit o, con -Base, del rango Base..Sha (sin package-lock.json), y lo
	entrega a «codex review» por stdin con el sandbox en solo lectura. Codex no necesita leer
	archivos por su cuenta: todo lo que revisa va en el prompt.

	-Cambio describe el trabajo revisado en las instrucciones (por omisión, el cambio OpenSpec
	reportes-mantenimiento-for-icsi-rmt-01). -Base permite revisar una fase hecha en varios commits.

	Protecciones para insumos/, storage/ y .env* (salvo .env.example):
	- Si el commit contiene alguna de esas rutas, el script se detiene antes de enviar nada.
	- Codex se ejecuta en un directorio temporal vacío (repositorio Git sin historia), sin acceso al
	  árbol del proyecto ni a su historial.

	Notas de compatibilidad (Codex 0.146 en Windows):
	- «--commit» no admite instrucciones propias, por eso el SHA y el diff van en el prompt.
	- El sandbox de Windows puede no iniciar; en ese caso Codex no ejecuta comandos y revisa solo
	  el prompt, que ya es autosuficiente.

	La salida completa (stdout y stderr) se guarda en el directorio indicado.

.EXAMPLE
	powershell -File scripts/revision-codex.ps1 -Sha 20f235d -Fase 0 -DirectorioSalida $env:TEMP\revisiones

.EXAMPLE
	powershell -File scripts/revision-codex.ps1 -Base dfbc60f -Sha 110ffd9 -Fase ux-A -Ronda 1 `
		-Cambio 'el plan de diseño de interfaz y experiencia de usuario (docs/PLAN_DISENO_UX.md)' `
		-ArchivosContexto docs/PLAN_DISENO_UX.md
#>
param(
	[Parameter(Mandatory = $true)][string]$Sha,
	[Parameter(Mandatory = $true)][string]$Fase,
	# Trabajo al que pertenece la fase, tal como se nombra en las instrucciones para Codex.
	[string]$Cambio = 'el cambio OpenSpec reportes-mantenimiento-for-icsi-rmt-01',
	# Commit anterior a la fase: se revisa el rango Base..Sha en lugar de un solo commit.
	[string]$Base = '',
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
$baseCompleta = if ($Base) { (git -C $raiz rev-parse --verify "$Base^{commit}").Trim() } else { '' }
$alcance = if ($baseCompleta) {
	"los commits del rango $baseCompleta..$shaCompleto (sin incluir la base)"
}
else {
	"el commit $shaCompleto"
}

New-Item -ItemType Directory -Force $DirectorioSalida | Out-Null
$salida = Join-Path $DirectorioSalida "fase-$Fase-ronda-$Ronda-$corto.txt"
$temporal = [System.IO.Path]::GetTempPath()
$aislado = Join-Path $temporal "revision-codex-$corto-$PID"
$archivoPrompt = Join-Path $temporal "revision-codex-$corto-$PID.txt"

$instrucciones = @"
Revisa únicamente los cambios introducidos por $alcance. Corresponden a la fase $Fase de
$Cambio. El diff completo y los archivos de contexto van al final de este mensaje; no necesitas
ejecutar comandos. Reglas obligatorias:
- No abras, listes ni leas las rutas insumos/, storage/ ni ningún archivo .env* (salvo .env.example).
- No modifiques archivos ni ejecutes comandos que escriban en disco o accedan a la red.
- Prioriza errores de corrección, seguridad, pérdida de datos, fugas de datos personales y
  contradicciones con los archivos de contexto (plan, diseño, requisitos o tareas).
- Para cada hallazgo indica: severidad (alta, media o baja), archivo, línea, descripción y la
  corrección sugerida. Si no hay hallazgos, dilo explícitamente.
- Responde en español.
"@

function Get-GitTexto([string[]]$argumentos) {
	$lineas = & git -C $raiz @argumentos
	if ($LASTEXITCODE -ne 0) { throw "git $($argumentos -join ' ') falló" }
	return ($lineas -join "`n")
}

# Rutas que nunca se envían a Codex. .env.example se revisa aparte porque es el único archivo de
# entorno permitido.
$patronSensible = '(^|/)(insumos|storage)(/|$)|(^|/)\.env'
$esSensible = { param($ruta) $ruta.Replace('\', '/') -match $patronSensible -and $ruta -notmatch '(^|[/\\])\.env\.example$' }

# Con «powershell -File» una lista llega como un solo texto: se aceptan rutas separadas por comas.
$ArchivosContexto = @($ArchivosContexto | ForEach-Object { $_ -split ',' } |
		ForEach-Object { $_.Trim() } | Where-Object { $_ })

foreach ($ruta in $ArchivosContexto) {
	if (& $esSensible $ruta) { throw "Ruta de contexto no permitida: $ruta" }
}

$listaArchivos = if ($baseCompleta) {
	@('-c', 'core.quotepath=off', 'diff', '--name-only', $baseCompleta, $shaCompleto)
}
else {
	@('-c', 'core.quotepath=off', 'show', '--name-only', '--format=', $shaCompleto)
}
$archivosCommit = (Get-GitTexto $listaArchivos) -split "`n" | Where-Object { $_ }
$sensibles = @($archivosCommit | Where-Object { & $esSensible $_ })
if ($sensibles.Count -gt 0) {
	throw "El commit contiene rutas que no deben revisarse con Codex ($($sensibles -join ', ')). Retíralas del commit antes de revisar."
}

$partes = New-Object System.Collections.Generic.List[string]
$partes.Add($instrucciones)
foreach ($ruta in $ArchivosContexto) {
	$contenido = Get-GitTexto @('show', "${shaCompleto}:$ruta")
	$partes.Add("`n===== CONTEXTO: $ruta (versión del commit) =====`n$contenido")
}
if ($baseCompleta) {
	$commits = Get-GitTexto @('log', '--format=%h %s', "$baseCompleta..$shaCompleto")
	$diff = Get-GitTexto @('-c', 'core.quotepath=off', 'diff', '--no-ext-diff', '--unified=40',
		$baseCompleta, $shaCompleto, '--', '.', ':(exclude)package-lock.json')
	$partes.Add("`n===== COMMITS DEL RANGO =====`n$commits")
	$partes.Add("`n===== DIFF DEL RANGO $baseCompleta..$shaCompleto =====`n$diff")
}
else {
	$diff = Get-GitTexto @('-c', 'core.quotepath=off', 'show', '--format=fuller', '--no-ext-diff',
		'--unified=40', $shaCompleto, '--', '.', ':(exclude)package-lock.json')
	$partes.Add("`n===== DIFF DEL COMMIT $shaCompleto =====`n$diff")
}
[System.IO.File]::WriteAllText($archivoPrompt, ($partes -join "`n"), (New-Object System.Text.UTF8Encoding $false))

$codigo = 1
try {
	New-Item -ItemType Directory -Force $aislado | Out-Null
	git -C $aislado init -q

	# cmd redirige stdin, stdout y stderr a archivos para conservar la salida en UTF-8 sin envolverla.
	Push-Location $aislado
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
	if (Test-Path $aislado) {
		Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $aislado
	}
}
exit $codigo
