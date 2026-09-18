package f.red.app;

import android.util.Log;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.SocketTimeoutException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * RedProxyServer — Servidor Proxy Local Soberano en Android
 *
 * Provee un proxy HTTP/HTTPS multi-hilo real en 127.0.0.1:8088.
 * Permite que el sistema Android (vía APN o proxy Wi-Fi) o navegadores locales
 * deriven tráfico a través de la infraestructura soberana de RED.
 *
 * Características:
 *  - Soporte para túnel HTTPS vía CONNECT (RFC 7231).
 *  - Soporte para proxy HTTP directo (GET, POST, HEAD, PUT, DELETE).
 *  - Telemetría de contabilidad precisa (bytes subidos, bajados, conexiones activas).
 *  - Aislamiento seguro en loopback local (127.0.0.1).
 */
public class RedProxyServer {

    private static final String TAG = "RedProxyServer";
    private static RedProxyServer instance;

    private ServerSocket serverSocket;
    private Thread serverThread;
    private ExecutorService workerPool;
    private final AtomicBoolean isRunning = new AtomicBoolean(false);
    private int boundPort = 8088;

    // Métricas en tiempo real
    private final AtomicLong bytesUploaded = new AtomicLong(0);
    private final AtomicLong bytesDownloaded = new AtomicLong(0);
    private final AtomicInteger activeConnections = new AtomicInteger(0);
    private final AtomicLong totalRequests = new AtomicLong(0);

    // Rastreo de sockets activos para cierre limpio
    private final ConcurrentHashMap<Long, Socket> activeSockets = new ConcurrentHashMap<>();
    private final AtomicLong connectionIdGen = new AtomicLong(0);

    public static synchronized RedProxyServer getInstance() {
        if (instance == null) {
            instance = new RedProxyServer();
        }
        return instance;
    }

    private RedProxyServer() {}

    public synchronized boolean start(int port) {
        if (isRunning.get()) {
            if (this.boundPort == port) {
                Log.i(TAG, "Proxy ya en ejecución en puerto " + port);
                return true;
            }
            stop();
        }

        this.boundPort = port;
        try {
            // Enlazar estrictamente a 127.0.0.1 para seguridad local
            serverSocket = new ServerSocket(boundPort, 50, InetAddress.getByName("127.0.0.1"));
            isRunning.set(true);
            workerPool = Executors.newCachedThreadPool();

            serverThread = new Thread(() -> {
                Log.i(TAG, "⚡ RedProxyServer INICIADO y LISTO en 127.0.0.1:" + boundPort);
                while (isRunning.get() && !serverSocket.isClosed()) {
                    try {
                        Socket clientSocket = serverSocket.accept();
                        clientSocket.setSoTimeout(30000); // 30 segundos timeout
                        activeConnections.incrementAndGet();
                        totalRequests.incrementAndGet();

                        long connId = connectionIdGen.incrementAndGet();
                        activeSockets.put(connId, clientSocket);

                        workerPool.submit(() -> {
                            try {
                                handleClient(clientSocket);
                            } catch (Exception e) {
                                Log.d(TAG, "Error procesando conexión proxy #" + connId + ": " + e.getMessage());
                            } finally {
                                activeSockets.remove(connId);
                                activeConnections.decrementAndGet();
                                closeQuietly(clientSocket);
                            }
                        });
                    } catch (Exception e) {
                        if (!isRunning.get()) break;
                        Log.w(TAG, "Excepción en accept de proxy: " + e.getMessage());
                    }
                }
            }, "RedProxy-Listener");

            serverThread.setDaemon(true);
            serverThread.start();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Fallo al iniciar RedProxyServer en puerto " + port + ": " + e.getMessage(), e);
            isRunning.set(false);
            return false;
        }
    }

    public synchronized void stop() {
        if (!isRunning.get()) return;
        isRunning.set(false);
        Log.i(TAG, "Deteniendo RedProxyServer...");

        try {
            if (serverSocket != null && !serverSocket.isClosed()) {
                serverSocket.close();
            }
        } catch (Exception ignored) {}

        // Cerrar todas las conexiones activas
        for (Socket s : activeSockets.values()) {
            closeQuietly(s);
        }
        activeSockets.clear();

        if (workerPool != null) {
            workerPool.shutdownNow();
            workerPool = null;
        }

        if (serverThread != null) {
            serverThread.interrupt();
            serverThread = null;
        }

        activeConnections.set(0);
        Log.i(TAG, "RedProxyServer detenido limpiamente.");
    }

    public boolean isRunning() {
        return isRunning.get();
    }

    public int getBoundPort() {
        return boundPort;
    }

    public long getBytesUploaded() {
        return bytesUploaded.get();
    }

    public long getBytesDownloaded() {
        return bytesDownloaded.get();
    }

    public int getActiveConnections() {
        return activeConnections.get();
    }

    public long getTotalRequests() {
        return totalRequests.get();
    }

    private void handleClient(Socket clientSocket) throws Exception {
        InputStream clientIn = new BufferedInputStream(clientSocket.getInputStream());
        OutputStream clientOut = new BufferedOutputStream(clientSocket.getOutputStream());

        // 1. Leer primera línea HTTP
        String initialLine = readLine(clientIn);
        if (initialLine == null || initialLine.trim().isEmpty()) {
            return;
        }

        String[] parts = initialLine.split("\\s+");
        if (parts.length < 2) return;

        String method = parts[0].toUpperCase();
        String target = parts[1];

        if ("CONNECT".equals(method)) {
            // Manejo de HTTPS CONNECT (Túnel TCP)
            handleConnectTunnel(clientIn, clientOut, target, clientSocket);
        } else {
            // Manejo de petición HTTP estándar
            handleHttpRequest(clientIn, clientOut, initialLine);
        }
    }

    /**
     * Túnel HTTPS CONNECT (RFC 7231)
     */
    private void handleConnectTunnel(InputStream clientIn, OutputStream clientOut, String target, Socket clientSocket) {
        String host = target;
        int port = 443;

        int colonIdx = target.indexOf(':');
        if (colonIdx != -1) {
            host = target.substring(0, colonIdx);
            try {
                port = Integer.parseInt(target.substring(colonIdx + 1));
            } catch (Exception ignored) {}
        }

        // Drenar cabeceras adicionales del CONNECT hasta línea vacía
        try {
            while (true) {
                String line = readLine(clientIn);
                if (line == null || line.trim().isEmpty()) break;
            }
        } catch (Exception ignored) {}

        Socket remoteSocket = null;
        try {
            remoteSocket = new Socket(host, port);
            remoteSocket.setSoTimeout(30000);

            // Responder 200 Connection Established al cliente
            byte[] okResponse = "HTTP/1.1 200 Connection Established\r\nProxy-Agent: RED-Sovereign-Proxy/1.0\r\n\r\n".getBytes();
            clientOut.write(okResponse);
            clientOut.flush();
            bytesDownloaded.addAndGet(okResponse.length);

            // Iniciar retransmisión bidireccional asimétrica
            InputStream remoteIn = new BufferedInputStream(remoteSocket.getInputStream());
            OutputStream remoteOut = new BufferedOutputStream(remoteSocket.getOutputStream());

            Socket finalRemote = remoteSocket;
            Thread clientToRemote = new Thread(() -> {
                pipeStream(clientIn, remoteOut, bytesUploaded);
                closeQuietly(finalRemote);
            }, "ProxyPipe-ClientToRemote");

            Thread remoteToClient = new Thread(() -> {
                pipeStream(remoteIn, clientOut, bytesDownloaded);
                closeQuietly(clientSocket);
            }, "ProxyPipe-RemoteToClient");

            clientToRemote.start();
            remoteToClient.start();

            try { clientToRemote.join(); } catch (InterruptedException ignored) {}
            try { remoteToClient.join(); } catch (InterruptedException ignored) {}

        } catch (Exception e) {
            try {
                byte[] err = ("HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\n\r\nRED Proxy Error: " + e.getMessage()).getBytes();
                clientOut.write(err);
                clientOut.flush();
            } catch (Exception ignored) {}
        } finally {
            closeQuietly(remoteSocket);
        }
    }

    /**
     * Petición HTTP directa (GET, POST, HEAD, PUT, DELETE)
     */
    private void handleHttpRequest(InputStream clientIn, OutputStream clientOut, String initialLine) {
        String[] parts = initialLine.split("\\s+");
        String method = parts[0];
        String uri = parts[1];
        String protocol = parts.length > 2 ? parts[2] : "HTTP/1.1";

        String host = "";
        int port = 80;
        String path = "/";

        if (uri.startsWith("http://")) {
            String withoutScheme = uri.substring(7);
            int slashIdx = withoutScheme.indexOf('/');
            if (slashIdx != -1) {
                host = withoutScheme.substring(0, slashIdx);
                path = withoutScheme.substring(slashIdx);
            } else {
                host = withoutScheme;
            }
            int colonIdx = host.indexOf(':');
            if (colonIdx != -1) {
                try {
                    port = Integer.parseInt(host.substring(colonIdx + 1));
                } catch (Exception ignored) {}
                host = host.substring(0, colonIdx);
            }
        } else {
            path = uri;
        }

        // Leer cabeceras entrantes antes de conectar para resolver Host y Content-Length
        List<String> headers = new ArrayList<>();
        int contentLength = 0;
        try {
            while (true) {
                String line = readLine(clientIn);
                if (line == null || line.trim().isEmpty()) break;
                headers.add(line);

                String lower = line.toLowerCase();
                if (host.isEmpty() && lower.startsWith("host:")) {
                    String hVal = line.substring(5).trim();
                    int cIdx = hVal.indexOf(':');
                    if (cIdx != -1) {
                        host = hVal.substring(0, cIdx);
                        try {
                            port = Integer.parseInt(hVal.substring(cIdx + 1));
                        } catch (Exception ignored) {}
                    } else {
                        host = hVal;
                    }
                } else if (lower.startsWith("content-length:")) {
                    try {
                        contentLength = Integer.parseInt(line.substring(15).trim());
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error leyendo cabeceras HTTP: " + e.getMessage());
            return;
        }

        if (host.isEmpty()) {
            try {
                byte[] err = "HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\n\r\nMissing Host header".getBytes();
                clientOut.write(err);
                clientOut.flush();
            } catch (Exception ignored) {}
            return;
        }

        Socket remoteSocket = null;
        try {
            remoteSocket = new Socket(host, port);
            remoteSocket.setSoTimeout(25000);

            OutputStream remoteOut = new BufferedOutputStream(remoteSocket.getOutputStream());
            InputStream remoteIn = new BufferedInputStream(remoteSocket.getInputStream());

            // Escribir primera línea reescrita
            String newFirstLine = method + " " + path + " " + protocol + "\r\n";
            remoteOut.write(newFirstLine.getBytes());
            bytesUploaded.addAndGet(newFirstLine.length());

            // Escribir cabeceras filtrando cabeceras hop-by-hop
            for (String h : headers) {
                if (h.toLowerCase().startsWith("proxy-connection:")) {
                    continue;
                }
                remoteOut.write((h + "\r\n").getBytes());
                bytesUploaded.addAndGet(h.length() + 2);
            }
            remoteOut.write("\r\n".getBytes());
            bytesUploaded.addAndGet(2);

            // Reenviar cuerpo de petición si existe (POST/PUT)
            if (contentLength > 0) {
                byte[] pBuf = new byte[8192];
                int remaining = contentLength;
                while (remaining > 0) {
                    int toRead = Math.min(pBuf.length, remaining);
                    int r = clientIn.read(pBuf, 0, toRead);
                    if (r == -1) break;
                    remoteOut.write(pBuf, 0, r);
                    bytesUploaded.addAndGet(r);
                    remaining -= r;
                }
            }
            remoteOut.flush();

            // Retransmitir respuesta remota hacia el cliente
            byte[] buf = new byte[8192];
            int read;
            while ((read = remoteIn.read(buf)) != -1) {
                clientOut.write(buf, 0, read);
                bytesDownloaded.addAndGet(read);
            }
            clientOut.flush();

        } catch (Exception e) {
            try {
                byte[] err = ("HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\n\r\nRED Proxy Gateway Error: " + e.getMessage()).getBytes();
                clientOut.write(err);
                clientOut.flush();
            } catch (Exception ignored) {}
        } finally {
            closeQuietly(remoteSocket);
        }
    }

    private void pipeStream(InputStream in, OutputStream out, AtomicLong byteCounter) {
        byte[] buffer = new byte[8192];
        int read;
        try {
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                out.flush();
                byteCounter.addAndGet(read);
            }
        } catch (SocketTimeoutException ignored) {
        } catch (Exception ignored) {}
    }

    private String readLine(InputStream in) throws Exception {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        int b;
        while ((b = in.read()) != -1) {
            if (b == '\r') {
                continue;
            }
            if (b == '\n') {
                break;
            }
            baos.write(b);
            if (baos.size() > 65536) {
                throw new IOException("HTTP Header line exceeds maximum 64KB limit");
            }
        }
        if (baos.size() == 0 && b == -1) {
            return null;
        }
        return baos.toString("UTF-8");
    }

    private void closeQuietly(Socket socket) {
        if (socket != null && !socket.isClosed()) {
            try {
                socket.close();
            } catch (Exception ignored) {}
        }
    }
}
