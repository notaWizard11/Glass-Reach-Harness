param([string]$CredentialPath,[switch]$SaveCredential)
$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
try {
  $inputData=[Console]::In.ReadToEnd() | ConvertFrom-Json
  if($SaveCredential) {
    $secure=ConvertTo-SecureString -String $inputData.token -AsPlainText -Force
    $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $CredentialPath -Encoding UTF8
    [Console]::Out.Write('{"ok":true}'); exit
  }
  $secret=Get-Content -LiteralPath $CredentialPath -Raw | ConvertTo-SecureString
  $headers=@{Authorization='Bearer '+[Net.NetworkCredential]::new('', $secret).Password}
  $uri='https://theglassreach.quest/op'+$(if($inputData.op){'/'+$inputData.op}else{''})
  $opts=@{Uri=$uri;Headers=$headers;TimeoutSec=40;MaximumRedirection=0}
  if($inputData.op) { $result=Invoke-RestMethod @opts -Method Post -ContentType 'application/json' -Body ($inputData.args | ConvertTo-Json -Depth 30 -Compress) }
  else { $result=Invoke-RestMethod @opts -Method Get }
  [Console]::Out.Write((ConvertTo-Json -InputObject $result -Depth 50 -Compress))
} catch {
  # Do not echo request headers, tokens or exception objects.
  [Console]::Out.Write('{"ok":false,"transportError":true,"reason":"The game request could not be confirmed. Refresh before retrying an action."}')
  exit 1
}
