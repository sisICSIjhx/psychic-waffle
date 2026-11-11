param([string]$Cli = 'supabase')

$ErrorActionPreference = 'Stop'
Get-Command $Cli -ErrorAction Stop | Out-Null
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
	$archivoEntorno = '.env.supabase.local'
	if (-not (Test-Path -LiteralPath $archivoEntorno)) {
		@'
const { createHmac, randomBytes } = require('node:crypto');
const { writeFileSync } = require('node:fs');
const secreto = randomBytes(32).toString('hex');
const codificar = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url');
function clave(rol) {
	const encabezado = codificar({ alg: 'HS256', typ: 'JWT' });
	const contenido = codificar({ role: rol, iss: 'reportes-icsi-local' });
	const mensaje = encabezado + '.' + contenido;
	return mensaje + '.' + createHmac('sha256', secreto).update(mensaje).digest('base64url');
}
writeFileSync('.env.supabase.local', [
	'PUBLIC_SUPABASE_URL=http://127.0.0.1:55321',
	'SUPABASE_SERVICE_ROLE_KEY=' + clave('service_role'),
	'REPORTES_ANON_KEY=' + clave('anon'),
	'REPORTES_POSTGRES_PASSWORD=' + randomBytes(24).toString('hex'),
	'REPORTES_JWT_SECRET=' + secreto,
	'STORAGE_DIR=./storage/supabase-local',
	''
].join('\n'), { flag: 'wx' });
'@ | node -
		if ($LASTEXITCODE -ne 0) { throw 'No se pudieron generar las claves locales.' }
	}

	$claveBd = node --env-file=$archivoEntorno -p 'process.env.REPORTES_POSTGRES_PASSWORD'
	if ($LASTEXITCODE -ne 0 -or $claveBd -notmatch '^[0-9a-f]{48}$') {
		throw 'Revisa la clave de la base de Reportes ICSI en .env.supabase.local.'
	}
	New-Item -ItemType Directory -Path 'storage/supabase-local' -Force | Out-Null
	docker compose --env-file $archivoEntorno -f supabase/compose.local.yml up -d --wait
	if ($LASTEXITCODE -ne 0) { throw 'No se pudieron iniciar los servicios de Reportes ICSI.' }

	$urlBd = 'postgresql://postgres:' + $claveBd + '@127.0.0.1:55322/postgres'
	& $Cli migration up --db-url $urlBd --yes
	if ($LASTEXITCODE -ne 0) { throw 'No se pudieron aplicar las migraciones locales.' }
} finally {
	Pop-Location
}
