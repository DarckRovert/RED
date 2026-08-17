$src = "d:\PROYECTO RED\client\app\out"
$dst = "d:\PROYECTO RED"

Write-Host "Copying web bundle from $src to $dst..."

# Copy files
Copy-Item -Force "$src\index.html" "$dst\index.html"
Copy-Item -Force "$src\404.html" "$dst\404.html"
Copy-Item -Force "$src\sw.js" "$dst\sw.js"
if (Test-Path "$src\index.txt") { Copy-Item -Force "$src\index.txt" "$dst\index.txt" }
if (Test-Path "$src\__next.__PAGE__.txt") { Copy-Item -Force "$src\__next.__PAGE__.txt" "$dst\__next.__PAGE__.txt" }
if (Test-Path "$src\__next._full.txt") { Copy-Item -Force "$src\__next._full.txt" "$dst\__next._full.txt" }
if (Test-Path "$src\__next._head.txt") { Copy-Item -Force "$src\__next._head.txt" "$dst\__next._head.txt" }
if (Test-Path "$src\__next._index.txt") { Copy-Item -Force "$src\__next._index.txt" "$dst\__next._index.txt" }
if (Test-Path "$src\__next._tree.txt") { Copy-Item -Force "$src\__next._tree.txt" "$dst\__next._tree.txt" }

# Copy directories
if (Test-Path "$dst\_next") { Remove-Item -Recurse -Force "$dst\_next" }
Copy-Item -Recurse -Force "$src\_next" "$dst\_next"

if (Test-Path "$src\404") {
    if (Test-Path "$dst\404") { Remove-Item -Recurse -Force "$dst\404" }
    Copy-Item -Recurse -Force "$src\404" "$dst\404"
}
if (Test-Path "$src\_not-found") {
    if (Test-Path "$dst\_not-found") { Remove-Item -Recurse -Force "$dst\_not-found" }
    Copy-Item -Recurse -Force "$src\_not-found" "$dst\_not-found"
}
if (Test-Path "$src\offline") {
    if (Test-Path "$dst\offline") { Remove-Item -Recurse -Force "$dst\offline" }
    Copy-Item -Recurse -Force "$src\offline" "$dst\offline"
}

Write-Host "Web sync completed successfully."
